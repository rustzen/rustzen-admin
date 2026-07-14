# Architecture

`rustzen-admin` is the source authority for the RustZen Admin runtime. It is a
Web/Rust A-class monorepo and produces one complete `rz` release artifact.

## Ownership

- `crates/auth/` owns authentication and role/capability policy.
- `crates/config/` owns `RUSTZEN_*` configuration and the four database paths.
- `crates/runtime/` owns runtime layout primitives.
- `crates/storage/` owns SQLite connection and maintenance primitives.
- `apps/server/` owns the `rz` CLI, Admin API, Worker adapters, migrations, and
  embedded Web assets.
- `apps/web/` owns the React UI and typed API clients.
- `deploy/` owns the four service units and initial installation layout.

There is no runtime dependency on `rustzen-core` or `rz-core`. Monitor,
Insights, and Reports reuse Admin authentication, permission, menu, logging,
configuration, and UI carriers; old standalone authentication and system
management implementations are not migrated.

## Runtime topology

One `rz` file runs as four independent server processes:

```text
rz admin serve          -> 0.0.0.0:9801 -> data/db/admin.db
rz monitor controller   -> 127.0.0.1:9802 -> data/db/monitor.db
rz insights worker      -> 127.0.0.1:9803 -> data/db/insights.db
rz reports worker       -> 127.0.0.1:9804 -> data/db/reports.db
```

`rz monitor agent` is an additional node-side mode of the same complete source
and version line. It does not create another server release authority. Agent
heartbeats register protocol, version, OS, architecture, and available space.
Controller rollout configuration first targets explicit Canary IDs, then a
stable bounded percentage. The signed directive fixes the download URL,
SHA-256, size, OS, architecture, and version. An Agent downloads to a temporary
file, verifies it, runs the fixed candidate self-test, atomically replaces its
binary, and retains the previous binary until a successful heartbeat. Three
failed heartbeats restore the previous binary.

Admin communicates with Workers only through versioned loopback HTTP. Every
request carries a 30-second HMAC-SHA256 context bound to method, path, contract
version, and module capability. Workers independently reject expired,
cross-module, or unsigned contexts. Calls time out after five seconds.

Worker failure is degraded locally: Admin login and unrelated modules remain
available, the failed module returns service unavailable, and the dashboard
health summary probes all Workers concurrently with a one-second timeout.

## Module scope

- Monitor: authenticated Agent heartbeat, latest CPU/memory/disk metrics,
  online/offline state, 30-day metric retention, node list and detail.
- Insights: project keys stored as SHA-256 hashes, exact origin allowlists,
  `page_view` and `api_request`, PV/UV/request/error/average/P95 summaries, and
  30-day event retention. The only public ingestion endpoint is
  `POST /api/insights/track`; `/api/analytics/track` is not exposed.
- Reports: HTML templates, scalar placeholder substitution with HTML escaping,
  manual jobs, status, download, restart recovery, and 30-day output expiry.

Admin runtime files, operation logs, task-run history, Monitor metrics,
Insights events, and Reports outputs all use one fixed 30-day retention policy.
SQLite row deletion is paired with WAL checkpoint, planner optimization, and
incremental vacuum maintenance.

The modules use only fixed queries needed by these loops. They do not include
standalone auth, duplicate dashboards, general query builders, cron report
generation, or cross-database joins.

## Permissions

- `owner` receives `*` and is the only role allowed to apply releases.
- `admin` receives `monitor:view/manage`, `insights:view/manage`, and
  `reports:view/manage` through concrete synchronized leaf capabilities.
- `viewer` receives only the three `*:view` capabilities.

Frontend visibility is supplementary. Every protected route performs a backend
capability check, and each Worker verifies the signed module capability again.

## Release topology

Web assets and all four migration sets are embedded into `rz`. Production uses:

```text
/opt/rz/
├── bin/rz -> rz-<version>-<arch>
├── config/rz.env
├── data/db/{admin,monitor,insights,reports}.db
├── data/reports/
└── systemd/rz-{admin,monitor,insights,reports}.service
```

Active deployment records accept only `release`. Historical split Server/Web
records are retained in `deploy_versions_legacy` and cannot be activated.

An update uses a transient `rz update worker` outside the Admin service cgroup.
It validates the signed complete artifact, creates consistent online backups of
all four databases, atomically switches `bin/rz`, then restarts Monitor,
Insights, Reports, and Admin one at a time through health gates. A failed gate
stops the sequence and restores the previous link plus the databases owned by
processes already restarted. A durable update journal records every restarted
unit; a bounded transient-worker restart recovers interruptions without leaving
two Current releases. Long-lived mixed versions, module-only activation, and
zero-downtime dual-instance behavior are not implemented.

## Local development and verification

The root `justfile` is the command authority. The frontend uses Bun 1.3.14 and
`apps/web/bun.lock`. `just verify-processes` performs local four-process health,
termination isolation, module-unavailable behavior, database separation,
four-database corruption, and restore checks. GitHub Actions are not part of
the build or verification path for this migration.
