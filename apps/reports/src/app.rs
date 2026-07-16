use std::{path::PathBuf, sync::Arc};

use axum::{Json, Router, routing::get};
use rustzen_ipc::{DelegationVerifier, ModuleDefinition, ModuleRouter};
use serde_json::json;
use sqlx::SqlitePool;

use crate::{
    config,
    features::{
        files::{self, FilesService},
        jobs::{self, JobsService},
        templates::{self, TemplatesService},
    },
    infra::db,
};

#[derive(Clone)]
pub struct AppState {
    pub templates: TemplatesService,
    pub jobs: JobsService,
    pub files: FilesService,
}

impl AppState {
    fn new(pool: SqlitePool, output_dir: PathBuf) -> Self {
        let templates = TemplatesService::new(pool.clone());
        let files = FilesService::new(pool.clone(), output_dir);
        let jobs = JobsService::new(pool, templates.clone(), files.clone());
        Self { templates, jobs, files }
    }
}

pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    let app = build_app().await?;
    let address = config::CONFIG.bind_address();
    let listener = tokio::net::TcpListener::bind(&address).await?;
    tracing::info!(%address, "Reports service started");
    axum::serve(listener, app).await?;
    Ok(())
}

async fn build_app() -> Result<Router, Box<dyn std::error::Error>> {
    let pool = db::create_pool().await?;
    db::run_migrations(&pool).await?;
    db::test_connection(&pool).await?;
    let output_dir = config::CONFIG.data_dir().join("reports");
    tokio::fs::create_dir_all(&output_dir).await?;
    let state = AppState::new(pool, output_dir);
    let recovered = state.jobs.recover_interrupted().await?;
    if recovered > 0 {
        tracing::warn!(recovered, "Recovered interrupted report jobs");
    }
    state.files.spawn_retention();
    build_router(state, &config::CONFIG.ipc_token).map_err(Into::into)
}

fn build_router(state: AppState, ipc_token: &str) -> Result<Router, rustzen_ipc::ManifestError> {
    let verifier = DelegationVerifier::new(ipc_token).map_err(rustzen_ipc::ManifestError::from)?;
    let definition = ModuleDefinition::from_toml(include_str!("../module.toml"))?;
    let module_id = definition.module.id.clone();
    let api_prefix = definition.module.api_prefix.clone();
    let module = ModuleRouter::<AppState>::new(module_id, verifier);
    let module = templates::routes(module)?;
    let module = jobs::routes(module)?;
    let module = files::routes(module)?;
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
    Json(json!({
        "status": "ok",
        "contractVersion": rustzen_ipc::CONTRACT_VERSION,
        "releaseVersion": env!("CARGO_PKG_VERSION"),
    }))
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use axum::{
        body::{Body, to_bytes},
        http::{Method, Request, StatusCode, header},
    };
    use rustzen_ipc::{DelegatedAccess, DelegatedContext, DelegationSigner};
    use serde_json::{Value, json};
    use sqlx::sqlite::SqlitePoolOptions;
    use tower::ServiceExt;

    use crate::infra::db::MIGRATOR;

    use super::{AppState, build_router};

    async fn test_app() -> (axum::Router, PathBuf) {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("connect");
        MIGRATOR.run(&pool).await.expect("migrate");
        let output_dir = std::env::temp_dir().join(format!("rz-reports-{}", uuid::Uuid::new_v4()));
        tokio::fs::create_dir_all(&output_dir).await.expect("create output dir");
        let state = AppState::new(pool, output_dir.clone());
        (build_router(state, "test-secret").expect("build router"), output_dir)
    }

    fn signed_request(method: Method, uri: &str, capability: &str, body: Value) -> Request<Body> {
        let context = DelegatedContext::new(
            "request-1",
            Some(7),
            "reports",
            method.clone(),
            uri,
            DelegatedAccess::protected(capability),
        )
        .expect("context");
        let headers =
            DelegationSigner::new("test-secret").expect("signer").sign(&context).expect("sign");
        let mut request = Request::builder().method(method).uri(uri);
        for (name, value) in &headers {
            request = request.header(name, value);
        }
        request
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(serde_json::to_vec(&body).expect("serialize body")))
            .expect("request")
    }

    async fn json_body(response: axum::response::Response) -> Value {
        serde_json::from_slice(
            &to_bytes(response.into_body(), usize::MAX).await.expect("read response"),
        )
        .expect("json response")
    }

    #[tokio::test]
    async fn manifest_and_success_envelope_match_the_module_contract() {
        let (app, output_dir) = test_app().await;
        let manifest_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/internal/v1/manifest")
                    .body(Body::empty())
                    .expect("manifest request"),
            )
            .await
            .expect("manifest response");
        assert_eq!(manifest_response.status(), StatusCode::OK);
        let manifest: rustzen_ipc::ModuleManifest =
            serde_json::from_value(json_body(manifest_response).await).expect("manifest");
        assert_eq!(manifest.module, "reports");
        assert_eq!(manifest.api_prefix, "/api/reports");
        assert_eq!(manifest.routes.len(), 6);

        let response = app
            .oneshot(signed_request(
                Method::GET,
                "/api/reports/templates",
                "reports:view",
                Value::Null,
            ))
            .await
            .expect("templates response");
        assert_eq!(response.status(), StatusCode::OK);
        let payload = json_body(response).await;
        assert_eq!(payload, json!({ "code": 0, "message": "Success", "data": [] }));
        tokio::fs::remove_dir_all(output_dir).await.expect("remove output dir");
    }

    #[tokio::test]
    async fn job_creation_is_http_200_and_download_streams_raw_content() {
        let (app, output_dir) = test_app().await;
        let template_response = app
            .clone()
            .oneshot(signed_request(
                Method::POST,
                "/api/reports/templates",
                "reports:manage",
                json!({
                    "id": "template",
                    "name": "Template",
                    "content": "<h1>{{name}}</h1>"
                }),
            ))
            .await
            .expect("template response");
        assert_eq!(template_response.status(), StatusCode::OK);

        let job_response = app
            .clone()
            .oneshot(signed_request(
                Method::POST,
                "/api/reports/jobs",
                "reports:manage",
                json!({ "templateId": "template", "data": { "name": "<RustZen>" } }),
            ))
            .await
            .expect("job response");
        assert_eq!(job_response.status(), StatusCode::OK);
        let job_payload = json_body(job_response).await;
        assert_eq!(job_payload["code"], 0);
        assert_eq!(job_payload["message"], "Success");
        let job_id = job_payload["data"]["id"].as_str().expect("job id");

        let download_uri = format!("/api/reports/jobs/{job_id}/download");
        let download = app
            .oneshot(signed_request(Method::GET, &download_uri, "reports:view", Value::Null))
            .await
            .expect("download response");
        assert_eq!(download.status(), StatusCode::OK);
        assert_eq!(
            download.headers().get(header::CONTENT_TYPE).and_then(|value| value.to_str().ok()),
            Some("text/html; charset=utf-8")
        );
        assert!(download.headers().contains_key(header::CONTENT_DISPOSITION));
        assert_eq!(
            to_bytes(download.into_body(), usize::MAX).await.expect("download body"),
            "<h1>&lt;RustZen&gt;</h1>"
        );
        tokio::fs::remove_dir_all(output_dir).await.expect("remove output dir");
    }

    #[tokio::test]
    async fn business_errors_preserve_the_existing_admin_proxy_envelope() {
        let (app, output_dir) = test_app().await;
        let invalid_job_shape = app
            .clone()
            .oneshot(signed_request(Method::POST, "/api/reports/jobs", "reports:manage", json!({})))
            .await
            .expect("invalid job shape response");
        assert_eq!(invalid_job_shape.status(), StatusCode::UNPROCESSABLE_ENTITY);
        let invalid_job_shape = json_body(invalid_job_shape).await;
        assert_eq!(invalid_job_shape["code"], 40002);
        assert!(invalid_job_shape["message"].as_str().is_some_and(|message| {
            message.starts_with("Failed to deserialize the JSON body into the target type:")
                && message.contains("templateId")
        }));

        let invalid_template = app
            .clone()
            .oneshot(signed_request(
                Method::POST,
                "/api/reports/templates",
                "reports:manage",
                json!({ "name": "", "content": "" }),
            ))
            .await
            .expect("invalid template response");
        assert_eq!(invalid_template.status(), StatusCode::BAD_REQUEST);
        assert_eq!(
            json_body(invalid_template).await,
            json!({
                "code": 40002,
                "message": "name and content are required",
                "data": null
            })
        );

        let missing_job = app
            .oneshot(signed_request(
                Method::GET,
                "/api/reports/jobs/missing",
                "reports:view",
                Value::Null,
            ))
            .await
            .expect("missing job response");
        assert_eq!(missing_job.status(), StatusCode::NOT_FOUND);
        assert_eq!(
            json_body(missing_job).await,
            json!({
                "code": 40002,
                "message": "report job not found",
                "data": null
            })
        );
        tokio::fs::remove_dir_all(output_dir).await.expect("remove output dir");
    }

    #[tokio::test]
    async fn direct_unsigned_module_request_is_rejected() {
        let (app, output_dir) = test_app().await;
        let response = app
            .oneshot(
                Request::builder().uri("/api/reports/jobs").body(Body::empty()).expect("request"),
            )
            .await
            .expect("response");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        tokio::fs::remove_dir_all(output_dir).await.expect("remove output dir");
    }
}
