# RustZen Admin Product Boundary

Status: current foundation specification.

## Product boundary

RustZen Admin is one self-hosted operations console delivered as one signed
release. The release contains four independently restarted server processes but
keeps one version and one rollback boundary:

- Admin owns identity, RBAC, module control, release management, and the Web
  application.
- Monitoring owns managed nodes, metrics, probes, and incidents.
- Analytics owns product-event collection and analysis.
- Reports owns target-backed browser filling templates and runs.

The current product does not contain a fifth service, a dynamic plugin system,
or independently versioned modules.

## Users and core journeys

- Owner configures the installation, roles, modules, and releases.
- Admin performs day-to-day operations without owner-only release authority.
- Viewer reads the concrete module capabilities granted by the module
  Manifests.
- An operator can inspect module health, monitor nodes and checks, query
  analytics observations, and execute or inspect report-filling runs without
  leaving the Admin console.

Module failure must not prevent Admin login or make an unrelated module
unavailable.

## Product language

| Product term | Current meaning | Product owner |
| --- | --- | --- |
| Admin | Control plane, identity, RBAC, release, and Web host. | Admin |
| Monitoring | Node, metric, probe, and incident operations. | Monitoring |
| Analytics | Instance-wide event overview and detail queries. | Analytics |
| Reports | Target systems, browser filling templates, runs, artifacts, and live frames. | Reports |
| Automation | An internal Reports capability, not a separately shipped module. | Reports |
| Report Center | A possible future cross-module report catalog. It is not implemented. | Deferred |

Technical ownership and stable internal names are defined in
[`architecture.md`](../architecture.md) and
[`project-map.md`](../project-map.md).

## Confirmed decisions

1. Current modules keep independent failure and data-ownership boundaries.
2. A new module starts from a live comparison with the relevant former
   standalone repository. The comparison preserves product behavior, not old
   directory layout or duplicated platform code.
3. Existing Admin identity, RBAC, deployment, navigation, and Web shell are
   reused. A module must not import a second copy from a former repository.
4. Cross-module code moves to a shared owner only after it has compatible real
   consumers and an independently verifiable contract. Security and protocol
   consistency may justify extraction earlier than ordinary presentation code.
5. Module business meanings, status lifecycles, calculations, data selection,
   and failure semantics remain with the module.
6. The current UI specification records the selected visual direction. Its
   package approval remains governed by `docs/ui/evaluation.yaml` and
   `docs/ui/artifact-manifest.yaml`; a new or changed product surface requires
   a scoped UI specification before frontend implementation.
7. Dashboard is a control-plane landing page: it shows account totals and
   module health. Detailed host resources remain owned by System Status, while
   module metrics and trends remain on their Monitoring and Analytics pages.
8. Dictionary management is not a current product capability because no
   in-repository workflow consumes it. Its HTTP surface, page, navigation, and
   permission are removed; the historical SQLite table remains dormant for
   upgrade compatibility and is not a supported integration contract.

## Legacy-product decisions

The evidence and path-level comparison are recorded in
[`legacy-module-comparison.md`](../reference/legacy-module-comparison.md).

### Monitoring

Retain and extend the current Monitor implementation. The former
`rustzen-inspect` is a behavior reference for alert policies, agent-side
collection, time-drift handling, and period reports. Do not copy its Admin,
system, project, deployment, permission, or runtime-layout layers.

Alert policy management and period reports are separate future feature slices;
they are not authorized by this foundation specification alone.

### Analytics

Retain the current single-project, instance-wide Analytics behavior. The former
`rustzen-analytics` is the reference for a possible multi-project evolution:
project lifecycle, stable project keys, browser-origin and application-package
allowlists, bounded ingestion, aggregation, and richer project queries.

Multi-project behavior changes event identity, permissions, navigation, and
data ownership. It requires one dedicated feature specification and migration
plan before implementation. The old repository's duplicate Admin and deploy
features must not return.

### Reports and Automation

Retain the current target, flow, run, step, screenshot, artifact, cancellation,
and live-frame loop. The former `rustzen-report` is the behavior reference for
possible account credentials, datasets, upload processing, a richer expression
and group DSL, suspend/resume semantics, scheduled runs, and detailed live job
events.

Each capability is a separate feature slice. The old authentication, users,
system settings, deployment, and application shell are rejected because Admin
already owns them. The browser runtime stays Reports-owned until another real
module needs the same semantics; it must not become a generic workflow engine
in advance.

### Report Center

A cross-module report catalog, common report summary, document renderer, and
artifact catalog are deferred. They require at least two real report producers,
an explicit permission model, and a product specification for degraded module
behavior. They do not justify a fifth process or a new contract crate today.

## Non-goals

- Whole-repository source copying from a former product.
- Compatibility wrappers for former HTTP paths, database names, binaries, or
  deployment layouts.
- A universal business status enum, CRUD framework, form DSL, dashboard
  builder, repository layer, or workflow engine.
- A generic dictionary administration surface without a current product
  consumer.
- Cross-database joins or one module reading another module's SQLite database.
- Moving a capability to a shared package before current consumers prove the
  same contract.

## Decision status

- Confirmed: the current product has Admin, Monitoring, Analytics, and Reports
  in one release; Automation remains part of Reports.
- Confirmed: former products are capability evidence, not whole-product
  migration targets.
- Confirmed: Dashboard is limited to control-plane summary and module health;
  detailed resource and product telemetry stay on their owning pages.
- Confirmed: Dictionary management is removed from the current surface while
  its historical SQLite table is retained as dormant upgrade data.
- Assumption: the named former repositories remain the best product-behavior
  references. Revalidate their live default branches before each slice.
- Open: which deferred capability becomes the first implementation slice.
- Open: whether Report Center will become an Admin projection, a Reports
  capability, or a separately approved module.
- Rejected: copying a former repository's Admin shell, authentication, RBAC,
  deployment, or directory layout into a module.
- Deferred: multi-project Analytics, expanded Reports automation, Monitoring
  alert policies and period reports, Report Center, and a fifth process.

## New-module acceptance

Before implementation begins, a module proposal must provide:

1. a fixed live source revision for every former repository used as evidence;
2. a capability matrix with `retain`, `reproduce`, `reuse`, `extend`, `wrap`,
   `new`, `defer`, or `drop` for every selected behavior;
3. declared product, data, permission, and navigation ownership;
4. a bounded user journey with normal and failure acceptance;
5. a reuse search through the current shared Rust and frontend owners;
6. verification for the selected behavior and every new shared contract;
7. synchronized architecture, project map, product, UI, command, and deployment
   documentation when those boundaries change.

## Ready verdict

Ready for legacy comparison and feature-specification slices.

Not ready for direct implementation of multi-project Analytics, expanded
Reports automation, Report Center, or a fifth module. Each remains deferred
until its named feature specification resolves behavior, permissions,
migration, failure states, and acceptance.
