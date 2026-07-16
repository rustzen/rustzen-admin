use std::{error::Error, sync::Arc};

use axum::{Json, Router, extract::State, routing::get};
use rustzen_ipc::{
    CONTRACT_VERSION, DelegationVerifier, ModuleDefinition, ModuleManifest, ModuleRouter,
};
use rustzen_storage::SqlitePool;

use crate::{config, features, infra};

type StartupResult<T> = Result<T, Box<dyn Error + Send + Sync>>;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    manifest: Arc<ModuleManifest>,
}

pub async fn run() -> StartupResult<()> {
    let pool = infra::db::connect().await?;
    features::tracking::spawn_retention(pool.clone());
    let app = build_router(pool, &config::CONFIG.ipc_token)?;
    let address = config::CONFIG.bind_address();
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!(%address, "Insights service started");
    axum::serve(listener, app).await?;
    Ok(())
}

pub fn build_router(pool: SqlitePool, ipc_token: &str) -> StartupResult<Router> {
    let definition = ModuleDefinition::from_toml(include_str!("../module.toml"))?;
    let module_id = definition.module.id.clone();
    let api_prefix = definition.module.api_prefix.clone();
    let verifier = DelegationVerifier::new(ipc_token)?;
    let module = ModuleRouter::<AppState>::new(module_id, verifier);
    let module = features::projects::register(module)?;
    let module = features::tracking::register(module)?;
    let module = features::overview::register(module)?;
    let module = features::query::register(module)?;
    let module = features::settings::register(module)?;
    let (module_routes, manifest) = module.build(&definition, env!("CARGO_PKG_VERSION"))?;
    let state = AppState { pool, manifest: Arc::new(manifest) };

    Ok(Router::new()
        .route("/health", get(health))
        .route("/internal/v1/manifest", get(runtime_manifest))
        .nest(&api_prefix, module_routes)
        .with_state(state))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "ok",
        "contractVersion": CONTRACT_VERSION,
        "releaseVersion": env!("CARGO_PKG_VERSION"),
    }))
}

async fn runtime_manifest(State(state): State<AppState>) -> Json<ModuleManifest> {
    Json((*state.manifest).clone())
}

#[cfg(test)]
mod tests {
    use axum::{
        body::{Body, to_bytes},
        http::{Method, Request, StatusCode, header},
    };
    use rustzen_ipc::{DelegatedAccess, DelegatedContext, DelegationSigner};
    use serde_json::{Value, json};
    use sqlx::sqlite::SqlitePoolOptions;
    use tower::ServiceExt;

    use crate::infra::db;

    use super::build_router;

    const SECRET: &str = "insights-test-secret";

    #[tokio::test]
    async fn manifest_and_success_responses_preserve_public_contract() {
        let pool = test_pool().await;
        let app = build_router(pool, SECRET).expect("router");

        let manifest_response = app
            .clone()
            .oneshot(Request::builder().uri("/internal/v1/manifest").body(Body::empty()).unwrap())
            .await
            .expect("manifest response");
        assert_eq!(manifest_response.status(), StatusCode::OK);
        let manifest = response_json(manifest_response).await;
        assert_eq!(manifest["module"], "insights");
        assert_eq!(manifest["apiPrefix"], "/api/insights");
        let routes = manifest["routes"].as_array().expect("routes");
        assert_eq!(routes.len(), 16);
        assert!(routes.iter().any(|route| {
            route["method"] == "GET"
                && route["path"] == "/tracker.js"
                && route["access"] == "public"
        }));
        assert!(routes.iter().any(|route| {
            route["method"] == "POST"
                && route["path"] == "/projects/{id}/rotate-key"
                && route["permission"] == "insights:project:manage"
        }));

        let tracker_response = app
            .clone()
            .oneshot(signed_request(
                Method::GET,
                "/api/insights/tracker.js",
                DelegatedAccess::Public,
                Body::empty(),
            ))
            .await
            .expect("tracker response");
        assert_eq!(tracker_response.status(), StatusCode::OK);
        assert_eq!(
            tracker_response.headers()[header::CONTENT_TYPE],
            "application/javascript; charset=utf-8"
        );
        let tracker = String::from_utf8(
            to_bytes(tracker_response.into_body(), usize::MAX)
                .await
                .expect("tracker body")
                .to_vec(),
        )
        .expect("tracker text");
        assert!(tracker.contains("window.fetch = async"));
        assert!(tracker.contains("XMLHttpRequest.prototype.send"));
        assert!(tracker.contains("userId: identifiedUserId"));

        let list_response = app
            .clone()
            .oneshot(signed_request(
                Method::GET,
                "/api/insights/projects",
                DelegatedAccess::protected("insights:project:view"),
                Body::empty(),
            ))
            .await
            .expect("list response");
        assert_eq!(list_response.status(), StatusCode::OK);
        assert_eq!(
            response_json(list_response).await,
            json!({ "code": 0, "message": "Success", "data": [] })
        );

        let create_response = app
            .clone()
            .oneshot(json_request(
                Method::POST,
                "/api/insights/projects",
                DelegatedAccess::protected("insights:project:manage"),
                json!({
                    "name": "Website",
                    "allowedOrigins": ["https://example.com/"]
                }),
            ))
            .await
            .expect("create response");
        assert_eq!(create_response.status(), StatusCode::OK);
        let created = response_json(create_response).await;
        assert_eq!(created["code"], 0);
        assert_eq!(created["message"], "Success");
        assert_eq!(created["data"]["name"], "Website");
        assert_eq!(created["data"]["allowedOrigins"], json!(["https://example.com"]));

        let project_key = created["data"]["projectKey"].as_str().expect("project key");
        let mut track_request = json_request(
            Method::POST,
            "/api/insights/track",
            DelegatedAccess::Public,
            json!({
                "eventType": "page_view",
                "visitorId": "visitor-1",
                "path": "/home"
            }),
        );
        track_request
            .headers_mut()
            .insert("x-rustzen-project-key", project_key.parse().expect("project key header"));
        track_request
            .headers_mut()
            .insert(header::ORIGIN, "https://example.com".parse().expect("origin header"));
        let track_response = app.oneshot(track_request).await.expect("track response");
        assert_eq!(track_response.status(), StatusCode::OK);
        assert_eq!(
            response_json(track_response).await,
            json!({ "code": 0, "message": "Success", "data": { "accepted": 1 } })
        );
    }

    #[tokio::test]
    async fn delegated_route_is_bound_to_full_method_and_path() {
        let app = build_router(test_pool().await, SECRET).expect("router");
        let response = app
            .oneshot(signed_request(
                Method::GET,
                "/api/insights/overview?projectId=project",
                DelegatedAccess::protected("insights:overview:view"),
                Body::empty(),
            ))
            .await
            .expect("response");
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn project_batch_query_rotation_and_archive_form_a_complete_analytics_loop() {
        let app = build_router(test_pool().await, SECRET).expect("router");
        let created = response_json(
            app.clone()
                .oneshot(json_request(
                    Method::POST,
                    "/api/insights/projects",
                    DelegatedAccess::protected("insights:project:manage"),
                    json!({ "name": "Loop", "allowedOrigins": ["https://loop.local"] }),
                ))
                .await
                .expect("create"),
        )
        .await;
        let id = created["data"]["id"].as_str().expect("id");
        let old_key = created["data"]["projectKey"].as_str().expect("key");
        let batch = json!([
            { "eventName": "page_view", "visitorId": "v1", "userId": "u1", "platform": "web", "pagePath": "/home", "durationMs": 10 },
            { "eventName": "api_request", "visitorId": "v1", "platform": "web", "apiPath": "/api/items", "apiMethod": "get", "statusCode": 500, "durationMs": 40, "isError": true },
            { "eventName": "purchase", "visitorId": "v2", "platform": "app", "properties": { "value": 9 } }
        ]);
        let tracked = track_request(&app, old_key, batch).await;
        assert_eq!(tracked.status(), StatusCode::OK);
        assert_eq!(response_json(tracked).await["data"]["accepted"], 3);

        for (path, capability) in [
            (format!("/api/insights/pages?projectId={id}"), "insights:page:view"),
            (format!("/api/insights/apis?projectId={id}"), "insights:api:view"),
            (format!("/api/insights/events?projectId={id}"), "insights:event:view"),
            (format!("/api/insights/users?projectId={id}"), "insights:user:view"),
        ] {
            let response = app
                .clone()
                .oneshot(signed_request(
                    Method::GET,
                    &path,
                    DelegatedAccess::protected(capability),
                    Body::empty(),
                ))
                .await
                .expect("query");
            assert_eq!(response.status(), StatusCode::OK, "{path}");
            assert!(response_json(response).await["data"]["total"].as_i64().is_some_and(|v| v > 0));
        }
        let api_stats = response_json(
            app.clone()
                .oneshot(signed_request(
                    Method::GET,
                    &format!("/api/insights/apis?projectId={id}"),
                    DelegatedAccess::protected("insights:api:view"),
                    Body::empty(),
                ))
                .await
                .expect("api stats"),
        )
        .await;
        assert_eq!(api_stats["data"]["data"][0]["p95DurationMs"], 40);

        let rotated = response_json(
            app.clone()
                .oneshot(signed_request(
                    Method::POST,
                    &format!("/api/insights/projects/{id}/rotate-key"),
                    DelegatedAccess::protected("insights:project:manage"),
                    Body::empty(),
                ))
                .await
                .expect("rotate"),
        )
        .await;
        let new_key = rotated["data"]["projectKey"].as_str().expect("new key");
        assert_eq!(
            track_request(&app, old_key, json!({ "eventName": "ping", "visitorId": "v1" }))
                .await
                .status(),
            StatusCode::UNAUTHORIZED
        );
        assert_eq!(
            track_request(&app, new_key, json!({ "eventName": "ping", "visitorId": "v1" }))
                .await
                .status(),
            StatusCode::OK
        );

        let archived = app
            .clone()
            .oneshot(signed_request(
                Method::DELETE,
                &format!("/api/insights/projects/{id}"),
                DelegatedAccess::protected("insights:project:manage"),
                Body::empty(),
            ))
            .await
            .expect("archive");
        assert_eq!(archived.status(), StatusCode::OK);
        assert_eq!(
            track_request(&app, new_key, json!({ "eventName": "ping", "visitorId": "v1" }))
                .await
                .status(),
            StatusCode::UNAUTHORIZED
        );

        let tracker = app
            .oneshot(signed_request(
                Method::GET,
                "/api/insights/tracker.js",
                DelegatedAccess::Public,
                Body::empty(),
            ))
            .await
            .expect("tracker");
        assert_eq!(tracker.status(), StatusCode::OK);
        assert_eq!(
            tracker.headers()[header::CONTENT_TYPE],
            "application/javascript; charset=utf-8"
        );
    }

    #[tokio::test]
    async fn typed_input_errors_preserve_the_existing_gateway_envelope_and_track_priority() {
        let app = build_router(test_pool().await, SECRET).expect("router");
        let project = app
            .clone()
            .oneshot(json_request(
                Method::POST,
                "/api/insights/projects",
                DelegatedAccess::protected("insights:project:manage"),
                json!({}),
            ))
            .await
            .expect("project rejection");
        assert_eq!(project.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let project = response_json(project).await;
        assert_eq!(project["code"], 40002);
        assert!(project["message"].as_str().is_some_and(|message| {
            message.starts_with("Failed to deserialize the JSON body into the target type:")
        }));

        let overview = app
            .clone()
            .oneshot(signed_request(
                Method::GET,
                "/api/insights/overview",
                DelegatedAccess::protected("insights:overview:view"),
                Body::empty(),
            ))
            .await
            .expect("query rejection");
        assert_eq!(overview.status(), StatusCode::BAD_REQUEST);
        assert_eq!(response_json(overview).await["code"], 40002);

        let missing_key = app
            .clone()
            .oneshot(json_request(
                Method::POST,
                "/api/insights/track",
                DelegatedAccess::Public,
                json!([]),
            ))
            .await
            .expect("missing key rejection");
        assert_eq!(missing_key.status(), StatusCode::UNAUTHORIZED);
        assert_eq!(
            response_json(missing_key).await,
            json!({ "code": 40002, "message": "project key is required", "data": null })
        );

        let mut non_object =
            json_request(Method::POST, "/api/insights/track", DelegatedAccess::Public, json!([]));
        non_object
            .headers_mut()
            .insert("x-rustzen-project-key", "project-key".parse().expect("project key"));
        let non_object = app.oneshot(non_object).await.expect("non-object rejection");
        assert_eq!(non_object.status(), StatusCode::BAD_REQUEST);
        assert_eq!(
            response_json(non_object).await,
            json!({ "code": 40002, "message": "batch must contain 1 to 100 events", "data": null })
        );
    }

    async fn test_pool() -> sqlx::SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        db::migrate(&pool).await.expect("migrate");
        pool
    }

    async fn track_request(app: &axum::Router, key: &str, body: Value) -> axum::response::Response {
        let mut request =
            json_request(Method::POST, "/api/insights/track", DelegatedAccess::Public, body);
        request.headers_mut().insert("x-rustzen-project-key", key.parse().expect("key"));
        request.headers_mut().insert(header::ORIGIN, "https://loop.local".parse().unwrap());
        app.clone().oneshot(request).await.expect("track")
    }

    fn json_request(
        method: Method,
        uri: &str,
        access: DelegatedAccess,
        body: Value,
    ) -> Request<Body> {
        let mut request = signed_request(method, uri, access, Body::from(body.to_string()));
        request
            .headers_mut()
            .insert(header::CONTENT_TYPE, "application/json".parse().expect("content type"));
        request
    }

    fn signed_request(
        method: Method,
        uri: &str,
        access: DelegatedAccess,
        body: Body,
    ) -> Request<Body> {
        let path = uri.split('?').next().expect("path");
        let user_id = matches!(access, DelegatedAccess::Protected(_)).then_some(7);
        let context = DelegatedContext::new(
            "insights-test-request",
            user_id,
            "insights",
            method.clone(),
            path,
            access,
        )
        .expect("context");
        let headers = DelegationSigner::new(SECRET).unwrap().sign(&context).unwrap();
        let mut request = Request::builder().method(method).uri(uri).body(body).unwrap();
        for (name, value) in headers {
            if let Some(name) = name {
                request.headers_mut().insert(name, value);
            }
        }
        request
    }

    async fn response_json(response: axum::response::Response) -> Value {
        let body = to_bytes(response.into_body(), 1024 * 1024).await.expect("response body");
        serde_json::from_slice(&body).expect("JSON response")
    }
}
