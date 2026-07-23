# Dashboard And Admin Navigation Simplification

Status: **Ready for dev-frontend**. The implementation and browser verification
are present on the current branch. This contract was ratified during final
review; future product-surface changes must establish their scoped contract
before frontend implementation.

## Scope and product facts

This is one control-plane entry slice covering:

- `/`: account totals and the availability/version of Monitor, Insights, and
  Reports;
- the persistent sidebar and page search: current product destinations only;
- removal of Dictionary and demo navigation from the current surface.

Detailed host resources belong to `/system/status`; Monitoring and Analytics
own their metrics and trends. Dictionary has no current in-repository consumer.
The historical SQLite table is dormant upgrade data, not a UI or API contract.
The `403` and `404` pages remain reachable for real routing and authorization
failures even though they are not navigation examples.

## Visual-source mapping

Selected source: `figure-2-web-console`, revision 2, accepted and
reference-only; local path:
`docs/ui/reference-assets/figure-2-light-glass-dashboard.png`.

Use its page density, navigation proportion, clear hierarchy, ambient
powder-blue/coral light, and translucent shell. Ignore its exact brand,
business content, metrics, and navigation. Verified product facts and current
component owners take precedence over pixels.

## Layout, components, and tokens

- `PageHeader` owns the single page heading and description.
- The Dashboard body is one responsive grid: module availability is the
  primary region and account totals are the secondary region. At the `xl`
  breakpoint the tracks are approximately `2fr / 1fr`; below it they stack in
  DOM order.
- Reuse `Card`, `DataState`, `Badge`, and `Button`. Do not introduce charts,
  tabs, a quick-action framework, a nested dashboard, or a new metric-card
  variant for this slice.
- Reuse the existing colorful-glass, white, and dark theme tokens in
  `apps/web/src/styles/theme.css`. No semantic token changes are authorized.
- Sidebar groups remain System and Management plus healthy module-provided
  navigation. Search consumes the same route inventory as the sidebar.

## States, transitions, and feedback

Dashboard account totals and module health are independent asynchronous
regions. Each owns its loading, error with retry, and populated state through
`DataState`; failure in one must not hide the other. A module marked unavailable
is valid populated data, not a page error. Empty account totals render numeric
zero values.

Sidebar/search entries are derived from current fixed Admin routes, granted
permissions, and compatible module Manifests. Removing Dictionary and demo
entries must remove them from both navigation and search. No UI transition may
reactivate an inactive core permission. Language and theme switches preserve
the current route and data state.

## Responsive and accessibility rules

- Target sizes: 1920x1080 and 1440x900; the page and representative routes must
  have no document-level horizontal overflow.
- Preserve module cards before account cards in DOM and keyboard order when the
  layout stacks.
- Keep one semantic `h1`, visible focus behavior from existing primitives,
  textual availability labels in addition to color, localized control names,
  and live status semantics supplied by `DataState`.
- Theme changes must preserve readable foreground/surface contrast. This slice
  adds no animation and therefore introduces no reduced-motion exception.

## Executable acceptance

1. `GET /api/dashboard/stats` is the only Dashboard-owned data endpoint; module
   health continues through `GET /api/dashboard/modules`.
2. Dashboard renders only its page heading, module availability/version cards,
   and the four account totals; no system-resource, request-metric, trend, or
   duplicate Analytics panel remains.
3. Sidebar and search contain no `/manage/dict`, `/403`, or `/404` entry, while
   direct `403` and `404` routing still renders.
4. Dictionary route/API/capability source is absent, stale built-in Dictionary
   permissions become inactive on sync, current manual overrides and custom
   menus remain active, and the historical table is not dropped.
5. Frontend format, lint, typecheck, and production build pass; all current
   authenticated routes render at 1920x1080 without horizontal overflow;
   representative routes pass at 1440x900; Dashboard passes all three themes;
   the authenticated console has no warning or error.

Unresolved blocker: human approval of the overall UI package is not recorded.
This does not authorize additional visual or product scope.
