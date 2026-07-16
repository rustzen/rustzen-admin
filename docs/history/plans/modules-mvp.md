# Monitoring, Analytics, and Automation MVP

This MVP keeps the existing `monitor`, `insights`, and `reports` service IDs,
binaries, API prefixes, SQLite databases, HMAC delegation, and release boundary.
Only the product names and web information architecture are expanded.

## Delivered loops

- Monitoring: heartbeat and metrics history, TCP checks, incident open/acknowledge/resolve,
  persistent thresholds, and retention.
- Analytics: project lifecycle and one-time keys, exact-origin batch tracking, page/API/event/user
  queries, project/time filters, and retention.
- Automation: target origins, authenticated encrypted accounts, validated six-action flows,
  queued browser execution, step audit and screenshots, cron schedules, recovery, and retention.

Each list or query has explicit filtering and bounded pagination where its size can grow. Secrets
are deployment configuration or write-only input. Old report-template tables remain only as
non-destructive migration history and have no registered routes.

## Acceptance and verification

Run:

```bash
just check
just verify-modules-mvp
just verify-automation-browser /path/to/chrome-headless-shell
just build-native
git diff --check
```

`verify-modules-mvp` exercises the four real services, delegated and public routes, persistence,
gateway latency, 24 startup orders, module failure isolation, and database restoration.
`verify-automation-browser` submits a real HTML form to a local fixture, verifies the received
fields, all persisted step results, secret redaction, and a screenshot artifact.

Final UI acceptance uses the in-app Codex Browser at 1920x1080 with real services and no API mocks.
Owner can manage every module; Viewer is limited to the concrete `*:view` capabilities supplied by
the module manifests.
