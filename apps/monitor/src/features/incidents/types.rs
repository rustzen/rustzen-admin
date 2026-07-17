use sqlx::FromRow;

#[derive(Debug, Clone, FromRow)]
pub(super) struct ResourceSample {
    pub cpu_percent: f64,
    pub memory_percent: f64,
    pub disk_percent: f64,
}
