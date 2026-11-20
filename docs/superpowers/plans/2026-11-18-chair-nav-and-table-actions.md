# Chair Navigation and Table Icon Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the duplicate "Sản phẩm" navigation item for Chủ trì (`!canManage`) and replace text buttons in the admin/chair product table's action column with icon buttons including a quick "Duyệt hồ sơ" (`CheckCircle2`) action for `SUBMITTED` records.

**Architecture:** Gate the `/admin/products` navigation links on `canManage` in `WorkspaceNav`, `AppSidebar`, and `PublicLayout` while keeping `/admin/registrations` visible to all `canView` users. In `AdminProductsPage`, render icon buttons with `Tooltip` for the `!isOwner` action column and wire a confirmation `Dialog` calling `adminProductsApi.approve(productId, reason)`.

**Tech Stack:** React 19, TypeScript, TanStack Router, TanStack Query, Lucide React, Radix/shadcn UI components, Node test runner (`node:test`).

**Spec:** `docs/superpowers/specs/2026-11-18-chair-nav-and-table-actions-design.md`

## Global Constraints

- Do not remove `/_app/admin/products/` route or change its `requirePermission(STAFF_PERMISSION.VIEW)` guard so Dashboard and Reports drill-down links continue working.
- Keep existing `isOwner` icon actions untouched.
- Invalidate `queryKeys.adminProducts.all`, `queryKeys.admin.all`, `queryKeys.judge.all`, `queryKeys.myProducts.all`, and `queryKeys.publicProducts.all` after approving a product from the table.

## Review Focus

- Chair user (`canView = true`, `canManage = false`) sees "Phiếu đăng ký" (`/admin/registrations`) in navigation and does not see "Sản phẩm" (`/admin/products`).
- Admin user (`canView = true`, `canManage = true`) still sees both "Sản phẩm" and "Phiếu đăng ký" in navigation.
- Quick approve button (`Duyệt hồ sơ`) only appears for rows with `status === 'SUBMITTED'` and is hidden for `DRAFT`, `RETURNED`, `APPROVED`, `SCORING`, and `COMPLETED`.
- Edit button (`Sửa phiếu`) only appears when `canManage === true` and `status` is `DRAFT` or `RETURNED`.
- Quick approve dialog trims optional reason, passes `undefined` when blank, disables controls while pending, and surfaces API errors inside the dialog without closing it.

---

### Task 1: Hide "Sản phẩm" navigation tab for Chủ trì and update table actions to icons with quick approve

**Files:**
- Modify: `apps/web/src/layouts/workspace/WorkspaceNav.tsx:114-126`
- Modify: `apps/web/src/components/app-sidebar.tsx:38-80`
- Modify: `apps/web/src/layouts/PublicLayout.tsx:149-164`
- Modify: `apps/web/src/pages/admin/AdminProductsPage.tsx`

**Interfaces:**
- Consumes: `adminProductsApi.approve(id: string, reason?: string)` from `apps/web/src/api/admin-products.ts`
- Produces: Updated `WorkspaceNav`, `AppSidebar`, `PublicLayout`, and `AdminProductsPage`

- [ ] **Step 1: Update navigation components so "Sản phẩm" only renders when `canManage` is true**

In `apps/web/src/layouts/workspace/WorkspaceNav.tsx`:
```tsx
          {canManage && (
            <NavItemTooltip label='Sản phẩm' enabled={tooltipEnabled}>
              <Link to='/admin/products' title='Sản phẩm' onClick={onNavigate}>
                <Package className='size-4' aria-hidden='true' />
                <span>Sản phẩm</span>
              </Link>
            </NavItemTooltip>
          )}
          <NavItemTooltip label='Phiếu đăng ký' enabled={tooltipEnabled}>
            <Link to='/admin/registrations' title='Phiếu đăng ký' onClick={onNavigate}>
              <FileText className='size-4' aria-hidden='true' />
              <span>Phiếu đăng ký</span>
            </Link>
          </NavItemTooltip>
```

In `apps/web/src/components/app-sidebar.tsx`:
Filter `mainNavItems` when `!canManage` so `/admin/products` is excluded:
```tsx
  const workItems = canManage
    ? mainNavItems
    : mainNavItems.filter((item) => item.href !== '/admin/products');
```
And pass `items={workItems}` to the `"Làm việc"` `NavMainCollapsible`.

In `apps/web/src/layouts/PublicLayout.tsx`:
When `canView` is true, link to `/admin/products` ("Danh sách sản phẩm") if `canManage`, otherwise link to `/admin/registrations` ("Phiếu đăng ký").

- [ ] **Step 2: Replace text buttons in `AdminProductsPage.tsx` action column with icon buttons and add quick Approve action + Dialog**

In `apps/web/src/pages/admin/AdminProductsPage.tsx`:
1. Import `CheckCircle2` from `lucide-react`, `adminProductsApi` from `../../api`, and `Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle` from `@/components/ui/dialog`.
2. Add state for quick approval:
   - `approvingProduct: AdminProductListItem | null`
   - `approveReason: string`
   - `approveError: string`
3. In `productColumns` (`!isOwner` branch), render icon buttons wrapped in `Tooltip`:
   - `Eye` (`variant='secondary'`, `size='icon-sm'`): Link to `/admin/products/$id` or `/admin/registrations/$id`, `aria-label={`Mở hồ sơ ${product.name}`}`, tooltip `"Mở hồ sơ"`.
   - `CheckCircle2` (`variant='secondary'`, `size='icon-sm'`): Rendered when `product.status === PRODUCT_STATUS.SUBMITTED`, `aria-label={`Duyệt hồ sơ ${product.name}`}`, tooltip `"Duyệt hồ sơ"`, opens the approval dialog for `product as AdminProductListItem`.
   - `Pencil` (`variant='secondary'`, `size='icon-sm'`): Rendered when `canManage && (product.status === PRODUCT_STATUS.DRAFT || product.status === PRODUCT_STATUS.RETURNED)`, Link to `/admin/registrations/$id/edit`, `aria-label={`Sửa phiếu ${product.name}`}`, tooltip `"Sửa phiếu"`.
4. Render the approval `Dialog` for `!isOwner`:
   - Title: `Duyệt hồ sơ sản phẩm: ${approvingProduct?.name ?? ''}`
   - Description: `Sau khi duyệt, hệ thống tự động phân công tất cả giám khảo đang hoạt động thuộc các cơ quan quản lý của phân loại sản phẩm này.`
   - Optional note input (`id='admin-table-approve-reason'`, `maxLength={255}`).
   - Confirm button calls `adminProductsApi.approve(approvingProduct.id, approveReason.trim() || undefined)`, invalidates `adminProducts.all`, `admin.all`, `judge.all`, `myProducts.all`, `publicProducts.all`, shows `toast.success('Đã duyệt hồ sơ và tự động phân công giám khảo theo cơ quan quản lý.')`, and closes the dialog.

- [ ] **Step 3: Run typecheck, tests, and boundary checks**

Run:
```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web exec node test/router.check.mjs
```
Expected: All commands exit 0 with PASS.
