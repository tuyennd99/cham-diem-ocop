# Restore File-Based Routing Design

## Decision and scope

Use TanStack file-based routing in `apps/web/src/routes/`. Keep `apps/web/src/router.tsx` responsible only for router creation and application-wide options. The user selected planning after the recommendation in this conversation; implementation is not part of this planning turn.

The current manual router is the behavior reference. The restored route files are reusable implementation material, not a behavior reference for parent/child nesting.

## Requirements

1. Preserve all 35 URL patterns, accepting existing URLs with and without a trailing slash.
2. Preserve route guards, role/permission semantics, search validators, page props, and the `/admin/judges` redirect to `/admin/users?permission=SCORE` with history replacement.
3. `/account/password`, `/my/products/$id/edit`, and `/admin/registrations/$id/edit` render independent pages inside the authenticated layout. Their detail/account screens must not be ancestors in the matching route chain.
4. Convert the three detail/account route files into index routes. Keep the existing password/edit route filenames and URL paths.
5. Preserve the current root shell: skip-link, `TooltipProvider`, `NavigationLoadingBar`, and `Toaster`. Preserve `AppSpin`, `PageSpin`, `defaultPreload: 'intent'`, and `scrollRestoration: true`.
6. Preserve the current two list-filter error screens by moving the existing shared `AdminFilterError` component out of the manual router.
7. Enable `tanstackRouter({ target: 'react', autoCodeSplitting: true })` before the React plugin. Generate `routeTree.gen.ts`; never maintain it by hand.
8. Keep module registration in `src/types/router.ts`; remove its duplicate from the old manual router when replacing that router.
9. Use the existing installed dependencies; do not add or upgrade packages.
10. Preserve unrelated working-tree changes, including the pending UI and category changes. Change only routing, its check, and its documentation.

## Global constraints

- Node.js: `>=24.7 <25`.
- Package manager: `pnpm@11.17.0`.
- React: `19.3.0`; Vite: `8.3.4`.
- Reuse installed `@tanstack/router-plugin` `1.168.45` and the existing `@tanstack/react-router` dependency `^1.170.44`.
- No backend, database, authentication-storage, API, or package-lock changes.
- Keep Vietnamese UI copy unchanged.
- No production edits during planning.

## File boundaries

| File | Responsibility |
| --- | --- |
| `apps/web/vite.config.ts` | Route generation and automatic code splitting alongside existing Vite plugins |
| `apps/web/src/router.tsx` | Router options and existing context |
| `apps/web/src/routes/__root.tsx` | Root shell and not-found rendering |
| `apps/web/src/routes/_app.tsx` | Authenticated layout and its pending component |
| Three renamed index route files | Exact account/detail screens without capturing password/edit children |
| `apps/web/src/components/admin-filter-error.tsx` | Existing shared error UI for two list routes |
| `apps/web/src/routeTree.gen.ts` | Generated route tree and file-route type mapping |
| `apps/web/test/router.check.mjs` | URL inventory, route ancestry, guards, validators, and redirect regression check |
| `apps/web/README.md` | Routing ownership and generation/check commands |

## Acceptance

- The generated tree supplies the only route tree used by `RouterProvider`.
- Build, typecheck, and the routing regression check pass.
- All 35 URL patterns are present; the three password/edit pages have the correct matching ancestry.
- Production build manifest contains dynamic route component entries, and hovering an admin link requests its component chunk before clicking.
- Browser checks cover direct access and navigation to password/edit, forbidden/anonymous access, invalid list filters, and the root providers/loading UI.

## Evidence and references

Review on 2026-10-28 found 39 route files, a 705-line manual router, and a deleted generated tree. Build passed; typecheck failed after restoring the file-route folder. The three old parent screens either omit `Outlet` or render the editor below detail content.

Consulted repository: [TanStack/router](https://github.com/TanStack/router), especially its [Vite installation source](https://github.com/TanStack/router/blob/main/docs/router/installation/with-vite.md). This matches the packages already installed and provides the generator/plugin pattern without a custom router abstraction.

- [File-based routing](https://tanstack.com/router/latest/docs/routing/file-based-routing)
- [File naming conventions](https://tanstack.com/router/latest/docs/routing/file-naming-conventions): index routes match the exact URL instead of acting as screen layouts.
- [Vite integration](https://tanstack.com/router/latest/docs/installation/with-vite): generator before React.
- [Automatic code splitting](https://tanstack.com/router/latest/docs/guide/automatic-code-splitting): split route components, including wrappers, through the plugin.

The GitHub example directory could not be fetched during planning; the repository documentation and official guides were available.
