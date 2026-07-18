# API CamelCase Audit

This audit records the current JSON naming boundary. Source code takes precedence when this file drifts.

## Rule

- Rust and database fields use `snake_case`.
- JSON and frontend-facing fields use `camelCase`.
- Backend response and request structs should use `#[serde(rename_all = "camelCase")]` when they expose multi-word fields to the frontend.
- Frontend API params and types should stay `camelCase`.

## Current Backend Coverage

Current backend files with `#[serde(rename_all = "camelCase")]` include:

- Admin boundary types under `apps/admin/src/features/`, including auth,
  account, dashboard, deploy, dictionary, log, task, module, menu, role,
  status, and user contracts
- Monitor boundary types under `apps/monitor/src/features/heartbeat/` and
  `apps/monitor/src/features/nodes/`
- Insights boundary types under `apps/insights/src/features/overview/` and
  `tracking/`
- Reports boundary types under `apps/reports/src/features/automation/`

## Current Frontend Boundary

- API modules live under `apps/web/src/api/`.
- Shared request behavior lives in `apps/web/src/api/request.ts`.
- Domain types live in `types.d.ts` beside their owning API module.

## Review Checklist

- New Rust request and response structs use `rename_all = "camelCase"` when exposed over HTTP.
- Frontend `types.d.ts` names match API JSON names directly.
- Pages do not translate field casing locally.
- SQL aliases are explicit when database names need to map into Rust fields.
- API list methods that feed ProTable return `{ data, total, success }`.
