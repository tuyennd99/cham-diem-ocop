# Backend Minimal Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current NestJS modular monolith build and boot reliably with explicit registrations, one environment configuration source, and no unused infrastructure scaffolding.

**Architecture:** Keep one `AppModule` and the existing controller → service → repository flow. Replace runtime barrel reflection with explicit class arrays, keep environment parsing in `src/config/env.ts`, and move service-level types and standalone file helpers into `src/types` and `src/utils`.

**Tech Stack:** NestJS 11, TypeScript 5.7, Jest 30, pnpm.

## Global Constraints

- Preserve the current modular monolith; do not introduce feature modules or microservices.
- Preserve user changes already present in the working tree.
- Do not add dependencies.
- Do not create commits unless the user explicitly requests them.

---

### Task 1: Establish regression baselines

**Files:**
- Test: `test/health.e2e-spec.ts`
- Test: `src/services/files.service.spec.ts`
- Test: `src/services/auth.service.spec.ts`

**Interfaces:**
- Consumes: current `AppModule`, `FilesService`, and `AuthService`.
- Produces: reproducible failures for provider discovery, auth mock resolution, and build blockers.

- [ ] Run `pnpm.cmd exec jest --config ./test/jest-e2e.json test/health.e2e-spec.ts --runInBand` and confirm `AppModule` fails while Nest tries to instantiate `assertAllowedDocument`.
- [ ] Run `pnpm.cmd exec jest src/services/files.service.spec.ts --runInBand` and retain its passing behavior as characterization coverage.
- [ ] Run `pnpm.cmd exec jest src/services/auth.service.spec.ts --runInBand` and confirm the stale mock path failure.
- [ ] Run `pnpm.cmd build` and record the remaining TypeScript blockers.

### Task 2: Move service-level types and standalone file helpers

**Files:**
- Create: `src/types/files.ts`
- Create: `src/types/dashboard.ts`
- Create: `src/types/notifications.ts`
- Create: `src/utils/document-files.ts`
- Modify: `src/services/files.service.ts`
- Modify: `src/services/dashboard.service.ts`
- Modify: `src/services/notifications.service.ts`
- Modify: `src/controllers/progress-reports.controller.ts`
- Modify: `src/controllers/consolidated-reports.controller.ts`
- Modify: `src/services/files.service.spec.ts`

**Interfaces:**
- Produces: `DocumentType`, `UploadedPrivateFile`, `DashboardStatus`, `OrganizationNotification`, `assertDraftSize`, `assertAllowedDocument`, `inspectDocument`, and `documentMime`.
- Consumes: `MAX_DRAFT_BYTES` from `src/utils/private-storage.ts`.

- [ ] Point the file service test at the desired `types/` and `utils/` modules and confirm it fails because those modules do not exist.
- [ ] Add the type files and `document-files.ts` with the existing behavior unchanged.
- [ ] Update services and controllers to consume the new locations.
- [ ] Remove standalone type/function exports from service modules.
- [ ] Run the file service, dashboard service, notification service, and affected controller tests.

### Task 3: Register Nest classes explicitly

**Files:**
- Modify: `src/controllers/index.ts`
- Modify: `src/services/index.ts`
- Modify: `src/repositories/index.ts`
- Modify: `src/app.module.ts`
- Delete: `src/utils/convert-object-to-array.util.ts`

**Interfaces:**
- Produces: `appControllers`, `appServices`, and `appRepositories` arrays containing only Nest classes.
- Consumes: those arrays directly from `AppModule`.

- [ ] Replace wildcard barrel exports with explicit imports and class arrays.
- [ ] Update `AppModule` to use the arrays directly.
- [ ] Delete runtime `typeof === "function"` discovery.
- [ ] Run the health e2e test and confirm the original provider-instantiation failure is gone.

### Task 4: Use one environment configuration source

**Files:**
- Modify: `src/services/auth.service.ts`
- Modify: `src/services/auth.service.spec.ts`
- Modify: `src/modules/index.ts`
- Delete: `src/config/configuration.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `env(process.env)` from `src/config/env.ts`.
- Produces: JWT and CSRF configuration based only on `PORT`, `JWT_SECRET`, `CSRF_SECRET`, `CORS_ORIGINS`, and `TRUST_PROXY_HOPS`.

- [ ] Fix the auth test mock path and update construction for the desired configuration interface.
- [ ] Confirm the auth test fails until `AuthService` stops depending on `ConfigService`.
- [ ] Replace `ConfigService` secret reads with `env(process.env)`.
- [ ] Register `JwtModule` from the same `env.ts` source.
- [ ] Remove `configuration.ts` and the unused `@nestjs/config` dependency.
- [ ] Run env, auth service, JWT guard, and auth e2e tests.

### Task 5: Delete dead infrastructure scaffolding

**Files:**
- Modify: `src/app.module.ts`
- Modify: `src/modules/index.ts`
- Delete: `src/middlewares/middlewares/admin.middleware.ts`
- Delete: `src/middlewares/middlewares/example.middleware.ts`
- Delete: `src/middlewares/middlewares/index.ts`
- Delete: `src/middlewares/routes/authentication.route.ts`
- Delete: `src/middlewares/routes/configuration.ts`
- Delete: `src/middlewares/routes/global.route.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Produces: an `AppModule` with no `NestModule.configure()` hook and infrastructure imports limited to JWT, scheduling, and throttling.

- [ ] Remove `RoutesConfiguration` and `NestModule` from `AppModule`.
- [ ] Remove `HttpModule`, `EventEmitterModule`, `@nestjs/axios`, and `@nestjs/event-emitter`.
- [ ] Delete the no-op middleware tree.
- [ ] Search for stale imports and package references.

### Task 6: Clear build and test blockers

**Files:**
- Modify: `src/utils/dayjs.ts`
- Modify only if still required: `src/controllers/progress-reports.controller.ts`
- Modify only if still required: `src/controllers/consolidated-reports.controller.ts`

**Interfaces:**
- Produces: the named `dayjs` export expected by task and reporting-period logic.

- [ ] Add the missing named `dayjs` export.
- [ ] Preserve the existing type-only `UploadedPrivateFile` imports.
- [ ] Run the focused periods, reporting-periods, tasks, and controller tests.

### Task 7: Full verification

**Files:**
- Verify: all modified files.

**Interfaces:**
- Produces: evidence for build, unit, e2e, and dependency consistency.

- [ ] Run `pnpm.cmd build`.
- [ ] Run `pnpm.cmd test --runInBand`.
- [ ] Run `pnpm.cmd test:e2e --runInBand`.
- [ ] Run ESLint without `--fix`.
- [ ] Run `git diff --check`, `git status --short`, and inspect the final diff for unintended changes.
