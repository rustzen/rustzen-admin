use std::path::PathBuf;

#[derive(Debug, sqlx::FromRow)]
pub struct DownloadRecord {
    pub status: String,
    pub output_file: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct ExpiredOutput {
    pub output_file: Option<String>,
}

pub struct OpenedReportFile {
    pub file_name: String,
    pub file: tokio::fs::File,
    pub length: u64,
    pub path: PathBuf,
}
