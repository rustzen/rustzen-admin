use axum::{
    body::Body,
    extract::{Path, State},
    http::{StatusCode, header},
    response::Response,
};
use tokio_util::io::ReaderStream;

use crate::{app::AppState, common::error::AppError};

pub async fn download(
    State(state): State<AppState>,
    Path(job_id): Path<String>,
) -> Result<Response<Body>, AppError> {
    let opened = state.files.open_download(&job_id).await?;
    tracing::debug!(path = %opened.path.display(), %job_id, "Streaming report output");
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/html; charset=utf-8")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{}\"", opened.file_name),
        )
        .header(header::CONTENT_LENGTH, opened.length)
        .body(Body::from_stream(ReaderStream::new(opened.file)))
        .map_err(AppError::internal)
}
