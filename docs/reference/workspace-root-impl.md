# Workspace Root Implementation

This reference explains runtime-root behavior. The source of truth is `crates/config/src/lib.rs` and the backend mounting code in `apps/server/src/infra/app.rs`.

## Current Behavior

- `RUSTZEN_RUNTIME_ROOT` is the single runtime root.
- Local development defaults to `.rustzen-admin`.
- Production deployment sets `RUSTZEN_RUNTIME_ROOT=.` from the deploy root.
- `RUSTZEN_FILES_PREFIX` defaults to `/resources`.
- Other runtime paths, ports, pool limits, logging, timezone, retention, and
  task timeout also have built-in defaults and do not belong in the minimal
  production environment file.

## Derived Paths

From `RUSTZEN_RUNTIME_ROOT`, the backend derives:

- `web/dist`
- `data/`
- `data/uploads`
- `data/avatars`
- `logs`

Avatar public URLs use:

- `RUSTZEN_FILES_PREFIX` for uploads
- `<RUSTZEN_FILES_PREFIX>/avatars` for avatars

## Serving

`apps/server/src/infra/app.rs` mounts:

- upload files at `RUSTZEN_FILES_PREFIX`
- avatar files at `<RUSTZEN_FILES_PREFIX>/avatars`
- frontend static files from `web/dist`

The backend must not depend on build-machine absolute paths.

## Tests

`crates/config/src/lib.rs` and `crates/runtime/src/lib.rs` include unit tests for:

- local default runtime root
- derived runtime paths
- avatar public prefix
