# rustzen-admin

`rustzen-admin` provides the RustZen Admin, Monitor, Insights, and Reports
runtime in one source repository and one signed release bundle.

A structured monorepo starting point for Rust full-stack admin systems.

> `rustzen-admin` combines an Axum backend, a React frontend, shared crates,
> deployment assets, and repository-level documentation in a single codebase
> designed for clear boundaries, maintainability, and AI-friendly collaboration.

## Overview

`rustzen-admin` is an open-source full-stack admin template built for real-world
projects, not just isolated UI demos.

The repository is organized as a monorepo:

- `crates/auth/` contains shared auth and permission capabilities for Rust services
- `crates/ipc/` contains the shared Manifest, route, and HMAC delegation contract
- `crates/storage/` contains shared SQLite pool and maintenance primitives
- `apps/admin/` contains the Admin API, gateway, RBAC, release management, and Web asset host
- `apps/monitor/` powers Monitoring and the optional managed-node Agent
- `apps/insights/` powers product Analytics and its public tracker
- `apps/reports/` powers report templates, filling runs, and live execution views
- `apps/web/` contains the React frontend application
- `deploy/` contains deployment assets and release support files
- `docs/` contains repository-level architecture and development guides
- the root keeps shared commands, workspace metadata, and collaboration entry documents

This layout keeps backend, frontend, and repository rules explicit, making the codebase easier to understand, review, and evolve.

## Screenshots

| Dashboard | Scheduled Tasks |
| --- | --- |
| ![Dashboard](./docs/assets/screenshots/dashboard.jpg) | ![Scheduled Tasks](./docs/assets/screenshots/scheduled-tasks.jpg) |

| Deploy Versions | Operation Logs |
| --- | --- |
| ![Deploy Versions](./docs/assets/screenshots/deploy-versions.jpg) | ![Operation Logs](./docs/assets/screenshots/operation-logs.jpg) |

## Repository Layout

→ Architecture summary: [docs/architecture.md](./docs/architecture.md)

## Documentation

→ Complete documentation index: [docs/README.md](./docs/README.md)

## Command Source

Use the root `justfile` as the command source of truth; inspect the relevant target before running it.

```bash
cargo run -p rustzen-admin -- serve
cargo run -p rustzen-monitor -- controller
cargo run -p rustzen-insights -- serve
cargo run -p rustzen-reports -- serve
```

Local startup is SQLite-first and does not require PostgreSQL.
SQLite connection primitives, role policy, runtime layout, and logging are owned
inside this repository; there is no `rustzen-core` runtime dependency.
Local development needs no `.env`: database paths, ports, connection-pool
limits, runtime paths, logging, timezone, JWT lifetime, and development-only
JWT/IPC secrets have built-in defaults. Use environment variables only to
override those defaults.

If startup fails with `VersionMismatch`, your local database schema is out-of-date with current migration checksums. Run:

```bash
just reset-db
cargo run -p rustzen-admin -- serve
```

If startup succeeds, the database will be recreated automatically.

## Demo

- Local demo URL: [https://admin.rustzen.dev](https://admin.rustzen.dev)
- Demo username: `superadmin`
- Demo password: `rustzen@123`

## Notes

- `README.md` and `AGENTS.md` stay as lightweight entry documents.
- `docs/history/` contains historical execution records and is not current implementation truth.

## License and Trademark

Source code is licensed under the [Apache License 2.0](./LICENSE.md). Commercial
use, modification, and distribution are permitted subject to that license.
Rustzen names, logos, domains, official package namespaces, and official
distribution channels are not included in the software license. See
[NOTICE.md](./NOTICE.md) and [TRADEMARKS.md](./TRADEMARKS.md).
