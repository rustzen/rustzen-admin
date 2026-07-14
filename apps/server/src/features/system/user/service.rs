use super::{
    repo::UserRepository,
    types::{
        CreateUserCommand, CreateUserRequest, UpdateUserPasswordPayload, UpdateUserPayload,
        UpdateUserStatusPayload, UserDashboardCounts, UserItemResp, UserListQuery, UserOptionResp,
        UserOptionsQuery, UserQuery,
    },
};
use crate::{
    common::{
        error::ServiceError,
        pagination::{Pagination, PaginationQuery},
        query::parse_optional_i16_filter,
    },
    infra::password::PasswordUtils,
    infra::permission::PermissionService,
};
use rustzen_auth::capability::SYSTEM_WILDCARD;

use sqlx::SqlitePool;

const OWNER_ROLE_CODE: &str = "owner";

/// User service for business operations
pub struct UserService;

impl UserService {
    /// Get user list with pagination
    pub async fn list_users(
        pool: &SqlitePool,
        query: UserQuery,
    ) -> Result<(Vec<UserItemResp>, i64), ServiceError> {
        tracing::info!("Fetching user list with query: {:?}", query);

        let UserQuery { current, page_size, username, status, real_name, email } = query;
        let pagination = Pagination::from_query(PaginationQuery { current, page_size });
        let limit = i64::from(pagination.limit);
        let offset = i64::from(pagination.offset);
        let status = parse_optional_i16_filter(status.as_deref(), "user status", None)?;
        let repo_query = UserListQuery { username, status, real_name, email };

        let (users, total) = UserRepository::list_users(pool, offset, limit, repo_query).await?;

        Ok((users.into_iter().map(UserItemResp::try_from).collect::<Result<Vec<_>, _>>()?, total))
    }

    /// Create user
    pub async fn create_user(
        pool: &SqlitePool,
        current_user_id: i64,
        dto: CreateUserRequest,
    ) -> Result<i64, ServiceError> {
        tracing::debug!("Creating user: {}", dto.username);
        Self::ensure_roles_are_assignable(pool, current_user_id, &dto.role_ids).await?;
        if !is_valid_user_status(dto.status.unwrap_or(1)) {
            return Err(ServiceError::InvalidUserStatus);
        }
        if UserRepository::username_exists(pool, &dto.username).await? {
            return Err(ServiceError::UsernameConflict);
        }
        if UserRepository::email_exists(pool, &dto.email).await? {
            return Err(ServiceError::EmailConflict);
        }
        let password_hash = PasswordUtils::hash_password(&dto.password)?;
        let create_cmd = CreateUserCommand {
            username: dto.username,
            email: dto.email,
            password_hash,
            real_name: dto.real_name,
            status: dto.status,
            role_ids: dto.role_ids,
        };

        let user_id = UserRepository::create_user(pool, &create_cmd).await?;

        Ok(user_id)
    }

    /// Update user
    pub async fn update_user(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
        request: UpdateUserPayload,
    ) -> Result<i64, ServiceError> {
        tracing::debug!("Updating user ID: {}", id);
        Self::ensure_user_is_mutable(pool, id, current_user_id).await?;
        Self::ensure_roles_are_assignable(pool, current_user_id, &request.role_ids).await?;
        if UserRepository::email_exists_for_other_user(pool, &request.email, id).await? {
            return Err(ServiceError::EmailConflict);
        }
        UserRepository::update_user(pool, id, &request.email, &request.real_name, &request.role_ids)
            .await
    }

    /// Delete user
    pub async fn delete_user(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
    ) -> Result<(), ServiceError> {
        tracing::debug!("Deleting user ID: {}", id);
        Self::ensure_user_is_mutable(pool, id, current_user_id).await?;
        if !UserRepository::soft_delete(pool, id).await? {
            return Err(ServiceError::NotFound(format!("User id: {}", id)));
        }

        Ok(())
    }

    /// Get user status options
    pub fn get_user_status_options() -> Vec<UserOptionResp> {
        vec![
            UserOptionResp { label: "Normal".to_string(), value: 1 },
            UserOptionResp { label: "Disabled".to_string(), value: 2 },
            UserOptionResp { label: "Pending".to_string(), value: 3 },
            UserOptionResp { label: "Locked".to_string(), value: 4 },
        ]
    }

    /// Get user options for dropdowns
    pub async fn get_user_options(
        pool: &SqlitePool,
        query: UserOptionsQuery,
    ) -> Result<Vec<UserOptionResp>, ServiceError> {
        tracing::debug!("Getting user options with query: {:?}", query);
        Ok(UserRepository::list_user_options(pool, query.status, query.q.as_deref(), query.limit)
            .await?
            .into_iter()
            .map(|(value, label)| UserOptionResp { label, value })
            .collect())
    }

    pub async fn update_user_password(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
        dto: UpdateUserPasswordPayload,
    ) -> Result<bool, ServiceError> {
        tracing::debug!("Updating user password for user ID: {}", id);
        Self::ensure_user_is_mutable(pool, id, current_user_id).await?;
        let password_hash = PasswordUtils::hash_password(&dto.password)?;
        UserRepository::update_user_password(pool, id, &password_hash).await
    }

    pub async fn update_user_status(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
        dto: UpdateUserStatusPayload,
    ) -> Result<bool, ServiceError> {
        tracing::debug!("Updating user status for user ID: {}", id);
        Self::ensure_user_is_mutable(pool, id, current_user_id).await?;
        if !is_valid_user_status(dto.status) {
            return Err(ServiceError::InvalidUserStatus);
        }
        UserRepository::update_user_status(pool, id, dto.status).await
    }

    pub async fn dashboard_counts(pool: &SqlitePool) -> Result<UserDashboardCounts, ServiceError> {
        UserRepository::dashboard_counts(pool).await
    }

    async fn ensure_user_is_mutable(
        pool: &SqlitePool,
        id: i64,
        current_user_id: i64,
    ) -> Result<(), ServiceError> {
        let user = UserRepository::find_user_by_id(pool, id)
            .await?
            .ok_or_else(|| ServiceError::NotFound(format!("User id: {}", id)))?;
        if user.is_system
            && !PermissionService::has_permission(current_user_id, SYSTEM_WILDCARD).await?
        {
            return Err(ServiceError::UserIsAdmin);
        }
        Ok(())
    }

    async fn ensure_roles_are_assignable(
        pool: &SqlitePool,
        current_user_id: i64,
        role_ids: &[i64],
    ) -> Result<(), ServiceError> {
        if role_ids.is_empty() {
            return Ok(());
        }

        let roles = UserRepository::list_role_identities_by_ids(pool, role_ids).await?;
        if roles.len() != role_ids.iter().copied().collect::<std::collections::HashSet<_>>().len() {
            return Err(ServiceError::NotFound("Role".to_string()));
        }

        if roles.iter().any(|(_, code, _)| role_requires_owner_permission(code))
            && !PermissionService::has_permission(current_user_id, SYSTEM_WILDCARD).await?
        {
            return Err(ServiceError::InvalidOperation(
                "Owner role can only be assigned by an owner user.".to_string(),
            ));
        }

        Ok(())
    }
}

fn role_requires_owner_permission(role_code: &str) -> bool {
    role_code == OWNER_ROLE_CODE
}

fn is_valid_user_status(status: i16) -> bool {
    matches!(status, 1..=4)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn owner_role_requires_owner_permission() {
        assert!(role_requires_owner_permission("owner"));
        assert!(!role_requires_owner_permission("admin"));
        assert!(!role_requires_owner_permission("viewer"));
    }

    #[test]
    fn validates_supported_user_status_values() {
        assert!(is_valid_user_status(1));
        assert!(is_valid_user_status(4));
        assert!(!is_valid_user_status(0));
        assert!(!is_valid_user_status(5));
    }
}
