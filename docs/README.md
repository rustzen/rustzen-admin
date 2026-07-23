# Docs

This is the documentation entrypoint for `rustzen-admin`.

## Source Of Truth

1. source code
2. [architecture.md](./architecture.md)
3. [guides/](./guides/)
4. [product/PRODUCT.md](./product/PRODUCT.md) (product scope and decisions, not implementation truth)
5. [reference/](./reference/)
6. [history/README.md](./history/README.md) (historical input and completion records)
7. [history/](./history/)

## Files

| File | Role | Value |
| --- | --- | --- |
| [ai-coding-rules.md](./guides/ai-coding-rules.md) | Current rule | Defines source-of-truth order, module ownership, and task verification expectations for AI-assisted changes. |
| [architecture.md](./architecture.md) | Current fact | Defines repository boundaries, runtime topology, data flow, and command source. |
| [project-map.md](./project-map.md) | Current fact | Maps important directories without implementation detail. |
| [ui/README.md](./ui/README.md) | Current UI index | Links shared visual facts, independently loadable slice contracts, status, and known specification gaps. |
| [product/PRODUCT.md](./product/PRODUCT.md) | Current product fact | Defines the four-process product boundary, product language, module-evolution decisions, and feature-specification gates. |
| [guides/backend.md](./guides/backend.md) | Current rule | Gives backend layering, naming, config, SQL, and prohibited-change rules. |
| [guides/frontend.md](./guides/frontend.md) | Current rule | Gives route, API, state, UI, and generated-file rules. |
| [guides/shared-capabilities.md](./guides/shared-capabilities.md) | Current rule | Defines shared ownership, extraction gates, reuse decisions, and former-product module intake. |
| [guides/deployment.md](./guides/deployment.md) | Current rule | Gives runtime layout, config, deploy-path, and build-output rules. |
| [guides/permission.md](./guides/permission.md) | Current rule | Gives permission ownership, route-check, menu-sync, and authorization rules. |
| [reference/README.md](./reference/README.md) | Appendix index | Lists optional deep-context files. |
| [reference/architecture-diagrams.md](./reference/architecture-diagrams.md) | Appendix | Visualizes topology and request flows. |
| [reference/capability-map.md](./reference/capability-map.md) | Appendix | Maps current capabilities to real backend and frontend owners. |
| [reference/api-camelcase-audit.md](./reference/api-camelcase-audit.md) | Appendix | Audits API casing boundaries. |
| [reference/workspace-root-impl.md](./reference/workspace-root-impl.md) | Appendix | Explains runtime-root path derivation. |
| [reference/code-review-checklist.md](./reference/code-review-checklist.md) | Appendix | Provides a compact review checklist. |
| [reference/legacy-module-comparison.md](./reference/legacy-module-comparison.md) | Current comparison | Fixes live former-product revisions and maps selected behaviors to retain, reproduce, reuse, defer, or drop decisions. |
| [history/README.md](./history/README.md) | Historical index | Explains where non-current records live. |
| [history/feats/login-page-design.md](./history/feats/login-page-design.md) | Historical design | Preserves the completed login-page design input and asset link. |
| [history/feats/sqlite-first-roadmap.md](./history/feats/sqlite-first-roadmap.md) | Historical feature task record | Breaks the sqlite-first design into executable and verifiable tasks. |
| [history/plans/independent-service-refactor.md](./history/plans/independent-service-refactor.md) | Completed execution baseline | Defines the implemented four-application service split, runtime contract, permission flow, release boundary, and validation gates. |
| [history/plans/update-docs.md](./history/plans/update-docs.md) | Historical task list | Records the completed documentation-governance task request. |
| [history/fixes/documentation-audit-report-2026-05-20.md](./history/fixes/documentation-audit-report-2026-05-20.md) | Historical audit | Preserves the pre-consolidation documentation audit snapshot. |

## Placement Rules

- Put current implementation facts in `architecture.md` or `project-map.md`.
- Put durable product boundaries and confirmed product decisions in `product/PRODUCT.md`.
- Put current development rules in `guides/`.
- Put optional diagrams, audits, specs, and checklists in `reference/`.
- Put completed designs, task records, proposals, fixes, and incidents in `history/`.
- Do not put Chinese text in documentation files.
- Use `kebab-case.md` for Markdown file names.
- sqlite-first design records under docs/history/ are historical inputs. Current implementation truth remains source code, [architecture.md](./architecture.md), and [guides/](./guides/).
