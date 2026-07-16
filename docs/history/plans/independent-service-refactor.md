# Independent Service Refactor Plan

## Status

This file is an implementation proposal and execution baseline. It is not
current implementation truth until the refactor is complete and the current
architecture documents are updated.

Prepared against repository commit `a0b5c32` on 2026-07-15. The verified
baseline is one `rz` binary with four independent server process modes under
`apps/server/`. The target is four independently runnable backend binaries in
the same repository, delivered as one signed release.

## Decision

The refactor must keep the operational model small:

- one repository;
- one Web application;
- four backend applications: Admin, Monitor, Insights, and Reports;
- four independent server processes and four listening ports;
- one additional outbound-only Monitor Agent mode with no listening port;
- one release version, one signed release bundle, and one rollback boundary;
- fixed same-host service locations with code defaults;
- no custom service registry or discovery system;
- no per-request database, TOML, or Manifest reads;
- no duplicate API route and permission declarations;
- no independent module releases in this phase.

Process isolation is required. A Monitor, Insights, or Reports failure must not
terminate Admin or another module.

## Verified Current Baseline

The current repository has:

- `apps/server/` as the only backend package;
- `rz admin serve`, `rz monitor controller`, `rz monitor agent`,
  `rz insights worker`, and `rz reports worker` command modes;
- Admin on port `9801` and loopback services on ports `9802` through `9804`;
- separate Admin, Monitor, Insights, and Reports SQLite databases;
- public module handlers in `apps/server/src/features/`;
- internal module implementations in `apps/server/src/processes/`;
- HMAC-SHA256 internal requests bound to contract version, timestamp, method,
  path, and capability;
- route capabilities registered by `route_with_permission` and synchronized
  into the Admin `menus` table at startup;
- in-memory user capability caching;
- one `reqwest::Client` constructed by the current helper for each internal
  request;
- one signed `rz-<version>-<arch>` binary used by four systemd services.

The last two items are important migration targets: the new gateway must reuse
one HTTP client, and the single binary artifact becomes a single bundle that
contains four binaries.

## Target Repository Layout

```text
apps/
├── admin/
│   ├── Cargo.toml
│   ├── migrations/
│   └── src/
│       ├── main.rs
│       ├── app.rs
│       ├── config.rs
│       ├── common/
│       ├── infra/
│       ├── middleware/
│       └── features/
│           ├── account/
│           ├── auth/
│           ├── dashboard/
│           ├── gateway/
│           ├── manage/
│           └── system/
├── monitor/
│   ├── Cargo.toml
│   ├── module.toml
│   ├── migrations/
│   └── src/
│       ├── main.rs
│       ├── app.rs
│       ├── config.rs
│       ├── common/
│       ├── infra/
│       ├── middleware/
│       └── features/
│           ├── heartbeat/
│           ├── metrics/
│           └── nodes/
├── insights/
│   ├── Cargo.toml
│   ├── module.toml
│   ├── migrations/
│   └── src/
│       ├── main.rs
│       ├── app.rs
│       ├── config.rs
│       ├── common/
│       ├── infra/
│       ├── middleware/
│       └── features/
│           ├── overview/
│           ├── projects/
│           └── tracking/
├── reports/
│   ├── Cargo.toml
│   ├── module.toml
│   ├── migrations/
│   └── src/
│       ├── main.rs
│       ├── app.rs
│       ├── config.rs
│       ├── common/
│       ├── infra/
│       ├── middleware/
│       └── features/
│           ├── files/
│           ├── jobs/
│           └── templates/
├── web/
crates/
├── auth/
├── config/
├── ipc/
├── runtime/
└── storage/
deploy/
```

Every owned business feature uses the established `mod.rs`, `handler.rs`,
`service.rs`, `repo.rs`, and `types.rs` layers. Handlers do not contain SQL,
services orchestrate behavior, and repos own persistence. Each application owns
its migrations and can compile and test independently.

`crates/ipc/` is the only new shared crate. It has four real consumers and owns
the small internal contract: Manifest types, route metadata, request signing,
signature verification, and delegated request context. Do not split this into
separate discovery, contract, gateway, or SDK crates.

## Runtime Topology

| Application | Binary and mode | Default bind | Database |
| --- | --- | --- | --- |
| Admin | `rz-admin serve` | `0.0.0.0:9801` | `data/db/admin.db` |
| Monitor | `rz-monitor controller` | `127.0.0.1:9802` | `data/db/monitor.db` |
| Insights | `rz-insights serve` | `127.0.0.1:9803` | `data/db/insights.db` |
| Reports | `rz-reports serve` | `127.0.0.1:9804` | `data/db/reports.db` |
| Monitor Agent | `rz-monitor agent` | no listener | no controller database |

Only Admin is exposed as the general HTTP API. Nginx terminates HTTPS and sends
Web and API traffic to Admin. Module service ports remain loopback-only.

The Monitor Agent submits to the Admin Monitor prefix. Admin forwards the
explicitly declared public heartbeat route, and Monitor validates the separate
agent credential. The Insights tracking endpoint follows the same gateway path
but validates its project key and origin inside Insights.

## Application Ownership

### Admin

Admin owns:

- login, JWT, current user, account, users, roles, menus, dictionaries, logs,
  tasks, deployment, and the embedded Web application;
- the fixed module list and module enabled state;
- user capability decisions;
- the background Manifest synchronizer;
- the in-memory module route registry;
- gateway forwarding and delegated request signing;
- menu and system capability reconciliation.

Admin does not own Monitor, Insights, or Reports business handlers or SQL after
the migration.

### Monitor

Monitor owns Agent heartbeat validation, nodes, latest and retained metrics,
online state, Monitor SQLite migrations, and the Agent runtime mode.

### Insights

Insights owns project keys, origin allowlists, event ingestion, overview
aggregation, retention, and Insights SQLite migrations.

### Reports

Reports owns templates, jobs, output files, restart recovery, retention, and
Reports SQLite migrations.

## Fixed Service Location, Not Service Discovery

Admin has a fixed allowlist of three modules:

```text
monitor  -> http://127.0.0.1:9802
insights -> http://127.0.0.1:9803
reports  -> http://127.0.0.1:9804
```

The host and ports have code defaults and optional environment overrides. Both
Admin and each service read the same port variable, so changing a port does not
require storing a duplicate endpoint in the database.

This phase does not support arbitrary runtime registration, leases, heartbeats
to a registry, multi-instance load balancing, Consul, Nacos, or Kubernetes
discovery. Adding a new built-in module requires a repository change and a full
release. Updating an existing service does not require an Admin restart because
Admin synchronizes its Manifest in the background.

## Module TOML

Each module embeds one `module.toml`. It contains only stable identity and
default menu presentation. It never contains API method, API path, or API
permission mappings.

```toml
[module]
id = "reports"
name = "Reports"
api_prefix = "/api/reports"
contract_version = 1

[[menus]]
code = "reports"
title = "Reports"
path = "/reports"
icon = "file-text"
sort_order = 30
permission = "reports:view"
```

The menu permission may reference a capability declared by the module routes.
Manifest validation rejects a menu permission outside the module namespace or
one not present in the module capability catalog.

## API Route and Permission Source

API routes and their required capabilities are declared exactly once in Rust.
The current router extension remains the architectural source, but it becomes
method-aware so the HTTP method can be collected without repeating it.

Target API shape:

```rust
ModuleRouter::new()
    .get_with_permission("/jobs", list_jobs, Require(reports::VIEW))
    .post_with_permission("/jobs", create_job, Require(reports::MANAGE))
    .get_with_permission("/jobs/{job_id}", get_job, Require(reports::VIEW))
```

An explicitly unauthenticated gateway route uses a separate helper:

```rust
ModuleRouter::new().post_public("/track", track)
```

`public` only means that Admin does not require a logged-in user. The target
handler must still perform its domain authentication, such as a project key or
Monitor Agent token.

These helpers perform three jobs together:

1. register the Axum handler;
2. attach the local delegated-capability middleware;
3. collect method, route pattern, access mode, and capability for the runtime
   Manifest.

Do not maintain a second TOML or hand-written JSON route list.

## Runtime Manifest

Every module exposes a loopback-only read endpoint:

```text
GET /internal/v1/manifest
```

The response is generated at startup from the embedded `module.toml` plus the
route metadata collected from code:

```json
{
  "module": "reports",
  "name": "Reports",
  "apiPrefix": "/api/reports",
  "contractVersion": 1,
  "releaseVersion": "0.6.0",
  "menus": [
    {
      "code": "reports",
      "title": "Reports",
      "path": "/reports",
      "icon": "file-text",
      "sortOrder": 30,
      "permission": "reports:view"
    }
  ],
  "routes": [
    {
      "method": "GET",
      "path": "/jobs",
      "access": "protected",
      "permission": "reports:view"
    },
    {
      "method": "POST",
      "path": "/jobs",
      "access": "protected",
      "permission": "reports:manage"
    }
  ]
}
```

There is no manually maintained Manifest version or route ID. A route is
identified by `module + method + path pattern`. Admin computes SHA-256 over the
received Manifest bytes and uses that local hash only to detect changes.

`contractVersion` is the internal protocol version, not the release version.
Admin accepts the exact versions it implements. Compatible route additions and
permission changes keep the same contract version. A breaking Manifest or
delegation schema change requires a coordinated full release.

## Manifest Synchronization

Synchronization is background control-plane work and never runs inside an API
request.

1. Admin starts even if every module is unavailable.
2. A background task polls each enabled module Manifest every 10 seconds with a
   one-second timeout. These are code constants, not environment variables.
3. Admin hashes the response. An unchanged hash updates only in-memory health
   and last-seen state.
4. A changed Manifest is parsed and validated.
5. Admin reconciles system permissions and default menus in one SQLite
   transaction.
6. After the transaction commits, Admin atomically replaces that module's
   in-memory route registry.
7. The next request uses the new registry without restarting Admin.

Validation requires:

- expected fixed module identity;
- expected API prefix and module namespace;
- supported contract version;
- supported HTTP methods and route syntax;
- no duplicate or ambiguous method and path patterns;
- every protected route has one module-scoped permission;
- public routes are explicit;
- menu permissions exist in the route capability catalog;
- no `*` grant and no capability from another module.

If a new Manifest is invalid, Admin retains the last-known-good snapshot for
diagnosis, marks the module incompatible, and returns `503` without forwarding
module requests. It does not partially update the database or expose new
routes.

This flow handles service startup after Admin, service restart, and service
update without an Admin restart.

## Gateway Request Flow

Admin owns one fixed gateway prefix for each built-in module:

```text
/api/monitor/*
/api/insights/*
/api/reports/*
```

The gateway is a catch-all transport, but authorization is not prefix-only.
For every request it matches:

```text
module + HTTP method + normalized relative path
```

against the compiled in-memory route registry. Route patterns use the same
Axum-style `{parameter}` syntax declared by the service. Query strings do not
participate in permission matching. Unknown routes return `404`.

For a protected route:

1. Admin resolves the route and required capability in memory.
2. Admin checks the already-loaded `CurrentUser` capability set in memory.
3. Admin signs one delegated request context.
4. Admin streams the request to the service through a reused HTTP client.
5. The service verifies the signature and checks that the delegated capability
   equals the capability required by the local handler.
6. The handler executes.

For a public route, Admin skips user authorization but signs an explicit public
delegation. The service still verifies the Admin signature and performs its
domain credential checks.

Response status, headers, and body are streamed back. The gateway must not
deserialize normal JSON payloads into `serde_json::Value` merely to forward
them.

## Authorization Boundary

The two checks have different responsibilities:

- Admin is the only component that decides whether a user has a capability.
- A module service only verifies that Admin authorized this exact request for
  the capability required by the local handler.

Admin never sends the user's full role or permission list. The signed context
contains only:

- contract version;
- timestamp;
- request ID;
- user ID or anonymous marker;
- module;
- HTTP method;
- normalized internal path;
- required capability or explicit public marker.

The signature uses HMAC-SHA256 and expires after 30 seconds. The service binds
verification to the actual method and path before installing a delegated
request context. A direct unsigned request to a protected service handler is
rejected.

Menu visibility and button visibility remain user-interface behavior, not an
authorization boundary. Direct API access still passes through Admin and the
service check.

## Menu, Capability, and Module State

Storage responsibilities are intentionally split:

| Data | Source and storage |
| --- | --- |
| Module identity and default menus | embedded `module.toml` |
| API method, path, and permission mapping | Rust route declaration |
| Runtime Manifest and service health | Admin memory |
| Compiled gateway route matchers | Admin memory |
| Module enabled state | Admin SQLite |
| System menu and permission definitions | Admin SQLite, reconciled from Manifest |
| Menu title, icon, sort, visibility overrides | Admin SQLite |
| Role capability assignments | Admin SQLite |

Add a minimal `modules` table containing the fixed module ID and enabled state.
Endpoints remain configuration, not database data. Health, last-seen time,
Manifest content, and route registries remain memory-only.

Reconciliation rules:

- system rows are created or updated from the current valid Manifest;
- `is_manual = TRUE` menu overrides are preserved;
- existing custom role grants are preserved;
- a new capability is unassigned for custom roles by default;
- built-in role policy is synchronized from the valid capability catalog;
- a removed system capability is marked inactive rather than immediately
  deleted;
- a module cannot grant capabilities to roles;
- a module cannot declare `*` or another module's namespace.

The existing menu and role pages remain the editing surfaces. Add one small
System Modules page for module enabled state and current health. Do not allow
editing endpoints, API prefixes, route methods, route paths, permissions, or
contract versions through the UI.

Menu behavior uses stable state:

- disabled or incompatible modules are omitted;
- enabled modules are filtered by user capability;
- a temporary service outage keeps the permitted menu visible and returns
  `503` from its API instead of constantly changing navigation.

## Performance Contract

The extra permission layer must remain constant-time control logic. The hot
request path contains:

- one in-memory route match;
- one in-memory capability lookup;
- one HMAC generation;
- one loopback HTTP hop over a reused connection;
- one service-side HMAC verification and exact capability comparison.

The hot path must not contain:

- a SQLite permission or route query;
- a TOML read;
- a Manifest fetch or parse;
- a service discovery lookup;
- construction of a new HTTP client;
- transfer of the user's full permission set;
- JSON parsing and re-serialization by the gateway.

Use one long-lived `reqwest::Client` in Admin state with connection reuse and a
bounded request timeout. Build immutable route registries off the request path
and swap them only after successful validation and database commit.

Performance acceptance requires a release-build same-host comparison between a
small direct service endpoint and the same endpoint through Admin. Record p50,
p95, and p99 gateway overhead after warm-up. The initial investigation gate is
a p95 delta no greater than 2 ms at concurrency 32; a larger result must be
profiled before acceptance. This is a target, not a verified current result.

Tests must also prove that a warm protected request performs no permission,
menu, module, or Manifest database query.

## Configuration and Environment Rules

Each binary loads a focused config type from `crates/config/` instead of one
monolithic struct containing every application's settings. Shared parsing and
runtime path helpers remain in the crate.

Code defaults cover local development:

- Admin host and port;
- internal host and module ports;
- SQLite paths and pool tuning;
- runtime directories;
- timezone;
- logging;
- retention and background intervals;
- request timeouts.

The production `.env.example` contains only required production values:

```dotenv
RUSTZEN_ENV=production
RUSTZEN_RUNTIME_ROOT=.
RUSTZEN_JWT_SECRET=replace-me
RUSTZEN_IPC_TOKEN=replace-me
RUSTZEN_MONITOR_AGENT_TOKEN=replace-me
RUSTZEN_DEPLOY_SIGNATURE_REQUIRED=true
RUSTZEN_DEPLOY_VERIFY_KEY=replace-me
```

The build step replaces the public verification-key placeholder. Production
startup rejects remaining secret or verification placeholders.

Optional overrides are documented but omitted from `.env.example`:

- `RUSTZEN_ADMIN_HOST`
- `RUSTZEN_ADMIN_PORT`
- `RUSTZEN_INTERNAL_HOST`
- `RUSTZEN_MONITOR_PORT`
- `RUSTZEN_INSIGHTS_PORT`
- `RUSTZEN_REPORTS_PORT`
- `RUSTZEN_ADMIN_SQLITE_PATH`
- `RUSTZEN_MONITOR_SQLITE_PATH`
- `RUSTZEN_INSIGHTS_SQLITE_PATH`
- `RUSTZEN_REPORTS_SQLITE_PATH`
- `RUSTZEN_DB_MAX_CONN`
- `RUSTZEN_DB_MIN_CONN`
- `RUSTZEN_DB_CONN_TIMEOUT`
- `RUSTZEN_DB_IDLE_TIMEOUT`
- `RUSTZEN_JWT_EXPIRATION`
- `RUSTZEN_TIMEZONE`
- `RUSTZEN_TASK_RUN_TIMEOUT_SECONDS`
- `RUSTZEN_MONITOR_CONTROLLER_URL` for a remote Monitor Agent

Environment rules:

- do not write an optional variable when no override is required;
- especially, never write an empty `Option<u64>`, `Option<u8>`, or other
  optional numeric value;
- do not replace an absent numeric override with `0` because `Some(0)` has a
  different meaning;
- do not keep blank `NAME=` lines as documentation;
- an explicitly supplied empty or malformed value is a startup error, not a
  fallback trigger;
- do not preserve legacy variable aliases during the breaking refactor.

## Process Management

systemd owns process lifecycle. Do not make Admin start, stop, or supervise
module processes.

Add `rz.target` with `Wants=` for the four server services. Each service uses
`PartOf=rz.target`, `Restart=on-failure`, and its own start-limit policy. Do not
use `Requires=` between the services because one module failure must not stop
another service.

Expected operations:

```bash
systemctl enable --now rz.target
systemctl restart rz-monitor.service
systemctl status rz.target
```

The Monitor Agent unit is installed only on managed nodes and is not part of the
server `rz.target`.

No `rz-bin`, launcher, or custom process supervisor is added.

## Release and Rollback

All four Cargo packages use one workspace release version. The Web version is
updated by the same version command.

One signed release bundle contains:

```text
rz-<version>-<arch>/
├── bin/
│   ├── rz-admin
│   ├── rz-monitor
│   ├── rz-insights
│   └── rz-reports
├── systemd/
├── config/rz.env
└── setup-layout.sh
```

The installed layout uses one atomic release-directory link:

```text
/opt/rz/
├── current -> releases/<version>
├── releases/<version>/bin/{rz-admin,rz-monitor,rz-insights,rz-reports}
├── config/rz.env
├── data/db/{admin,monitor,insights,reports}.db
└── data/reports/
```

systemd units execute binaries below `/opt/rz/current/bin/`. The Admin update
worker verifies the complete bundle, backs up all four databases, installs one
versioned directory, switches `current` once, and restarts Monitor, Insights,
Reports, and Admin through health gates. Rollback restores the previous
directory link and the databases belonging to processes that entered the
restart sequence.

Do not implement module-only activation, separate service versions, long-lived
mixed releases, or a compatibility fallback to the old single binary.

## Failure Behavior

| Condition | Required result |
| --- | --- |
| Unknown module or route | `404` |
| Missing login on protected route | `401` |
| User lacks capability | `403` |
| Module disabled | `503` |
| Module process unavailable | `503` for that module only |
| Manifest incompatible or invalid | `503`, no partial sync |
| Invalid or expired delegated signature | service rejects request |
| Capability does not match local handler | service returns `403` |
| One service crashes | systemd restarts it; other services remain available |
| Admin starts before services | Admin starts; modules appear after background sync |
| Service restarts with a changed valid Manifest | Admin syncs without restart |

## Execution Model

This is a coupled, structure-impact and contract-impact migration. Use one
sequential owner because workspace membership, shared route contracts, source
moves, migration ownership, release packaging, and removal of old adapters must
stay synchronized. Do not run independent writers against the split until the
shared IPC contract and file ownership are frozen.

### Task 1: Freeze behavior and add the IPC contract

**Type:** contract-impact.

**Required reads:** repository rules, current module public routes and response
types, `apps/server/src/processes/`, `crates/auth/`, current migrations, and
`justfile`.

**Owned scope:** new `crates/ipc/`, workspace manifest, contract tests, and only
the minimum auth interfaces required by delegated checks.

**Do not touch:** frontend behavior, deployment layout, or remove current
process implementations yet.

**Steps:**

1. Add Manifest, menu, route, access-mode, and delegated-context types.
2. Move HMAC signing and verification from the server process helper.
3. Add method-aware module route helpers and public-route support.
4. Add canonical method/path and namespace validation.
5. Add tests for signature expiry, method/path binding, cross-module denial,
   duplicate routes, public-route declaration, and deterministic Manifest
   generation.

**Validation:** `cargo test -p rustzen-ipc`, `cargo test -p rustzen-auth`, and
`cargo check --workspace`.

**Done:** the contract is usable by all four applications without depending on
`apps/server/`.

**Reject:** duplicated route metadata, a second shared crate, per-request
storage access, or unreviewed contract drift.

### Task 2: Split the four applications

**Type:** structure-impact.

**Dependency:** Task 1.

**Required reads:** current Admin features, process implementations, migration
folders, backend guide, configuration and database bootstrap.

**Owned scope:** `apps/admin/`, `apps/monitor/`, `apps/insights/`,
`apps/reports/`, workspace members, and each application's migrations.

**Do not touch:** public Web API paths or business behavior.

**Steps:**

1. Move Admin ownership from `apps/server/` to `apps/admin/`.
2. Move Monitor migrations and behavior into complete Monitor feature layers.
3. Move Insights migrations and behavior into complete Insights feature
   layers.
4. Move Reports migrations and behavior into complete Reports feature layers.
5. Preserve current public response shapes and module capability codes.
6. Embed Web assets only in Admin.
7. Remove old `processes/` code only after the corresponding application tests
   pass.

**Validation:** package tests for each application, `cargo test --workspace`,
and API contract tests comparing the preserved public endpoints.

**Done:** four binaries compile and each service starts with only its own
database and migrations.

**Reject:** SQL left in handlers, copied duplicate implementations, cross-module
repo calls, changed public response contracts, or stale `apps/server` ownership.

### Task 3: Implement Admin synchronization, gateway, and permissions

**Type:** contract-impact and migration.

**Dependency:** Task 2.

**Required reads:** current permission cache and menu sync, auth middleware,
role-menu schema, module frontend routes, and the frozen IPC contract.

**Owned scope:** Admin gateway and module features, Admin module migration,
permission reconciliation, module API, and minimal Modules UI.

**Do not touch:** module business SQL or add endpoint editing and runtime module
registration.

**Steps:**

1. Add fixed module specs and the minimal enabled-state table.
2. Add the background Manifest synchronizer and validation.
3. Build immutable in-memory method/path route matchers.
4. Add transactional capability and menu reconciliation.
5. Add streaming gateway forwarding through one reused HTTP client.
6. Add user authorization and signed single-request delegation.
7. Add module list/toggle APIs and the small Modules page.
8. Remove Admin's old module-specific proxy handlers after parity is proven.

**Validation:** tests for startup ordering, service restart, Manifest change,
invalid Manifest rollback, disabled modules, route matching, role checks,
manual menu preservation, and direct-service rejection.

**Done:** service updates synchronize without Admin restart, and protected
requests make one user permission decision plus one service delegation check.

**Reject:** prefix-only authorization, DB or Manifest access in the request hot
path, full permission-list forwarding, JSON proxy re-serialization, or partial
database/registry updates.

### Task 4: Simplify configuration

**Type:** contract-impact.

**Dependency:** Tasks 2 and 3.

**Required reads:** `crates/config/`, `.env.example`, release config generation,
all four startup paths, and systemd environment usage.

**Owned scope:** focused config structs, target environment names, examples,
tests, and stale-variable removal.

**Do not touch:** add compatibility aliases or expose code-owned intervals as
new environment variables.

**Steps:**

1. Split the monolithic config into shared primitives and per-application
   config types.
2. Keep safe code defaults for local development.
3. Rename ambiguous Admin and internal host variables in one breaking change.
4. Add the separate Monitor Agent credential and remote controller URL.
5. Reduce `.env.example` to required production values.
6. Remove every empty optional value and all unused config fields.
7. Add tests proving absent numeric options remain `None` and explicit zero is
   not treated as absence.

**Validation:** config tests, startup tests for all binaries, production
placeholder rejection, and a stale `RUSTZEN_*` reference search.

**Done:** each process parses only relevant settings and local startup still
needs no `.env`.

**Reject:** blank optional numeric variables, `0` as an absence sentinel,
fallback aliases, or duplicated endpoint settings.

### Task 5: Replace packaging and systemd topology

**Type:** structure-impact.

**Dependency:** Tasks 2 through 4.

**Required reads:** Dockerfile, build and signing scripts, deploy service files,
installer, update worker, release schema, and deployment guide.

**Owned scope:** unified four-binary bundle, installer, `rz.target`, service
units, update and rollback logic, and build commands.

**Do not touch:** independent service release versions or an additional
launcher.

**Steps:**

1. Make one workspace version authoritative for the four binaries.
2. Build and sign one bundle containing all binaries and deployment files.
3. Install versioned release directories and one atomic `current` link.
4. Point each unit at its binary and attach it to `rz.target` with `Wants=`.
5. Update the transient Admin update worker for bundle verification, database
   backups, health-gated restart, interruption recovery, and rollback.
6. Update `justfile`, installer tests, and release marker validation.

**Validation:** `just build-native`, `just build`, installer validation, apply
and rollback integration tests, and independent service termination tests.

**Done:** one bundle installs, starts, updates, and rolls back four isolated
services as one release.

**Reject:** four separately activated versions, multiple active release links,
`Requires=` coupling, an old single-binary fallback, or an unverified rollback.

### Task 6: Close verification and documentation

**Type:** integration and review.

**Dependency:** all prior tasks.

**Owned scope:** verification scripts, current architecture, project map,
backend, permission and deployment guides, README, document indexes, and stale
reference cleanup.

**Steps:**

1. Replace `verify-processes` with a four-service verification target.
2. Test service startup in every order and independent termination.
3. Test all four database corruption and restore boundaries.
4. Test Manifest refresh after a service-only restart and route change.
5. Test protected, public, denied, disabled, unavailable, and incompatible
   request paths.
6. Run and record the gateway latency comparison.
7. Update current-truth documentation only after the implementation passes.
8. Search for old binary commands, `apps/server`, `processes`, old environment
   names, old artifact paths, and stale systemd commands.
9. Run `repo-review` over the complete structure and contract chain before
   commit.

**Validation:**

```text
cargo test --workspace
just check
just build-native
just build
just verify-services
git diff --check
```

**Done:** source, commands, tests, release assets, current docs, and runtime
behavior describe the same four-application architecture.

**Reject:** skipped runtime isolation, sync, rollback, permission, or
performance evidence; stale current-truth documentation; or unrelated changes
in the final diff.

## Final Acceptance Checklist

- [ ] Four backend Cargo packages and four binaries exist.
- [ ] Every module owns full feature layers and its migrations.
- [ ] Public Web API paths and response shapes remain compatible.
- [ ] Admin starts and logs in when all modules are down.
- [ ] One module failure does not affect another process.
- [ ] Existing module updates synchronize without restarting Admin.
- [ ] Route, method, access mode, and capability have one Rust source.
- [ ] TOML contains only module metadata and default menu presentation.
- [ ] Gateway routes and health are in memory; mutable grants and menu
      overrides are in SQLite.
- [ ] Protected hot-path requests perform no DB, TOML, Manifest, or discovery
      access.
- [ ] Admin reuses one HTTP client and streams proxy bodies.
- [ ] Admin checks user capability; services verify signed delegation.
- [ ] Direct unsigned module access is rejected.
- [ ] Optional numeric environment values are absent when unset.
- [ ] `.env.example` has no blank optional assignments.
- [ ] systemd uses `rz.target` with failure isolation.
- [ ] One signed release bundle and one rollback boundary remain.
- [ ] Gateway latency results are recorded and reviewed.
- [ ] Current documentation and command targets are updated after validation.

## Non-Goals

- arbitrary runtime plugin or third-party module registration;
- custom service discovery;
- multi-host or multi-instance routing;
- Kubernetes, Consul, Nacos, Kafka, Redis, or a service mesh;
- independent module versions or releases;
- dynamic frontend code loading;
- sending full user roles or capabilities to services;
- service-to-service role database queries;
- per-request Manifest, TOML, or module database reads;
- compatibility fallbacks for the old binary, paths, commands, or environment
  names.

## Not Verified

- The target four-binary architecture has not been implemented.
- The Manifest and method-aware router APIs shown here are proposed interfaces.
- The `modules` migration and Modules UI do not exist yet.
- The bundle installer, atomic directory link, and `rz.target` do not exist yet.
- No gateway latency benchmark has been run; the performance threshold is an
  acceptance target.
- Exact file moves may change during implementation if current source ownership
  proves different, but the application, contract, permission, persistence,
  release, and non-goal boundaries must not drift without explicit approval.
