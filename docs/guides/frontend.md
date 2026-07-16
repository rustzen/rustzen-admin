# Frontend Guide

The frontend uses Bun 1.3.14. Vite 8.1.3 and Vite+ 0.2.4 are pinned exactly,
and the package override keeps transitive Vite consumers on 8.1.3 so plugin
types come from one Vite instance. Keep the pins until lint, typecheck, and
build all pass on a newer pair.

Rules for frontend work under `apps/web/`.

## Routes

- Use file-based routes that match the final pathname.
- Keep auth redirects, permission gates, current-user bootstrap, and not-found handling in `apps/web/src/routes/__root.tsx`.
- Keep route paths stable; `apps/web/src/store/useAuthStore.ts` derives permission codes from pathname.
- Do not edit `apps/web/src/routeTree.gen.ts` manually.
- Do not create future groups such as `rbac`, `audit`, or `runtime` until implementation lands.

## APIs

- Pages import domain APIs from `@/api`.
- API modules import shared request helpers from `@/api/request`.
- Keep HTTP URLs inside the owning API module.
- `apiRequest` unwraps to `data` by default.
- Use `raw: true` only when callers need envelope metadata such as `total`.
- ProTable list methods return `{ data, total, success }`.
- Keep transport shaping and option normalization inside API modules.
- When backend contracts change, update matching frontend API modules and types in the same task.

## State And UI

- React Query owns read-side server state.
- Zustand stays limited to shared auth state and small persisted UI filters.
- Keep page-local tables, forms, and action handlers in the route file until reuse is real.
- Keep layout-only concerns in `apps/web/src/components/base-layout/`.
- Use existing design-system primitives before adding wrappers.
- Use lowercase kebab-case for component file and directory names. Use PascalCase only for exported React components and types.
- Prefer plain function components. Use `forwardRef`, `memo`, `useCallback`, or similar React wrappers only when a real caller needs the ref identity or memoized identity.
- Do not add small calculation helpers or generic abstractions for values that are clearer as local constants or fixed props.
- Use root `justfile` as the command source of truth.

## Tailwind Classes

- Prefer Tailwind spacing-scale size utilities over arbitrary px values for size classes. For example, write `min-h-75` instead of `min-h-[300px]`, `w-45` instead of `w-[180px]`, and `max-h-105` instead of `max-h-[420px]`.
- If a px size does not map exactly to the 4px spacing scale, use the closest integer spacing utility instead of keeping the arbitrary value. For example, write `h-153` instead of `h-[610px]`.
- Keep arbitrary values for non-px units and complex expressions such as grid templates.

## Browser Testing

- When opening the frontend in a browser for testing or verification, set the default viewport to `1920*1080` before checking layout or screenshots.
- If the browser tool cannot set `1920*1080`, state that limitation in the verification result.

## Tables

- Use `ProTable` for admin list pages unless the page has a reason to use lower-level `Table`.
- Keep table column definitions close to the owning route until reuse is real.
- For icon-only action columns, use `TableActionButton` and `TABLE_ACTION_SPACE_SIZE`.
- Set action column `width` to the smallest fixed value that keeps actions on one line. If a page has more actions, calculate the value once while designing the column and write the fixed number directly.
- Do not add a helper such as `tableActionColumnWidth(count)` for simple one-line width math.
- Do not override `.ant-table-cell` padding for a single page. If table density needs to change globally, use Ant Design table size or theme tokens as a product-wide decision.

## Package Manager

- `apps/web` uses Bun 1.3.14; keep `apps/web/bun.lock` as the only frontend lockfile.
- Keep the Bun version pinned in `apps/web/package.json`.
- `vite-plus` is the frontend build tool used in package.json scripts (aliases: `vp`).
- Use `bun run dev`, `bun run build`, and `bun run vp ...` for frontend commands.

## Prohibited

- Multiple entrypoints for the same API domain.
- Route-local `-content/` directories before real need.
- Shared API type redeclarations inside pages.
- Route-local state pushed into global stores without cross-page need.
