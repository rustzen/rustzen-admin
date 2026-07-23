# Project Map

This is the authoritative repository navigation index. Source code, manifests,
the root `justfile`, and the nearest `AGENTS.md` remain proof.

- Scope class: versioned Web/Rust monorepo.
- Map and Git root: the repository root.
- Specialist maps: `docs/ui/component-map.json` owns the declared UI component
  mapping, while `docs/ui/evaluation.yaml` owns its current approval status;
  `docs/reference/capability-map.md` owns the short capability-owner view. This
  file links those boundaries instead of duplicating their complete
  inventories.

## Root

| Path | Value | Inspect when |
| --- | --- | --- |
| `README.md` | Human entrypoint and project summary. | You need a quick repository overview. |
| `AGENTS.md` | Repository-wide contribution constraints. | You start any task. |
| `Cargo.toml` | Workspace members and authoritative release version. | You change packages, dependencies, or versions. |
| `justfile` | Command source of truth. | You run, check, build, package, or verify. |
| `.env.example` | Minimal production configuration template. | You change runtime configuration or deployment. |

## Commands

| Task | Authoritative command |
| --- | --- |
| Start Admin, Monitor, Insights, Reports, or Web | `just dev-server`, `just dev-monitor`, `just dev-insights`, `just dev-reports`, `just dev-web` |
| Format, lint, typecheck, build, clippy, and test | `just check` |
| Exercise the four-service module contract | `just verify-modules-mvp` |
| Exercise real Reports browser filling | `just verify-automation-browser <browser-path>` |
| Build the native four-binary release | `just build-native` |
| Build the signed Linux release bundle | `just build` |

## Shared crates

| Path | Value | Inspect when |
| --- | --- | --- |
| `crates/auth/` | JWT/auth context, permission checks, and capability constants. | You change authentication or authorization policy. |
| `crates/ipc/` | Shared module response and pagination, health responses, Manifest, method-aware module router, and HMAC delegation contract. | You change a compatible module HTTP envelope, service health, module routes, or the Admin-to-module boundary. |
| `crates/config/` | Focused Admin, Monitor, Insights, and Reports configuration. | You change `RUSTZEN_*` parsing, defaults, or runtime paths. |
| `crates/storage/` | SQLite pool and maintenance primitives. | You change shared SQLite behavior. |
| `crates/runtime/` | Stable runtime-layout and compatible process-logging helpers. | You change runtime-root topology or shared daily-file logging mechanics. |

## Admin

| Path | Value | Inspect when |
| --- | --- | --- |
| `apps/admin/AGENTS.md` | Admin-specific backend rules. | You work below `apps/admin/`. |
| `apps/admin/src/infra/` | Admin startup, DB, auth cache, logging, config, and embedded Web serving. | You change Admin runtime wiring. |
| `apps/admin/src/features/modules/` | Fixed module state, Manifest sync, immutable registry, gateway, and module APIs. | You change module availability, sync, navigation, or forwarding. |
| `apps/admin/src/features/manage/deploy/` | Signed bundle validation, update worker, rollback, and recovery. | You change release behavior. |
| `apps/admin/src/features/auth/` | Login, logout, and current-session bootstrap. | You change sessions or token flows. |
| `apps/admin/src/features/account/` | Current-account profile, avatar, and password flows. | You change self-service account behavior. |
| `apps/admin/src/features/dashboard/` | Account totals and module-health landing data. | You change dashboard cards or module health display. |
| `apps/admin/src/features/manage/` | Logs, scheduled tasks, and deploy versions. | You change Admin management features. |
| `apps/admin/src/features/system/` | Menu, role, user, and status management. | You change RBAC or system administration. |
| `apps/admin/migrations/sqlite/` | Admin, RBAC, module-state, and release migrations. | You change Admin schema. |

## Module applications

| Path | Value | Inspect when |
| --- | --- | --- |
| `apps/monitor/src/features/` | Heartbeat, nodes, metrics, and service monitoring; incident and setting internals support the retained overview and probes. | You change Monitoring behavior. |
| `apps/monitor/migrations/` | Monitor-owned schema. | You change Monitor persistence. |
| `apps/monitor/module.toml` | Monitor metadata and default menu only. | You change module presentation metadata. |
| `apps/insights/src/features/` | Single-project tracking, instance-wide overview/details, and retention settings. | You change Analytics behavior. |
| `apps/insights/migrations/` | Insights-owned schema. | You change Insights persistence. |
| `apps/insights/module.toml` | Insights metadata and default menu only. | You change module presentation metadata. |
| `apps/reports/src/features/automation/` | Report targets, templates, browser filling runs, artifacts, live frames, and retention. | You change Reports behavior. |
| `apps/reports/migrations/` | Reports-owned schema. | You change Reports persistence. |
| `apps/reports/module.toml` | Reports metadata and page menus. | You change module presentation metadata. |

Module route method, path, access mode, capability, and handler are declared in
Rust route registration, not in `module.toml`.

## Frontend

| Path | Value | Inspect when |
| --- | --- | --- |
| `apps/web/AGENTS.md` | Frontend-specific rules. | You work below `apps/web/`. |
| `apps/web/package.json` and `apps/web/bun.lock` | Bun package and dependency lock. | You change frontend dependencies or scripts. |
| `apps/web/src/routes/` | File-based pages and route guards. | You add or change pages. |
| `apps/web/src/api/` | Typed API modules and request wrapper. | You change HTTP contracts or data access. |
| `apps/web/src/components/layout/` | Admin shell and runtime navigation. | You change menus, header, or layout. |
| `apps/web/src/store/` | Shared frontend state. | You change auth or persisted cross-page state. |

## Shortest task routes

| Task | Reading chain |
| --- | --- |
| Add or expand a module capability | `docs/product/PRODUCT.md` -> `docs/reference/legacy-module-comparison.md` -> `docs/guides/shared-capabilities.md` -> owning `apps/<module>/src/features/` -> route registration -> matching Web API and route |
| Change a module HTTP contract | owning Rust `ModuleRouter` registration -> handler/service/types -> `apps/web/src/api/<module>/contract.ts` -> representative route -> `just verify-modules-mvp` |
| Change module ownership or add a process | `docs/architecture.md` -> `Cargo.toml` -> owning app -> `crates/config/` -> deployment units/bundle scripts -> verification scripts |
| Add a shared Rust capability | `docs/guides/shared-capabilities.md` -> closest named crate -> exports -> two representative consumers -> focused tests -> `just check` |
| Add or change shared UI | `docs/ui/component-map.json` -> current component/token owner -> two representative routes -> `docs/ui/evaluation.yaml` -> frontend checks and browser verification |
| Change release behavior | `apps/admin/src/features/manage/deploy/` -> bundle/signing scripts -> `deploy/` -> `scripts/test-setup-layout.sh` and service verification |

## Verified reuse index

| Capability or product job | Canonical definition and access | Representative consumers | Boundary and evidence |
| --- | --- | --- | --- |
| Module route and Manifest | `ModuleRouter`, `Require` in `crates/ipc/src/router.rs`, exported by `crates/ipc/src/lib.rs` | Monitor checks/metrics; Insights overview/query; Reports automation | Reuse for module routes; Rust registration is the only method/path/access/capability source. Tested in `crates/ipc`. |
| Service health | `HealthResponse` in `crates/ipc/src/health.rs` | Four service health producers; Admin deploy health gate | Reuse for the fixed release health contract; module-specific diagnostics stay local. |
| Authentication and capabilities | `crates/auth/src/` exports | Admin permission checks and three module routers | Reuse policy and constants; business authorization decisions remain with the owner. |
| SQLite connection and maintenance | `crates/storage/src/{sqlite,maintenance}.rs`, exported by `crates/storage/src/lib.rs` | Four databases and retention jobs | Reuse mechanics; schemas, SQL, and retention selection stay application-owned. |
| HTTP transport | `apiRequest`, `apiUpload`, `apiDownload` in `apps/web/src/api/request.ts` | Admin and module API packages | Reuse transport; keep URLs, DTOs, and shaping in the domain API module. |
| Page hierarchy | `PageHeader`, `PageCard` in `apps/web/src/components/page/` | Dashboard/status and list/management routes | Reuse the mapped semantics and check current approval in `docs/ui/evaluation.yaml`. |
| Query feedback and table surface | `DataState`, `DataTableState`, `DataTableShell`, `TablePagination` | System, management, and module lists | Reuse states and surface; keep filters and columns route-local until semantics repeat. |
| Operational metrics | `MetricCard` in `apps/web/src/components/page/metric-card.tsx` | Monitoring and Analytics overviews | Reuse factual metrics; do not create module copies. |
| Nullable locale date-time | `formatDateTime` in `apps/web/src/lib/format-date-time.ts` | Management and system tables | Reuse only for the same `null`/empty to `-` and locale-display contract. |
| Module API envelope and page | `ApiResponse<T>`, `Page<T>`, and bounded pagination in `crates/ipc/src/response.rs` | Monitor, Insights, and Reports HTTP boundaries | Reuse only for the shared `{code,message,data}` and `{data,total,success}` wire contracts; Admin's historical top-level `total` stays local. |

Before a new declaration, search the named owner, its export or registration,
and representative consumers. Decide `reuse`, `extend`, `wrap`, justified
`new`, or `Not verified`; a map miss is not proof that no implementation exists.

## Former product references

`docs/reference/legacy-module-comparison.md` fixes the current comparison basis
for `rustzen-inspect`, `rustzen-analytics`, and `rustzen-report`. Those
repositories are behavior references only. They are not current owners or
package dependencies. New module work must select capabilities row by row and
must not copy their duplicate Admin, auth, RBAC, deployment, or Web-shell code.

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
| `docs/product/PRODUCT.md` | Current product boundary, terminology, confirmed decisions, and deferred module slices. | You change product scope or propose a new module. |
| `docs/guides/` | Current development rules. | You edit backend, frontend, permission, or deployment behavior. |
| `docs/guides/shared-capabilities.md` | Shared-code ownership and new-module intake gate. | You consider copying, extracting, or creating a shared declaration. |
| `docs/reference/` | Optional deeper current context. | Current facts and guides are not enough. |
| `docs/reference/legacy-module-comparison.md` | Fixed live-source comparison with former standalone products. | You decide which former behaviors to retain, reproduce, defer, or drop. |
| `docs/history/` | Non-current plans and records. | You need historical rationale. |

## High-risk and not-verified boundaries

- Adding a fifth server changes the signed bundle, target units, health gates,
  database backup/restore transaction, and rollback boundary.
- Multi-project Analytics changes event identity, permissions, navigation, and
  migration semantics.
- Reports credentials, datasets, uploads, DSL expansion, suspend/resume, and
  scheduling each require a separate product and failure-state specification.
- Former repository runtime behavior is not verified by this map; re-run its
  current tests and the selected `rustzen-admin` acceptance path before reuse.
