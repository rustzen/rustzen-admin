# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.2] - 2026-06-24

### Changed

- Slimmed the server release binary by replacing the scheduled-task runtime with
  lightweight cron calculation and fixed-offset timezone handling.

### Fixed

- Added the legacy `build_id: "manual"` field to signed web deploy markers so
  new web release zips can still be uploaded through existing deployed servers.
- Fixed signed web deploy package hashing so uploaded release zips validate
  against the backend signature policy.
- Changed server deployment to return before triggering the service restart, so
  nginx does not report the deploy request as a bad gateway during restart.

## [0.4.1] - 2026-06-24

### Added

- Added signed deploy artifacts for server binaries and web release zips.
- Added the system status page and API for runtime storage and resource usage.

### Changed

- Updated the release workflow to read `RUSTZEN_DEPLOY_SIGN_KEY` from GitHub Actions secrets.
- Updated production build config to require deploy signature verification.

## [0.4.0] - 2026-06-08

### Added

- Added SQLite-first embedded migrations and seed data under `apps/server/migrations/sqlite/`.
- Added shared `crates/config`, `crates/runtime`, and `crates/storage` helpers for runtime configuration, paths, and SQLite startup.
- Added repository rules and guides for the `apps/server`, `apps/web`, and `crates/*` layout.

### Changed

- **Breaking:** SQLite is now the default runtime storage backend. PostgreSQL-first migration history is archived under `apps/server/migrations/postgresql_legacy/`.
- Moved source ownership to the current monorepo layout: `apps/server`, `apps/web`, and shared `crates/*`.
- Moved local development ports to backend `9801` and frontend `9800`.
- Reworked system permission checks around explicit capability boundaries while keeping existing capability codes.
- Updated deployment assets, runtime configuration, and documentation for the SQLite-first baseline.

### Fixed

- Fixed collapsed sidebar menu icons so they remain visible when the navigation is minimized.

### Migration notes

- Existing PostgreSQL-first deployments need a separate migration review before adopting the SQLite-first runtime.
- Fresh SQLite-first installs should use `.env.example`, set `RUSTZEN_JWT_SECRET`, and start the backend so embedded migrations apply.
- If a local development database has stale migration checksums, run `just reset-db` before restarting the backend.

## [0.3.0] - 2026-04-05

### Added

- Monorepo layout: backend under `server/`, frontend under `web/`, SQL migrations under `server/migrations/`.
- Embedded migrations applied automatically on backend startup (`run_migrations` in `server/src/infra/db.rs`).
- Centralized runtime layout via `RUSTZEN_RUNTIME_ROOT` (default `.rustzen-admin` in development), deriving:
    - `web/dist` for static frontend assets
    - `data/uploads` and `data/avatars` for uploads
    - `logs` for file logging (with retention controlled by `RUSTZEN_LOG_RETENTION_DAYS`)
- Separate static route for avatars at `{RUSTZEN_FILES_PREFIX}/avatars` (default `/resources/avatars`).
- Split Docker build assets: `deploy/binary.Dockerfile`, `deploy/release.Dockerfile`, `deploy/runtime.Dockerfile`.

### Changed

- Environment variables use the `RUSTZEN_` prefix (see `.env.example`). `DATABASE_URL` remains unprefixed.
- Replaced per-path env keys (`web_dist`, `upload_dir`, `avatar_dir`, `upload_public_prefix`) with `RUSTZEN_RUNTIME_ROOT` and `RUSTZEN_FILES_PREFIX`.
- CI and `just` targets updated for the new layout (`just build-binary`, `just build-release`, `just build-image`). See `justfile` and `docs/guides/deployment.md`.

### Migration notes

- **Fresh installs**: use `.env.example`, run the backend once so embedded migrations apply; no repair script needed.
- **Full upgrade steps**: `docs/guides/deployment.md`.
