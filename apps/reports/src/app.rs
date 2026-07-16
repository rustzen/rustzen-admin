use std::{path::PathBuf, sync::Arc};

use axum::{Json, Router, routing::get};
use rustzen_ipc::{DelegationVerifier, ModuleDefinition, ModuleRouter};
use rustzen_storage::SqlitePool;
use serde_json::json;

use crate::{config, features::automation, infra::db};

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub cipher: automation::CredentialCipher,
    pub output_dir: PathBuf,
    pub browser_path: Option<String>,
    pub headless: bool,
    pub max_concurrency: usize,
}

impl AppState {
    fn new(pool: SqlitePool, output_dir: PathBuf) -> Self {
        Self {
            pool,
            cipher: automation::CredentialCipher::new(config::CONFIG.credential_key()),
            output_dir,
            browser_path: config::CONFIG.browser_path().map(str::to_string),
            headless: config::CONFIG.reports_headless,
            max_concurrency: config::CONFIG.reports_max_concurrency,
        }
    }
}

pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let pool = db::create_pool().await?;
    db::run_migrations(&pool).await?;
    db::test_connection(&pool).await?;
    let output_dir = config::CONFIG.data_dir().join("automation");
    tokio::fs::create_dir_all(&output_dir).await?;
    let state = AppState::new(pool, output_dir);
    automation::initialize(&state).await?;
    let app = build_router(state.clone(), &config::CONFIG.ipc_token)?;
    automation::spawn(state);
    let address = config::CONFIG.bind_address();
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!(%address,"Automation service started");
    axum::serve(listener, app).await?;
    Ok(())
}

fn build_router(state: AppState, ipc_token: &str) -> Result<Router, rustzen_ipc::ManifestError> {
    let verifier = DelegationVerifier::new(ipc_token).map_err(rustzen_ipc::ManifestError::from)?;
    let definition = ModuleDefinition::from_toml(include_str!("../module.toml"))?;
    let api_prefix = definition.module.api_prefix.clone();
    let module = ModuleRouter::<AppState>::new(definition.module.id.clone(), verifier);
    let module = automation::routes(module)?;
    let (module_routes, manifest) = module.build(&definition, env!("CARGO_PKG_VERSION"))?;
    let manifest = Arc::new(manifest);
    Ok(Router::new()
        .route("/health", get(health))
        .route(
            "/internal/v1/manifest",
            get(move || {
                let manifest = Arc::clone(&manifest);
                async move { Json(manifest.as_ref().clone()) }
            }),
        )
        .nest(&api_prefix, module_routes)
        .with_state(state))
}

async fn health() -> Json<serde_json::Value> {
    Json(
        json!({"status":"ok","contractVersion":rustzen_ipc::CONTRACT_VERSION,"releaseVersion":env!("CARGO_PKG_VERSION")}),
    )
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

    use super::{AppState, build_router};
    use crate::{features::automation::CredentialCipher, infra::db::MIGRATOR};

    async fn test_app() -> (axum::Router, AppState) {
        let pool =
            SqlitePoolOptions::new().max_connections(1).connect("sqlite::memory:").await.unwrap();
        MIGRATOR.run(&pool).await.unwrap();
        let output_dir =
            std::env::temp_dir().join(format!("rz-automation-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&output_dir).await.unwrap();
        let state = AppState {
            pool,
            cipher: CredentialCipher::new("test-credential-key"),
            output_dir,
            browser_path: None,
            headless: true,
            max_concurrency: 1,
        };
        (build_router(state.clone(), "test-secret").unwrap(), state)
    }
    fn request(method: Method, uri: &str, capability: &str, body: Value) -> Request<Body> {
        let path = uri.split('?').next().unwrap();
        let context = DelegatedContext::new(
            "request-1",
            Some(7),
            "reports",
            method.clone(),
            path,
            DelegatedAccess::protected(capability),
        )
        .unwrap();
        let headers = DelegationSigner::new("test-secret").unwrap().sign(&context).unwrap();
        let mut request = Request::builder().method(method).uri(uri);
        for (name, value) in &headers {
            request = request.header(name, value);
        }
        request
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body.to_string()))
            .unwrap()
    }
    async fn body(response: axum::response::Response) -> Value {
        serde_json::from_slice(&to_bytes(response.into_body(), usize::MAX).await.unwrap()).unwrap()
    }

    #[tokio::test]
    async fn manifest_exposes_only_the_automation_contract() {
        let (app, state) = test_app().await;
        let response = app
            .oneshot(Request::builder().uri("/internal/v1/manifest").body(Body::empty()).unwrap())
            .await
            .unwrap();
        let manifest = body(response).await;
        assert_eq!(manifest["module"], "reports");
        assert_eq!(manifest["routes"].as_array().unwrap().len(), 25);
        assert!(
            manifest["routes"].as_array().unwrap().iter().all(|route| !route["path"]
                .as_str()
                .unwrap()
                .contains("templates")
                && !route["path"].as_str().unwrap().contains("jobs"))
        );
        tokio::fs::remove_dir_all(state.output_dir).await.unwrap();
    }

    #[tokio::test]
    async fn system_account_flow_and_run_are_typed_and_secrets_stay_encrypted() {
        let (app, state) = test_app().await;
        let system = body(
            app.clone()
                .oneshot(request(
                    Method::POST,
                    "/api/reports/systems",
                    "reports:system:manage",
                    json!({"name":"Fixture","baseUrl":"https://fixture.local","enabled":true}),
                ))
                .await
                .unwrap(),
        )
        .await;
        let system_id = system["data"]["id"].as_str().unwrap();
        let account_response=app.clone().oneshot(request(Method::POST,"/api/reports/accounts","reports:system:manage",json!({"systemId":system_id,"name":"Default","username":"operator","secret":"do-not-leak"}))).await.unwrap();
        assert_eq!(account_response.status(), StatusCode::OK);
        let account = body(account_response).await;
        assert!(account["data"].get("secret").is_none());
        let account_id = account["data"]["id"].as_str().unwrap();
        let stored: String =
            sqlx::query_scalar("SELECT secret_ciphertext FROM automation_accounts WHERE id=?")
                .bind(account_id)
                .fetch_one(&state.pool)
                .await
                .unwrap();
        assert!(!stored.contains("do-not-leak"));
        let flow=body(app.clone().oneshot(request(Method::POST,"/api/reports/flows","reports:flow:manage",json!({"systemId":system_id,"name":"Login","steps":[{"action":"goto","url":"/login"},{"action":"fill","selector":"#password","value":"{{account.password}}"}]}))).await.unwrap()).await;
        let flow_id = flow["data"]["id"].as_str().unwrap();
        let run = app
            .clone()
            .oneshot(request(
                Method::POST,
                "/api/reports/runs",
                "reports:run:manage",
                json!({"flowId":flow_id,"accountId":account_id,"input":{}}),
            ))
            .await
            .unwrap();
        assert_eq!(run.status(), StatusCode::OK);
        assert_eq!(body(run).await["data"]["status"], "queued");

        let other_system = body(
            app.clone()
                .oneshot(request(
                    Method::POST,
                    "/api/reports/systems",
                    "reports:system:manage",
                    json!({"name":"Other","baseUrl":"https://other.local"}),
                ))
                .await
                .unwrap(),
        )
        .await;
        let other_account = body(
            app.clone()
                .oneshot(request(
                    Method::POST,
                    "/api/reports/accounts",
                    "reports:system:manage",
                    json!({
                        "systemId": other_system["data"]["id"],
                        "name":"Other",
                        "username":"operator",
                        "secret":"other-secret"
                    }),
                ))
                .await
                .unwrap(),
        )
        .await;
        let other_account_id = other_account["data"]["id"].as_str().unwrap();
        let mismatched_run = app
            .clone()
            .oneshot(request(
                Method::POST,
                "/api/reports/runs",
                "reports:run:manage",
                json!({"flowId":flow_id,"accountId":other_account_id,"input":{}}),
            ))
            .await
            .unwrap();
        assert_eq!(mismatched_run.status(), StatusCode::BAD_REQUEST);
        let mismatched_schedule = app
            .oneshot(request(
                Method::POST,
                "/api/reports/schedules",
                "reports:schedule:manage",
                json!({
                    "name":"Invalid",
                    "flowId":flow_id,
                    "accountId":other_account_id,
                    "cron":"0 0 * * *",
                    "input":{}
                }),
            ))
            .await
            .unwrap();
        assert_eq!(mismatched_schedule.status(), StatusCode::BAD_REQUEST);
        tokio::fs::remove_dir_all(state.output_dir).await.unwrap();
    }

    #[tokio::test]
    async fn flow_rejects_cross_origin_navigation() {
        let (app, state) = test_app().await;
        let system = body(
            app.clone()
                .oneshot(request(
                    Method::POST,
                    "/api/reports/systems",
                    "reports:system:manage",
                    json!({"name":"Fixture","baseUrl":"https://fixture.local"}),
                ))
                .await
                .unwrap(),
        )
        .await;
        let id = system["data"]["id"].as_str().unwrap();
        let response=app.oneshot(request(Method::POST,"/api/reports/flows","reports:flow:manage",json!({"systemId":id,"name":"Unsafe","steps":[{"action":"goto","url":"https://other.local"}]}))).await.unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        tokio::fs::remove_dir_all(state.output_dir).await.unwrap();
    }
}
