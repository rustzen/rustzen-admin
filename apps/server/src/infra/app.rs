use crate::{
    common::api::{ApiResponse, AppResult},
    features::{
        account::account_routes,
        auth::{protected_auth_routes, public_auth_routes},
        dashboard::dashboard_routes,
        insights,
        manage::{deploy::service::DeployService, manage_routes, task::service::TaskService},
        monitor::monitor_routes,
        reports::reports_routes,
        system::system_routes,
    },
    infra::{
        auth_runtime::{ServerAuthContextLoader, jwt_codec},
        config::CONFIG,
        db::{create_default_pool, run_migrations, run_startup_data_migrations, test_connection},
        permission::PermissionService,
    },
    middleware::log::log_middleware,
};

use axum::{
    Extension, Router,
    http::{
        HeaderValue, Method,
        header::{ACCEPT, AUTHORIZATION, CONTENT_TYPE},
    },
    middleware,
    routing::get,
};
use rustzen_auth::auth::auth_middleware;
use serde_json::json;
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, services::ServeDir};

#[tracing::instrument(name = "run_server")]
pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("Initializing database connection pool...");
    let pool = create_default_pool().await?;
    run_migrations(&pool).await?;
    run_startup_data_migrations(&pool).await?;
    test_connection(&pool).await?;
    let task_service = std::sync::Arc::new(TaskService::new(pool.clone())?);
    task_service.bootstrap().await?;
    let deploy_service = std::sync::Arc::new(DeployService::new(pool.clone()));

    let cors = CorsLayer::new()
        .allow_origin(HeaderValue::from_static("*"))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
        .allow_headers([
            CONTENT_TYPE,
            AUTHORIZATION,
            ACCEPT,
            axum::http::HeaderName::from_static("x-rustzen-project-key"),
        ]);

    let protected_api = Router::new()
        .nest("/account", account_routes())
        .nest("/auth", protected_auth_routes())
        .nest("/dashboard", dashboard_routes())
        .nest("/insights", insights::protected_routes())
        .nest("/manage", manage_routes())
        .nest("/monitor", monitor_routes())
        .nest("/reports", reports_routes())
        .nest("/system", system_routes())
        .layer(Extension(task_service))
        .layer(Extension(deploy_service))
        .route_layer(middleware::from_fn_with_state(pool.clone(), log_middleware))
        .route_layer(middleware::from_fn_with_state(
            (jwt_codec(), ServerAuthContextLoader::new(pool.clone())),
            auth_middleware,
        ));

    let public_api = Router::new()
        .nest("/auth", public_auth_routes())
        .nest("/insights", insights::public_routes());

    PermissionService::sync_permissions(&pool).await?;

    let uploads_prefix = CONFIG.files_prefix.clone();
    let avatars_prefix = CONFIG.avatars_prefix();
    let uploads_service =
        ServeDir::new(CONFIG.uploads_dir()).append_index_html_on_directories(true);
    let avatars_service =
        ServeDir::new(CONFIG.avatars_dir()).append_index_html_on_directories(true);
    tracing::info!("Serving frontend assets embedded in rz");

    let app = Router::new()
        .route("/api/summary", get(summary))
        .nest("/api", public_api.merge(protected_api))
        .nest_service(&avatars_prefix, avatars_service)
        .nest_service(&uploads_prefix, uploads_service)
        .layer(cors)
        .with_state(pool)
        .fallback(crate::infra::web::serve)
        .into_make_service_with_connect_info::<SocketAddr>();

    let addr = server_addr();
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server started successfully, listening on http://{}", addr);

    axum::serve(listener, app).await?;

    Ok(())
}

fn server_addr() -> String {
    format!("{}:{}", CONFIG.app_host, CONFIG.app_port)
}

async fn summary() -> AppResult<serde_json::Value> {
    Ok(ApiResponse::success(json!({
        "message": "Welcome to rustzen-admin API",
        "description": "A backend management system built with Rust, Axum, SQLx, and SQLite.",
        "github": "https://github.com/rustzen/rustzen-admin"
    })))
}
