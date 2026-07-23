use crate::{
    features::{
        account::account_routes,
        auth::{protected_auth_routes, public_auth_routes},
        dashboard::dashboard_routes,
        manage::{deploy::service::DeployService, manage_routes, task::service::TaskService},
        modules::{
            control_routes, gateway,
            service::{ModuleControlState, ModuleService},
        },
        system::system_routes,
    },
    infra::{
        auth_runtime::{ServerAuthContextLoader, jwt_codec},
        config::CONFIG,
        db::{create_default_pool, run_migrations, test_connection},
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
use rustzen_ipc::{DelegationSigner, HealthResponse};
use std::net::SocketAddr;
use tower_http::{cors::CorsLayer, services::ServeDir};

#[tracing::instrument(name = "run_server")]
pub async fn run_server() -> Result<(), Box<dyn std::error::Error>> {
    tracing::info!("Initializing database connection pool...");
    let pool = create_default_pool().await?;
    run_migrations(&pool).await?;
    test_connection(&pool).await?;
    let task_service = std::sync::Arc::new(TaskService::new(pool.clone())?);
    task_service.bootstrap().await?;
    let deploy_service = std::sync::Arc::new(DeployService::new(pool.clone()));
    deploy_service.bootstrap_installed_current().await?;
    let module_client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(1))
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()?;
    let module_state = ModuleControlState::initialize(
        pool.clone(),
        module_client,
        DelegationSigner::new(CONFIG.ipc_token.as_bytes())?,
    )
    .await?;

    let cors = CorsLayer::new()
        .allow_origin(HeaderValue::from_static("*"))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
        .allow_headers([
            CONTENT_TYPE,
            AUTHORIZATION,
            ACCEPT,
            axum::http::HeaderName::from_static("x-rustzen-project-key"),
            axum::http::HeaderName::from_static("x-rustzen-monitor-agent-token"),
        ]);

    let protected_api: Router = Router::new()
        .nest("/account", account_routes())
        .nest("/auth", protected_auth_routes())
        .nest("/dashboard", dashboard_routes())
        .nest("/manage", manage_routes())
        .nest("/system", system_routes())
        .layer(Extension(task_service))
        .layer(Extension(deploy_service))
        .route_layer(middleware::from_fn_with_state(pool.clone(), log_middleware))
        .route_layer(middleware::from_fn_with_state(
            (jwt_codec(), ServerAuthContextLoader::new()),
            auth_middleware,
        ))
        .with_state(pool.clone());

    let public_api: Router =
        Router::new().nest("/auth", public_auth_routes()).with_state(pool.clone());
    let module_control: Router = control_routes()
        .route_layer(middleware::from_fn_with_state(
            (jwt_codec(), ServerAuthContextLoader::new()),
            auth_middleware,
        ))
        .with_state(module_state.clone());
    let module_gateway: Router = gateway::routes().with_state(module_state.clone());

    PermissionService::sync_permissions(&pool).await?;

    let uploads_prefix = CONFIG.files_prefix().to_string();
    let avatars_prefix = CONFIG.avatars_prefix();
    let uploads_service =
        ServeDir::new(CONFIG.uploads_dir()).append_index_html_on_directories(true);
    let avatars_service =
        ServeDir::new(CONFIG.avatars_dir()).append_index_html_on_directories(true);
    tracing::info!("Serving frontend assets embedded in rz");

    let app = Router::new()
        .route("/health", get(health))
        .nest("/api", public_api.merge(protected_api))
        .merge(module_control)
        .merge(module_gateway)
        .nest_service(&avatars_prefix, avatars_service)
        .nest_service(&uploads_prefix, uploads_service)
        .layer(cors)
        .fallback(crate::infra::web::serve)
        .into_make_service_with_connect_info::<SocketAddr>();

    let addr = server_addr();
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("Server started successfully, listening on http://{}", addr);
    ModuleService::spawn_synchronizer(module_state);

    axum::serve(listener, app).await?;

    Ok(())
}

async fn health() -> axum::Json<HealthResponse> {
    axum::Json(HealthResponse::ok(env!("CARGO_PKG_VERSION")))
}

fn server_addr() -> String {
    format!("{}:{}", CONFIG.admin_host(), CONFIG.admin_port())
}
