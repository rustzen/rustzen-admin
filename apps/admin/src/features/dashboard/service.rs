use crate::{
    common::error::ServiceError,
    features::{manage::log::service::LogService, system::user::service::UserService},
    infra::system_info::{SystemInfo, SystemUtils},
};

use super::types::{StatsResp, SystemMetricsDataResp, TrendResp, UserTrendsResp};

use sqlx::SqlitePool;

pub struct DashboardService;

impl DashboardService {
    pub async fn get_stats(pool: &SqlitePool) -> Result<StatsResp, ServiceError> {
        let (counts, system_uptime) = tokio::try_join!(
            UserService::dashboard_counts(pool),
            LogService::system_uptime_label(pool)
        )?;

        Ok(StatsResp {
            total_users: counts.total_users,
            active_users: counts.active_users,
            today_logins: counts.today_logins,
            system_uptime,
            pending_users: counts.pending_users,
        })
    }

    pub fn get_health() -> SystemInfo {
        SystemUtils::get_system_info()
    }

    pub async fn get_metrics(pool: &SqlitePool) -> Result<SystemMetricsDataResp, ServiceError> {
        let summary = LogService::metrics_summary(pool).await?;
        let error_rate = if summary.total_requests > 0 {
            (summary.error_requests as f64 / summary.total_requests as f64) * 100.0
        } else {
            0.0
        };

        Ok(SystemMetricsDataResp {
            avg_response_time: summary.avg_response_time as i64,
            error_rate,
            total_requests: summary.total_requests,
        })
    }

    pub async fn get_trends(pool: &SqlitePool) -> Result<UserTrendsResp, ServiceError> {
        let (daily_logins, hourly_active) = tokio::try_join!(
            LogService::daily_login_trends(pool),
            LogService::hourly_active_users(pool),
        )?;

        Ok(UserTrendsResp {
            daily_logins: daily_logins
                .into_iter()
                .map(|item| TrendResp { date: item.date, count: item.count })
                .collect(),
            hourly_active: hourly_active
                .into_iter()
                .map(|item| TrendResp { date: item.date, count: item.count })
                .collect(),
        })
    }
}
