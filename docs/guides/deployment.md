# Deployment Guide

Current deployment rules.

RustZen standardization role: Web/Rust A-class reference deployment. This guide
records the current release bundle contract for `rustzen-admin`; it is not a
Vercel, Tauri, Docker-only, or legacy `zen-server` deployment guide.

## Runtime Layout

```txt
<runtime_root>/
├── bin/
│   ├── rustzen-admin -> rustzen-admin-<version>-<arch>
│   └── rustzen-admin-<version>-<arch>
├── config/
├── data/
│   ├── avatars/
│   ├── db/
│   └── uploads/
├── logs/
├── systemd/
└── web/
    ├── dist/
    └── web-<version>.zip
```

## Rules

- Use one deploy root for the whole app.
- Production runs with `WorkingDirectory=/opt/rustzen-admin`.
- Production sets `RUSTZEN_RUNTIME_ROOT=.`.
- Runtime config comes from `RUSTZEN_SQLITE_PATH` and `RUSTZEN_*`.
- The deployment backend API port is `9880`.
- Production must provide `RUSTZEN_SQLITE_PATH` and `RUSTZEN_JWT_SECRET`.
- `config/app.env` is only an environment-variable carrier.
- `RUSTZEN_TIMEZONE` controls process-local timezone behavior such as local log dates and scheduled task cron evaluation; the default is `UTC`.
- Backend static files are served from `<runtime_root>/web/dist`.
- SQLite database files live under `<runtime_root>/data/db`.
- Uploads live under `<runtime_root>/data/uploads`.
- Avatars live under `<runtime_root>/data/avatars`.
- Logs live under `<runtime_root>/logs`.
- Installed build artifacts initialize `bin/rustzen-admin` as a symlink to the packaged server version, for example `bin/rustzen-admin-<version>-x86_64`.
- Uploaded server versions live under `<runtime_root>/bin/rustzen-admin-<version>-<arch>`.
- Build and deploy targets are defined in the root `justfile`.
- GitHub Actions workflows call the root `justfile` recipes instead of
  duplicating build commands inline.
- `just build` writes versioned deployment outputs under `target/rustzen-admin/`.
- `just build-config` writes `config/app.env`, `systemd/rustzen-admin.service`,
  and `setup-layout.sh` under `target/rustzen-admin/`.
- Build outputs include `rustzen-admin-<version>-<arch>`, `dist-<version>.zip`, `config/app.env`, `systemd/rustzen-admin.service`, and `setup-layout.sh`.
- The build `config/app.env` is copied from `.env.example` with `RUSTZEN_RUNTIME_ROOT=.`, `RUSTZEN_APP_PORT=9880`, and `RUSTZEN_SQLITE_PATH=./data/db/rustzen.db` for the deploy layout.
- The build `config/app.env` keeps the release JWT placeholder; production must replace it with a real secret.
- `setup-layout.sh` creates the deploy directory structure from the build outputs and does not overwrite an existing `config/app.env`.
- `setup-layout.sh` enables the systemd service but skips startup while `RUSTZEN_JWT_SECRET` is still a release placeholder.
- `setup-layout.sh` prints the JWT update command and follow-up `systemctl` commands after setup.
- Production must replace the JWT secret before startup.
- Frontend release builds use pnpm with `apps/web/pnpm-lock.yaml`.
- The sqlite-first phase uses SQLite by default and does not require PostgreSQL for local startup.
- Deploy version management accepts only `server` and `web` components.
- `server` uploads are executable binary files with a `RUSTZEN_ADMIN_MARKER` marker and matching `x86_64` or `aarch64` arch.
- `web` uploads are architecture-independent zip files. SQLite currently stores
  them with the `x86_64` arch sentinel for deploy-version uniqueness; the UI
  displays web versions as `universal`.
- `web` uploads are zip files containing `dist/index.html`, `dist/assets/*.js`
  or `*.css`, and `dist/__rustzen_admin_marker__.json`. The marker JSON must
  contain `component: "web"` and `build_id: "manual"`.
- Deploying `server` switches `<runtime_root>/bin/rustzen-admin` to the uploaded version file in `<runtime_root>/bin/` and triggers `rustzen-admin.service` restart. The service template lives at `deploy/rustzen-admin.service`.
- Server deploy records are marked current only after the restart trigger is accepted.
- If marking the server version current fails after restart, the symlink is restored and the service restart is triggered again to return runtime state to the previous binary.
- Deploying `web` replaces `<runtime_root>/web/dist` from the uploaded zip.
- Uploaded web version files are stored as `<runtime_root>/web/web-<version>.zip`.
- Web deploy restores the previous `web/dist` when the database current-version update fails.
- Deleting or cleaning deploy versions marks the database record deleted first, then best-effort removes the uploaded file. File cleanup failure is logged and can be handled manually; deleted records are not left visible only because cleanup failed.

## RustZen Standardization Guardrails

- Keep `target/rustzen-admin`, `/opt/rustzen-admin`, `bin/config/data/logs/web`,
  `systemd/rustzen-admin.service`, and `setup-layout.sh` as the deployment
  vocabulary for this project.
- Do not introduce systemd `User`/`Group`, `NoNewPrivileges`, `PrivateTmp`, or
  similar hardening only in `deploy/rustzen-admin.service`. Review
  `deploy/setup-layout.sh`, existing `/opt/rustzen-admin` ownership, writable
  runtime directories, and rollback steps in the same change.
- Do not apply `rustzen-report` legacy binary names such as `report-server` or
  `zen-server` / `zen-web` paths to this repository.
- Do not apply Peripheral Vercel or Tauri release terminology.

## Prohibited

- Parallel runtime config files such as `system.yaml`.
- Fallback deploy layouts.
- Build-machine absolute paths in runtime behavior.
- Nested deployment asset directories unless the deployment surface grows.
- npm or Bun lockfiles for the `apps/web` release build.

## Local startup

```bash
cargo run -p server
```

## Existing SQLite Path Move

The server runs a startup migration before opening SQLite. If an older
deployment left `rustzen.db`, `rustzen.db-shm`, or `rustzen.db-wal` directly
under `data/`, startup moves those files into `data/db/`.

Special case: the migration treats `rustzen.db`, `rustzen.db-shm`, and
`rustzen.db-wal` as one SQLite file group. If any target file already exists
under `data/db/`, startup logs a warning and leaves the whole legacy group for
manual inspection instead of mixing files from different databases.

## Existing Deploy Version Move

The server also runs a startup migration for older uploaded server versions.
Files under `<runtime_root>/versions/server-<version>-<arch>` move to
`<runtime_root>/bin/rustzen-admin-<version>-<arch>` before SQLite opens. If the
target file already exists, startup logs a warning and leaves the legacy file
in place for manual inspection.

If `<runtime_root>/bin/rustzen-admin` is a symlink to the moved legacy
`versions/server-*` file, startup rewrites it to the migrated
`bin/rustzen-admin-*` file so the runtime service entrypoint remains valid.

After embedded database migrations complete, startup also updates matching
`deploy_versions.file_path` rows from the old `versions/server-*` path to the
new `bin/rustzen-admin-*` path when the migrated target file exists. If the
target file is missing, the database row stays unchanged and startup logs a
warning for manual inspection.

## Build Output Checks

- `target/rustzen-admin/rustzen-admin-<version>-<arch>` exists and is executable.
- `target/rustzen-admin/dist-<version>.zip` exists.
- `target/rustzen-admin/config/app.env` exists and sets `RUSTZEN_RUNTIME_ROOT=.`, `RUSTZEN_APP_PORT=9880`, and `RUSTZEN_SQLITE_PATH=./data/db/rustzen.db`.
- `target/rustzen-admin/systemd/rustzen-admin.service` exists.
- `target/rustzen-admin/setup-layout.sh` exists and is executable.
- The web zip contains `dist/index.html`.
- The web zip contains at least one `dist/assets/*.js` or `dist/assets/*.css` file.
- The web zip contains `dist/__rustzen_admin_marker__.json`.
- The web marker has `component` set to `web` and `build_id` set to `manual`.

## Installed Layout Checks

- `bin/rustzen-admin` exists.
- `web/dist/index.html` exists.
- Uploaded web versions, if present, live under `web/web-<version>.zip`.
- `config/app.env` exists.
- Runtime data and log directories are writable.
- `data/db` exists for SQLite database files.
- `systemd/rustzen-admin.service` exists.
- `systemd/rustzen-admin.service` does not set `TZ`; backend startup sets process `TZ` from `RUSTZEN_TIMEZONE`.
- `config/app.env` carries `RUSTZEN_TIMEZONE=UTC` for process-local timezone behavior.
- Uploaded deploy file SHA-256 matches the stored database record before deployment.
