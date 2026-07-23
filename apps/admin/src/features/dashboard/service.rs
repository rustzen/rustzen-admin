use crate::{common::error::ServiceError, features::system::user::service::UserService};

use super::types::StatsResp;

use sqlx::SqlitePool;

pub struct DashboardService;

impl DashboardService {
    pub async fn get_stats(pool: &SqlitePool) -> Result<StatsResp, ServiceError> {
        let counts = UserService::dashboard_counts(pool).await?;

        Ok(StatsResp {
            total_users: counts.total_users,
            active_users: counts.active_users,
            today_logins: counts.today_logins,
            pending_users: counts.pending_users,
        })
    }
}
