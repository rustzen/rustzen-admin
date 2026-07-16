mod handler;
mod repo;
mod service;
mod types;

use rustzen_ipc::{ManifestError, ModuleRouter};

use crate::app::AppState;

pub fn register(router: ModuleRouter<AppState>) -> Result<ModuleRouter<AppState>, ManifestError> {
    router.post_public("/track", handler::track)
}

pub use service::spawn_retention;
