use super::{
    repo::MenuRepository,
    types::{
        CreateMenuRequest, MenuItemResp, MenuListQuery, MenuOptionResp, MenuQuery,
        UpdateMenuPayload,
    },
};
use crate::common::{api::OptionsQuery, error::ServiceError, query::parse_optional_i16_filter};
use crate::infra::permission::PermissionService;
use rustzen_auth::capability::SYSTEM_WILDCARD;

use sqlx::SqlitePool;

pub struct MenuService;

impl MenuService {
    /// Get menu list as tree structure with optional filtering
    pub async fn list_menus(
        pool: &SqlitePool,
        query: MenuQuery,
    ) -> Result<(Vec<MenuItemResp>, i64), ServiceError> {
        tracing::info!("Fetching menu list with query: {:?}", query);

        let MenuQuery { name, code, status } = query;
        let status = parse_optional_i16_filter(status.as_deref(), "menu status", None)?;
        let repo_query = MenuListQuery { name, code, status };

        let menus = MenuRepository::list_menus(pool, repo_query).await?;
        let menu_responses: Vec<MenuItemResp> = menus.into_iter().map(MenuItemResp::from).collect();
        let count = menu_responses.len() as i64;
        Ok((menu_responses, count))
    }

    /// Create new menu with validation
    pub async fn create_menu(
        pool: &SqlitePool,
        request: CreateMenuRequest,
    ) -> Result<i64, ServiceError> {
        tracing::info!("Attempting to create menu with name: {}", request.name);
        ensure_not_module_capability(&request.code)?;
        let menu_id = MenuRepository::create(pool, &request).await?;
        PermissionService::refresh_all_user_permissions(pool).await?;
        Ok(menu_id)
    }

    /// Update existing menu with validation
    pub async fn update_menu(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
        request: UpdateMenuPayload,
    ) -> Result<i64, ServiceError> {
        tracing::info!("Attempting to update menu: {}", id);
        let _module_menu_guard = PermissionService::lock_module_menu_mutation().await;
        let menu_id = match MenuRepository::identity(pool, id).await? {
            Some((true, Some(module_id), Some(module_menu_code))) => {
                MenuRepository::update_module_override(
                    pool,
                    &module_id,
                    &module_menu_code,
                    &request.name,
                    request.icon.as_deref().filter(|icon| !icon.trim().is_empty()),
                    request.sort_order,
                    request.status,
                )
                .await
            }
            Some((_, None, None)) => {
                ensure_not_module_capability(&request.code)?;
                Self::ensure_menu_is_mutable(pool, id, current_user_id).await?;
                MenuRepository::update(pool, id, &request).await
            }
            Some(_) => Err(ServiceError::NotFound("Active module menu".to_string())),
            None => Err(ServiceError::NotFound(format!("Menu id: {id}"))),
        }?;
        PermissionService::refresh_all_user_permissions(pool).await?;
        Ok(menu_id)
    }

    /// Delete menu with child validation
    pub async fn delete_menu(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
    ) -> Result<(), ServiceError> {
        tracing::info!("Attempting to disable menu: {}", id);
        Self::ensure_menu_is_mutable(pool, id, current_user_id).await?;

        if MenuRepository::disable(pool, id).await? {
            PermissionService::refresh_all_user_permissions(pool).await?;
            Ok(())
        } else {
            Err(ServiceError::NotFound("Menu".to_string()))
        }
    }

    async fn ensure_menu_is_mutable(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
    ) -> Result<(), ServiceError> {
        match MenuRepository::identity(pool, id).await? {
            Some((true, _, _)) => {
                if PermissionService::has_permission(current_user_id, SYSTEM_WILDCARD).await? {
                    Ok(())
                } else {
                    Err(ServiceError::MenuIsSystem)
                }
            }
            Some((false, _, _)) => Ok(()),
            None => Err(ServiceError::NotFound(format!("Menu id: {}", id))),
        }
    }

    /// Get menu options for dropdowns
    pub async fn get_menu_options(
        pool: &SqlitePool,
        query: OptionsQuery,
    ) -> Result<Vec<MenuOptionResp>, ServiceError> {
        tracing::info!("Fetching menu options: {:?}", query);
        Ok(MenuRepository::list_menu_options(pool, query.q.as_deref(), query.limit)
            .await?
            .into_iter()
            .map(|(id, name, code)| MenuOptionResp { label: name, value: id, code })
            .collect())
    }
}

fn ensure_not_module_capability(code: &str) -> Result<(), ServiceError> {
    if ["monitor:", "insights:", "reports:"].iter().any(|prefix| code.starts_with(prefix)) {
        return Err(ServiceError::InvalidOperation(
            "Independent module capabilities are declared by Rust routes.".to_string(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ensure_not_module_capability;

    #[test]
    fn fixed_module_capabilities_cannot_be_created_or_reassigned_manually() {
        for code in ["monitor:view", "insights:analyze", "reports:export"] {
            assert!(ensure_not_module_capability(code).is_err(), "accepted {code}");
        }
        assert!(ensure_not_module_capability("system:menu:update").is_ok());
    }
}
