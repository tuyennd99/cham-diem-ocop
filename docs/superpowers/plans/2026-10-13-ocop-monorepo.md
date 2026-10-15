# OCOP Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Turn the existing FE and NestJS base into one pnpm OCOP monorepo with the registration, judging, admin, and public flows from the approved spec.

**Architecture:** Put the current FE and BE under `apps/web` and `apps/api`, with a root pnpm workspace and shared API contract types in `packages/shared`. Keep the existing FE stack and reusable Nest infrastructure; replace the task/report business domain and seed with OCOP models and endpoints.

**Tech Stack:** pnpm, Node.js 24.7+, React 19, Vite, TanStack Router, NestJS 11, Prisma 7, PostgreSQL, class-validator, bcrypt, local disk uploads, Nodemailer SMTP.

**Spec:** `2026-10-12-ocop-scoring-system-design.md`

## Global Constraints

- API prefix: `/api`.
- Roles: `REGISTRANT`, `JUDGE`, `ADMIN`.
- Access JWT lifetime: 7 days; registration and password reset use 6-digit email OTP with 5-minute expiry.
- Product status flow: `DRAFT` → `SUBMITTED` → `SCORING` → `COMPLETED`.
- Five-star thresholds: 90, 70, 50, 30 points.
- Upload limit: 10 MB per file; accept image and PDF evidence only.
- Criteria and form fields must come from Quyết định 26/2026/QĐ-TTg and its appendices; do not invent legal scoring content.
- User approved replacing the task/report domain and discarding its data; do not run a migration against any configured database during this implementation.

---

### Task 1: Establish the monorepo root

**Files:**
- Move: `fe/**` → `apps/web/**`
- Move: `be/**` → `apps/api/**`
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`, `README.md`
- Create: `packages/shared/package.json`, `packages/shared/src/index.ts`

**Interfaces:**
- Root workspace includes `apps/*` and `packages/*`.
- Root scripts forward `dev`, `build`, and `typecheck` to both apps.
- Keep FE dependencies in `apps/web` and API dependencies in `apps/api`.

- [x] Move both app working trees, preserving all authored source/assets and excluding `node_modules`, `dist`, coverage, storage, and local env files.
- [x] Add root workspace declarations:

```yaml
packages:
  - apps/*
  - packages/*
```

- [x] Create root scripts that use `pnpm --filter @ocop/web ...` and `pnpm --filter @ocop/api ...`.
- [x] Rename app package metadata to `@ocop/web` and `@ocop/api`; retain each app's existing stack and scripts.
- [x] Consolidate Git at the workspace root and preserve the old FE/BE repositories as recoverable history before removing nested `.git` metadata.
- [x] Create `packages/shared` for the roles, product status, category, and API result types consumed by both apps; do not move Prisma-only types there.
- [x] Generate the root lockfile from the two app manifests.

### Task 2: Replace the Prisma domain and seed

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<new-migration>/migration.sql`
- Modify: `apps/api/prisma/seed/seed.ts`
- Create: `apps/api/prisma/seed-data/categories.json`
- Create: `apps/api/prisma/seed-data/criteria-*.json`
- Create: `apps/api/src/utils/scoring.ts`

**Interfaces:**
- Prisma models: `User`, `OtpCode`, `ProductCategory`, `CriteriaSet`, `Criterion`, `SubCriterion`, `ScoreOption`, `Product`, `Attachment`, `JudgeAssignment`, `Evaluation`, and `Score`.
- `calculateStars(score: number): number` maps the spec's five thresholds.
- `calculateFinalScore(...)` averages full-assignment totals, or averages each criterion across partial assignments before summing.

- [x] Replace task/report enums and models with the approved OCOP data model; use cuid IDs and explicit foreign keys, uniqueness, indexes, and delete behavior.
- [x] Add DB constraints/relations so an evaluation score can only select an option belonging to that score's subcriterion.
- [x] Create a forward migration that removes the approved-disposable task/report tables and creates OCOP tables; leave historical migration files unchanged.
- [x] Source category/criterion/score-option values and registration form fields from the official decision and appendices. Keep the source edition in the seed metadata.
- [x] Seed categories and criteria idempotently; never seed fabricated score options or sample users/products.
- [x] Add the scoring utility with the exact threshold and partial-assignment rules above.

### Task 3: Implement email account and OTP flows

**Files:**
- Modify: `apps/api/src/controllers/auth.controller.ts`
- Modify: `apps/api/src/services/auth.service.ts`
- Modify: `apps/api/src/repositories/auth.repository.ts`
- Modify: `apps/api/src/guards/jwt-auth.guard.ts`
- Modify: `apps/api/src/guards/account.guard.ts`
- Modify: `apps/api/src/types/auth.ts`
- Modify: `apps/api/src/dtos/auth.dto.ts`
- Create: `apps/api/src/services/otp.service.ts`
- Create: `apps/api/src/services/mail.service.ts`
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/package.json`

**Interfaces:**
- Endpoints: register, verify OTP, login, forgot password, reset password, and `GET /auth/me`.
- JWT claims contain `sub`, `email`, and `role`; role guards enforce registrant/judge/admin access.
- OTP service validates purpose, expiry, one-time use, and attempt limits before account/password changes.

- [x] Replace the base's username/admin-id auth flow with email and persisted role checks.
- [x] Implement bcrypt password hashing using `bcryptjs` and retain constant-time credential failure behavior where compatible.
- [x] Add Nodemailer SMTP configuration with required env validation; never log OTP values.
- [x] Store OTPs safely, expire and consume them atomically, and rate-limit send/verify endpoints.
- [x] Remove refresh-cookie/CSRF endpoints from the OCOP API, since refresh tokens are explicitly out of scope.

### Task 4: Implement public and registrant product flows

**Files:**
- Create: `apps/api/src/controllers/categories.controller.ts`
- Create: `apps/api/src/controllers/products.controller.ts`
- Create: `apps/api/src/controllers/my-products.controller.ts`
- Create: `apps/api/src/services/products.service.ts`
- Create: `apps/api/src/repositories/products.repository.ts`
- Create: `apps/api/src/dtos/products.dto.ts`
- Modify: `apps/api/src/utils/private-storage.ts`
- Modify: `apps/api/src/controllers/index.ts`
- Modify: `apps/api/src/repositories/index.ts`
- Modify: `apps/api/src/services/index.ts`

**Interfaces:**
- Public endpoints list only submitted/scoring/completed products and expose only approved public form fields.
- Registrant endpoints enforce ownership and draft-only updates/deletes/submission.
- Attachment endpoints accept images/PDFs, record metadata, and prevent access outside the owning product's scope.

- [x] Implement categories, paginated public products, and public product detail.
- [x] Implement registrant product CRUD, submit transition, and attachment add/remove.
- [x] Derive `SCORING`/`COMPLETED` status from evaluation progress, not client-supplied status.
- [x] Validate MIME using file content plus extension; cap upload size to 10 MB and clean up rejected files.
- [x] Allowlist public `formData` fields instead of returning arbitrary JSON with ad-hoc redaction.

### Task 5: Implement judge assignments and evaluations

**Files:**
- Create: `apps/api/src/controllers/judge.controller.ts`
- Create: `apps/api/src/services/evaluations.service.ts`
- Create: `apps/api/src/repositories/evaluations.repository.ts`
- Create: `apps/api/src/dtos/evaluations.dto.ts`
- Modify: `apps/api/src/controllers/index.ts`
- Modify: `apps/api/src/repositories/index.ts`
- Modify: `apps/api/src/services/index.ts`

**Interfaces:**
- Judge queue and evaluation endpoints require a matching category assignment.
- Draft writes accept only assigned subcriteria and valid options; submit rejects missing required scores.
- Submitted evaluations are immutable; product aggregate updates in the same transaction.

- [x] Implement queue, evaluation read, draft save, and submit endpoints.
- [x] Enforce assignment and product status at the repository transaction boundary.
- [x] On submit, require complete coverage for the assigned criterion scope and calculate its total from selected options.
- [x] Recompute final score and stars only when configured coverage is complete; otherwise leave them null.
- [x] Reject cross-subcriterion option IDs and duplicate score entries.

### Task 6: Implement admin judges, assignments, and results

**Files:**
- Create: `apps/api/src/controllers/admin.controller.ts`
- Create: `apps/api/src/services/admin.service.ts`
- Create: `apps/api/src/repositories/admin.repository.ts`
- Create: `apps/api/src/dtos/admin.dto.ts`
- Modify: `apps/api/src/controllers/index.ts`
- Modify: `apps/api/src/repositories/index.ts`
- Modify: `apps/api/src/services/index.ts`

**Interfaces:**
- Admin endpoints manage judges and category/criterion assignments and return all product statuses/results.
- Only `ADMIN` may call admin endpoints; assignment updates validate category and criterion membership.

- [x] Implement judge create/update/delete/reset-password.
- [x] Implement category assignments and criterion scope management.
- [x] Implement all-products and per-product results views with evaluator and aggregate scores.
- [x] Audit role/assignment changes using the existing audit mechanism.

### Task 7: Connect the existing FE to the API

**Files:**
- Modify: `apps/web/src/auth.ts`
- Modify: `apps/web/src/data.ts`
- Modify: `apps/web/src/judgeData.ts`
- Modify: `apps/web/src/router-context.ts`
- Modify: `apps/web/src/route-guards.ts`
- Modify: `apps/web/src/routes/_public.*.tsx`
- Modify: `apps/web/src/routes/_auth.*.tsx`
- Modify: `apps/web/src/routes/_app.my.*.tsx`
- Modify: `apps/web/src/routes/_app.judge.*.tsx`
- Modify: `apps/web/src/routes/_app.admin.*.tsx`
- Create: `apps/web/src/lib/api.ts`
- Modify: `apps/web/vite.config.ts`

**Interfaces:**
- FE API client uses `VITE_API_URL` and the shared role/status/request types.
- Existing route loaders/actions consume server data; mock registries remain only where the spec explicitly calls for demonstrative static content.

- [x] Replace sample product/category/auth/score data with API calls for public, registrant, judge, and admin routes.
- [x] Implement auth forms and OTP verification against the new endpoints.
- [x] Wire draft save, product submit, attachment upload, evaluation draft/submit, assignments, and result views.
- [x] Keep current visual components and route structure; do not migrate Vite/TanStack Router to TanStack Start in this scope.
- [x] Add a development proxy to the API prefix and document required `VITE_API_URL` configuration.

### Task 8: Align application configuration and docs

**Files:**
- Modify: `apps/api/src/config/app.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/README.md`
- Modify: root `README.md`

- [x] Set the API prefix to `/api`, update Swagger metadata, and remove duplicate Swagger setup.
- [x] Document root install/dev/build commands, app-specific commands, PostgreSQL setup, SMTP env vars, upload storage, seed, and migration deploy.
- [x] Ensure old task/report seed scripts and scheduled jobs are no longer registered or runnable.
- [x] Do not run Prisma migrations or seed against the configured database.

## Self-review

- Spec coverage: monorepo/REST prefix (Tasks 1, 8); roles/OTP (Task 3); categories/criteria/official seed (Task 2); public and registrant flows (Task 4); judge queue/scoring and partial assignments (Tasks 2, 5); admin management/results (Task 6); existing FE surfaces (Task 7); local upload constraints (Task 4); out-of-scope refresh/SMS/criteria UI/S3 remain absent.
- All 26 category-specific criteria sets are transcribed from the cited Appendix II and validated to total 100 points; known transcription defects are called out in seed metadata and are not guessed.
- Mẫu 01 is represented by named form fields, and the API rejects submission until required identity, registration, sample, contact, and declaration values are complete.
- Database changes are code-only in this task; no configured database migration or reset will run.
- UI refinements from the gap review are design-only handoffs in `docs/open-design/ocop-ui-review-prompts.md`.
- Unit coverage now checks star boundaries and complete/partial score aggregation; database-backed API e2e requires a disposable test database and was not run here.
