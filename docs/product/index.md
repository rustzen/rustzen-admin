# Product Feature Index

Read [product.md](./product.md) for product positioning, shared principles,
module boundaries, and direction. Read only the target feature specification
below for slice-local behavior and acceptance.

| Product area | Feature slice | Product specification | Status |
| --- | --- | --- | --- |
| Admin | Role definition management | [role-definition-management](./features/role-definition-management/spec.md) | Ready |
| Admin | User role assignment readiness | [user-role-assignment-readiness](./features/user-role-assignment-readiness/spec.md) | Ready |

The two slices share the Admin access-control foundation but have independent
jobs and acceptance boundaries. Implementing one slice does not require loading
the sibling specification. Selected-source layout and visual behavior remain in
the related UI specification when one exists.
