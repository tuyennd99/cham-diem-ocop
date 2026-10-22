# Admin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver H3’s forward-only data foundation and combined staff permissions, with migration, API, product lifecycle, and client behavior covered by MIG-01, USR-01..04, ORG-01, and CAT-01..02.

**Architecture:** Keep `role` as a compatibility projection while the BE reads fixed `staffPermissions` from the database on every authenticated request. Add normalized groups, optional organization/locality references, transactional status history, and server-created submission snapshots; update the existing routes and clients to consume the same permission contract.

**Tech Stack:** Prisma, PostgreSQL, NestJS, React, TanStack Router, Jest, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-17-admin-modules-spec.md`; H3 acceptance is listed in `Hãy khảo sát dự án trong Working Directory hiện tạ.md`.

## Global Constraints

- “Không cấp VIEW toàn hệ thống cho toàn bộ giám khảo cũ.”
- “Tài khoản nội bộ active phải có ít nhất một quyền.”
- “Thay quyền, khóa tài khoản hoặc reset mật khẩu làm tăng `tokenVersion`; phiên cũ bị thu hồi.”
- “Thay phân công được kiểm tra từ DB tại mỗi thao tác, không dựa vào danh sách trong token hoặc localStorage.”
- “Mọi truy vấn/kiểm tra giám khảo đang dùng `role = JUDGE` phải nhận cả tài khoản ADMIN có SCORE.”
- “Danh mục triển khai dùng mã đã được chủ quản đối chiếu; tài liệu không tự tạo mã địa bàn.”
- “Chỉ backfill từ nguồn lịch sử có thể kiểm chứng; không lấy `updatedAt` làm ngày hoàn tất hoặc dò xã/phường bằng chuỗi địa chỉ.”
- “Nhật ký trạng thái chỉ ghi khi trạng thái thực sự đổi; retry không tạo lại ngày nộp/ngày hoàn tất.”
- “BE đặt `completedAt` cùng transaction chuyển sang COMPLETED; không cho client truyền thời điểm.”
- “Thông tin tại lúc nộp/hoàn tất phải có schema cố định và được tạo tại BE, không nhận một JSON snapshot tùy ý từ FE.”
- Do not modify migrations before `0011`; run DB integration tests only through the existing isolated test-schema harness.
- Seed only the six official ProductGroups derivable from `seed-data/categories.json`; leave OrganizationUnit and Locality empty until verified catalogs are provided.

## Plan Rulings

- Use VIEW’s documented deployment-wide read scope; OrganizationUnit is accountability metadata and does not filter records. If this assumption is wrong, disclosure scope and every read query must be revisited.
- Keep real OrganizationUnit/Locality catalogs empty; fabricated codes/names would corrupt assignment and reporting dimensions.
- H3 adds only the staff-access mutation needed to prove revocation and final-admin concurrency. Full user search/create/reset screens and APIs remain H4.
- Legacy completed records retain `completedAt = null`; no date can be reconstructed from `updatedAt` safely. This makes old records count as missing completion data until sourced.

---

### Task 1: Schema, migration, and catalog backfill

**Files:** `apps/be/prisma/schema.prisma`, new `apps/be/prisma/migrations/0011_admin_foundation/migration.sql`, `apps/be/prisma/seed/seed.ts`, `apps/be/test/seed.db-spec.ts`, new migration DB test.

**Produces:** `StaffPermission` (`MANAGE`, `VIEW`, `SCORE`), compatibility `Role.VIEWER`, `OrganizationUnit`, six `ProductGroup` records, empty `Locality`, category/group and active-state relations, Product ownership/locality/completion columns, `ProductStatusEvent`, Evaluation submission snapshot columns, and the 0011 forward migration.

- [ ] Add schema/migration assertions for the exact legacy mapping: ADMIN → MANAGE + VIEW, JUDGE → SCORE, REGISTRANT → no staff permission; preserve all IDs and records, and add no invented unit, locality, completion time, or history.
- [ ] Run the migration test against an isolated schema containing one user of each legacy role, categories, product, attachment, assignment, evaluation, and score; assert unchanged IDs/counts and correct mapped values.
- [ ] Seed six ProductGroups from existing category codes/names and link all 26 existing categories without changing category IDs, names, group labels, or criteria IDs; make seed re-runnable.
- [ ] Assert CAT-01’s six-group/26-category/criteria links and that the new locality/unit catalogs contain no fabricated rows.
- [ ] Generate Prisma client and run focused migration/seed DB tests; commit the task.

### Task 2: Permission enforcement and staff-access mutation

**Files:** `packages/shared/src/index.ts`, `apps/be/src/types/*`, `apps/be/src/guards/*`, auth/admin/judge controllers, auth service/repository, admin service/repository/DTOs, and their existing/new unit or DB specs.

**Consumes:** Task 1’s User permission/unit fields and VIEWER role.

**Produces:** A DB-derived authenticated principal with effective permissions and unit; MANAGE/VIEW/SCORE authorization; a MANAGE-only staff-access update that audits before/after, increments `tokenVersion`, and cannot deactivate/unverify/demote the last active verified MANAGE account under concurrent requests.

- [ ] Add tests for `MANAGE` implying VIEW only, `MANAGE` not implying SCORE, and token-version mismatch rejecting old sessions; then implement the shared permission decorator/guard and database principal hydration.
- [ ] Apply MANAGE to admin writes/user data, VIEW to permitted read endpoints, and SCORE plus current DB assignment to judging routes; retain REGISTRANT role protection.
- [ ] Replace judge-role checks in assignment, progress, and scoring paths with SCORE eligibility while preserving active/verified checks.
- [ ] Add focused DB coverage for USR-01..04, including simultaneous attempts to remove access from the final admin; make access changes atomic with audit and token-version increment.
- [ ] Run focused BE unit and isolated DB tests; commit the task.

### Task 3: Transactional product/evaluation history and active-category rules

**Files:** `apps/be/src/repositories/products.repository.ts`, `apps/be/src/repositories/evaluations.repository.ts`, `apps/be/src/utils/evaluation-result.ts`, category repository/service/controller as present, and corresponding unit/DB specs.

**Consumes:** Task 1’s ProductStatusEvent and snapshot fields; Task 2’s current principal.

- [ ] Add failing DB cases for one event per actual status transition, retry idempotency, `completedAt` set only on first COMPLETED transition, and actor attribution; implement shared transaction-local event writes for product creation/submission, first scoring, and completion.
- [ ] Reject new submissions when category or its criteria set is inactive while leaving existing submitted products/evaluations readable and scoreable; exclude inactive categories from new-registration choices and allow existing drafts to load.
- [ ] Snapshot the judge and organization-unit names and criteria/assignment scope on BE when an evaluation is submitted; prove changing the judge’s unit later does not change submitted history (ORG-01).
- [ ] Assert CAT-02’s inactive-category choice/submission behavior and ensure no historical product/category/evaluation row is deleted or rewritten.
- [ ] Run focused repository and isolated DB tests; commit the task.

### Task 4: Shared client contract and permission-based navigation

**Files:** `packages/shared/src/index.ts`, `apps/web/src/types/auth.ts`, `apps/web/src/stores/session-store.ts`, `apps/web/src/lib/route-guards.ts`, `apps/web/src/lib/auth.ts`, `apps/web/src/layouts/AppLayout.tsx`, affected `apps/web/src/routes/*`, and focused client tests.

**Consumes:** Task 2’s auth response permissions and unit.

- [ ] Add client tests for VIEWER persistence, legacy ADMIN → MANAGE + VIEW migration, judge SCORE access, and combined MANAGE + SCORE access.
- [ ] Replace role-only admin/judge checks with permission checks: MANAGE sees admin navigation, VIEW sees allowed read routes, SCORE sees `/judge`, and MANAGE + SCORE sees both; do not expose user-management routes to VIEW.
- [ ] Keep server authorization authoritative; route redirects only improve navigation and do not substitute for BE guards.
- [ ] Run web typecheck, focused tests, API unit tests, and production builds for web and BE; commit the task.

## Acceptance Map and Self-Review

| Acceptance | Task / evidence |
|---|---|
| MIG-01 | Task 1 isolated upgrade test preserves IDs/rows and exact role mapping; no fabricated historical values. |
| USR-01..03 | Tasks 2 and 4 permission/assignment API tests plus client route/session tests. |
| USR-04 | Task 2 concurrent final-MANAGE access-change test and stale-token rejection. |
| ORG-01 | Task 3 submitted unit snapshot remains unchanged after unit rename/transfer. |
| CAT-01 | Task 1 migration/seed test asserts six groups, 26 categories, and their criteria links. |
| CAT-02 | Task 3 verifies inactive categories cannot be selected/submitted anew and old records stay accessible. |

No placeholder steps remain. Schema fields produced by Task 1 are the explicit inputs to Tasks 2 and 3; Task 2’s auth contract is the explicit input to Task 4. H4’s full user-management UI/API is outside this plan.
