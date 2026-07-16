mod app;
mod common;
mod config;
mod features;
mod infra;
mod middleware;

use crate::{app::run_controller, features::heartbeat::run_agent, infra::logger::init_logging};

#[used]
#[unsafe(no_mangle)]
pub static RUSTZEN_RELEASE_MARKER: &str = concat!(
    "RUSTZEN_RELEASE_MARKER\n",
    "artifact=rz-bundle-member\n",
    "binary=rz-monitor\n",
    "version=",
    env!("CARGO_PKG_VERSION"),
    "\n",
);

fn main() -> Result<(), Box<dyn std::error::Error>> {
    rustzen_config::load_dotenv_if_present()?;
    let command = Command::parse(std::env::args().skip(1))?;
    match command {
        Command::Controller => run_controller_process(),
        Command::Agent => run_agent_process(),
    }
}

fn run_controller_process() -> Result<(), Box<dyn std::error::Error>> {
    let config = config::controller();
    init_process_timezone(config.timezone());
    let log_dir = config.log_dir();
    let runtime = tokio::runtime::Builder::new_multi_thread().enable_all().build()?;
    runtime.block_on(async move {
        let _logging = init_logging(log_dir)?;
        run_controller().await
    })
}

fn run_agent_process() -> Result<(), Box<dyn std::error::Error>> {
    let config = config::agent();
    init_process_timezone(config.timezone());
    let log_dir = config.log_dir();
    let endpoint = config.heartbeat_endpoint();
    let agent_token = config.monitor_agent_token.clone();
    let runtime = tokio::runtime::Builder::new_multi_thread().enable_all().build()?;
    runtime.block_on(async move {
        let _logging = init_logging(log_dir)?;
        run_agent(endpoint, agent_token).await
    })
}

fn init_process_timezone(timezone: &str) {
    // SAFETY: called in synchronous startup before the Tokio runtime creates worker threads.
    unsafe {
        std::env::set_var("TZ", timezone.trim());
    }
}

#[derive(Debug, Clone, Copy, Eq, PartialEq)]
enum Command {
    Controller,
    Agent,
}

impl Command {
    fn parse(args: impl IntoIterator<Item = String>) -> Result<Self, CommandError> {
        match args.into_iter().collect::<Vec<_>>().as_slice() {
            [mode] if mode == "controller" => Ok(Self::Controller),
            [mode] if mode == "agent" => Ok(Self::Agent),
            _ => Err(CommandError),
        }
    }
}

#[derive(Debug)]
struct CommandError;

impl std::fmt::Display for CommandError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("usage: rz-monitor controller | rz-monitor agent")
    }
}

impl std::error::Error for CommandError {}

#[cfg(test)]
mod tests {
    use super::{Command, CommandError};

    #[test]
    fn parses_controller_and_agent_modes() {
        assert_eq!(Command::parse(["controller".to_string()]).ok(), Some(Command::Controller));
        assert_eq!(Command::parse(["agent".to_string()]).ok(), Some(Command::Agent));
        assert!(matches!(Command::parse(std::iter::empty()), Err(CommandError)));
        assert!(Command::parse(["monitor".to_string(), "controller".to_string()]).is_err());
    }

    #[test]
    fn local_monitor_startup_configurations_are_valid_and_mode_focused() {
        rustzen_config::MonitorControllerConfig::local()
            .expect("local Monitor Controller startup config");
        rustzen_config::MonitorAgentConfig::local().expect("local Monitor Agent startup config");
    }
}
