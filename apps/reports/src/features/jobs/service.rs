use std::collections::BTreeMap;

use chrono::{Duration as ChronoDuration, Utc};
use rustzen_config::RETENTION_DAYS;
use serde_json::Value;
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::common::error::AppError;

use super::{
    repo::JobsRepository,
    types::{CreateJobInput, Job, NewJob},
};
use crate::features::{files::FilesService, templates::TemplatesService};

#[derive(Clone)]
pub struct JobsService {
    repo: JobsRepository,
    templates: TemplatesService,
    files: FilesService,
}

impl JobsService {
    pub fn new(pool: SqlitePool, templates: TemplatesService, files: FilesService) -> Self {
        Self { repo: JobsRepository::new(pool), templates, files }
    }

    pub async fn list(&self) -> Result<Vec<Job>, AppError> {
        self.repo.list().await
    }

    pub async fn get(&self, id: &str) -> Result<Job, AppError> {
        self.repo
            .find(id)
            .await?
            .ok_or_else(|| AppError::NotFound("report job not found".to_string()))
    }

    pub async fn create(&self, input: CreateJobInput) -> Result<Job, AppError> {
        let template = self.templates.find_for_job(&input.template_id).await?;
        let id = Uuid::new_v4().to_string();
        let output_file = format!("{id}.html");
        let now = Utc::now();
        let created_at = now.to_rfc3339();
        let expires_at = (now + ChronoDuration::days(RETENTION_DAYS as i64)).to_rfc3339();
        let input_json = serde_json::to_string(&input.data).map_err(AppError::internal)?;
        self.repo
            .insert_queued(NewJob {
                id: &id,
                template_id: &input.template_id,
                input_json: &input_json,
                created_at: &created_at,
                expires_at: &expires_at,
            })
            .await?;

        self.repo.mark_running(&id, &Utc::now().to_rfc3339()).await?;
        let rendered = render_template(&template.content, &input.data);
        let finished_at = Utc::now().to_rfc3339();
        match self.files.write_output(&output_file, rendered).await {
            Ok(()) => self.repo.mark_succeeded(&id, &output_file, &finished_at).await?,
            Err(error) => {
                tracing::error!(%error, %id, "Report output write failed");
                self.repo.mark_failed(&id, &error.to_string(), &finished_at).await?;
            }
        }
        self.get(&id).await
    }

    pub async fn recover_interrupted(&self) -> Result<u64, AppError> {
        self.repo.recover_interrupted(&Utc::now().to_rfc3339()).await
    }
}

fn render_template(content: &str, data: &BTreeMap<String, Value>) -> String {
    data.iter().fold(content.to_string(), |rendered, (key, value)| {
        let replacement =
            value.as_str().map(ToOwned::to_owned).unwrap_or_else(|| value.to_string());
        rendered.replace(&format!("{{{{{key}}}}}"), &escape_html(&replacement))
    })
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde_json::json;

    use super::{escape_html, render_template};

    #[test]
    fn template_values_are_html_escaped() {
        let data = BTreeMap::from([("name".to_string(), json!("<RustZen>"))]);
        assert_eq!(render_template("<h1>{{name}}</h1>", &data), "<h1>&lt;RustZen&gt;</h1>");
        assert_eq!(escape_html("'&\""), "&#39;&amp;&quot;");
    }
}
