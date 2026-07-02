# Architecture

`rustzen-admin` is a Rust full-stack admin foundation. The repository is a monorepo with shared Rust capability crates, one backend service, one React frontend, and deployment assets.

RustZen standardization classification: Web/Rust A-class reference layout. New
Web/Rust admin projects can use this repository as the default structure for
`apps/server`, `apps/web`, shared `crates/*`, root `justfile`, and `deploy/`.
This classification does not make Peripheral Vercel, Tauri client, or legacy
`zen-server` / `zen-web` rules applicable here.

## Module Boundaries

- `crates/auth/` owns shared auth and permission capability code.
- `crates/config/` owns runtime configuration loading and layout paths.
- `crates/runtime/` owns concrete runtime-path primitives for local-first deployment topology.
- `crates/storage/` owns the admin SQLite adapter and migration helpers; SQLite
  URL/path, pool, tuning, and connection test primitives come from
  `rz-core`.
- `apps/server/` owns the Axum backend runtime and business features.
- `apps/server/migrations/sqlite/` owns active SQL migrations.
- `apps/web/` owns the React frontend.
- `deploy/` owns deployment assets.
- `docs/` owns repository documentation.

Backend feature code lives under `apps/server/src/features/<feature>/` with `mod.rs`, `handler.rs`, `service.rs`, `repo.rs`, and `types.rs` unless the feature is intentionally smaller. `features/dashboard/` is an intentional smaller read-only aggregation feature: it has no `repo.rs` because it delegates dashboard counts and trends to owning services such as system user and manage log instead of owning persistence. System user/role/menu stay under `features/system/`; dictionary, logs, scheduled tasks, and deploy version management live under `features/manage/`.

Frontend pages live under `apps/web/src/routes/`. Frontend API modules live under `apps/web/src/api/`.

## Runtime Topology

Local development runs backend and frontend separately:

- backend and frontend development targets are defined in the root `justfile`.
- frontend dev server runs on `127.0.0.1:9800`.
- backend API defaults to `RUSTZEN_APP_PORT=9801`.
- frontend dev traffic proxies `/api` and `/resources` to the backend API through `apps/web/vite.config.ts`.

Packaged deployment runs the backend as the serving process:

- backend binary: `<runtime_root>/bin/rustzen-admin` symlinked to a versioned file
- deploy versions: `<runtime_root>/bin/rustzen-admin-<version>-<arch>` for server files and `<runtime_root>/web/web-<version>.zip` for web files
- frontend static files: `<runtime_root>/web/dist`
- database: `<runtime_root>/data/db/rustzen.db`
- uploads: `<runtime_root>/data/uploads`
- avatars: `<runtime_root>/data/avatars`
- logs: `<runtime_root>/logs`
- process env: `<runtime_root>/config/app.env`

`RUSTZEN_RUNTIME_ROOT` is the single runtime root. Production uses `.` from the deploy root. Local development defaults to `.rustzen-admin`.
Deployment packages set `RUSTZEN_APP_PORT=9880`.

Production deployment contract: `just build` assembles
`target/rustzen-admin/`, `deploy/rustzen-admin.service` runs
`/opt/rustzen-admin/bin/rustzen-admin` with
`WorkingDirectory=/opt/rustzen-admin`, and `deploy/setup-layout.sh` owns the
install layout. Systemd user/group or hardening changes must be reviewed with
runtime directory ownership and setup script behavior, not edited only in the
unit file.

## Data Flow

- Browser pages call typed frontend API modules from `apps/web/src/api/`.
- Frontend API modules call backend HTTP endpoints through `apps/web/src/api/request.ts`.
- Backend handlers parse requests and return responses.
- Backend services coordinate validation, transactions, permission-aware behavior, and repo calls.
- Backend repos run SQL against SQLite by default.
- Backend database bootstrap uses `crates/storage/`, which delegates shared
  SQLite connection behavior to `rz-core`.
- Backend logging uses `rz-core` daily rolling file logging and date-based
  retention cleanup; `apps/server` supplies runtime paths and starts the
  cleanup task.
- The built-in task scheduler starts with the backend and registers fixed manage tasks from source.
- Deploy version management stores uploaded `server` binaries and `web` dist zip files with version, arch, file size, and SHA-256. Deploying `server` switches the runtime binary symlink and triggers a service restart; deploying `web` extracts the zip into `<runtime_root>/web/dist`.
- Static files and uploaded resources are served from paths derived from `RUSTZEN_RUNTIME_ROOT`.

## Permissions

- JWT, auth context extraction, and capability checks live in `crates/auth/`.
- Backend capability cache and menu synchronization live in `apps/server/src/infra/`.
- New protected backend routes use `PermissionsCheck::Require(...)` by default.
- `*` is the only full-authorization grant.
- `owner`, `admin`, and `viewer` are built-in roles synchronized from the menu capability catalog. `owner` receives `*`, `admin` receives deploy view-only access plus other concrete leaf capabilities, and `viewer` receives read-only leaf capabilities.
- Built-in roles are immutable in role management.
- `users.is_system`, `roles.is_system`, and `menus.is_system` mark protected built-in records only; they do not grant permissions.

## Change Sync

- API contract changes update backend types, frontend API modules, frontend types, and relevant docs together.
- Schema changes update migrations, SQL queries, API types, and relevant docs together.
- Structure changes update `README.md`, `AGENTS.md`, `docs/README.md`, this file, and `docs/project-map.md` together.

## Command Source

- Use root `justfile` as the command source of truth; inspect the relevant target before running it.
