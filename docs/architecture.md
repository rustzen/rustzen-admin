# Architecture

`rustzen-admin` is the source authority for the RustZen Admin, Monitor,
Insights, and Reports runtime. It is a Web/Rust A-class monorepo that produces
four independent server binaries in one signed release bundle, with one
version and one rollback boundary.

## Ownership

- `apps/admin/` owns the Admin API, authentication and RBAC persistence, the
  in-memory module registry and gateway, release management, Admin migrations,
  and embedded Web assets.
- `apps/monitor/` owns Monitor routes, behavior, migrations, and the optional
  managed-node Agent mode.
- `apps/insights/` owns Insights routes, behavior, and migrations.
- `apps/reports/` owns Reports routes, behavior, migrations, and output files.
- `apps/web/` owns the React UI and typed API clients.
- `crates/ipc/` owns Manifest types, module route registration, and HMAC
  delegation signing and verification.
- `crates/auth/` owns shared authentication types and capability policy.
- `crates/config/` owns focused per-application `RUSTZEN_*` parsing and runtime
  path defaults.
- `crates/storage/` owns shared SQLite connection and maintenance primitives.
- `deploy/` owns the installer, target, recovery unit, four server units, and
  the separately installed Monitor Agent unit.

There is no runtime dependency on `rustzen-core` or `rz-core`, no registry or
service discovery, and no dynamic module or independently published module
version.

## Runtime topology

| Application | Command | Default bind | Database |
| --- | --- | --- | --- |
| Admin | `rz-admin serve` | `0.0.0.0:9801` | `data/db/admin.db` |
| Monitor | `rz-monitor controller` | `127.0.0.1:9802` | `data/db/monitor.db` |
| Insights | `rz-insights serve` | `127.0.0.1:9803` | `data/db/insights.db` |
| Reports | `rz-reports serve` | `127.0.0.1:9804` | `data/db/reports.db` |

`rz-monitor agent` is an optional managed-node process. It reports to the
Monitor Controller and is intentionally not part of the server `rz.target`.

Each server owns only its database and migrations. A module failure leaves
Admin login and the other module processes available. systemd restarts each
service independently.

## Module contract and gateway

Monitor, Insights, and Reports each keep only module metadata and default menu
presentation in `module.toml`. Their Rust `ModuleRouter` calls are the single
source for HTTP method, route path, access mode, handler, and required
capability. The same registration builds the in-memory Axum router and the
runtime Manifest exposed at `GET /internal/v1/manifest`.

Admin uses fixed loopback endpoints and synchronizes enabled module Manifests
in the background. A valid change is reconciled transactionally into module
menu/capability rows, then swapped into an immutable in-memory registry. An
invalid or incompatible Manifest never partially updates database or runtime
state.

The request path performs one in-memory route lookup and one in-memory user
capability decision. Admin then streams the body through one reused
`reqwest::Client` and signs a request-scoped HMAC context bound to contract
version, timestamp, request ID, user ID, module, method, path, and the one
required capability. The module verifies that context and its local route
requirement before calling the handler. Admin does not query SQLite, read TOML,
fetch a Manifest, perform discovery, rebuild a client, send a full permission
set, or parse and re-serialize JSON on this hot path.

Public module routes still require Admin delegation at the service boundary.
Direct unsigned, expired, cross-module, or wrong-capability calls are rejected.

## Permissions and menus

The product navigation presents the stable internal services as grouped modules:

- Monitoring: overview, nodes, TCP checks, incidents, and settings below `/monitoring`;
- Analytics: overview, projects, pages, APIs, events, users, and settings below `/analytics`;
- Automation: systems/accounts, flows, runs, schedules, and settings below `/automation`.

The internal service IDs, binaries, databases, and API prefixes remain
`monitor`, `insights`, and `reports`. Each page menu owns a concrete read
capability so Manifest reconciliation, Viewer grants, route guards, and frontend
authorization use the same boundary.

- `owner` receives `*` and is the only built-in role allowed to mutate
  releases.
- `admin` receives concrete Monitor, Insights, and Reports capabilities plus
  deploy view access.
- `viewer` receives concrete read-only capabilities.

Admin persists mutable grants, module enabled state, menu overrides, and
reconciled module menu rows in SQLite. The permission cache is refreshed on
login and permission mutations; the gateway reads the cache only. Manual menu
overrides are preserved when a Manifest refreshes, and disabling a module
removes it from runtime navigation without deleting its stored overrides.

## Release topology

All four Cargo applications use the workspace version. `just build` creates and
signs one uncompressed tar bundle:

```text
target/rz/rz-<version>-<arch>.tar
└── rz-<version>-<arch>/
    ├── bin/{rz-admin,rz-monitor,rz-insights,rz-reports}
    ├── systemd/{rz.target,rz-recovery.service,rz-admin.service,
    │            rz-monitor.service,rz-insights.service,rz-reports.service}
    ├── config/rz.env
    └── setup-layout.sh
```

The initial-only installer verifies the complete bundle signature with a
separately supplied trusted public key, preserves shared configuration and data,
and installs an immutable release directory:

```text
/opt/rz/
├── current -> releases/<version>
├── releases/<version>/bin/{rz-admin,rz-monitor,rz-insights,rz-reports}
├── config/rz.env
├── data/db/{admin,monitor,insights,reports}.db
├── data/releases/rz-<version>-<arch>.tar
└── data/reports/
```

`rz.target` uses `Wants=` for recovery and the four server services. The four
services use `PartOf=rz.target`, independent restart/start-limit policies, and
no `Requires=` coupling. `rz-recovery.service` runs before them and blocks their
start if an interrupted update cannot be recovered.

Once `current` exists, the installer refuses to switch it. Upgrades run only
through the Admin update worker so no direct symlink change can create a mixed
release outside the backup, health-gate, journal, and rollback transaction.

The Admin update worker verifies the complete signed bundle and the installed
rollback release, creates consistent online backups of all four databases,
installs or verifies one release directory, atomically switches `current` once,
then restarts Monitor, Insights, Reports, and Admin through systemd-active and
release-version health gates. Rollback restores the previous link and only the
databases whose services entered the restart sequence. The durable journal and
boot recovery unit close process-crash and host-restart interruption windows.

Module-only activation, separate service versions, mixed releases, an old
single-binary fallback, and multiple active release links are not supported.

## Verification

The root `justfile` is the command authority. `just verify-services` uses
release binaries to test all 24 startup orders, independent termination, four
database corruption/restore boundaries, gateway and delegation contracts, and
the Manifest restart/change contract.

The 2026-07-15 same-host gateway comparison used
`GET /api/monitor/nodes`, release binaries, concurrency 32, 128 warm-up
requests and 320 measured requests per path. Direct p50/p95/p99 were
0.825/1.302/1.507 ms; gateway p50/p95/p99 were 1.151/1.722/1.835 ms; the
corresponding overhead was 0.327/0.419/0.328 ms. The p95 overhead passed the
2 ms investigation gate.
