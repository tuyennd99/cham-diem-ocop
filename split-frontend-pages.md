# Split Frontend `*Pages.tsx` Into Single-Screen Files

## Goal
Split `RoutePages.tsx`, `PublicPages.tsx`, `AuthPages.tsx`, `RegistrantPages.tsx`, `JudgePages.tsx`, and `AdminPages.tsx` into one file per screen under domain folders in `apps/web/src/pages/` without changing URLs, route tree, or runtime behavior.

## Tasks
- [x] Task 1: Create `apps/web/src/constants/product-status.ts` with shared status label/tone maps (`PUBLIC_PRODUCT_STATUS_LABEL`, `PUBLIC_PRODUCT_STATUS_TONE`, `REGISTRANT_PRODUCT_STATUS_LABEL`, `ADMIN_DASHBOARD_STATUS_LABEL`) → Verify: file exists and exports all 4 constants.
- [x] Task 2: Split `RoutePages.tsx`, `PublicPages.tsx`, and `App.tsx` into `src/pages/errors/{ForbiddenPage,NotFoundPage}.tsx` and `src/pages/public/{HomePage,PublicCatalogPage,PublicProductDetailPage}.tsx` (keep `App.tsx` re-exporting `HomePage`), update `403.tsx`, `404.tsx`, `__root.tsx`, `_public.index.tsx`, `_public.products.index.tsx`, `_public.products.$id.tsx`, and remove `RoutePages.tsx` & `PublicPages.tsx` → Verify: `Test-Path apps/web/src/pages/RoutePages.tsx, apps/web/src/pages/PublicPages.tsx` returns `False`.
- [x] Task 3: Split `AuthPages.tsx` into `src/pages/auth/{pending-email.ts,AuthFrame.tsx,LoginPage.tsx,RegisterPage.tsx,VerifyOtpPage.tsx,ForgotPasswordPage.tsx}` and `src/pages/account/{AccountPage.tsx,ChangePasswordPage.tsx}`, update `_auth.*.tsx` and `_app.account*.tsx`, and remove `AuthPages.tsx` → Verify: `Test-Path apps/web/src/pages/AuthPages.tsx` returns `False`.
- [x] Task 4: Split `RegistrantPages.tsx` into `src/pages/registrant/{AttachmentLink.tsx,MyProductsPage.tsx,ProductEditorPage.tsx,MyProductDetailPage.tsx}`, update `_app.my.products*.tsx`, and remove `RegistrantPages.tsx` → Verify: `Test-Path apps/web/src/pages/RegistrantPages.tsx` returns `False`.
- [x] Task 5: Split `JudgePages.tsx` into `src/pages/judge/{JudgeQueuePage.tsx,JudgeEvaluationPage.tsx}`, update `_app.judge*.tsx`, and remove `JudgePages.tsx` → Verify: `Test-Path apps/web/src/pages/JudgePages.tsx` returns `False`.
- [x] Task 6: Split `AdminPages.tsx` into `src/pages/admin/{AdminDashboardPage.tsx,AdminJudgesPage.tsx,AdminAssignmentsPage.tsx,AdminProductsPage.tsx,AdminProductResultsPage.tsx}`, update `_app.admin*.tsx`, and remove `AdminPages.tsx` → Verify: `Test-Path apps/web/src/pages/AdminPages.tsx` returns `False`.
- [x] Task 7: Run final verification (`Get-ChildItem apps/web/src/pages -File`, `pnpm --filter @ocop/web build`, `node apps/web/test/api-integration.check.mjs`, `node apps/web/test/proxy.check.mjs`) → Verify: 0 `*Pages.tsx` files in `src/pages/`, build & tests exit 0.

## Done When
- [x] Every screen lives in its own `.tsx` file under `apps/web/src/pages/{errors,public,auth,account,registrant,judge,admin}/`.
- [x] All route files in `apps/web/src/routes/` import from the new paths and `routeTree.gen.ts` remains unchanged.
- [x] `pnpm --filter @ocop/web build` and both integration check scripts pass.

## Notes
- Reference specification: `docs/superpowers/plans/2026-10-22-split-frontend-pages.md`.
- Do not touch `apps/web/src/api/` sample files or edit `routeTree.gen.ts` by hand.
