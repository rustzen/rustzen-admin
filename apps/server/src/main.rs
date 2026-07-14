mod common;
mod features;
mod infra;
mod middleware;
mod workers;

use crate::features::manage::deploy::service::DeployService;
use crate::infra::app::run_server;
use crate::infra::config::CONFIG;
use crate::infra::logger::init_logging;
use crate::workers::{insights, monitor, reports};

#[used]
#[unsafe(no_mangle)]
pub static RUSTZEN_RELEASE_MARKER: &str = concat!(
    "RUSTZEN_RELEASE_MARKER\n",
    "artifact=rz\n",
    "build_id=",
    env!("CARGO_PKG_VERSION"),
    "\n",
);

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // load env
    dotenvy::dotenv().ok();

    init_process_timezone();

    let runtime = tokio::runtime::Builder::new_multi_thread().enable_all().build()?;

    let command = Command::parse(std::env::args().skip(1))?;

    runtime.block_on(async move {
        // init log
        let _logging = init_logging()?;

        match command {
            Command::Admin => run_server().await,
            Command::MonitorController => monitor::run_controller().await,
            Command::MonitorAgent => monitor::run_agent().await,
            Command::MonitorAgentVerify => Ok(()),
            Command::InsightsWorker => insights::run_worker().await,
            Command::ReportsWorker => reports::run_worker().await,
            Command::UpdateWorker(id) => DeployService::run_update_worker(id).await,
        }
    })?;

    Ok(())
}

#[derive(Debug, Clone, Eq, PartialEq)]
enum Command {
    Admin,
    MonitorController,
    MonitorAgent,
    MonitorAgentVerify,
    InsightsWorker,
    ReportsWorker,
    UpdateWorker(i64),
}

impl Command {
    fn parse(args: impl IntoIterator<Item = String>) -> Result<Self, CommandError> {
        let args = args.into_iter().collect::<Vec<_>>();
        match args.as_slice() {
            [module, mode] if module == "admin" && mode == "serve" => Ok(Self::Admin),
            [module, mode] if module == "monitor" && mode == "controller" => {
                Ok(Self::MonitorController)
            }
            [module, mode] if module == "monitor" && mode == "agent" => Ok(Self::MonitorAgent),
            [module, mode, action]
                if module == "monitor" && mode == "agent" && action == "verify" =>
            {
                Ok(Self::MonitorAgentVerify)
            }
            [module, mode] if module == "insights" && mode == "worker" => Ok(Self::InsightsWorker),
            [module, mode] if module == "reports" && mode == "worker" => Ok(Self::ReportsWorker),
            [module, mode, id] if module == "update" && mode == "worker" => id
                .parse::<i64>()
                .ok()
                .filter(|id| *id > 0)
                .map(Self::UpdateWorker)
                .ok_or(CommandError),
            _ => Err(CommandError),
        }
    }
}

#[derive(Debug)]
struct CommandError;

impl std::fmt::Display for CommandError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(
            "usage: rz admin serve | rz monitor controller | rz monitor agent | rz insights worker | rz reports worker | rz update worker <release-id>",
        )
    }
}

impl std::error::Error for CommandError {}

fn init_process_timezone() {
    // SAFETY: this runs in sync main before the Tokio runtime and worker threads are created.
    unsafe {
        std::env::set_var("TZ", CONFIG.timezone.trim());
    }
}

#[cfg(test)]
mod tests {
    use super::Command;

    #[test]
    fn parses_all_supported_process_modes() {
        assert_eq!(
            Command::parse(["admin".to_string(), "serve".to_string()]).ok(),
            Some(Command::Admin)
        );
        assert_eq!(
            Command::parse(["monitor".to_string(), "controller".to_string()]).ok(),
            Some(Command::MonitorController)
        );
        assert_eq!(
            Command::parse(["monitor".to_string(), "agent".to_string()]).ok(),
            Some(Command::MonitorAgent)
        );
        assert_eq!(
            Command::parse(["monitor".to_string(), "agent".to_string(), "verify".to_string()]).ok(),
            Some(Command::MonitorAgentVerify)
        );
        assert_eq!(
            Command::parse(["insights".to_string(), "worker".to_string()]).ok(),
            Some(Command::InsightsWorker)
        );
        assert_eq!(
            Command::parse(["reports".to_string(), "worker".to_string()]).ok(),
            Some(Command::ReportsWorker)
        );
        assert_eq!(
            Command::parse(["update".to_string(), "worker".to_string(), "7".to_string()]).ok(),
            Some(Command::UpdateWorker(7))
        );
        assert!(Command::parse(std::iter::empty()).is_err());
    }
}
