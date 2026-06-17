use crate::common::{
    error::ServiceError,
    query::{count_with_filters, fetch_with_filters, push_ilike},
};

use chrono::{Duration, Utc};
use sqlx::{QueryBuilder, Sqlite, SqlitePool};

use super::types::{LogItemResp, LogListQuery, LogMetricsSummary, LogTrendPoint, LogWriteCommand};

/// Log data access layer
pub struct LogRepository;

impl LogRepository {
    fn format_query(query: &LogListQuery, query_builder: &mut QueryBuilder<Sqlite>) {
        if let Some(search_term) = query.search.as_deref() {
            let search_term = search_term.trim();
            if !search_term.is_empty() {
                let pattern = format!("%{}%", search_term.to_lowercase());
                query_builder
                    .push(" AND (LOWER(username) LIKE ")
                    .push_bind(pattern.clone())
                    .push(" OR LOWER(ip_address) LIKE ")
                    .push_bind(pattern)
                    .push(")");
            }
        }

        push_ilike(query_builder, "username", query.username.as_deref());
        push_ilike(query_builder, "action", query.action.as_deref());
        push_ilike(query_builder, "description", query.description.as_deref());
        push_ilike(query_builder, "ip_address", query.ip_address.as_deref());
    }

    /// Find logs with pagination and filters
    pub async fn list_logs(
        pool: &SqlitePool,
        offset: i64,
        limit: i64,
        query: LogListQuery,
    ) -> Result<(Vec<LogItemResp>, i64), ServiceError> {
        tracing::debug!("Finding logs with pagination and filters: {:?}", query);
        let total = count_with_filters(
            pool,
            "SELECT COUNT(*) FROM operation_logs WHERE 1=1",
            |query_builder| {
                Self::format_query(&query, query_builder);
            },
        )
        .await?;
        if total == 0 {
            return Ok((Vec::new(), total));
        }
        let logs = fetch_with_filters(
            pool,
            "SELECT id, user_id, username, action, description, data, status, duration_ms, ip_address, user_agent, created_at FROM operation_logs WHERE 1=1",
            |query_builder| {
                Self::format_query(&query, query_builder);
            },
            Some("created_at DESC"),
            Some(limit),
            Some(offset),
        )
        .await?;

        Ok((logs, total))
    }

    /// Creates a new log entry with full details (for business operations)
    pub async fn insert_log_entry(
        pool: &SqlitePool,
        command: &LogWriteCommand,
    ) -> Result<i64, ServiceError> {
        tracing::debug!("Creating detailed log entry with action: {:?}", command.action);

        let log_id = sqlx::query_scalar::<_, i64>(
            "INSERT INTO operation_logs (
                user_id, username, action, description, data, status, duration_ms, ip_address, user_agent, created_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
            ) RETURNING id",
        )
        .bind(command.user_id)
        .bind(command.username.as_str())
        .bind(command.action.as_str())
        .bind(command.description.as_str())
        .bind(command.data.clone()) // Option<serde_json::Value> will map to JSONB or NULL
        .bind(command.status.as_str())
        .bind(command.duration_ms)
        .bind(command.ip_address.as_str())
        .bind(command.user_agent.as_str())
        .fetch_one(pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error creating detailed log: {:?}", e);
            ServiceError::DatabaseQueryFailed
        })?;

        Ok(log_id)
    }

    pub async fn list_logs_for_export(
        pool: &SqlitePool,
        query: LogListQuery,
    ) -> Result<Vec<LogItemResp>, ServiceError> {
        fetch_with_filters(
            pool,
            "SELECT id, user_id, username, action, description, data, status, duration_ms, ip_address, user_agent, created_at FROM operation_logs WHERE 1=1",
            |query_builder| {
                Self::format_query(&query, query_builder);
            },
            Some("created_at DESC"),
            None,
            None,
        )
        .await
    }

    pub async fn cleanup_old_logs(
        pool: &SqlitePool,
        retention_days: i64,
    ) -> Result<u64, ServiceError> {
        let cutoff = Utc::now().naive_utc() - Duration::days(retention_days.max(1));
        let result = sqlx::query("DELETE FROM operation_logs WHERE created_at < ?")
            .bind(cutoff)
            .execute(pool)
            .await
            .map_err(|e| {
                tracing::error!("Database error cleaning old operation logs: {:?}", e);
                ServiceError::DatabaseQueryFailed
            })?;
        Ok(result.rows_affected())
    }

    pub async fn system_uptime_label(pool: &SqlitePool) -> Result<String, ServiceError> {
        sqlx::query_scalar::<_, String>(
            r#"
            SELECT
                ((CAST(strftime('%s', 'now') AS INTEGER) - CAST(COALESCE(
                    (SELECT CAST(strftime('%s', created_at) AS INTEGER) FROM operation_logs ORDER BY created_at ASC LIMIT 1),
                    strftime('%s', 'now')
                ) AS INTEGER)) / 86400) || '天 ' ||
                (((CAST(strftime('%s', 'now') AS INTEGER) - CAST(COALESCE(
                    (SELECT CAST(strftime('%s', created_at) AS INTEGER) FROM operation_logs ORDER BY created_at ASC LIMIT 1),
                    strftime('%s', 'now')
                ) AS INTEGER)) % 86400) / 3600) || '小时 '
            "#,
        )
        .fetch_one(pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error getting system uptime: {:?}", e);
            ServiceError::DatabaseQueryFailed
        })
    }

    pub async fn metrics_summary(pool: &SqlitePool) -> Result<LogMetricsSummary, ServiceError> {
        let (total_requests, error_requests, avg_response_time) = tokio::join!(
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM operation_logs WHERE created_at > datetime('now', '-7 day')",
            )
            .fetch_one(pool),
            sqlx::query_scalar::<_, i64>(
                "SELECT COUNT(*) FROM operation_logs WHERE status IN ('FAILED', 'ERROR') AND created_at > datetime('now', '-7 day')",
            )
            .fetch_one(pool),
            sqlx::query_scalar::<_, f64>(
                "SELECT COALESCE(AVG(CAST(duration_ms AS REAL)), 0) FROM operation_logs WHERE created_at > datetime('now', '-7 day') AND duration_ms IS NOT NULL",
            )
            .fetch_one(pool),
        );

        Ok(LogMetricsSummary {
            total_requests: total_requests.map_err(|e| {
                tracing::error!("Database error getting total requests: {:?}", e);
                ServiceError::DatabaseQueryFailed
            })?,
            error_requests: error_requests.map_err(|e| {
                tracing::error!("Database error getting error requests: {:?}", e);
                ServiceError::DatabaseQueryFailed
            })?,
            avg_response_time: avg_response_time.map_err(|e| {
                tracing::error!("Database error getting avg response time: {:?}", e);
                ServiceError::DatabaseQueryFailed
            })?,
        })
    }

    pub async fn daily_login_trends(pool: &SqlitePool) -> Result<Vec<LogTrendPoint>, ServiceError> {
        sqlx::query_as(
            r#"
            SELECT
                strftime('%Y-%m-%d', created_at) as date,
                COUNT(*) as count
            FROM operation_logs
            WHERE action = 'AUTH_LOGIN'
                AND status = 'SUCCESS'
                AND created_at > datetime('now', '-30 day')
            GROUP BY DATE(created_at)
            ORDER BY date
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error getting daily login trends: {:?}", e);
            ServiceError::DatabaseQueryFailed
        })
    }

    pub async fn hourly_active_users(
        pool: &SqlitePool,
    ) -> Result<Vec<LogTrendPoint>, ServiceError> {
        sqlx::query_as(
            r#"
            WITH RECURSIVE hour_series AS (
                SELECT 0 as hour
                UNION ALL
                SELECT hour + 1 FROM hour_series WHERE hour < 23
            )
            SELECT
                CAST(hs.hour AS TEXT) as date,
                COALESCE(COUNT(DISTINCT ol.user_id), 0) as count
            FROM hour_series hs
            LEFT JOIN operation_logs ol ON CAST(strftime('%H', ol.created_at) AS INTEGER) = hs.hour
                AND ol.created_at > datetime('now', '-24 hour')
                AND ol.user_id IS NOT NULL
            GROUP BY hs.hour
            ORDER BY hs.hour
            "#,
        )
        .fetch_all(pool)
        .await
        .map_err(|e| {
            tracing::error!("Database error getting hourly active users: {:?}", e);
            ServiceError::DatabaseQueryFailed
        })
    }
}
