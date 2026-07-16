# AI Coding Rules

This is a current guide for AI-assisted contributions.

## Current Truth

- Source of truth for implementation decisions remains:
  - source code
  - `docs/architecture.md`
  - `docs/guides/*` (especially `docs/guides/ai-coding-rules.md`)
- `docs/history/` remains historical input, not active implementation truth.

## Working Rules

- Prefer the smallest meaningful change that matches the current task.
- Prefer existing modules and abstractions over speculative layers.
- Do not add compatibility fallback logic unless there is a user-facing migration requirement.
- Keep `docs/architecture.md` and command surface (`justfile`) aligned with structure changes.
- Keep module ownership boundaries explicit and stable.
- Update code and docs together for API, config, or schema changes.

## Ownership Notes

- `crates/` owns shared Rust capability, auth, Manifest, delegation, config,
  and storage helpers.
- `apps/admin/` owns Admin runtime, authentication, RBAC, gateway, module
  synchronization, and release management.
- `apps/monitor/`, `apps/insights/`, and `apps/reports/` each own one service,
  its Rust route declarations, behavior, and migrations.
- `apps/web/` owns frontend routes, API modules, and static runtime-facing behavior.
- `deploy/` owns the single-bundle, systemd target, recovery, and service
  topology.

## Verification Rule

- Before marking a task as complete, run the task's verification command and then `git diff --check`.

## Phase Scope

- Desktop, plugins, sync, PostgreSQL provider support, and enterprise deployment are outside the sqlite-first phase scope.
