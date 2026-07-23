# UI Contract Index

Status: **Partial** for the historical all-route standardization package.

The structured package in this directory records shared visual facts and the
current 20-route inventory. It is not a substitute for independently loadable
domain contracts. Existing Monitoring, Analytics, Reports, System, Profile,
Login, and management surfaces retain their implemented baseline, but this task
does not retroactively invent separate product decisions for them.

| Slice | Contract | Status |
| --- | --- | --- |
| Dashboard and Admin navigation simplification | [`contracts/dashboard-navigation-simplification.md`](./contracts/dashboard-navigation-simplification.md) | Ready for dev-frontend; implemented and runtime-verified on this branch. |
| Shared visual baseline | [`profile.yaml`](./profile.yaml), [`references.yaml`](./references.yaml) | Accepted source mapping; package promotion remains pending human approval. |
| Historical all-route standardization | [`task.yaml`](./task.yaml), [`page-audit.md`](./page-audit.md) | Partial: route inventory and shared rules exist, but independent contracts were not reconstructed for every domain. |

Shared exclusions: no new business metrics, no route renames, no new module,
no generic dashboard builder, and no permission semantics invented by UI code.
Consumers implementing the current slice read this index, its named contract,
and the accepted shared profile; they do not need unrelated domain detail.
