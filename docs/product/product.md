# Product Foundation

This document defines the current product positioning, direction, and module
boundaries for `rustzen-admin`. Source code remains authoritative for delivered
behavior, while [architecture.md](../architecture.md) remains authoritative for
runtime and repository structure.

## Product boundary and positioning

`rustzen-admin` is primarily a lightweight, self-hosted operations and
administration product for small deployments. It gives one installation a
single control surface for administration, monitoring, product activity, and
repeatable browser-based reporting work.

The repository is also a structured Rust full-stack reference implementation,
but product behavior takes priority over showcasing generic framework features.
New capabilities must strengthen a defined user journey instead of turning the
project into a collection of unrelated admin examples.

The product is delivered as one coherent release with four product areas:

- **Admin** is the control plane for access, system state, operations, and
  releases.
- **Monitoring** covers managed nodes, service availability, and incident
  awareness.
- **Analytics** provides lightweight visibility into activity collected by the
  deployment.
- **Reports** runs controlled, repeatable browser-based data-filling workflows.

## Target users and problems

The current target-user definition is an assumption to validate with real
adoption evidence.

### Primary user assumption

The primary user is a developer-operator or a small technical team responsible
for a self-hosted service estate. They need useful operational coverage without
adopting a large infrastructure platform or assembling several unrelated tools.

### Problems the product addresses

- administer accounts, roles, permissions, and product modules from one place;
- understand whether the installation and its managed services are healthy;
- inspect lightweight product-activity summaries and raw details;
- execute recurring browser-based reporting work with visible results and
  failure evidence;
- install and update the complete product with one version and one recovery
  boundary.

## Product principles and direction

1. **Complete loops before feature breadth.** Each module must provide a useful
   path from setup to result, failure, and recovery before adjacent features are
   added.
2. **Self-hosting must remain understandable.** Local development and small
   deployments should keep low configuration and operational overhead.
3. **One product, isolated failures.** The modules share navigation, identity,
   permissions, and releases, while a failed module must not make Admin or the
   other modules unusable.
4. **Safe operations over hidden automation.** Destructive or privileged work
   requires explicit authorization, visible status, audit evidence, and a
   recoverable failure path.
5. **Product needs outrank template completeness.** Generic CRUD examples,
   framework demonstrations, and speculative abstractions are not reasons to
   expand the product.
6. **Fixed modules before extensibility.** The current product evolves its four
   built-in areas. A dynamic plugin marketplace or independently versioned
   module ecosystem is not part of the product direction.

## Core journeys and failure expectations

### Administration

An owner can sign in, understand system status, manage users and roles, control
module availability, inspect operational records, and manage product releases.
An administrator can perform ordinary management work but cannot cross
owner-only system and release boundaries. A viewer receives read-only access to
the concrete capabilities assigned to that role.

### Monitoring

An authorized user can review monitoring health, inspect managed nodes and
their recent metrics, configure service checks, and follow the resulting
incident state. Missing data, unavailable nodes, failed checks, and module
unavailability must be distinguishable from a healthy empty state.

### Analytics

An authorized user can view an installation-wide activity overview and inspect
the available event details. Collection or query failures must be visible
without blocking other product areas, and an empty installation must explain
that no activity has been collected yet.

### Reports

An authorized user can define a target-backed template, provide run inputs,
start a filling run, and inspect step results and live or captured evidence.
Validation errors must stop an invalid run before work is queued. Runtime
failures must retain enough visible evidence to understand the failed step.
Run input is retained with the run, so users must not submit secrets until a
separate protected-credential boundary is explicitly specified and delivered.

### Shared failure expectations

- unavailable modules remain visible as unavailable rather than silently
  disappearing from system status;
- denied actions produce a clear permission result and do not partially apply;
- loading, empty, validation-error, business-error, and retry states are
  explicit on user-facing workflows;
- workflows that accept secrets provide a defined protected-storage and
  redaction boundary before those values are collected;
- long-running operations expose status and preserve an auditable outcome;
- a failed update or interrupted operation has a defined recovery result.

## Module capabilities and content

Product documents use user-facing area names, while architecture and source may
use shorter internal runtime names:

| Product area | Internal runtime name |
| --- | --- |
| Admin | Admin |
| Monitoring | Monitor |
| Analytics | Insights |
| Reports | Reports |

Module-level feature specifications must use the product-area name and state the
internal runtime name on first use when the distinction matters.

### Admin

**Purpose:** provide the trusted control plane for the complete installation.

**Current core capabilities:**

- dashboard summaries for resources, product records, and module health;
- sign-in, current-account profile, avatar, and password management;
- user lifecycle, role assignment, capability assignment, and menu management;
- module availability and system-status inspection;
- dictionaries, operation logs, scheduled maintenance tasks, and release
  management;
- owner-only controls for sensitive system and deployment operations.

**Direction:** make installation, access control, diagnosis, update, and recovery
clearer before adding general-purpose administration features.

**Non-goals:** ERP functions, arbitrary business CRUD generation, workflow
builders, or a generic low-code admin platform.

### Monitoring

**Purpose:** show whether managed nodes and selected services are available and
when operator attention is required.

**Current core capabilities:**

- monitoring overview;
- managed-node registration, heartbeat state, and metric history;
- TCP service checks;
- incident opening, acknowledgement, and resolution;
- persisted monitoring settings and bounded data retention.

**Direction:** improve the path from signal to actionable incident while keeping
configuration and diagnosis suitable for small installations.

**Non-goals:** a full observability suite, distributed tracing platform, log
warehouse, cloud-resource orchestrator, or replacement for large-scale APM.

### Analytics

**Purpose:** provide lightweight product-activity visibility inside one
installation.

**Current core capabilities:**

- collection of supported page, API, event, and user activity;
- installation-wide overview metrics;
- raw activity-detail exploration;
- bounded retention of collected activity.

**Direction:** make the small set of collected signals understandable and useful
before adding new event families or segmentation features.

**Non-goals:** a marketing automation platform, multi-tenant analytics service,
data warehouse, general BI tool, or project-management surface unless a future
product decision explicitly adds those boundaries.

### Reports

**Purpose:** automate controlled, repeatable browser-based form filling and keep
an auditable execution result.

**Current core capabilities:**

- target origins and template definitions;
- validated browser-action sequences;
- queued filling runs with step results;
- live frames, screenshots, and retained run evidence;
- interrupted-run recovery and bounded retention.

**Direction:** strengthen template authoring, validation, protected credential
handling, execution visibility, and recovery for known reporting targets before
expanding the action model.

**Non-goals:** a general robotic-process-automation platform, unrestricted
script execution, a document editor, or an open-ended browser agent.

## Product language

- The user interface supports Chinese and English. New user-facing interface
  copy must define both language variants.
- English is the canonical language for repository documentation, source
  identifiers, product-area names, and internal runtime names.
- The Chinese and English README files may present equivalent product facts in
  their respective languages.
- Internal logs are operational evidence, not user-facing product copy. A raw
  service error must not substitute for a clear user-facing message.
- Product documents use **Monitoring** and **Analytics**; implementation
  documents may use their mapped internal names **Monitor** and **Insights**.

## Shared product capabilities and exclusions

Shared product capabilities are limited to what all relevant modules need:

- identity, sessions, roles, and capability-based authorization;
- common navigation and system-status visibility;
- consistent loading, empty, error, confirmation, and feedback states;
- audit records for privileged or operational work;
- one installation, update, rollback, and recovery experience;
- Chinese and English user-interface presentation.

Shared capability does not imply that module data or business behavior should
be centralized. Each module remains responsible for its own product data and
failure behavior.

## MVP and non-goals

The current MVP is the complete usable path through Admin plus the retained
Monitoring, Analytics, and Reports journeys described above. MVP work should
prioritize correctness, understandable states, permission safety, recovery, and
consistent presentation over additional modules.

Product-wide non-goals are:

- hosted multi-tenant SaaS control plane;
- dynamic third-party plugin marketplace;
- independently installed or versioned built-in modules;
- PostgreSQL-backed operation within the current product boundary;
- generalized ERP, low-code, BI, APM, or RPA coverage;
- feature growth that lacks a named user problem and an end-to-end acceptance
  path.

## Development horizon

### Now: consolidate the product

- keep the documented module boundaries aligned with delivered behavior;
- close incomplete loading, empty, error, permission, and recovery states;
- make installation, first sign-in, module health, and updates understandable;
- preserve the minimal self-hosted operating model and release safety.

### Next: deepen proven journeys

- use adoption evidence to identify the highest-friction step in each retained
  module;
- add module depth only when it completes or materially improves a core journey;
- define notification and export needs from real operator workflows rather than
  adding broad integration catalogs.

### Later: evaluate bounded integrations

- external notifications, exports, and target-specific helpers may be evaluated
  when a repeated user need is demonstrated;
- multi-installation administration, multi-tenancy, and a broader extension
  model remain deferred and require a new product-boundary decision.

The horizon expresses direction, not promised release dates or committed
features.

## Success signals

The product is succeeding when:

- a new owner can install, sign in, understand system health, and complete one
  useful journey in each enabled module without undocumented setup;
- ordinary administrators and viewers can complete their allowed work without
  receiving owner-only controls;
- module failures are diagnosable without losing access to Admin or healthy
  modules;
- reporting runs and product updates leave understandable success, failure, and
  recovery evidence;
- new features can be traced to a retained module journey instead of generic
  template completeness.

Quantitative targets for time to first value, module adoption, execution success,
and recovery frequency are open until real usage telemetry or user feedback is
available.

## Decision register

### Confirmed

- The primary positioning is a lightweight self-hosted operations and
  administration product; the reference-template role is secondary.
- Admin, Monitoring, Analytics, and Reports are the current product areas.
- SQLite is the current supported storage backend; PostgreSQL compatibility is
  not promised. The product uses one coherent release and preserves module
  failure isolation.
- Product growth favors complete retained journeys over more modules or generic
  framework examples.
- Dynamic plugins, independently versioned modules, and broad low-code scope are
  outside the current direction.

### Assumptions

- The primary adopter is a developer-operator or small technical team.
- One installation is the appropriate product boundary for the current stage.
- Improving onboarding, failure clarity, and recovery will create more value
  than adding new feature categories.

### Open questions

- Which user segment and deployment size represent the strongest real adoption?
- Which step in each module's core journey causes the most user friction?
- Which notification and export channels are repeatedly required by operators?
- Should dictionaries and generic scheduled tasks remain visible product
  features or become internal administration utilities?
- Does the Reports name remain the clearest description of controlled filling
  automation as that workflow matures?

### Rejected for the current boundary

- positioning the product primarily as a generic admin template;
- expanding into an ERP, low-code platform, general BI system, full APM suite,
  or unrestricted RPA tool;
- treating PostgreSQL support as part of the current product boundary;
- adding modules only to demonstrate framework extensibility.

### Deferred

- hosted SaaS and multi-tenant operation;
- multi-installation fleet administration;
- third-party extension marketplace;
- broad external integration catalogs;
- mobile applications.

## Ready for module-level feature specifications

This foundation is ready to guide bounded feature specifications within Admin,
Monitoring, Analytics, and Reports. Each implementation slice must still define
its affected users, permissions, main and failure states, user-visible data
effects, non-goals, and executable acceptance criteria.

The open questions above do not block maintenance or completion of the current
core journeys. They block only proposals that would change the target audience,
add a new product area, introduce multi-tenancy, or widen a module beyond its
stated purpose.
