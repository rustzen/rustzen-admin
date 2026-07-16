use crate::common::error::ServiceError;
use sqlx::{QueryBuilder, Sqlite, SqlitePool, sqlite::SqliteRow};

pub fn push_ilike(query: &mut QueryBuilder<Sqlite>, column: &'static str, value: Option<&str>) {
    if let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) {
        query
            .push(" AND LOWER(")
            .push(column)
            .push(") LIKE ")
            .push_bind(format!("%{}%", value.to_lowercase()));
    }
}

pub fn push_eq<T>(query: &mut QueryBuilder<Sqlite>, column: &'static str, value: Option<T>)
where
    T: for<'q> sqlx::Encode<'q, Sqlite> + sqlx::Type<Sqlite>,
{
    if let Some(value) = value {
        query.push(" AND ").push(column).push(" = ").push_bind(value);
    }
}

pub fn parse_optional_i16_filter(
    value: Option<&str>,
    field_name: &str,
    default_on_empty: Option<i16>,
) -> Result<Option<i16>, ServiceError> {
    match value.map(str::trim) {
        None | Some("") => Ok(default_on_empty),
        Some("all") => Ok(None),
        Some(raw) => raw.parse::<i16>().map(Some).map_err(|_| {
            ServiceError::InvalidOperation(format!("Invalid {field_name} value: {raw}"))
        }),
    }
}

pub async fn count_with_filters<F>(
    pool: &SqlitePool,
    base_sql: &'static str,
    apply_filters: F,
) -> Result<i64, ServiceError>
where
    F: FnOnce(&mut QueryBuilder<Sqlite>),
{
    let mut query = QueryBuilder::new(base_sql);
    apply_filters(&mut query);
    query.build_query_scalar().fetch_one(pool).await.map_err(|error| {
        tracing::error!(?error, "Database count query failed");
        ServiceError::DatabaseQueryFailed
    })
}

pub async fn fetch_with_filters<T, F>(
    pool: &SqlitePool,
    base_sql: &'static str,
    apply_filters: F,
    order_by: Option<&'static str>,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<T>, ServiceError>
where
    F: FnOnce(&mut QueryBuilder<Sqlite>),
    T: for<'r> sqlx::FromRow<'r, SqliteRow> + Send + Unpin,
{
    let mut query = QueryBuilder::new(base_sql);
    apply_filters(&mut query);
    if let Some(order_by) = order_by {
        query.push(" ORDER BY ").push(order_by);
    }
    if let Some(limit) = limit {
        query.push(" LIMIT ").push_bind(limit);
    }
    if let Some(offset) = offset {
        query.push(" OFFSET ").push_bind(offset);
    }
    query.build_query_as().fetch_all(pool).await.map_err(|error| {
        tracing::error!(?error, "Database fetch query failed");
        ServiceError::DatabaseQueryFailed
    })
}
