# Admin Density and Sidebar Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thu gọn đúng control và bộ lọc admin đang chạy, sửa form giãn bất thường và hoàn thiện sidebar 248/72px, có số đo trình duyệt chứng minh.

**Architecture:** Sửa các quy tắc CSS hiện có trong phạm vi admin và dialog admin, rồi nối kích thước trường vào markup thật; không tạo một bộ giao diện song song. Tái sử dụng sidebar, Button, Radix và logic truy vấn/lưu đang có. Dùng kiểm tra DOM/computed style để phát hiện lỗi cascade, kèm kiểm tra tương tác và build; không coi CSS mới hoặc build thành công là bằng chứng giao diện đúng.

**Tech Stack:** React 19.3.0, TypeScript, Vite, Tailwind CSS 4, Radix UI, Lucide, TanStack Router/Query; Node >=24.7 <25, pnpm 11.17.0 theo package.json gốc.

**Spec:** [Admin density review, bao gồm sidebar và đối chiếu bản sửa](../specs/2026-10-25-admin-density-review.md); [design.md, mục 4 và 6](../../../design.md). Đọc cả hai trước khi triển khai. Spec ngày 24/10 là lịch sử tổng thể; không áp lại quy tắc control 44px đồng loạt.

## Global Constraints

- “nghiệp vụ OCOP, gọn và rõ”. Giữ palette xanh, Be Vietnam Pro, chức năng và từ vựng hiện có.
- “Không đổi `.button` toàn cục để sửa mỗi admin.”
- “Button thường | Cao 36; padding ngang 12; chữ 14”.
- “Nút phụ trong bảng / icon | Cao 32 / 32×32; chữ 14”.
- “Input một dòng / select | Cao 36; padding ngang 10–12; chữ 14”.
- “Textarea | Tối thiểu 80–96; padding 8–12”. Select `multiple` không bị ép thành control một dòng.
- “Trên mobile hoặc thiết bị cảm ứng, giữ vùng bấm tối thiểu 44px”; trường nhập chữ 16px.
- “Panel: một lớp padding 12–16px”; khoảng khối 16px, vùng nội dung lớn 24px; main desktop 20–24px, mobile 16px.
- “Năm | 112px”; “Tháng | 144px”; “Trạng thái | 176px”; “Nhóm / phân loại | 240–280px”; “Tìm kiếm | 280–360px”. Đây là preferred width, không gây tràn ở 320px.
- “Form nhập hồ sơ | Tối đa 960px; 2 cột desktop, 1 cột khi không đủ chỗ”; bảng dùng chiều rộng khả dụng.
- “Sidebar desktop mở rộng 248px, thu gọn 72px”; dưới 1024px dùng drawer, không chừa cột trống.
- Không đổi API, quyền, query key, payload, URL filter, upload, luồng lưu hoặc bản in; không thêm dependency hay chế độ chọn mật độ.
- Giữ các sửa đổi chưa commit của người dùng/Open Design. Không reset, checkout đè hoặc stage toàn bộ workspace. Không commit thay đổi có trước chỉ vì nằm cùng file.
- Chỉ làm việc trên dự án thật `D:/project/chamdiemocop`; không xuất một app React mới, không chỉ sửa preview Open Design.
- Chưa có browser test runner trong web package. Dùng công cụ browser sẵn có hoặc DevTools cho phép đo bên dưới; không cài framework để kiểm tra CSS. Không tạo bản ghi nghiệp vụ hoặc lưu form vào DB để lấy ảnh.

---

## Phạm vi file và trách nhiệm

Đường dẫn dưới đây tương đối với `D:/project/chamdiemocop`. Số dòng là mốc định vị ngày 25/10, tìm bằng selector/id khi chúng thay đổi.

| File | Trách nhiệm trong bản sửa |
| --- | --- |
| `apps/web/src/styles.css` | Sửa cascade control tại ~2895–3385; bố cục bộ lọc, khoảng cách; ngoại lệ touch; sidebar responsive; giữ print |
| `apps/web/src/components/ui/button.tsx` | Thêm thuộc tính DOM `data-size` để CSS admin phân biệt default/sm/lg/icon; không đổi kích thước toàn cục |
| `apps/web/src/pages/admin/AdminDashboardPage.tsx` | Bộ lọc mẫu, năm/tháng/nhóm, hành động cùng hàng |
| `apps/web/src/pages/admin/AdminProductsPage.tsx` | Cả danh sách sản phẩm và phiếu đăng ký dùng chung trang này |
| `apps/web/src/pages/admin/AdminScoringFormsPage.tsx` | Cả bộ phiếu và phiếu thực tế, không bỏ bộ lọc nâng cao |
| `apps/web/src/pages/admin/AdminUsersPage.tsx` | Bộ lọc người dùng; giữ tab đơn vị |
| `apps/web/src/pages/admin/AdminReportsPage.tsx` | Bộ lọc báo cáo, giữ `no-print`, tab và cột dữ liệu |
| `apps/web/src/pages/admin/AdminProductGroupsPage.tsx` | Bộ lọc danh mục; giữ cây nhóm và tab địa bàn |
| `apps/web/src/pages/admin/LocalitiesPanel.tsx` | Bộ lọc địa bàn và dialog được hưởng control chung |
| `apps/web/src/pages/admin/OrganizationUnitsPanel.tsx` | Bộ lọc đơn vị và dialog được hưởng control chung |
| `apps/web/src/pages/admin/AdminAssignmentsPage.tsx` | Gắn kích thước trường lọc nhóm/phân loại; giữ scope/phân công/checkbox |
| `apps/web/src/components/products/ProductDraftEditor.tsx` | Chỉ sửa markup mode admin nếu CSS không đủ; giữ mode owner và luồng lưu/upload |
| `apps/web/src/layouts/AppLayout.tsx` | Hoàn thiện sidebar đã có: tên truy cập/tooltip/điều khiển; không thay hệ thống menu |
| `docs/verification/2026-10-25-admin-density-and-sidebar.md` | Tạo khi thực thi: phép đo trước/sau, trang/viewport/trạng thái, kiểm tra tương tác và giới hạn |

Chỉ đọc để kiểm tra ảnh hưởng: `components/ui/{input,select,textarea,tabs,dialog}.tsx`, `pages/admin/{CategoryEditorDialog,UserEditorDialog,AdminProductDetailPage,AdminProductResultsPage}.tsx`, trang tài khoản, public/auth/judge/owner, các route `_app.admin.*`. Không sửa route/API để phục vụ hình thức.

## Bằng chứng và thứ tự phụ thuộc

Tại lần kiểm tra gần nhất trên `/admin?year=2026`, viewport 2560px: controls 44px; trường năm/tháng 719px; filter panel 178px; main padding đã là 20px 24px, gap đã là 16px. Nút sidebar đã tồn tại và có state `sidebarCollapsed`, key localStorage `admin_sidebar_collapsed`.

Nguyên nhân còn lại: `.button` 44px và Button utilities; input/select admin ~3270 vẫn 44px; CSS chiều rộng chưa gắn TSX; `.admin-filters` chia `1fr`, có padding/viền trong `.filter-card`. Không làm lại những phần đã đúng.

Thứ tự: **Task 1 → 2 → 3 → 4 → 5 → 6**. Cùng sửa `styles.css`, nên thực hiện tuần tự. Khi người dùng chọn subagent, mỗi task có người thực hiện riêng theo thứ tự, không sửa CSS đồng thời.

### Task 1: Sửa kích thước control tại đúng phạm vi CSS

**Files:**
- Modify: `apps/web/src/styles.css` — admin control block ~3248–3282, topbar controls ~3098, catalog mobile select ~3187.
- Modify: `apps/web/src/components/ui/button.tsx` — `Button()` ~33.
- Test/evidence: `docs/verification/2026-10-25-admin-density-and-sidebar.md` — mục controls.

**Interfaces:**
- Consumes: `[data-admin-ui='true']` trên shell và DialogContent; `ButtonProps.size` là `'default' | 'sm' | 'lg' | 'icon' | null | undefined`.
- Produces: DOM Button `data-size={size ?? 'default'}`; CSS custom properties `--admin-control-height`, `--admin-small-control-height`, `--admin-control-font-size`. Component dùng chung ngoài admin giữ nguyên.

- [x] **Step 1 — Ghi phép đo thất bại trước sửa.** Mở Tổng quan desktop, chạy hàm đọc DOM sau bằng browser tool cho phép `evaluate` hoặc DevTools. Ghi kết quả vào tài liệu verification. Hàm không thay DOM hay gọi API.

```js
(() => {
  const visible = (e) => e.getClientRects().length > 0;
  const field = document.querySelector('#dashboard-year');
  const apply = [...document.querySelectorAll('main button')]
    .find((e) => visible(e) && e.textContent.trim() === 'Áp dụng');
  const result = [field, apply].map((e) => e ? {
    name: e.id || e.textContent.trim(),
    height: e.getBoundingClientRect().height,
    minHeight: getComputedStyle(e).minHeight,
    padding: getComputedStyle(e).padding,
  } : { missing: true });
  const failures = result.filter((r) => r.missing || Math.abs(r.height - 36) > 1);
  return { result, pass: failures.length === 0, failures };
})()
```

Expected trước sửa: `pass: false`, cả hai cao 44. Nếu khác, ghi số thật và kiểm tra lại source, không chép baseline cũ làm kết quả mới.

- [x] **Step 2 — Thêm marker kích thước vào Button.** Trong JSX `<Comp>`, giữ spread props và handlers; thêm đúng một thuộc tính cạnh `data-slot`:

```tsx
data-slot='button'
data-size={size ?? 'default'}
```

Không sửa `buttonVariants` toàn cục. Marker cũng được truyền qua Slot cho `<Link asChild>`.

- [x] **Step 3 — Sửa control CSS chung, không nối thêm một bộ CSS cạnh tranh.** Trong block `[data-admin-ui='true']` đang có thêm ba biến; thay khai báo 44px/10px trong nhóm form hiện có bằng các giá trị dưới. Tách textarea/file/multiple khỏi nhóm một dòng. CSS cho button và Radix trigger phải ở ngoài layer, có scope admin như các quy tắc cũ.

```css
[data-admin-ui='true'] {
  --admin-control-height: 36px;
  --admin-small-control-height: 32px;
  --admin-control-font-size: 14px;
}
[data-admin-ui='true'] .button {
  min-height: var(--admin-control-height);
  height: auto;
  padding: 7px 12px;
  font-size: 14px;
  line-height: 20px;
}
[data-admin-ui='true'] .button[data-size='sm'] {
  min-height: var(--admin-small-control-height);
  padding: 5px 10px;
  font-size: 14px;
}
[data-admin-ui='true'] .button[data-size='icon'] {
  width: var(--admin-small-control-height);
  height: var(--admin-small-control-height);
  min-height: var(--admin-small-control-height);
  padding: 0;
}
[data-admin-ui='true'] .button[data-size='lg'] {
  min-height: 40px;
  padding: 9px 16px;
}
[data-admin-ui='true'] .application-topbar-actions :is(a, button) {
  min-height: var(--admin-control-height);
  padding: 7px 12px;
  font-size: 14px;
  line-height: 20px;
}
[data-admin-ui='true'] :is(.admin-form, .admin-filters, .account-form, .admin-step-grid) input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='hidden']),
[data-admin-ui='true'] :is(.admin-form, .admin-filters, .account-form, .admin-step-grid) select:not([multiple]),
.admin-dialog[data-admin-ui='true'] input:not([type='checkbox']):not([type='radio']):not([type='file']):not([type='hidden']),
.admin-dialog[data-admin-ui='true'] select:not([multiple]),
[data-admin-ui='true'] [data-slot='select-trigger'] {
  height: var(--admin-control-height);
  min-height: var(--admin-control-height);
  padding: 0 12px;
  font-size: var(--admin-control-font-size);
  line-height: 20px;
}
[data-admin-ui='true'] textarea {
  height: auto;
  min-height: 96px;
  padding: 8px 12px;
  font-size: var(--admin-control-font-size);
  resize: vertical;
}
[data-admin-ui='true'] select[multiple] {
  height: auto;
  min-height: 112px;
}
```

Giữ border, màu, width, disabled và focus của nhóm hiện có; gỡ height/min-height/padding cũ khỏi nhóm nhập một dòng, không để chúng thắng selector mới. Checkbox/radio giữ hình dạng; file input được wrap tự nhiên và không ép 36px. Topbar links/buttons thường dùng cùng chiều cao chuẩn qua selector topbar hiện có. `.input-control`/`.select-control` nếu còn dùng phải nhận biến thay cho 36px riêng; nếu không có TSX dùng thì xóa các class này cùng class chiều rộng chết ở Task 3.

- [x] **Step 4 — Thêm ngoại lệ mobile/touch ở cuối phần admin, trước print.** Giữ touch ở cả màn hình rộng có con trỏ thô:

```css
@media (max-width: 767px), (pointer: coarse) {
  [data-admin-ui='true'] {
    --admin-control-height: 44px;
    --admin-small-control-height: 44px;
    --admin-control-font-size: 16px;
  }
  [data-admin-ui='true'] .button[data-size='lg'] {
    min-height: 44px;
  }
  [data-admin-ui='true'] .application-sidebar nav a,
  .admin-mobile-nav-dialog nav a,
  [data-admin-ui='true'] .admin-nav-logout {
    min-height: 44px;
  }
}
```

- [x] **Step 5 — Chạy lại phép đo Step 1 và mở dialog thật.** Desktop expected 36px, icon/sm 32px; 375px expected ít nhất 44px. Kiểm tra Button `asChild`, native select, Radix SelectTrigger nếu có caller thực tế, input number/date/password, textarea, checkbox, file; kiểm tra focus/disabled/loading không đổi kích thước. Nếu không có caller Radix trong admin, ghi rõ, không tạo demo page sản phẩm. Đo `.admin-sidebar-toggle-btn`: trước 32×44, sau desktop 32×32; chưa kết luận toàn sidebar đã đạt.

- [x] **Step 6 — Typecheck và ghi kết quả.** `pnpm --filter @ocop/web typecheck`. Tạo checkpoint diff chỉ của task, thông điệp dự kiến `fix(web): compact active admin controls`. Khi commit, chọn hunk đúng phần vừa sửa, không `git add .`; nếu không tách được khỏi sửa có trước, giữ diff và báo rõ thay vì commit hộ.

### Task 2: Tổng quan làm mẫu bộ lọc một panel và chiều rộng thật

**Files:**
- Modify: `apps/web/src/styles.css` — `.admin-filters` ~3238 và class filter field đang chết ~3488.
- Modify: `apps/web/src/pages/admin/AdminDashboardPage.tsx:151` — form, labels, actions và bộ lọc nâng cao.
- Test/evidence: `docs/verification/2026-10-25-admin-density-and-sidebar.md` — Tổng quan.

**Interfaces:**
- Consumes: control 36/44 từ Task 1, handlers `applySearch`/`draftFilters` giữ nguyên.
- Produces: contract markup `.admin-filter-panel` (panel ngoài), `.admin-filters` (hàng flex có wrap), `.admin-filter-field[data-filter-width]`, `.admin-filter-actions`; Task 3 dùng lại đúng tên này.

- [x] **Step 1 — Đo lỗi width và panel trước sửa.** Ở 1440px và 2560px, chạy:

```js
(() => {
  const ids = ['dashboard-year', 'dashboard-month', 'dashboard-group'];
  const fields = ids.map((id) => {
    const e = document.getElementById(id);
    return { id, width: e?.getBoundingClientRect().width ?? 0 };
  });
  const panel = document.querySelector('form[aria-label="Bộ lọc Tổng quan OCOP"]');
  const inner = panel?.querySelector('.admin-filters');
  return {
    fields,
    panelHeight: panel?.getBoundingClientRect().height,
    innerPadding: inner ? getComputedStyle(inner).padding : null,
    pass: Math.abs(fields[0].width - 112) <= 1
      && Math.abs(fields[1].width - 144) <= 1,
  };
})()
```

Expected hiện tại `pass: false`. Sau Task 1 chiều cao control đã nhỏ nhưng width vẫn sai: tách hai nguyên nhân bằng số đo.

- [x] **Step 2 — Đổi quy tắc layout hiện có và tạo contract được dùng ngay.** `.admin-filters` standalone vẫn có một panel. Khi nằm trong `.admin-filter-panel`, bỏ decoration của hàng con. Không dùng `display: contents` cho form hay label.

```css
[data-admin-ui='true'] .admin-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
[data-admin-ui='true'] .admin-filter-panel > .admin-filters {
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
}
[data-admin-ui='true'] .admin-filters > label,
[data-admin-ui='true'] .admin-filter-field {
  flex: 0 1 var(--admin-filter-field-width, 240px);
  min-width: 0;
  max-width: 100%;
}
[data-admin-ui='true'] [data-filter-width='year'] { --admin-filter-field-width: 112px; }
[data-admin-ui='true'] [data-filter-width='month'] { --admin-filter-field-width: 144px; }
[data-admin-ui='true'] [data-filter-width='status'] { --admin-filter-field-width: 176px; }
[data-admin-ui='true'] [data-filter-width='group'] { --admin-filter-field-width: 260px; }
[data-admin-ui='true'] [data-filter-width='search'] { --admin-filter-field-width: 320px; }
[data-admin-ui='true'] .admin-filter-actions {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin: 0;
}
@media (max-width: 767px) {
  [data-admin-ui='true'] .admin-filters > label,
  [data-admin-ui='true'] .admin-filter-field,
  [data-admin-ui='true'] .admin-filter-actions {
    flex-basis: 100%;
  }
}
```

- [x] **Step 3 — Nối contract vào Tổng quan.** Form ngoài đổi `className='admin-form filter-card admin-filter-panel'`. Giữ `aria-label` và `onSubmit`. Đổi đúng các opening tags:

```tsx
<label className='admin-filter-field' data-filter-width='year' htmlFor='dashboard-year'>
<label className='admin-filter-field' data-filter-width='month' htmlFor='dashboard-month'>
<label className='admin-filter-field' data-filter-width='group' htmlFor='dashboard-group'>
```

Di chuyển **nguyên node** `.admin-actions` ngay sau ba label vào trong `.admin-filters`, trước thẻ đóng hàng này; không viết lại các nút/handlers bên trong. Đổi opening tag của node đó thành:

```tsx
<div className='admin-actions admin-filter-actions'>
```

Xóa inline `style={{ marginTop: '12px' }}` của node vừa chuyển. Hàng nâng cao vẫn là sibling sau `.admin-filters`, giữ id, `hidden`, `aria-controls`, summary/chips và các điều kiện `hasActiveFilters`. Không chuyển nó vào cùng hàng bằng flex vô điều kiện.

- [x] **Step 4 — Xác nhận width/padding và chức năng.** Chạy lại Step 1: năm 112px, tháng 144px ở 1440/2560; `innerPadding: '0px'`; desktop đóng nâng cao hướng tới panel 84–96px khi một hàng vừa. 1024px wrap được; không dùng `height:96px` để ép đạt. Mở/đóng nâng cao, Enter áp dụng, xóa bộ lọc và quay lại URL đều giữ hành vi. Nếu cần đổi filter để thử, ghi URL ban đầu và khôi phục sau, không lưu nghiệp vụ.

- [x] **Step 5 — Typecheck, chụp trước/sau cùng viewport và checkpoint.** `pnpm --filter @ocop/web typecheck`. Checkpoint dự kiến `fix(web): compact dashboard filter layout`; chỉ stage hunk thuộc task nếu tạo commit.

### Task 3: Áp dụng bộ lọc lên các trang còn lại và xóa CSS không được dùng

**Files:**
- Modify: `apps/web/src/pages/admin/AdminProductsPage.tsx:399`.
- Modify: `apps/web/src/pages/admin/AdminScoringFormsPage.tsx:133`, `:377`.
- Modify: `apps/web/src/pages/admin/AdminUsersPage.tsx:198`.
- Modify: `apps/web/src/pages/admin/AdminReportsPage.tsx:375`.
- Modify: `apps/web/src/pages/admin/AdminProductGroupsPage.tsx:411`.
- Modify: `apps/web/src/pages/admin/LocalitiesPanel.tsx:365`.
- Modify: `apps/web/src/pages/admin/OrganizationUnitsPanel.tsx:313`.
- Modify: `apps/web/src/pages/admin/AdminAssignmentsPage.tsx:346`.
- Modify: `apps/web/src/styles.css` — bỏ class kích thước chết sau khi đối chiếu caller.
- Test/evidence: `docs/verification/2026-10-25-admin-density-and-sidebar.md` — mỗi form trong bảng sau.

**Interfaces:**
- Consumes: contract `.admin-filter-panel`, `.admin-filter-field[data-filter-width]`, `.admin-filter-actions` từ Task 2.
- Produces: tất cả filter thật có preferred width và một panel; không đổi hàm hoặc kiểu dữ liệu nào.

- [x] **Step 1 — Ghi thất bại trên Sản phẩm và một form standalone.** Đo `#admin-product-q`, `#admin-product-group`, `#catalog-search-status` sau khi mở đúng trang; ghi width và height. Dùng hàm đo sau, đổi danh sách `ids` thành các id của form đang mở:

```js
(() => {
  const ids = ['admin-product-q', 'admin-product-group', 'admin-product-category'];
  return ids.map((id) => {
    const e = document.getElementById(id);
    const label = e?.closest('label');
    return {
      id, present: !!e,
      width: e?.getBoundingClientRect().width,
      height: e?.getBoundingClientRect().height,
      role: label?.getAttribute('data-filter-width'),
    };
  });
})()
```

Expected chưa đạt trước task: `role` thiếu và độ rộng chưa theo vai trò. Không xem `present:false` là pass.

- [x] **Step 2 — Nối markup cho nhóm form có panel ngoài.** Với Sản phẩm, hai tab phiếu chấm, Người dùng, Báo cáo: thêm `admin-filter-panel` vào form `admin-form filter-card`; giữ mọi class khác như `no-print mt-3`. Di chuyển nguyên node actions chính vào cuối hàng `.admin-filters`; đổi thành `admin-actions admin-filter-actions`, bỏ margin-top inline tại hàng chính. Gắn thuộc tính vào **label hoặc wrapper chứa cả label+control**, không gắn width lên một input còn nằm trong cột `1fr`.

Áp dụng chính xác bảng sau; mỗi dòng là một form cần tự kiểm tra:

| Form | `data-filter-width='search'` | `group` | `status` / `year` / `month` |
| --- | --- | --- | --- |
| Sản phẩm và phiếu đăng ký | `admin-product-q` | `admin-product-group`, `admin-product-category` | Không thêm trường mới |
| Bộ phiếu | `scoring-sets-q` | `scoring-sets-group` | `scoring-sets-status`: status |
| Phiếu thực tế | `scoring-evals-q` | `scoring-evals-group` | `scoring-evals-status`: status |
| Người dùng | `admin-users-q` | Không có ở hàng chính | `admin-users-kind`, `admin-users-status`: status |
| Báo cáo | Không có ở hàng chính | `report-group-by` | `report-year`: year; `report-month`: month |

Ví dụ opening tag cần gắn, giữ toàn bộ nội dung và handler của control hiện có:

```tsx
<label className='admin-filter-field' data-filter-width='search' htmlFor='admin-product-q'>
<label className='admin-filter-field' data-filter-width='group' htmlFor='admin-product-group'>
<label className='admin-filter-field' data-filter-width='group' htmlFor='admin-product-category'>
```

- [x] **Step 3 — Nối markup cho form standalone, không thêm panel ngoài.** Giữ class `.admin-filters` của chính form/div và actions hiện đã nằm trong nó; chỉ thêm `admin-filter-actions` vào actions cùng hàng và gắn các wrapper theo bảng:

| File | search | group | status |
| --- | --- | --- | --- |
| AdminProductGroupsPage | `catalog-search-q` | Không thêm | `catalog-search-status` |
| LocalitiesPanel | `localities-filter-q` | Không thêm | `localities-filter-type`, `localities-filter-active` |
| OrganizationUnitsPanel | `units-filter-q` | Không thêm | `units-filter-active` |
| AdminAssignmentsPage | Không thêm | `assignment-filter-group`, `assignment-filter-category` | Checkbox giữ nguyên |

Ví dụ cho standalone:

```tsx
<label className='admin-filter-field' data-filter-width='search' htmlFor='catalog-search-q'>
<label className='admin-filter-field' data-filter-width='status' htmlFor='catalog-search-status'>
```

Giữ cách lọc phân công đang áp dụng trực tiếp khi đổi select; không thêm nút submit hay đổi logic scope. Checkbox không bị ép vào layout label trường văn bản.

- [x] **Step 4 — Giữ phần nâng cao đầy đủ và bỏ CSS chết.** Bộ lọc nâng cao vẫn dùng grid riêng với cột `minmax(min(100%,220px),1fr)` và khoảng 12px; không đổi sang preferred width của hàng chính nếu điều đó cắt địa bàn/lý do. Giữ toàn bộ bộ lọc ngày, địa bàn, quyền, giám khảo, năm đánh giá và sort. Chạy tìm caller:

```powershell
rg -n 'filter-year-select|filter-month-select|filter-status-select|filter-group-select|filter-category-select|input-control|select-control|filter-main-bar|search-input-wrap' apps/web/src
```

Xóa các rule chỉ còn định nghĩa CSS và không có caller, gồm media rule tương ứng; không để bộ class 112/144px không được dùng gây hiểu nhầm. Không xóa class có caller chỉ vì nó nằm cạnh rule chết.

- [x] **Step 5 — Chạy kiểm tra từng form và query behavior.** Ở 1440px/2560px: control 36px, các trường không chia đều toàn màn hình; 375px: một cột, control 44px, actions wrap. Đi cả `/admin/products` và `/admin/registrations`; cả hai tab phiếu chấm; tab đơn vị/địa bàn. Gõ draft chưa áp dụng thì URL chưa đổi ở các form có nút áp dụng; áp dụng/Enter/reset/pagination/back giữ đúng tập lọc. Ghi từng trang, không chỉ ghi “toàn bộ đã kiểm tra”.

- [x] **Step 6 — Chạy kiểm tra hành vi đã có và checkpoint.** Lệnh từ root:

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-search.test.ts ../web/test/admin-date.test.ts ../web/test/admin-assignment-form.test.ts
pnpm --filter @ocop/web typecheck
```

Expected exit 0. Checkpoint dự kiến `fix(web): connect compact filters across admin pages`.

### Task 4: Chặn form giãn, thống nhất tab/bảng/khoảng cách

**Files:**
- Modify: `apps/web/src/styles.css` — editor/grid/label, admin account-form, tabs, table, form steps, mobile padding.
- Modify if required: `apps/web/src/components/products/ProductDraftEditor.tsx` — chỉ wrapper mode admin, không logic lưu.
- Test/evidence: `docs/verification/2026-10-25-admin-density-and-sidebar.md` — editor, dialogs, table, account.

**Interfaces:**
- Consumes: variables control Task 1; `.admin-draft-editor` đã có `max-width:960px`; mode admin/owner hiện có.
- Produces: chiều cao control độc lập với lỗi ở cột cạnh, editor có trần 960px, tab đồng nhất; không thêm props/exports.

- [x] **Step 1 — Đo form thực tế trước sửa.** Vào `/admin/registrations/new` khi không có dữ liệu đang nhập. Ghi width editor và height `#admin-draft-registrant-search`, label, select cạnh nó. Với bản sửa hiện tại, grid đã có `align-items:flex-start`: kiểm tra trước, không mặc định lỗi 101px vẫn còn. Mở dialog phân loại và người dùng mà không lưu, ghi margin-top/form và control height.

- [x] **Step 2 — Giữ phần đúng và sửa độ giãn/khoảng cách còn lại.** Hợp nhất vào selector có sẵn, không thêm bản sao cuối file:

```css
[data-admin-ui='true'] .admin-draft-editor {
  width: 100%;
  max-width: 960px;
  justify-self: start;
}
[data-admin-ui='true'] .admin-step-grid {
  align-items: start;
  gap: 16px;
}
[data-admin-ui='true'] .admin-form label,
[data-admin-ui='true'] .admin-filters label {
  align-content: start;
  gap: 4px;
}
.admin-dialog[data-admin-ui='true'] .account-form,
[data-admin-ui='true'] .admin-form.account-form {
  margin-top: 0;
  gap: 12px;
}
[data-admin-ui='true'] .form-steps {
  margin-block: 12px;
}
[data-admin-ui='true'] .form-steps button,
[data-admin-ui='true'] .tab-item,
[data-admin-ui='true'] [data-slot='tabs-trigger'] {
  height: auto;
  min-height: var(--admin-control-height);
  padding: 7px 12px;
  font-size: 14px;
  line-height: 20px;
}
[data-admin-ui='true'] [data-slot='tabs-list'] {
  height: auto;
  max-width: 100%;
  justify-content: flex-start;
  overflow-x: auto;
}
[data-admin-ui='true'] .data-table :is(th, td),
[data-admin-ui='true'] .admin-data-table :is(th, td) {
  padding: 8px 12px;
}
@media (max-width: 767px) {
  [data-admin-ui='true'] .application-content { padding: 16px; }
}
```

Checkbox/radio labels dùng `inline-flex` ở dialog không được biến thành grid qua selector rộng. Sau nhóm label grid hiện có, giữ chúng theo hàng bằng rule scoped sau:

```css
[data-admin-ui='true'] label:has(> input:is([type='checkbox'], [type='radio'])) {
  display: flex;
  align-items: center;
  gap: 8px;
}
```

Tab list không đặt chiều cao 40px cố định khi trigger đã đổi; không cắt focus. Bảng có button giữ chiều cao tự nhiên; không đặt height hàng để ép đồng loạt.

- [x] **Step 3 — Thu panel phân công trong scope admin và kiểm tra topbar.** Giữ ô ma trận tối thiểu 72px nếu nó cần hai dòng và thao tác; đây không phải input 36px. Panel editor/preview dùng padding16, margin0 khi đã nằm trong grid page gap16. Sticky actions dùng padding12px 16px. Sửa tại selector scoped tương ứng:

```css
[data-admin-ui='true'] :is(.assignment-editor, .assignment-preview) {
  margin: 0;
  padding: 16px;
}
[data-admin-ui='true'] .admin-assignment-sticky-bar {
  padding: 12px 16px;
}
```

Topbar đang `min-height:56px; padding:8px 24px`: sau khi controls thu về36px, đo tổng cao khoảng56–60px; không đặt height cứng cắt nội dung wrap. Giữ H1 hiện có 24px; không đổi font/theme lần nữa.

- [x] **Step 4 — Kiểm tra lỗi dài và vùng ngoài admin.** Khi API có lỗi hoặc validation hiện tự nhiên, input một dòng vẫn36px; không thay DOM bằng script để tạo bằng chứng. Dùng form trống/validation không lưu nếu cần; nếu không tạo được thông báo dài an toàn, ghi chưa kiểm tra trường hợp đó. Textarea có ít nhất96px, file input vẫn chọn được tệp qua giao diện nhưng không upload. Kiểm tra hai cột/ một cột, 200% zoom, nhãn địa bàn dài; tài khoản chịu scope admin còn `/login`, `/my/products/new`, `/judge` và public giữ bố cục riêng.

- [x] **Step 5 — Typecheck/build và checkpoint.** `pnpm --filter @ocop/web typecheck`; `pnpm --filter @ocop/web build`. Checkpoint dự kiến `fix(web): stabilize admin form and table density`.

### Task 5: Hoàn thiện sidebar đang có, không tạo sidebar mới

**Files:**
- Modify: `apps/web/src/layouts/AppLayout.tsx:32`, navContent, sidebar JSX ~208.
- Modify: `apps/web/src/styles.css:2908` — collapsed selectors, media <=1023px, reduced motion.
- Test/evidence: `docs/verification/2026-10-25-admin-density-and-sidebar.md` — desktop, mobile, accessibility, state preservation.

**Interfaces:**
- Consumes: state `sidebarCollapsed`, `toggleSidebar()`, key `admin_sidebar_collapsed`, Radix `Dialog`/`Tooltip`, `.button[data-size='icon']` Task 1.
- Produces: shell attribute `data-sidebar-collapsed` hiện có; `aria-controls='admin-desktop-navigation'`; accessible name/tooltip khi thu gọn. Không thêm key lưu trữ hay dependency.

- [x] **Step 1 — Ghi lỗi sidebar trước sửa.** Desktop kiểm tra tên truy cập sau khi nhãn bị `display:none`; dùng Tab xem tooltip có hiện khi focus. Thu gọn desktop rồi chuyển viewport 768px: đo cột shell và vị trí main. Selector collapsed có độ ưu tiên cao hơn media chỉ có `[data-admin-ui]`, nên phải kiểm tra việc mobile còn cột72px. Ghi sự thật, không giả định tất cả đều lỗi.

- [x] **Step 2 — Nối điều khiển và giữ tên liên kết.** Thêm id vào nav desktop và thuộc tính ở nút đã có, không thêm nút thứ hai:

```tsx
aria-controls='admin-desktop-navigation'
```

```tsx
<nav id='admin-desktop-navigation' aria-label='Điều hướng khu vực làm việc'>
```

Giữ `aria-expanded`, label tiếng Việt, handlers, activeOptions và key localStorage. Các link đã có `title` giữ lại; khi thu gọn, thay rule `display:none` cho span nhãn bằng kỹ thuật visually-hidden để giữ accessible name; chỉ áp span nhãn trong nav, không ẩn icon/số khác.

```css
.application-shell[data-admin-ui='true'][data-sidebar-collapsed='true'] .application-sidebar nav a > span,
.application-shell[data-admin-ui='true'][data-sidebar-collapsed='true'] .application-sidebar .admin-nav-logout > span {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
```

- [x] **Step 3 — Tooltip dùng Radix đã cài, hiện được khi focus và không bị sidebar cắt.** Thêm `Tooltip` vào import từ `radix-ui`; thêm `ReactElement` type từ React. Dùng một helper cục bộ trong `AppLayout.tsx` vì có nhiều nav item, không tạo thư viện component mới:

```tsx
function AdminNavTooltip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled: boolean;
  children: ReactElement;
}) {
  if (!enabled) return children;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className='admin-nav-tooltip' side='right' sideOffset={8}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
```

Wrap nguyên link/button nav hiện có bằng helper, dùng `enabled={sidebarCollapsed && !mobileMenuOpen}` và label đúng nhãn/title hiện tại. Các nhãn bao phủ: Tổng quan, Sản phẩm, Phiếu đăng ký, Phân công, Phiếu chấm OCOP, Báo cáo thống kê, Hồ sơ được phân công, Nhóm sản phẩm & địa bàn, Người dùng, Tài khoản, Trang công khai, Đăng xuất; nhánh REGISTRANT có Hồ sơ của tôi và Tạo hồ sơ. Không đổi điều kiện canView/canManage/canScore/role hay đường dẫn của link. Bọc shell hiện có trong một `<Tooltip.Provider delayDuration={200}>` để tất cả Root có Provider. Tooltip Portal có class riêng vì không nằm trong shell:

```css
.admin-nav-tooltip {
  z-index: 60;
  max-width: 280px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--fg);
  font: 500 14px/1.4 var(--font-body);
}
```

- [x] **Step 4 — Sửa responsive bằng selector đủ ưu tiên và giữ motion150ms.** Trong media <=1023 thay selector shell một trạng thái thành cả hai trạng thái:

```css
@media (max-width: 1023px) {
  .application-shell[data-admin-ui='true'],
  .application-shell[data-admin-ui='true'][data-sidebar-collapsed='true'] {
    grid-template-columns: minmax(0, 1fr);
  }
}
```

Sidebar desktop vẫn `display:none` ở breakpoint này; drawer có đầy đủ nhãn vì collapsed selectors chỉ target `.application-sidebar`. Đổi transition grid/padding hiện có từ200ms thành150ms; giữ reduced-motion hiện có. Không thêm transition cho hàng bảng hoặc dữ liệu. Nếu group padding/sidebar width đúng248/72 rồi thì giữ.

- [x] **Step 5 — Kiểm tra vòng tương tác đầy đủ.** 1440px: mở248 → bấm thu72 → tooltip hover/focus → reload vẫn72 → mở248. Ghi filter URL và trường draft trước/sau toggle; chúng không đổi. 768px sau trạng tháicollapsed: main chiếm hết chiều rộng, drawer mở/đóng được, Escape trả focus về nút Điều hướng. 1024px trở lên mới dùng sidebar. Kiểm tra một active item, tên truy cập của mọi icon, reduced motion và keyboard không bị focus trap ở sidebar. Khôi phục trạng thái/sidebar/URL ban đầu khi kết thúc khảo sát.

- [x] **Step 6 — Typecheck/build và checkpoint.** `pnpm --filter @ocop/web typecheck`; `pnpm --filter @ocop/web build`. Checkpoint dự kiến `fix(web): complete responsive accessible sidebar collapse`. Không đổi cơ chế lưu trạng thái ngoài yêu cầu này.

### Task 6: Nghiệm thu ứng dụng thật và bàn giao bằng số đo

**Files:**
- Create/complete: `docs/verification/2026-10-25-admin-density-and-sidebar.md`.
- Update if implementation changes sizing contract: `design.md`, `docs/superpowers/specs/2026-10-25-admin-density-review.md` — giữ nguyên lịch sử khảo sát.
- Test: browser checks bên dưới và các check có sẵn, không thêm dependency.

**Interfaces:**
- Consumes: toàn bộ contract Task 1–5 và URL thật localhost của ứng dụng.
- Produces: bảng bằng chứng trước/sau theo trang/viewport, kết quả check/lệnh, hạn chế; chỉ báo hoàn tất phạm vi có bằng chứng.

- [x] **Step 1 — Chạy bộ kiểm tra cuối một lượt.** Từ root:

```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web build
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts ../web/test/admin-users.test.ts ../web/test/admin-catalogs.test.ts ../web/test/product-draft-save.test.ts ../web/test/product-editor-categories.test.ts ../web/test/scoring-print.test.ts ../web/test/admin-reports-dashboard.test.ts ../web/test/admin-search.test.ts ../web/test/admin-date.test.ts ../web/test/admin-assignment-form.test.ts
git diff --check
```

Expected các lệnh exit0, số test ghi theo output thực tế. Không chạy backend DB suite vì không đổi nghiệp vụ/DB. Không lặp build/test đã pass nếu sau đó chỉ viết báo cáo; nếu có sửa mã sau kiểm tra, chạy lại check bị ảnh hưởng.

- [x] **Step 2 — Chạy ma trận thị giác.** Kiểm tra 375/768/1024/1440/2560px cho Tổng quan, Sản phẩm, Phiếu đăng ký, Phiếu chấm cả hai tab, Báo cáo, Danh mục/Địa bàn, Người dùng/Đơn vị, Phân công và editor. Thêm reflow320 và zoom200% trên Tổng quan/editor/drawer. Desktop kiểm tra cả sidebar248/72; mobile kiểm tra drawer sau khi desktop đãcollapsed. Đo bằng công cụ browser được hỗ trợ, đặt viewport bằng capability được công cụ cung cấp; nếu không có, chỉnh bằng UI trình duyệt. Không giả lập bằng thay CSS/DOM trong evaluate.

Mỗi trang ghi ít nhất: control height, width trường ngắn nếu có, panel padding/height, tràn ngang, trạng thái sidebar, URL và dữ liệu đang tải/đã tải/lỗi. Screenshot dùng cùng viewport, cùng trạng thái để so sánh. Bảng2chiều chỉ cuộn trong vùng có nhãn, không cuộn cả trang.

- [x] **Step 3 — Dùng một check DOM cuối trên Tổng quan.** Khi ở desktop dùng chuột >=1440px, chạy hàm dưới; các phép đọc không được bỏ qua khi thiếu phần tử:

```js
(() => {
  const failures = [];
  const rect = (selector) => {
    const e = document.querySelector(selector);
    if (!e) { failures.push(`missing ${selector}`); return null; }
    return e.getBoundingClientRect();
  };
  const near = (actual, expected, label) => {
    if (actual == null || Math.abs(actual - expected) > 1)
      failures.push(`${label}: ${actual}, expected ${expected}`);
  };
  const year = rect('#dashboard-year');
  const month = rect('#dashboard-month');
  near(year?.height, 36, 'year height');
  near(year?.width, 112, 'year width');
  near(month?.width, 144, 'month width');
  const toggle = rect('.admin-sidebar-toggle-btn');
  near(toggle?.height, 32, 'toggle height');
  near(toggle?.width, 32, 'toggle width');
  const shell = document.querySelector('.application-shell');
  const collapsed = shell?.getAttribute('data-sidebar-collapsed') === 'true';
  near(rect('.application-sidebar')?.width, collapsed ? 72 : 248, 'sidebar width');
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)
    failures.push('page horizontal overflow');
  return { pass: failures.length === 0, failures };
})()
```

Expected `pass:true` cả hai trạng thái sidebar. 375px dùng kiểm tra riêng height>=44 và scrollWidth<=clientWidth+1, không tái dùng expecteddesktop. Không báo pass nếu check chỉ được đọc mà chưa chạy.

- [x] **Step 4 — Kiểm tra hồi quy an toàn.** Account/password, public/login, owner tạo hồ sơ, judge và print preview giữ luồng. Không nhập mật khẩu mới, nộp hồ sơ, tải file lên, thay phân công hay sửa quyền. Chỉ chọn tệp nếu đang có môi trường kiểm tra phù hợp và không upload. Các trang chi tiết/results không có dữ liệu kiểm tra thì ghi chưa kiểm tra bằng trình duyệt, không tự tạo bản ghi.

- [x] **Step 5 — Hoàn thiện báo cáo với khung sau, điền kết quả đo thật ngay trong lúc chạy.** Không để ô trống, ghi “Chưa kiểm tra — lý do cụ thể” khi không làm được:

| Trang / trạng thái | Viewport | Control trước → sau | Width trước → sau | Panel / sidebar | Kết quả / bằng chứng |
| --- | --- | --- | --- | --- | --- |

Ghi thêm command, exit code, số test, ảnh có đường dẫn thật nếu đã lưu, và danh sách còn hạn chế. Không tái dùng tuyên bố “40/40” hoặc ảnh của ngày24/10 làm kết quả lần này. Đọc diff cuối để bảo đảm không có thay đổi API/quyền/data và không cuốn sửa của người dùng vào commit.

- [x] **Step 6 — Bàn giao và checkpoint cuối.** Chỉ nói “đã sửa giao diện” khi source thật đã đổi, browser nhận bản mới và số đo đạt. Checkpoint dự kiến `docs: record admin density and sidebar verification`. Nếu môi trường không kiểm tra được một vùng quan trọng, nêu chính xác vùng đó thay vì tuyên bố toàn bộ đã đạt.

## Tự rà soát kế hoạch

| Yêu cầu | Task bao phủ |
| --- | --- |
| D01 input kéo giãn, editor960 | 1, 4, 6 |
| D02 panel lồng / hành động xuống hàng | 2, 3, 6 |
| D03 width theo vai trò, class phải có caller | 2, 3 |
| D04 cascade Button/native/Radix/account | 1, 4, 6 |
| Touch44, chữ nhập16, checkbox/file/multiple | 1, 4, 6 |
| Tab, table, main padding, topbar, print | 4, 6 |
| Sidebar248/72, focus tooltip, accessible name | 5 |
| Mobile không cột trống, drawer, state, reduced motion | 5, 6 |
| Giữ truy vấn, quyền, API, dirty workspace | Global Constraints, 3, 6 |
| Bằng chứng ứng dụng thật thay vì chỉ preview/build | Tất cả task, cổng cuối tại6 |

Tên marker/contract dùng nhất quán: `data-size`, `data-filter-width`, `.admin-filter-panel`, `.admin-filter-field`, `.admin-filter-actions`, `.admin-nav-tooltip`. Không đổi chúng riêng lẻ giữa các task. Không cần subproject hoặc kế hoạch backend: đây là một bản sửa UI cùng phạm vi, làm tuần tự trên hệ thống đang có.
