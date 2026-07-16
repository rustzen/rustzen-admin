# Project Map

This is a practical path index for task orientation.

## Root

| Path | Value | Inspect when |
| --- | --- | --- |
| `README.md` | Human entrypoint and project summary. | You need a quick repository overview. |
| `AGENTS.md` | Repository-wide contribution constraints. | You start any task. |
| `Cargo.toml` | Workspace members and authoritative release version. | You change packages, dependencies, or versions. |
| `justfile` | Command source of truth. | You run, check, build, package, or verify. |
| `.env.example` | Minimal production configuration template. | You change runtime configuration or deployment. |

## Shared crates

| Path | Value | Inspect when |
| --- | --- | --- |
| `crates/auth/` | JWT/auth context, permission checks, and capability constants. | You change authentication or authorization policy. |
| `crates/ipc/` | Manifest, method-aware module router, and HMAC delegation contract. | You change module routes or the Admin-to-module boundary. |
| `crates/config/` | Focused Admin, Monitor, Insights, and Reports configuration. | You change `RUSTZEN_*` parsing, defaults, or runtime paths. |
| `crates/storage/` | SQLite pool and maintenance primitives. | You change shared SQLite behavior. |
| `crates/runtime/` | Stable runtime-layout helpers. | You change runtime-root topology. |

## Admin

| Path | Value | Inspect when |
| --- | --- | --- |
| `apps/admin/AGENTS.md` | Admin-specific backend rules. | You work below `apps/admin/`. |
| `apps/admin/src/infra/` | Admin startup, DB, auth cache, logging, config, and embedded Web serving. | You change Admin runtime wiring. |
| `apps/admin/src/features/modules/` | Fixed module state, Manifest sync, immutable registry, gateway, and module APIs. | You change module availability, sync, navigation, or forwarding. |
| `apps/admin/src/features/manage/deploy/` | Signed bundle validation, update worker, rollback, and recovery. | You change release behavior. |
| `apps/admin/src/features/auth/` | Login, logout, and current-session bootstrap. | You change sessions or token flows. |
| `apps/admin/src/features/account/` | Current-account profile, avatar, and password flows. | You change self-service account behavior. |
| `apps/admin/src/features/dashboard/` | Admin dashboard aggregation. | You change dashboard cards or module health display. |
| `apps/admin/src/features/manage/` | Dictionaries, logs, scheduled tasks, and deploy versions. | You change Admin management features. |
| `apps/admin/src/features/system/` | Menu, role, user, and status management. | You change RBAC or system administration. |
| `apps/admin/migrations/sqlite/` | Admin, RBAC, module-state, and release migrations. | You change Admin schema. |

## Module applications

| Path | Value | Inspect when |
| --- | --- | --- |
| `apps/monitor/src/features/` | Heartbeat, node, and metrics behavior. | You change Monitor business behavior. |
| `apps/monitor/migrations/` | Monitor-owned schema. | You change Monitor persistence. |
| `apps/monitor/module.toml` | Monitor metadata and default menu only. | You change module presentation metadata. |
| `apps/insights/src/features/` | Projects, tracking, and overview behavior. | You change Insights business behavior. |
| `apps/insights/migrations/` | Insights-owned schema. | You change Insights persistence. |
| `apps/insights/module.toml` | Insights metadata and default menu only. | You change module presentation metadata. |
| `apps/reports/src/features/` | Templates, jobs, and report files. | You change Reports business behavior. |
| `apps/reports/migrations/` | Reports-owned schema. | You change Reports persistence. |
| `apps/reports/module.toml` | Reports metadata and default menu only. | You change module presentation metadata. |

Module route method, path, access mode, capability, and handler are declared in
Rust route registration, not in `module.toml`.

## Frontend

| Path | Value | Inspect when |
| --- | --- | --- |
| `apps/web/AGENTS.md` | Frontend-specific rules. | You work below `apps/web/`. |
| `apps/web/package.json` and `apps/web/bun.lock` | Bun package and dependency lock. | You change frontend dependencies or scripts. |
| `apps/web/src/routes/` | File-based pages and route guards. | You add or change pages. |
| `apps/web/src/api/` | Typed API modules and request wrapper. | You change HTTP contracts or data access. |
| `apps/web/src/components/base-layout/` | Admin shell and runtime navigation. | You change menus, header, or layout. |
| `apps/web/src/store/` | Shared frontend state. | You change auth or persisted cross-page state. |

## Deployment and verification

| Path | Value | Inspect when |
| --- | --- | --- |
| `Dockerfile` | Four-binary Linux release build. | You change release compilation. |
| `scripts/package-release-bundle.sh` | Exact bundle assembly and marker checks. | You change bundle membership. |
| `scripts/deploy-sign.mjs` | Complete-bundle signing and verification. | You change signature behavior. |
| `deploy/setup-layout.sh` | Signature-verifying initial installer and first atomic `current` link. | You change installation. |
| `deploy/rz.target` and `deploy/rz-*.service` | Recovery, four server units, and separate Monitor Agent unit. | You change systemd topology. |
| `scripts/verify-services.sh` | Four-service runtime, isolation, DB restore, and latency verification. | You change runtime contracts or acceptance gates. |
| `scripts/test-setup-layout.sh` | Signature, initial-install boundary, and unit-topology integration tests. | You change bundle or install layout. |

## Documentation

| Path | Value | Inspect when |
| --- | --- | --- |
| `docs/README.md` | Documentation index. | You choose current guidance. |
| `docs/architecture.md` | Current repository and runtime facts. | You need architecture or data flow. |
| `docs/guides/` | Current development rules. | You edit backend, frontend, permission, or deployment behavior. |
| `docs/reference/` | Optional deeper current context. | Current facts and guides are not enough. |
| `docs/history/` | Non-current plans and records. | You need historical rationale. |
