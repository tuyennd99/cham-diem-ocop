# Restore File-Based Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore one file-based route tree while preserving the manual router's URLs, independent password/edit pages, permissions, and current UI shell.

**Architecture:** Reuse the existing `src/routes/` files and let the installed Vite plugin generate the tree and split route components. Convert three screen routes to index routes so password/edit screens remain independent. Keep router construction separate from root/layout UI and reuse existing guards and search parsers.

**Tech Stack:** React 19, TypeScript, Vite 8, TanStack Router, Node.js assertions, existing pnpm workspace.

**Spec:** `docs/superpowers/specs/2026-10-28-file-based-routing-design.md` — read before executing.

## Global Constraints

- Node.js: `>=24.7 <25`.
- Package manager: `pnpm@11.17.0`.
- React: `19.3.0`; Vite: `8.3.4`.
- Reuse installed `@tanstack/router-plugin` `1.168.45` and the existing `@tanstack/react-router` dependency `^1.170.44`.
- No backend, database, authentication-storage, API, or package-lock changes.
- Keep Vietnamese UI copy unchanged.
- No production edits during planning.
- During execution, preserve all unrelated working-tree edits. Do not restore the repository to HEAD or run `git add .`.

---

## Starting state and execution order

Working directory: `D:/project/chamdiemocop`. All shell commands below run here unless another directory is stated.

- `src/routes/` currently contains 39 files and matches HEAD.
- `src/router.tsx` currently declares 38 non-root routes and has 35 URL patterns.
- `src/routeTree.gen.ts` is deleted; the generator plugin is absent from Vite configuration.
- Typecheck currently fails in the restored file-route files. Production build currently passes because the active import graph uses only the manual router.
- Several components imported by the manual router are untracked user work. Keep them intact and do not silently absorb that work into a routing commit.

Run tasks sequentially. Task 1 deliberately restores wiring and nesting together: restoring wiring alone would activate the old nesting bugs. Task 2 ports the existing shell and filter-error UI. Task 3 verifies split output and browser behavior and updates routing documentation.

For commits, first inspect `git diff --cached --name-only`. Never commit another person's staged work. The commit commands are checkpoints, not authorization to collect unrelated files. If an imported UI dependency is still untracked/uncommitted user work, keep the routing changes uncommitted until that dependency is integrated; do not create a knowingly incomplete commit.

## File map

| Action | Path | Responsibility |
| --- | --- | --- |
| Modify | `apps/web/vite.config.ts` | Enable generator before React, preserve inspector/proxy/alias |
| Replace | `apps/web/src/router.tsx` | Small router factory configuration |
| Generate | `apps/web/src/routeTree.gen.ts` | Runtime route tree and generated types |
| Rename | `apps/web/src/routes/_app.account.tsx` to `_app.account.index.tsx` | Account screen as exact route |
| Rename | `apps/web/src/routes/_app.my.products.$id.tsx` to `_app.my.products.$id.index.tsx` | Registrant detail as exact route |
| Rename | `apps/web/src/routes/_app.admin.registrations.$id.tsx` to `_app.admin.registrations.$id.index.tsx` | Registration detail as exact route |
| Modify | `apps/web/src/routes/__root.tsx` | Preserve current root shell |
| Modify | `apps/web/src/routes/_app.tsx` | Preserve app pending screen |
| Create | `apps/web/src/components/admin-filter-error.tsx` | Shared existing list-filter error screen |
| Modify | `apps/web/src/routes/_app.admin.products.index.tsx` | Consume shared filter error |
| Modify | `apps/web/src/routes/_app.admin.registrations.index.tsx` | Consume shared filter error |
| Create | `apps/web/test/router.check.mjs` | One routing contract check |
| Modify | `apps/web/README.md` | Document ownership and checks |

Keep all other route files, `main.tsx`, `types/router.ts`, guards, parsers, page implementations, package files, and `.prettierignore` unchanged. The existing formatter ignore already excludes `src/routeTree.gen.ts`.

### Task 1: Activate file-based routing with correct ancestry

**Files:** Vite config, router, generated tree, three renamed index files, and `apps/web/test/router.check.mjs` from the map.

**Interfaces:**
- Consumes: existing `getSession`, `queryClient`, `RouterContext`, route guards, parsers, pages, and `PageSpin`.
- Produces: `export const router = createRouter(...)` in the existing module; `export const routeTree` from the generated module. `types/router.ts` remains the single router type registration.
- The check invokes existing synchronous `beforeLoad({ context })` guards directly; it does not call APIs or render pages.

- [ ] **Step 1: Add the failing routing check.** Create `apps/web/test/router.check.mjs` with this complete content:

```js
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const server = await createServer({
  root,
  configFile: false,
  envDir: false,
  appType: 'custom',
  resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  ssr: { optimizeDeps: { include: ['lodash'] } },
  server: { middlewareMode: true, watch: null, hmr: false },
});

try {
  const { router } = await server.ssrLoadModule('/src/router.tsx');
  const { routeTree } = await server.ssrLoadModule('/src/routeTree.gen.ts');
  assert.equal(router.options.routeTree, routeTree);
  assert.equal(router.options.defaultPreload, 'intent');
  assert.equal(router.options.scrollRestoration, true);
  const normalize = (path) => path === '/' ? path : path.replace(/\/$/, '');
  const paths = Object.values(router.routesById)
    .filter((route) => route.options.path)
    .map((route) => normalize(route.fullPath));
  const expected = [
    '/', '/403', '/404', '/products', '/products/$id',
    '/login', '/register', '/forgot-password', '/verify-otp',
    '/account', '/account/password', '/admin', '/admin/reports',
    '/admin/product-groups', '/admin/scoring-forms', '/admin/assignments',
    '/admin/users', '/admin/judges', '/admin/products', '/admin/products/$id',
    '/admin/registrations', '/admin/registrations/new',
    '/admin/registrations/$id', '/admin/registrations/$id/edit',
    '/judge', '/judge/products/$id', '/my/products', '/my/products/new',
    '/my/products/$id', '/my/products/$id/edit', '/print/criteria-sets/$id',
    '/print/evaluations/$id', '/print/judge/products/$id',
    '/print/products/$id/registration', '/print/products/$id/results',
  ];
  assert.deepEqual([...new Set(paths)].sort(), expected.sort());

  const matches = (path) => router.matchRoutes(path)
    .map((match) => router.routesById[match.routeId]);
  const leaf = (path) => matches(path).at(-1);
  for (const [path, id] of [
    ['/account/password', '/_app/account/password'],
    ['/my/products/product-1/edit', '/_app/my/products/$id/edit'],
    ['/admin/registrations/product-1/edit', '/_app/admin/registrations/$id/edit'],
  ]) {
    for (const url of [path, `${path}/`]) {
      assert.deepEqual(matches(url).map((route) => route.id), ['__root__', '/_app', id]);
    }
  }
  assert.equal(router.matchRoutes('/products/product-1').at(-1).params.id, 'product-1');

  const session = (role, staffPermissions = []) => ({
    accessToken: 'routing-check',
    user: {
      id: 'user-1', email: 'routing@example.invalid', fullName: 'Routing check',
      phone: null, role, verified: true, staffPermissions,
      organizationUnitId: null, organizationUnit: null,
    },
  });
  const owner = session('REGISTRANT');
  const viewer = session('VIEWER', ['VIEW']);
  const manager = session('ADMIN', ['MANAGE']);
  const judge = session('JUDGE', ['SCORE']);
  const checkGuards = (path, value) => {
    const context = { getSession: () => value, queryClient: router.options.context.queryClient };
    for (const route of matches(path)) route.options.beforeLoad?.({ context });
  };
  const redirectsTo = (to) => (error) => error?.options?.to === to;
  assert.throws(() => checkGuards('/account/password', null), redirectsTo('/login'));
  assert.doesNotThrow(() => checkGuards('/account/password', owner));
  assert.doesNotThrow(() => checkGuards('/my/products/product-1/edit', owner));
  assert.throws(() => checkGuards('/my/products/product-1/edit', manager), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/admin/registrations/product-1/edit', manager));
  assert.throws(() => checkGuards('/admin/registrations/product-1/edit', viewer), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/admin/products', viewer));
  assert.throws(() => checkGuards('/admin/products', owner), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/judge', judge));
  assert.throws(() => checkGuards('/judge', viewer), redirectsTo('/403'));
  assert.doesNotThrow(() => checkGuards('/admin/scoring-forms', judge));
  assert.doesNotThrow(() => checkGuards('/print/products/product-1/registration', owner));
  assert.throws(() => checkGuards('/print/products/product-1/results', null), redirectsTo('/login'));
  assert.throws(() => checkGuards('/login', manager), redirectsTo('/admin/products'));
  assert.throws(() => checkGuards('/admin/judges', manager), (error) => {
    assert.equal(error.options.to, '/admin/users');
    assert.deepEqual(error.options.search, { permission: 'SCORE' });
    assert.equal(error.options.replace, true);
    return true;
  });
  for (const path of ['/admin/products', '/admin/registrations']) {
    const validate = leaf(path).options.validateSearch;
    const search = validate({ page: '2', limit: '20', q: ' Chè ' });
    assert.equal(search.page, 2);
    assert.equal(search.limit, 20);
    assert.equal(search.q, 'Chè');
    assert.throws(() => validate({ localityId: 'locality-1', unmappedLocality: true }));
    assert.equal(typeof leaf(path).options.errorComponent, 'function');
  }
  console.log('PASS router: generated tree, 35 URLs, ancestry, guards, search, redirect');
} finally {
  await server.close();
}
```

This uses the same Vite SSR pattern as the existing `api-integration.check.mjs`. SSR dependency optimization handles lodash's CommonJS exports. If this environment exposes another SSR-only module interoperability error, resolve the test harness narrowly; do not rewrite application imports to satisfy the harness.

- [ ] **Step 2: Confirm the check is red before changing production files.**

Run: `node apps/web/test/router.check.mjs`

Expected: FAIL because `/src/routeTree.gen.ts` is missing. The manual router must not satisfy the generated-tree identity check.

- [ ] **Step 3: Convert the three screen files to index routes.** Use PowerShell literal paths so `$id` is not expanded:

```powershell
Rename-Item -LiteralPath 'apps/web/src/routes/_app.account.tsx' -NewName '_app.account.index.tsx'
Rename-Item -LiteralPath 'apps/web/src/routes/_app.my.products.$id.tsx' -NewName '_app.my.products.$id.index.tsx'
Rename-Item -LiteralPath 'apps/web/src/routes/_app.admin.registrations.$id.tsx' -NewName '_app.admin.registrations.$id.index.tsx'
```

In those files, replace only these route declarations, respectively. Retain all existing imports, guards, parsers, wrappers, and page props:

```diff
-export const Route = createFileRoute('/_app/account')({
+export const Route = createFileRoute('/_app/account/')({
```

```diff
-export const Route = createFileRoute('/_app/my/products/$id')({
+export const Route = createFileRoute('/_app/my/products/$id/')({
```

```diff
-export const Route = createFileRoute('/_app/admin/registrations/$id')({
+export const Route = createFileRoute('/_app/admin/registrations/$id/')({
```

Leave password/edit filenames and their declarations unchanged. Do not add `Outlet` to the three screens and do not edit `AdminProductDetailPage` to achieve routing behavior. Index screens must not become layout ancestors.

- [ ] **Step 4: Enable generation and automatic splitting.** Apply these additions to `apps/web/vite.config.ts`; retain all existing inspector, editor, alias, proxy, and environment configuration:

```diff
 import tailwindcss from "@tailwindcss/vite";
+import { tanstackRouter } from '@tanstack/router-plugin/vite';
```

```diff
     plugins: [
+      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
       codeInspectorPlugin({
```

The TanStack plugin must precede `react()`. No dependency installation is necessary.

- [ ] **Step 5: Replace `apps/web/src/router.tsx` with the complete small module below.** Root/layout/error UI moves to the existing file routes in Task 2; retain their original files during this step.

```tsx
import { createRouter } from '@tanstack/react-router';
import PageSpin from '@/components/page-spin';
import { getSession } from './lib/auth';
import { queryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  context: { getSession, queryClient },
  defaultPendingComponent: PageSpin,
  defaultPreload: 'intent',
  scrollRestoration: true,
});
```

Remove the old local `declare module` together with the replaced content. `src/types/router.ts` already registers `typeof router` and remains unchanged. No new router factory or routing abstraction is needed.

- [ ] **Step 6: Generate, run the check, and typecheck in this order.**

```powershell
pnpm --filter @ocop/web build
node apps/web/test/router.check.mjs
pnpm --filter @ocop/web typecheck
```

Expected: all commands exit 0. Build recreates `routeTree.gen.ts` before TypeScript checks `createFileRoute`. The ancestry assertions must show only root, `_app`, and the final password/edit route. Confirm the generated tree has no account/detail page as an ancestor for those three paths.

If generation differs from the expected direct ancestry, inspect generated parents and file naming against the official naming guide. Fix source route filenames/declarations; never patch generated output or weaken ancestry assertions.

- [ ] **Step 7: Review and checkpoint the routing switch.** Inspect `git diff -- apps/web/vite.config.ts apps/web/src/router.tsx apps/web/src/routes apps/web/src/routeTree.gen.ts` and the new check. Apply the commit preconditions from Starting state.

```powershell
git add -- apps/web/vite.config.ts apps/web/src/router.tsx apps/web/src/routeTree.gen.ts apps/web/test/router.check.mjs
git add -A -- 'apps/web/src/routes/_app.account.tsx' 'apps/web/src/routes/_app.account.index.tsx' 'apps/web/src/routes/_app.my.products.$id.tsx' 'apps/web/src/routes/_app.my.products.$id.index.tsx' 'apps/web/src/routes/_app.admin.registrations.$id.tsx' 'apps/web/src/routes/_app.admin.registrations.$id.index.tsx'
git diff --cached --stat
git commit -m "fix(web): restore file routes with independent edit screens"
```

### Task 2: Preserve the manual router's shell, pending UI, and filter errors

**Files:** `routes/__root.tsx`, `routes/_app.tsx`, new `components/admin-filter-error.tsx`, and the two admin list route files.

**Interfaces:**
- Consumes: Task 1 generated routing, existing `TooltipProvider`, `NavigationLoadingBar`, `Toaster`, `AppSpin`, `AlertError`, and `Button`.
- Produces: `default function AdminFilterError({ mode }: { mode: 'products' | 'registrations' })` for the two route-local error wrappers; unchanged URL/search/permission APIs.

- [ ] **Step 1: Replace `routes/__root.tsx` with the existing shell from the manual router.**

```tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { NavigationLoadingBar } from '@/components/navigation-bar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NotFoundPage } from '../pages/errors/NotFoundPage';
import type { RouterContext } from '../types/router-context';

export const Route = createRootRouteWithContext<RouterContext>()({
  shellComponent: ({ children }) => (
    <TooltipProvider delayDuration={200}>
      <a className='skip-link' href='#content'>Bỏ qua điều hướng</a>
      <NavigationLoadingBar />
      <Toaster richColors closeButton />
      {children}
    </TooltipProvider>
  ),
  component: Outlet,
  notFoundComponent: NotFoundPage,
});
```

- [ ] **Step 2: Preserve the app pending component in `routes/_app.tsx`.** Keep the existing guard and layout body exactly as they are; add:

```diff
 import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
+import AppSpin from '@/components/app-spin';
```

```diff
 export const Route = createFileRoute('/_app')({
+  pendingComponent: AppSpin,
```

- [ ] **Step 3: Move the shared filter-error screen to `components/admin-filter-error.tsx`.** Use this complete content:

```tsx
import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';

export default function AdminFilterError({ mode }: { mode: 'products' | 'registrations' }) {
  const isProducts = mode === 'products';
  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div><h1>Bộ lọc không hợp lệ</h1></div>
      </div>
      <AlertError
        title='Bộ lọc không hợp lệ'
        errors={['Điều kiện tìm kiếm trên địa chỉ trang không đúng định dạng hoặc có xung đột.']}
      />
      <div className='admin-actions'>
        <Button asChild>
          <Link to={isProducts ? '/admin/products' : '/admin/registrations'} search={{}}>
            {isProducts ? 'Về danh sách sản phẩm' : 'Về danh sách phiếu đăng ký'}
          </Link>
        </Button>
      </div>
    </section>
  );
}
```

`AlertError` already renders the shared alert with `role='alert'`; no additional error infrastructure is required.

- [ ] **Step 4: Connect the two route-local error components.** In both list route files, replace the TanStack import to remove the unused `Link` and add the shared component import:

```tsx
import { createFileRoute } from '@tanstack/react-router';
import AdminFilterError from '@/components/admin-filter-error';
```

Replace the entire `ProductsFilterError` function in `_app.admin.products.index.tsx` with:

```tsx
function ProductsFilterError() {
  return <AdminFilterError mode='products' />;
}
```

Replace the entire `RegistrationsFilterError` function in `_app.admin.registrations.index.tsx` with:

```tsx
function RegistrationsFilterError() {
  return <AdminFilterError mode='registrations' />;
}
```

Keep route options pointing to these local functions, and retain all other imports, validators, guards, page props, and navigation callbacks. Route component functions remain unexported so the plugin can split them.

- [ ] **Step 5: Verify integration.**

```powershell
pnpm --filter @ocop/web build
pnpm --filter @ocop/web typecheck
node apps/web/test/router.check.mjs
```

Expected: all pass. In the browser, open `/admin/products?localityId=locality-1&unmappedLocality=true` and `/admin/registrations?localityId=locality-1&unmappedLocality=true` as a VIEW/MANAGE user. Both show the Vietnamese filter alert; their reset buttons return to the correct list and clear conflicting query parameters.

- [ ] **Step 6: Review and checkpoint shell preservation.** Apply the commit preconditions from Starting state, then:

```powershell
git add -- apps/web/src/routes/__root.tsx apps/web/src/routes/_app.tsx apps/web/src/components/admin-filter-error.tsx apps/web/src/routes/_app.admin.products.index.tsx apps/web/src/routes/_app.admin.registrations.index.tsx apps/web/src/routeTree.gen.ts
git diff --cached --stat
git commit -m "refactor(web): preserve router shell and filter error screens"
```

### Task 3: Verify production splitting and document the routing contract

**Files:** `apps/web/README.md`; use the Task 1 check and existing build output. Do not add a test framework or browser-test dependency.

**Interfaces:**
- Consumes: generated route tree, existing router context/options, production Vite manifest, and existing accounts with REGISTRANT, VIEW, MANAGE, and SCORE access.
- Produces: documented generation/check workflow and recorded pass/fail results for the acceptance checks.

- [ ] **Step 1: Verify the production output with a manifest.**

```powershell
pnpm --filter @ocop/web exec vite build --manifest
pnpm --filter @ocop/web typecheck
node apps/web/test/router.check.mjs
```

Run the following manifest assertion from repository root:

```powershell
@'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('apps/web/dist/.vite/manifest.json', 'utf8'));
const entries = Object.entries(manifest);
for (const route of ['_app.admin.index.tsx', '_public.products.$id.tsx']) {
  assert.ok(entries.some(([key, value]) =>
    `${key} ${value.src ?? ''}`.includes(route) &&
    `${key} ${value.src ?? ''}`.includes('tsr-split=component') &&
    value.isDynamicEntry === true), `Missing dynamic component entry: ${route}`);
}
console.log('PASS production route component splitting');
'@ | node --input-type=module
```

Expected: PASS for the admin dashboard wrapper and public product-detail wrapper. Inspect the manifest's real keys if the installed plugin serializes its query differently; retain the requirement that these route components are dynamic entries. Never replace it with an assertion that unrelated dynamic imports exist. Do not compare bundle sizes to the old app because concurrent UI changes make that comparison inconclusive.

- [ ] **Step 2: Run the proxy regression check.**

Run: `node apps/web/test/proxy.check.mjs`

Expected: `PASS proxy: default, file env, process override`. Preserve the inspector/editor options if this fails due to plugin initialization; isolate the configuration loading issue instead of removing existing features.

- [ ] **Step 3: Start the existing web/API development services and check the browser flows below.** Reuse running services. If absent, run the existing root `pnpm dev` command. Use test accounts already available to the project; never hardcode credentials in test files or documentation.

| Session and action | Expected result |
| --- | --- |
| Anonymous direct access to `/account/password` | Redirect to `/login` |
| REGISTRANT follows password link, then reloads `/account/password` | Password form, not account profile content |
| REGISTRANT opens own product edit from detail, then reloads edit URL | Editor page without product-detail page above it |
| MANAGE opens registration edit from detail, then reloads edit URL | Admin editor page without registration detail content above it |
| VIEW-only opens registration edit | `/403` |
| SCORE opens `/judge` and `/admin/scoring-forms` | Both allowed |
| VIEW-only opens `/judge` | `/403` |
| MANAGE visits `/admin/judges` | `/admin/users?permission=SCORE`; replacement navigation remains configured |
| Conflicting locality filters on either admin list | Alert and working list-reset button |
| Unknown URL | Existing not-found screen |
| Keyboard Tab from document start | Skip-link remains visible on focus and reaches content |
| An existing action that emits a toast | Toast appears once inside the root shell |
| Cold navigation with network throttling | Loading bar and existing pending UI remain functional |

For splitting/preload, disable browser cache, load a different page first, and hover an admin dashboard or product-detail link. The route component chunk should be requested before clicking, without rendering the destination page. Check each hover from a fresh load if the module was already cached. Record missing loading indicators or console errors as failures; do not infer browser behavior from build success alone.

- [ ] **Step 4: Add this routing section to `apps/web/README.md`.**

```markdown
## Routing

Define routes in `src/routes/` with TanStack file-based routing. `src/router.tsx` creates the router and supplies session/query context, preload, pending, and scroll options. `src/types/router.ts` registers its type.

Vite's TanStack plugin generates `src/routeTree.gen.ts` and automatically splits route components. Do not edit generated output. Run `pnpm --filter @ocop/web build` before typechecking when the generated file is absent.

Account and product/registration detail screens use index route files. Password and edit routes are independent pages under the authenticated layout; do not turn the detail screens into their parent layouts.

Verification from repository root:

    pnpm --filter @ocop/web build
    pnpm --filter @ocop/web typecheck
    node apps/web/test/router.check.mjs
    node apps/web/test/proxy.check.mjs

Root providers and navigation indicators belong in `src/routes/__root.tsx`; the authenticated pending screen belongs in `src/routes/_app.tsx`.
```

- [ ] **Step 5: Review the complete routing diff and final checkpoint.** Ensure only the planned route files, router/Vite integration, generated output, shared filter screen, routing check, README, and design/plan documents changed for this work. Do not use a repository-wide formatter. Format only edited human-written files using the existing Prettier setup; the generated tree is already ignored.

Record actual verification results in the execution handoff: build, typecheck, URL/guard check, proxy check, production splitting, and each browser flow. State unavailable accounts or services explicitly; a blocked browser check is not a pass. No database migrations or backend suite are required for this frontend routing change.

Apply the commit preconditions from Starting state before the documentation checkpoint:

```powershell
git add -- apps/web/README.md docs/superpowers/specs/2026-10-28-file-based-routing-design.md docs/superpowers/plans/2026-10-28-restore-file-based-routing.md
git diff --cached --stat
git commit -m "docs(web): document file routing and verification workflow"
```

## Plan self-review

- Spec 1–4: Task 1 covers URL inventory, guards/validators/redirects, generated-tree ownership, and all three independent password/edit routes.
- Spec 5–6: Task 2 preserves root providers, pending UI, shared filter errors; Task 1 preserves preload and scroll options.
- Spec 7–8: Task 1 enables plugin generation/splitting and leaves registration only in `types/router.ts`; Task 3 checks production dynamic entries and hover behavior.
- Spec 9–10: global constraints prohibit dependency changes and unrelated edits; scoped checkpoints guard the dirty working tree.
- All new module names and exports are defined in a task. Existing page/guard/parser APIs remain unchanged.
- A single Node/Vite routing check is introduced; no framework, API mocks, or custom router abstraction.

## Execution handoff

Planning creates only this plan and its companion design document. Implementation has not started.

Choose either fresh subagents per task with review between tasks, or inline execution with `superpowers:executing-plans`. Both use the same sequential task order and acceptance checks.
