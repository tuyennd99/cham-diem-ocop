# Admin OCOP UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai admin OCOP gọn, rõ và nhất quán theo thiết kế đã viết; sửa đủ A01–A19, giữ quyền truy cập và các luồng dữ liệu hiện có.

**Architecture:** Chỉnh trong React và các route hiện có. Dùng CSS có phạm vi admin, control/Radix đang cài, query hook/API đang có; URL giữ trạng thái đã áp dụng, state cục bộ chỉ giữ nội dung đang nhập. Tách hàm thuần cho đọc query, ngày giờ và phạm vi phân công để kiểm tra hồi quy; không dựng lại ứng dụng hoặc tạo framework quản trị.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, TanStack Router/Query/Form, Radix UI, Lucide, node:test và tsx đã có trong workspace API; Node.js `>=24.7 <25`, pnpm `11.17.0` theo package root.

**Spec:** [Đánh giá và thiết kế từng trang](../specs/2026-10-24-admin-ui-ux-redesign-design.md), [design.md](../../../design.md). Đọc cả hai trước khi thực thi.

Ngày lập: 24/10/2026. **Chỉ lập kế hoạch; chưa thực hiện các checkbox.** Các đoạn mã dưới đây là chỉ dẫn triển khai và kiểm thử, chưa phải mã đã thêm vào ứng dụng.

## Global Constraints

Các câu trong dấu ngoặc kép được giữ nguyên từ thiết kế; mọi task bao hàm các ràng buộc này.

- “Không thêm dependency.”
- “Các trang admin dùng cùng nhận diện, thành phần và quy tắc tương tác; không chọn một theme khác cho từng trang.”
- “Không áp dụng thay đổi thị giác sang trang công khai, xác thực, chủ thể hoặc giám khảo.”
- “Admin không có header/footer công khai.”
- “Chỉ một mục điều hướng chính được chọn.”
- “Main rộng linh hoạt, tối đa 1600px; căn giữa khi màn hình lớn hơn.”
- “Form nhập hồ sơ có vùng đọc tối đa 960px.”
- “Control chính cao tối thiểu 44px; vùng bấm icon 44×44px.”
- “Nghiệm thu ở 320, 375, 414, 768, 1024 và 1440px; thêm màn hình rộng đang dùng.”
- Không biến lỗi truy vấn thành “0 hồ sơ”.
- “Không viết lại route tree, API, query key, quyền, snapshot hay luồng upload để phục vụ hình thức.”
- “Không thêm trạng thái duyệt, từ chối, yêu cầu bổ sung, hạn xử lý hoặc thông báo chưa có trong hợp đồng.”
- “Không tạo số hồ sơ dễ đọc giả để thay ID hiện có.”
- “Không cộng đơn giản các tổng giám khảo thành tổng sản phẩm.”
- Giữ enum, payload, audit reason, giới hạn tệp, snapshot, độ chính xác điểm và cơ chế chặn kết quả tạo/upload chưa rõ. MANAGE bao hàm VIEW, không bao hàm SCORE.
- Dùng `design.md` làm hệ thống Hallmark đã chọn. Không tạo theme mới, ảnh trang trí, `.hallmark` catalogue hoặc prototype HTML thay thế cho React.

---

## 1. Ranh giới, phụ thuộc và bàn giao

Một kế hoạch chung vì các trang phụ thuộc cùng khung/control/query URL. Mỗi task tạo một phần dùng được và kiểm độc lập; task sau không được xóa hành vi task trước.

| Task | Đầu ra | Phụ thuộc | Vấn đề |
| --- | --- | --- | --- |
| 1 | Khung admin, menu, control, dialog responsive | Baseline hiện tại | A01, A02, A06, A07, A17 |
| 2 | Danh sách sản phẩm/phiếu đăng ký và query URL đúng | 1 | A03, A04, A05, A08, A09, A19 |
| 3 | Chi tiết hồ sơ/kết quả, quay lại đúng danh sách | 1, 2 | A14 |
| 4 | Trình nhập ba bước, dữ liệu chưa lưu được bảo vệ | 1, 2, 3 | A19 và spec §6.4 |
| 5 | Danh mục, địa bàn, ngày hiệu lực | 1, 2 | A02, A13, A18 |
| 6 | Người dùng/đơn vị và dialog theo tác vụ | 1, 2 | A07, A13, A17 |
| 7 | Bộ phiếu/phiếu thực tế và chi tiết có cuộn | 1, 2, 5 | A12, A18 |
| 8 | Phân công đúng scope và lưu toàn bộ tập | 1, 2 | A10, A11 |
| 9 | Tổng quan ưu tiên việc cần xử lý | 1, 2, 3 | A15 |
| 10 | Báo cáo màn hình và bản in đầy đủ | 1, 2, 9 | A16 |
| 11 | Kiểm hồi quy, bằng chứng và bàn giao | 1–10 | Toàn bộ nghiệm thu |

Thực thi tuần tự là mặc định vì nhiều task cùng sửa CSS và hàm query. Nếu người dùng chọn subagent, giao từng task cùng spec, file sở hữu và trạng thái đã thay đổi; không cho hai người cùng chỉnh `styles.css` hoặc `admin-search.ts` một lúc. Reviewer phải xem tác vụ và ràng buộc toàn cục, không chỉ ảnh đẹp.

### Bản đồ file

Tất cả đường dẫn trong task tính từ `D:/project/chamdiemocop`.

| File / vùng | Trách nhiệm |
| --- | --- |
| `apps/web/src/layouts/AppLayout.tsx` | Scope admin theo pathname, nhóm menu, exact active, menu nhỏ bằng Dialog |
| `apps/web/src/styles.css` | Token admin, mật độ, control/bảng/form, responsive và print override có scope |
| `apps/web/src/constants/product-status.ts` | Dùng nhãn admin hiện có, thống nhất “Bản nháp/Đã nộp/Đang chấm/Hoàn tất” |
| **Mới** `apps/web/src/lib/admin-search.ts` | Hàm thuần đọc URL cho các trang admin; type giao diện thêm tab nhưng không gửi tab tới API |
| **Mới** `apps/web/src/lib/admin-date.ts` | Biên ngày Việt Nam và chuyển input ngày giờ địa bàn; không phụ thuộc timezone máy |
| **Mới** `apps/web/src/lib/admin-assignment-form.ts` | Nạp scope theo đúng cặp, chuẩn bị payload toàn bộ tập, không chứa HTTP |
| Các `apps/web/src/pages/admin/*.tsx` trong task | Thay bố cục và tương tác tại chủ sở hữu hiện có |
| `apps/web/src/components/products/ProductDraftEditor.tsx` | Biến thể admin của trình nhập chung; giữ owner và lệnh lưu |
| Các `apps/web/src/routes/_app.admin.*.tsx` | `validateSearch`, đọc search kiểu đúng và truyền xuống component, guard giữ nguyên |
| **Mới** `apps/web/test/admin-search.test.ts` | Kiểm đọc query và các điều kiện từ URL |
| **Mới** `apps/web/test/admin-date.test.ts` | Kiểm biên tháng/năm, offset và độ chính xác |
| **Mới** `apps/web/test/admin-assignment-form.test.ts` | Kiểm scope đúng cặp và payload chứa cả dòng không hiển thị |
| Test đang có | Session, quyền người dùng, danh mục, lưu nháp, điểm/in, báo cáo và API boundary |
| **Mới khi thực thi** `docs/verification/2026-10-24-admin-ui-ux-redesign.md` | Baseline, kết quả thật, ảnh và phần chưa kiểm tra |

Không tạo component registry, generic DataTable, generic CRUD form, cache riêng hoặc thư viện URL-state. Các hàm mới chỉ xuất hiện ở task đầu thực sự dùng. Không sửa `components/ui/input.tsx` toàn cục chỉ để làm đẹp admin: Input hiện có nhận `className`, CSS scoped đủ giải quyết. Dialog portal gắn scope riêng.

### Quy tắc commit và bảo toàn thay đổi có sẵn

Trước mỗi task xem `git status --short`, diff file sở hữu và staged diff. Baseline hiện có thay đổi tại PublicLayout, AdminProductsPage, LoginPage, `__root.tsx`, styles.css; hai tài liệu thiết kế còn untracked tại lúc lập kế hoạch. Không reset, stash, stage cả thư mục hoặc commit nhầm phần người dùng.

Mỗi task kết thúc bằng kiểm chứng rồi commit phần của task. Với file đã dirty stage từng hunk bằng `git add -p`, xem `git diff --cached`, chỉ commit hunk của task. Ví dụ riêng Task 1: `git add -p -- apps/web/src/layouts/AppLayout.tsx apps/web/src/styles.css apps/web/src/pages/admin/CategoryEditorDialog.tsx apps/web/src/pages/admin/UserEditorDialog.tsx`. File mới được stage theo đúng đường dẫn của task. Nếu không tách được hunk an toàn, để thay đổi chưa commit và ghi rõ, không ghi đè baseline. Nội dung commit gợi ý nằm ở cuối từng task; không push/deploy trong kế hoạch này.

## 2. Lệnh kiểm tra chuẩn

Chạy từ repository root. Đây là lệnh cho lúc thực thi, **chưa được chạy trong lượt lập kế hoạch**.

```powershell
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web build
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web exec node test/proxy.check.mjs
```

Web chưa có script `test`. Chạy Node test bằng tsx đã có ở workspace API, đúng cách dự án đã dùng, không cài mới:

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts ../web/test/admin-users.test.ts ../web/test/admin-catalogs.test.ts ../web/test/product-draft-save.test.ts ../web/test/product-editor-categories.test.ts ../web/test/scoring-print.test.ts ../web/test/admin-reports-dashboard.test.ts
```

Với file mới thay bằng đường dẫn tương ứng sau `--test`. Test API transport hiện có dùng adapter giả, không kết nối DB. Không chạy seed/migration để lấy dữ liệu cho UI; kiểm mutation bằng fixture/môi trường test tách biệt đã được xác định. Không chạy lại kiểm tra backend không liên quan vì chỉ sửa frontend.

## Task 1: Khung admin, control và dialog responsive

**Files:** Modify `apps/web/src/layouts/AppLayout.tsx`, `apps/web/src/styles.css`, `apps/web/src/pages/admin/CategoryEditorDialog.tsx`, `apps/web/src/pages/admin/UserEditorDialog.tsx`. Create verification report đã nêu trong bản đồ. Không sửa public/auth/root.

**Interfaces:** Consumes `hasStaffPermission`, `useLocation`, Link, Button và Dialog đang có. Produces DOM scope `data-admin-ui='true'`, các class `admin-page`, `admin-form`, `admin-filters`, `admin-table-region`, `admin-dialog`, `admin-page-heading`, `admin-actions` dùng ở các task sau.

- [x] **1.1. Ghi baseline và tái hiện lỗi.** Xem diff năm file dirty, ghi commit gốc vào report; chạy web typecheck/API boundary, phân biệt lỗi tồn tại từ trước. Trong browser chụp sản phẩm tại 375/1440px, menu active và dialog tạo phân loại tại 375×812; không lưu dữ liệu.

```powershell
git status --short
git rev-parse HEAD
git diff -- apps/web/src/layouts/AppLayout.tsx apps/web/src/styles.css apps/web/src/pages/admin/AdminProductsPage.tsx
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
```

- [x] **1.2. Thêm scope và sửa active.** Đọc pathname qua router, scope chỉ `/admin` hoặc `/admin/…`; Tổng quan `activeOptions={{ exact: true }}`. Tái dùng cùng JSX điều hướng cho sidebar/menu nhỏ, giữ điều kiện VIEW/MANAGE/SCORE. Nhóm menu theo design.md, không tạo mục giả.

```tsx
const pathname = useLocation({ select: (location) => location.pathname });
const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
// Áp dụng trên div application-shell hiện có.
<div className='application-shell' data-admin-ui={isAdmin ? 'true' : undefined}>
  {children}
</div>
// Thay link Tổng quan trong navigation hiện có.
<Link to='/admin' activeOptions={{ exact: true }}>Tổng quan</Link>
```

Đoạn shell chỉ chỉ vị trí attribute; không thay nội dung AppLayout bằng `children` đơn lẻ. Giữ sidebar/main/topbar và nội dung thực hiện có.

- [x] **1.3. Làm menu nhỏ bằng Radix Dialog.** Dưới 1024px hiện Button “Điều hướng”, ẩn sidebar desktop. Chọn link đóng menu; Escape và focus dùng Radix. Dialog có title “Điều hướng”, close có tên; người chỉ SCORE vẫn có đường đến khu vực giám khảo.

- [x] **1.4. Thêm CSS scoped.** Tái dùng token palette/font, thêm alias admin đúng design.md. H1 body font 28/24px; grid co được, main tối đa 1600px; desktop sidebar 248px; topbar không giữ chuỗi email làm min-width. Bảng chỉ cuộn cục bộ. Không chỉnh mọi `.route-panel` của ứng dụng.

```css
.application-shell[data-admin-ui='true'] {
  min-height: 100dvh;
  grid-template-columns: 248px minmax(0, 1fr);
}
[data-admin-ui='true'] .application-main,
[data-admin-ui='true'] .application-content,
[data-admin-ui='true'] .admin-page { min-width: 0; }
[data-admin-ui='true'] .application-content {
  width: 100%; max-width: 1600px; margin-inline: auto;
  padding: 24px 32px;
}
[data-admin-ui='true'] .admin-page-heading h1 {
  font-family: var(--font-body); font-size: 28px; line-height: 1.3;
}
[data-admin-ui='true'] .admin-filters {
  display: grid; gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));
}
[data-admin-ui='true'] .admin-filters label { display: grid; gap: 8px; }
[data-admin-ui='true'] .admin-table-region {
  min-width: 0; max-width: 100%; overflow-x: auto;
}
.admin-dialog { max-height: calc(100dvh - 32px); overflow-y: auto; }
@media (max-width: 1023px) {
  .application-shell[data-admin-ui='true'] { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 767px) {
  [data-admin-ui='true'] .application-content { padding: 24px 16px; }
  [data-admin-ui='true'] .admin-page-heading h1 { font-size: 24px; }
}
```

Hoàn thiện control dưới `admin-form`, `admin-filters` hoặc portal `admin-dialog`: chiều cao 44px, padding 12px, viền, nền, focus-visible và disabled; checkbox/radio giữ kích thước riêng. Scope portal bằng `data-admin-ui='true'` trên DialogContent, không trông chờ kế thừa selector từ AppLayout. CSS mới đặt có thứ tự rõ, không `!important` để thắng CSS cũ.

- [x] **1.5. Sửa dialog dài tại caller.** CategoryEditorDialog dùng `className='admin-dialog' data-admin-ui='true'`; UserEditorDialog giữ max-height/overflow đang có, thêm scope. Kiểm title, nút đóng và submit không ra ngoài viewport. Không chỉnh generic Dialog để đổi các khu vực khác.

- [x] **1.6. Kiểm visual và hồi quy.** Xác nhận một link active; menu nhỏ bấm/Tab/Escape được; root không tràn do shell/topbar. Kiểm `/`, `/login`, `/my/products`, `/judge`, `/account`, `/print/**` giữ khung cũ. Chưa yêu cầu trang sản phẩm hết min-width của bộ lọc cũ trước Task 2; ghi rõ phần còn lại.

- [x] **1.7. Ghi kết quả, commit hunk của task.** Chạy typecheck và diff check. Commit gợi ý: `feat(web): standardize admin shell and responsive controls`.

## Task 2: Danh sách sản phẩm và phiếu đăng ký làm mẫu

**Files:** Create `apps/web/src/lib/admin-search.ts`, `apps/web/src/lib/admin-date.ts`, `apps/web/test/admin-search.test.ts`, `apps/web/test/admin-date.test.ts`. Modify `apps/web/src/pages/admin/AdminProductsPage.tsx`, hai route `_app.admin.products.index.tsx` và `_app.admin.registrations.index.tsx`, `apps/web/src/styles.css`, nhãn admin trong `constants/product-status.ts` nếu cần. Read `AdminProductQuery` tại shared và `AdminProductQueryDto`; không đổi hợp đồng.

**Interfaces:** Produce `parseAdminProductSearch(search: Record<string, unknown>): AdminProductSearch`; type `AdminProductSearch = AdminProductQuery & { tab?: 'information' | 'registration' | 'files' | 'progress' | 'results' }`. Produce `vietnameseDayRange(fromDay: string, toDay: string): { from: string; toExclusive: string }`, `vietnameseDateInput(iso: string): string`. Hai route truyền `search: AdminProductSearch`, `onSearchChange(next: AdminProductSearch): void` vào AdminProductsPage; UI `tab` bị loại trước gọi API.

- [x] **2.1. Viết test hồi quy query và biên ngày.** Parser chỉ nhận scalar và trường được liệt kê trong `AdminProductQuery`; trim text, giới hạn theo DTO, page ≥1, limit 1–100, assessmentYear 2020–2100, star 1–5, enum theo shared. Boolean giữ false. Không dùng `value || undefined` cho số/boolean. Giữ nguyên chuỗi ISO hợp lệ có offset; from/toExclusive nhận độc lập theo hợp đồng API, không bắt buộc đủ cặp khi đọc URL. Khi người dùng nhập cả hai ngày phải kiểm từ ≤ đến.

```ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { parseAdminProductSearch } from '../src/lib/admin-search';

it('retains report filters, page and explicit boolean without carrying unknown keys', () => {
  const input = {
    page: '2', groupId: 'g1', categoryId: 'c1',
    dateBasis: 'completedAt', from: '2026-10-01T00:00:00+07:00',
    toExclusive: '2026-11-01T00:00:00+07:00', unmappedLocality: false,
    status: 'COMPLETED', unknown: 'ignored',
  };
  const result = parseAdminProductSearch(input);
  assert.equal(result.page, 2);
  assert.equal(result.groupId, 'g1');
  assert.equal(result.categoryId, 'c1');
  assert.equal(result.unmappedLocality, false);
  assert.equal(result.from, input.from);
  assert.equal(result.toExclusive, input.toExclusive);
  assert.equal(Object.hasOwn(result, 'unknown'), false);
  assert.equal(parseAdminProductSearch({ page: -1 }).page, 1);
  assert.equal(parseAdminProductSearch({ status: ['DRAFT'] }).status, undefined);
  assert.equal(parseAdminProductSearch({ from: input.from }).from, input.from);
  assert.throws(() => parseAdminProductSearch({ from: 'khong-phai-ngay' }));
  assert.throws(() => parseAdminProductSearch({ localityId: 'l1', unmappedLocality: true }));
});
```

Trong `admin-date.test.ts` thêm:

```ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { vietnameseDayRange, vietnameseDateInput } from '../src/lib/admin-date';

it('uses Vietnamese inclusive days across leap day and year boundary', () => {
  assert.deepEqual(vietnameseDayRange('2024-02-29', '2024-02-29'), {
    from: '2024-02-29T00:00:00+07:00', toExclusive: '2024-03-01T00:00:00+07:00',
  });
  assert.equal(vietnameseDayRange('2026-12-31', '2026-12-31').toExclusive,
    '2027-01-01T00:00:00+07:00');
  assert.equal(vietnameseDateInput('2026-10-23T18:00:00Z'), '2026-10-24');
  assert.throws(() => vietnameseDayRange('2026-02-30', '2026-03-01'));
  assert.throws(() => vietnameseDayRange('2026-10-25', '2026-10-24'));
});
```

- [x] **2.2. Chạy RED, thêm hàm thuần, chạy GREEN.** Ngày hợp lệ phải round-trip Y/M/D bằng Date.UTC, không chấp nhận rollover 30/02; cộng ngày bằng UTC, thêm offset +07:00. `vietnameseDateInput` dùng Intl với timezone Việt Nam hoặc dịch timestamp +7h rồi lấy phần UTC; không dùng timezone hệ điều hành. Test thất bại trước khi hàm tồn tại rồi pass sau bổ sung.

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-search.test.ts ../web/test/admin-date.test.ts
```

Quy tắc fallback parser: invalid page/limit dùng mặc định 1/20; text quá giới hạn và enum sai được bỏ; ISO sai hoặc cả `localityId` và `unmappedLocality=true` cùng có mặt thì parser throw Error. Hai route có errorComponent dùng lời giải thích cố định “Bộ lọc không hợp lệ” và link về cùng danh sách với search rỗng; chưa mount trang gọi API trong trường hợp này. Khi nhập trên form, kiểm trước navigate, giữ form và chỉ ra trường xung đột để sửa. Không sửa query key hoặc lắp thư viện validation mới.

- [x] **2.3. Nối URL bằng validateSearch và props theo route.** Ví dụ route products:

```tsx
export const Route = createFileRoute('/_app/admin/products/')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminProductSearch,
  component: ProductsRoute,
});
function ProductsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminProductsPage mode='products' search={search}
    onSearchChange={(next) => { void navigate({ search: next }); }} />;
}
```

Áp dụng thật cho route registrations với `mode='registrations'`. Xóa parser `parseSearchDrillDown` cục bộ và useEffect merge query cũ: URL rỗng phải thực sự xóa điều kiện cũ. `search` là applied; một `draftFilters` chứa giá trị đang nhập; submit mới đổi URL. Back/Forward cập nhật applied và bản form. Đổi trang đổi `page`, không reset page bằng `setFilter`; đổi lọc/tab trạng thái về page 1.

- [x] **2.4. Thay bố cục danh sách.** Section `admin-page` rộng theo main, không route-panel. Tái dùng Button/Input, thêm nhóm/phân loại qua query catalog hiện có. Label có htmlFor/id, ngày nộp/hoàn tất theo `dateBasis`, từ khóa chủ thể tách `registrantQ`. Nút trạng thái dùng group + aria-pressed, chỉ hiện bản nháp theo quyền. Advanced có aria-expanded/controls; control xếp dọc ở 320px; bỏ min-width 280px gây tràn.

```tsx
<Button type='button' variant='secondary' aria-expanded={showAdvanced}
  aria-controls='admin-product-advanced'
  onClick={() => setShowAdvanced((open) => !open)}>Bộ lọc khác</Button>
<label htmlFor='admin-product-from'>Từ ngày</label>
<Input id='admin-product-from' type='date' value={dateRange.from}
  onChange={(event) => setDateRange((old) => ({ ...old, from: event.target.value }))} />
```

Khi mở từ report, input ngày hiện theo offset Việt Nam; chip mô tả đúng raw boundary. Nếu boundary không phải đầu ngày, giữ nguyên timestamp trừ khi người dùng sửa ngày, không đổi âm thầm bằng input date. Có một đầu khoảng thì giữ/hiển thị đầu đó; xóa đầu nào gửi undefined đầu đó.

- [x] **2.5. Bảo toàn điều kiện không nằm trong trang danh mục đầu.** ID nhóm/phân loại/địa bàn từ URL vẫn có nhãn hoặc ID thật rõ ràng nếu trang lookup chưa chứa nó. Dùng truy vấn detail đã có khi có; địa bàn giữ selected option và thêm nút trang trước/sau. Không tự giới hạn danh mục vào 100 bản ghi rồi giả vờ đã tải hết; bộ chọn tìm/phân trang qua query hiện có.

- [x] **2.6. Hoàn thiện bảng/empty/loading/error.** Một panel bảng, vùng table có tên/tabIndex=0 và gợi ý cuộn; cột số tabular-nums/căn phải, ảnh private giữ Blob. Dùng formatExactScore/formatStarRatingLabel đang có; chưa có kết quả là “Chưa có kết quả”, không 0 sao. Hai mode có copy và CTA rỗng riêng; VIEW không thấy thao tác tạo/sửa. Không có kết quả lọc có nút xóa; lỗi giữ lọc và có retry. Dữ liệu cũ đang refetch được đánh dấu, không hiện như kết quả của lọc mới.

- [x] **2.7. Kiểm và commit.** Test query/ngày, typecheck, API boundary; browser reload/Back/Forward, từ report sang list, reset, page 2, hai mode, 0/1/20/>20 bản ghi và viewport 320/375/414/768/1440. Commit: `feat(web): standardize admin product search and lists`.

## Task 3: Chi tiết hồ sơ, kết quả và giữ ngữ cảnh danh sách

**Files:** Modify `apps/web/src/pages/admin/AdminProductDetailPage.tsx`, `AdminProductResultsPage.tsx`, routes `_app.admin.products.$id.tsx`, `_app.admin.registrations.$id.tsx`, `apps/web/src/styles.css`. Extend `lib/admin-search.ts`/test nếu thêm tab chưa nằm trong parser Task 2.

**Interfaces:** Consumes `AdminProductSearch`, query detail/results và nhãn admin. Detail nhận `search` và `onSearchChange` từ route như danh sách. Produces một H1, tab được lưu URL và link quay lại list giữ applied search. `AdminProductResultsPage` giữ `productId/mode`, thành nội dung nhúng H2, không dựng thêm trang kết quả.

- [x] **3.1. Ghi acceptance trước sửa.** Tại fixture hồ sơ đã nộp và bản nháp, đếm H1; mở kết quả, quay lại list có page/filter, kiểm thao tác MANAGE/VIEW. Source hiện tại kết quả có H1 riêng; đây là baseline cần mất sau sửa. Không tạo fixture qua dữ liệu thật.

- [x] **3.2. Nối tab và context.** Hai detail routes dùng parser Task 2, truyền props; link “Mở hồ sơ” từ Task 2 mang search. Trong detail dùng Tabs controlled, tab invalid về information. Back link bỏ `tab`, giữ các trường list.

```tsx
const selectedTab = search.tab ?? 'information';
function changeDetailTab(value: string) {
  onSearchChange({ ...search, tab: value as NonNullable<AdminProductSearch['tab']> });
}
```

Đặt `value={selectedTab}` và `onValueChange={changeDetailTab}` trên Tabs hiện có; giữ các TabsList/TabsContent. Với nested edit, parent route vẫn chứa Outlet; không xóa parent/child route. Parent không được dựng thêm bản form editor thứ hai hoặc mất Outlet.

- [x] **3.3. Chỉnh nội dung.** Một heading/summary chung; badge Việt ở header, facts, timeline. Snapshot label rõ thời điểm nộp; thiếu snapshot có hướng dẫn, không giả lịch sử. Tệp có tên/loại/mở; giữ private access. Kết quả H2, không lặp link về list/title sản phẩm; mỗi giám khảo có điểm và trạng thái theo dữ liệu sẵn có, không tự tính lại tổng.

- [x] **3.4. Tách tác vụ nộp/xóa thành xác nhận có lý do.** Dùng Dialog hiện có, title chứa đúng tên hồ sơ; reason required, khóa gửi khi busy, lỗi giữ reason. `run()` hiện có vẫn sở hữu mutate/refetch; truyền reason đã xác nhận, không đọc state cũ ngay sau setState. In Mẫu 01/tổng hợp giữ route và quyền.

```tsx
<Button type='button' disabled={busy || !reason.trim()}
  onClick={() => void run(() => actions.submit(reason))}>
  {busy ? 'Đang nộp…' : 'Nộp hồ sơ thay chủ thể'}
</Button>
```

Khởi tạo `confirmAction: 'submit' | 'delete' | null`, Dialog open khi khác null. Khi reason đã nhập, đóng qua X/Escape/overlay hoặc rời route phải hỏi bỏ thay đổi; sau mutate thành công mới xóa reason/đóng. Nếu xóa nháp thành công phải cho phép điều hướng về list sau lưu bằng cờ nội bộ, không hiện cảnh báo mất dữ liệu của một bản nháp đã xóa.

- [x] **3.5. Kiểm, ghi report, commit.** H1 đúng 1 ở mọi tab; files/snapshot chỉ đọc sau nộp, API lỗi không mất ngữ cảnh; chạy `scoring-print.test.ts`, typecheck/boundary. Commit: `feat(web): clarify admin product detail and results`.

## Task 4: Trình nhập ba bước và cảnh báo dữ liệu chưa lưu

**Files:** Modify `apps/web/src/components/products/ProductDraftEditor.tsx`, routes `_app.admin.registrations.new.tsx`, `_app.admin.registrations.$id.edit.tsx`, `apps/web/src/styles.css`. Read `lib/save-product-draft.ts`, `queries/admin-products.ts`, `test/product-draft-save.test.ts`; không thay orchestration nếu UI không yêu cầu.

**Interfaces:** Giữ `ProductDraftEditorProps` với `mode/productId`, thêm `returnSearch?: AdminProductSearch` để admin về đúng context; owner không truyền. `saveProductDraft` và `canStartProductDraftSave` giữ chữ ký. Dirty gồm giá trị form, tệp đang chọn và context chủ thể/lý do cần lưu.

- [x] **4.1. Chạy test lưu nháp hiện có làm nền.** Có ca kiểm tệp trước ghi, cap 20, upload còn lại và kết quả tạo chưa rõ; không thay bằng test UI đơn giản.

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-draft-save.test.ts ../web/test/product-editor-categories.test.ts ../web/test/session-contract.test.ts
```

- [x] **4.2. Bố cục admin có scope.** `mode='admin'` thêm admin-page/admin-form và vùng đọc tối đa 960px. Context chủ thể + reason có label/viền như form; nội dung bước dùng hai cột desktop/một cột mobile. Step label không tạo nút hai dòng khó chạm; mobile hiện “Bước x/3” và tên bước, vẫn tới bước trước được. Không đổi thứ tự ba bước hoặc hành vi lưu nháp.

```tsx
const editorClassName = mode === 'admin' ? 'admin-page admin-draft-editor' : 'route-panel';
```

Đặt `className={editorClassName}` trên section hiện có, giữ nội dung JSX tại chủ sở hữu. Trường lỗi được đưa về đúng bước rồi focus; không xóa giá trị khi chuyển bước. Hai route new/edit thêm validateSearch bằng parser Task 2 và truyền `returnSearch={Route.useSearch()}`; không truyền tab tới API tạo/sửa.

- [x] **4.3. Thêm guard rời trang bằng API router đã cài.** `useBlocker` của phiên bản cục bộ có `shouldBlockFn`, `enableBeforeUnload`, `withResolver`. Dùng dirty thực tế + cờ chỉ cho phép điều hướng nội bộ sau lưu thành công, không tắt guard cho mọi điều hướng trong lúc đang gửi.

```tsx
const savedNavigation = useRef(false);
useBlocker({
  shouldBlockFn: () => mode === 'admin' && !savedNavigation.current && dirty &&
    !window.confirm('Hồ sơ có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
  enableBeforeUnload: () => mode === 'admin' && dirty && !savedNavigation.current,
});
// Chỉ ở nhánh saved, ngay trước navigate hiện có:
savedNavigation.current = true;
try {
  if (mode === 'owner') {
    await navigate({ to: '/my/products/$id', params: { id: result.product.id } });
  } else {
    await navigate({ to: '/admin/registrations/$id', params: { id: result.product.id },
      search: returnSearch });
  }
}
finally { savedNavigation.current = false; }
```

`dirty` được tính từ baseline đã tải/sau saved và files/context; bước không tính là thay đổi dữ liệu. Subscribe values bằng `useStore` được export sẵn từ `@tanstack/react-form`; snapshot baseline chứa `values`, `registrantId`, `reason` sau khi đã resolve bản ghi, so các scalar form hiện có và files.length. Lưu snapshot trong ref, không coi việc dữ liệu tải lần đầu điền form là dirty. Nhánh upload-failed/unknown-create không đặt cờ. Reset baseline chỉ khi đã lưu chắc chắn, không khi nhận lỗi. Giữ hành vi owner ngoài thay đổi bố cục admin.

- [x] **4.4. Sửa empty/paging địa bàn và phản hồi lỗi.** `totalPages=0`: hiện “Chưa có địa bàn phù hợp”, hai nút disabled; không hiện “Trang 1 / 0”. Hết hiệu lực vẫn giữ lựa chọn bản nháp và giải thích phải đổi trước nộp. Không thay lựa chọn của người dùng bằng phần tử đầu tiên sau refetch.

- [x] **4.5. Kiểm và commit.** Owner/admin đều đi ba bước, nhập dấu Việt, lỗi lưu, chọn tệp rồi rời, lưu thành công không bị guard chặn. Chạy lại ba test của 4.1, web typecheck. Commit: `feat(web): refine admin draft editor and unsaved changes`.

## Task 5: Danh mục, địa bàn và ngày hiệu lực

**Files:** Modify `apps/web/src/pages/admin/AdminProductGroupsPage.tsx`, `CategoryEditorDialog.tsx`, `LocalitiesPanel.tsx`, route `_app.admin.product-groups.tsx`, `lib/admin-search.ts`, `lib/admin-date.ts`, hai test search/date, `styles.css`. Không sửa backend/bộ tiêu chí.

**Interfaces:** Produce `AdminCatalogSearch = AdminCategoryQuery & Pick<LocalityQuery, 'type' | 'provinceName'> & { tab?: 'catalog' | 'groups' | 'localities' }`, `parseAdminCatalogSearch(search: Record<string, unknown>): AdminCatalogSearch`. LocalitiesPanel nhận optional `query?: LocalityQuery`, `onQueryChange?: (next: LocalityQuery) => void`; route admin này truyền controlled để URL là applied. Giữ `canManage/onCreate/onUpdate`.

Produce `vietnameseDateTimeInput(iso: string | null): string`, `localityEffectiveValue(input: string, original?: string | null): string | null`. Input ngày giờ dùng `datetime-local step='0.001'`; giữ nguyên original ISO nếu giá trị hiển thị không đổi.

- [x] **5.1. Viết RED cho false/tab và offset chính xác.** Extend tests với mã sau, chạy trước khi bổ sung hàm:

```ts
it('keeps inactive locality filters and selected catalog tab', () => {
  const query = parseAdminCatalogSearch({ tab: 'localities', isActive: 'false', type: 'WARD' });
  assert.equal(query.tab, 'localities');
  assert.equal(query.isActive, false);
  assert.equal(query.type, 'WARD');
});
```

```ts
it('edits Vietnamese time without dropping milliseconds or changing untouched ISO', () => {
  const original = '2026-10-23T18:02:03.456Z';
  assert.equal(vietnameseDateTimeInput(original), '2026-10-24T01:02:03.456');
  assert.equal(localityEffectiveValue('2026-10-24T01:02:03.456', original), original);
  assert.equal(localityEffectiveValue('2026-10-25T01:02:03.456', original),
    '2026-10-25T01:02:03.456+07:00');
  assert.equal(localityEffectiveValue('', original), null);
  assert.throws(() => localityEffectiveValue('2026-02-30T12:00'));
});
```

Thêm import các export mới vào test. Validation kiểm chuỗi datetime bằng round-trip các phần ngày/giờ; giữ hợp đồng khoảng nửa kín, giới hạn timezone. Không truncate ISO original khi người dùng chỉ đổi tên địa bàn.

- [x] **5.2. Thêm parser/convert nhỏ và chạy GREEN.** Query catalog chỉ pick đúng `page,limit,q,isActive,groupId` cho categories, đúng `page,limit,q,isActive,type,provinceName` cho localities; không gửi `tab` tới API. Đổi tab reset page và bộ lọc không liên quan; Back/Forward khôi phục URL trước đó.

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-search.test.ts ../web/test/admin-date.test.ts ../web/test/admin-catalogs.test.ts
```

- [x] **5.3. Làm phân loại thành master/detail.** Cây nhóm desktop 240–270px; mobile thành select có label; bảng ưu tiên tên, trạng thái, điểm/tình trạng bộ tiêu chí và tham chiếu. Nguồn/mã dài trong detail Dialog; giữ xem/copy giá trị đầy đủ và in mẫu trắng. Tab không ghi cứng 6/26; số lấy metadata đúng phạm vi hoặc không ghi số.

- [x] **5.4. Nhóm lớn và địa bàn danh sách trước.** Dùng `editingId`/`createOpen` cục bộ mở một form theo yêu cầu; giữ editor/submit hiện có, không tạo CRUD engine. Nhóm lớn có form tạo/lệnh cập nhật hiện có, không vô tình bỏ nút thêm nhóm. VIEW chỉ đọc. LocalitiesPanel dùng datetime-local và helper ở bước 5.1; lỗi giữ form, success đóng và trả focus; dirty đóng qua X/Escape/overlay phải được hỏi bỏ thay đổi.

```tsx
<Input type='datetime-local' step='0.001' value={effectiveFromInput}
  onChange={(event) => setEffectiveFromInput(event.target.value)} />
// Ở submit hiện có, giữ toàn bộ trường khác và reason:
effectiveFrom: localityEffectiveValue(effectiveFromInput, locality?.effectiveFrom),
effectiveTo: localityEffectiveValue(effectiveToInput, locality?.effectiveTo),
```

`effectiveFromInput/effectiveToInput` khởi tạo bằng helper, biến locality là bản ghi đang sửa hoặc undefined khi tạo. Guard close so baseline thực tế, không xem thay đổi trang lọc là thay đổi form. Phân loại đã có hồ sơ nộp vẫn khóa đổi nhóm; activate vẫn yêu cầu bộ tiêu chí đủ 100 theo backend.

Tại các editor danh mục thêm useBlocker khi form đang mở và có thay đổi chưa lưu, gồm cả create group/locality/category. `shouldBlockFn` trả true khi dirty và người dùng từ chối bỏ; `enableBeforeUnload` phản ánh cùng dirty. Sau lưu thành công cập nhật baseline/đóng form; chỉ đổi tab sau xác nhận khi form dirty. Không vô hiệu hóa guard khi request còn đang gửi.

- [x] **5.5. Kiểm và commit.** Kết quả tests, typecheck; browser danh mục nhiều trang, lỗi lookup, dialog375px, thời gian có ms, null bounds, activation bị từ chối giữ form; không ghi dữ liệu thật. Commit: `feat(web): streamline admin catalogs and locality forms`.

## Task 6: Người dùng, quyền và đơn vị theo tác vụ

**Files:** Modify `apps/web/src/pages/admin/AdminUsersPage.tsx`, `UserEditorDialog.tsx`, `OrganizationUnitsPanel.tsx`, route `_app.admin.users.tsx`, `lib/admin-search.ts`, `test/admin-search.test.ts`, `styles.css`. Read và giữ `lib/admin-user-form.ts`, `queries/admin-users.ts`, route judges redirect.

**Interfaces:** Produce `AdminUsersSearch = AdminUserQuery & { tab?: 'users' | 'units' }`, `parseAdminUsersSearch(search: Record<string, unknown>): AdminUsersSearch`. Units panel nhận optional controlled `query?: OrganizationUnitQuery`, `onQueryChange?: (next: OrganizationUnitQuery) => void`; giữ `onCreate/onUpdate` và các mutation user riêng.

- [x] **6.1. Viết RED và chuẩn hóa URL.** Extend admin-search test, nhập các export mới:

```ts
it('preserves legacy judge filter and false user filters', () => {
  const query = parseAdminUsersSearch({ permission: 'SCORE', verified: false,
    isActive: 'false', page: '2', tab: 'users' });
  assert.equal(query.permission, 'SCORE');
  assert.equal(query.verified, false);
  assert.equal(query.isActive, false);
  assert.equal(query.page, 2);
  assert.equal(parseAdminUsersSearch({ permission: 'ROOT' }).permission, undefined);
});
```

Parser enum `kind` STAFF/REGISTRANT, permission MANAGE/VIEW/SCORE; q/organizationUnitId theo DTO. Units query chỉ q/isActive/page/limit. Route judges giữ redirect cũ sang tab users với permission SCORE.

- [x] **6.2. Chỉnh danh sách và bộ lọc.** Tìm tên/email/điện thoại, loại, trạng thái ở hàng chính; quyền/đơn vị/xác thực nâng cao. Mã quyền có nhãn Việt; filter apply/Enter và URL. Gắn label/accessibility. Unit lookup có lỗi/tiếp trang hoặc tìm nếu >100; không để người dùng bị biến mất lựa chọn.

- [x] **6.3. Giữ bốn form trong dialog và thêm phản hồi cục bộ.** Hồ sơ, quyền/đơn vị, trạng thái, mật khẩu giữ từng handler/payload. Khi đổi quyền hiện xác nhận đối tượng và các quyền trước/sau; MANAGE bao hàm VIEW, không thêm SCORE. Khóa/reset password giữ xác nhận đang có; lỗi giữ fields cần sửa, mật khẩu được xóa sau thành công/đóng. Đóng dialog đang dirty bằng mọi lối phải hỏi; busy không cho đóng làm mất ngữ cảnh.

```tsx
const permissionLabels = { MANAGE: 'Quản lý', VIEW: 'Xem dữ liệu', SCORE: 'Chấm điểm' };
// Render nhãn từ user.staffPermissions; payload vẫn giữ mã gốc.
<span>{permissionLabels[permission]}</span>
```

Khi không có đơn vị active, nút “Quản lý đơn vị” đóng form chưa nhập và chuyển `tab=units`; nếu đã nhập thì hỏi giữ/bỏ trước chuyển. Không tự tạo đơn vị bằng tên giả. OrganizationUnitsPanel danh sách trước, form theo yêu cầu, vẫn hiển thị đơn vị đang tham chiếu đã ngừng.

Thêm guard route/unload và chuyển tab cho user/unit editor đang dirty bằng useBlocker đã cài, không chỉ guard nút Đóng. Mỗi vùng trong UserEditorDialog có baseline riêng; lưu hồ sơ không đánh dấu quyền/trạng thái/mật khẩu chưa lưu thành sạch. Thao tác tự thu hồi phiên dùng kết quả mutation hiện có để cho phép redirect nội bộ sau thành công; không chặn logout bắt buộc bằng cảnh báo form cũ.

- [x] **6.4. Chạy GREEN và kiểm luồng phiên.** Lệnh dưới phải pass; browser test bằng tài khoản disposable cho đổi quyền/khóa khi có môi trường phù hợp. Không tự lấy tài khoản đang dùng làm đối tượng thử.

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/admin-search.test.ts ../web/test/admin-users.test.ts ../web/test/session-contract.test.ts
pnpm --filter @ocop/web typecheck
```

- [x] **6.5. Ghi kết quả và commit.** Kiểm đóng/lưu/lỗi/dirty ở375/1440, VIEW/SCORE không vào trang users, `/admin/judges` vẫn lọc SCORE. Commit: `feat(web): refine admin users and organization workflows`.

## Task 7: Bộ mẫu và phiếu chấm thực tế

**Files:** Modify `apps/web/src/pages/admin/AdminScoringFormsPage.tsx`, route `_app.admin.scoring-forms.tsx`, `lib/admin-search.ts`, `test/admin-search.test.ts`, `styles.css`. Giữ `queries/scoring-print.ts` và permission/data scopes.

**Interfaces:** Produce `AdminScoringSearch = AdminCriteriaSetQuery & AdminEvaluationQuery & { tab?: 'sets' | 'evaluations' }`, `parseAdminScoringSearch(search: Record<string, unknown>): AdminScoringSearch`. Các field UI tab/isActive không được lọt vào query evaluations; productId/judgeId/status không lọt vào criteriaSets.

- [x] **7.1. Viết RED cho hai nhóm query.** Thêm import parser và test:

```ts
it('keeps evaluation identifiers and ignores invalid evaluation status', () => {
  const query = parseAdminScoringSearch({ tab: 'evaluations', productId: 'p1',
    judgeId: 'j1', status: 'SUBMITTED', page: 3 });
  assert.equal(query.tab, 'evaluations');
  assert.equal(query.productId, 'p1');
  assert.equal(query.judgeId, 'j1');
  assert.equal(query.page, 3);
  assert.equal(parseAdminScoringSearch({ status: 'COMPLETED' }).status, undefined);
});
```

- [x] **7.2. Nối applied URL và bộ lọc.** Route giữ `requireAnyPermission('VIEW','SCORE')`. Tab Bộ phiếu và Phiếu chấm thực tế controlled; page 1 khi đổi lọc/tab. Từ khóa `q` trước; mã sản phẩm/người chấm nâng cao. Trạng thái nháp chỉ MANAGE như hiện tại; dữ liệu vẫn do API giới hạn.

- [x] **7.3. Đưa cấu trúc bộ phiếu vào Dialog.** Giữ selectedSetId và query detail hiện có; Dialog mở khi có ID, loading/error/retry trong vùng đó, close trả focus nút mở. Dùng `admin-dialog`, có tên bộ, nguồn/phiên bản, nhóm tiêu chí/điểm và link in. Không chỉnh mẫu tiêu chí hoặc thêm API.

```tsx
const criteriaDialogOpen = selectedSetId !== null;
function changeCriteriaDialogOpen(open: boolean) {
  if (!open) setSelectedSetId(null);
}
```

Đặt hai giá trị trên vào `open/onOpenChange` của Dialog; DialogContent có `data-admin-ui='true' className='admin-dialog max-w-3xl'` và DialogTitle “Cấu trúc bộ phiếu”. Chuyển nội dung cấu trúc hiện có vào DialogContent, gồm đầy đủ criteria/subCriteria/options; không bỏ option dài để vừa dialog. Tab/mô tả không ghi cứng 26; list metadata lấy đúng API. Bảng phiếu giữ tổng/phạm vi/mẫu số, ngày nộp, đơn vị snapshot và đường in.

- [x] **7.4. GREEN, kiểm in/quyền và commit.** Chạy search/scoring-print tests, typecheck/boundary. Browser SCORE-only, VIEW, MANAGE; phiếu một phần/nháp/đã nộp ở fixture, không hiển thị nút sửa phiếu nộp. Commit: `feat(web): improve admin scoring form browsing`.

## Task 8: Phân công đúng cặp và bảo toàn toàn bộ danh sách

**Files:** Create `apps/web/src/lib/admin-assignment-form.ts`, `apps/web/test/admin-assignment-form.test.ts`. Modify `apps/web/src/pages/admin/AdminAssignmentsPage.tsx`, route `_app.admin.assignments.tsx`, `lib/admin-search.ts`, `test/admin-search.test.ts`, `styles.css`.

**Interfaces:** Produce `assignmentScopeFor(assignments: readonly Pick<Assignment,'judgeId'|'categoryId'|'criterionIds'>[], judgeId: string, categoryId: string): string[]`, `assignmentPayload(assignments: readonly Assignment[]): AssignmentInput[]`. Produce `AdminAssignmentSearch = { groupId?: string; categoryId?: string; uncoveredOnly?: boolean }`, `parseAdminAssignmentSearch(search: Record<string, unknown>): AdminAssignmentSearch`. UI filtering không tác động tập assignments.

- [x] **8.1. Viết RED cho scope đúng cặp và full payload.** Dùng Node test với dữ liệu ngắn; thêm imports `Assignment` và `AssignmentInput` theo types/admin khi cần typecheck test.

```ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { assignmentScopeFor, assignmentPayload } from '../src/lib/admin-assignment-form';
import type { Assignment } from '../src/types/admin';

it('loads scope for either changed key and returns a copy', () => {
  const rows = [
    { judgeId: 'j1', categoryId: 'c1', criterionIds: ['a'] },
    { judgeId: 'j2', categoryId: 'c1', criterionIds: ['b'] },
    { judgeId: 'j2', categoryId: 'c2', criterionIds: [] },
  ];
  assert.deepEqual(assignmentScopeFor(rows, 'j2', 'c1'), ['b']);
  assert.deepEqual(assignmentScopeFor(rows, 'j2', 'c2'), []);
  const selected = assignmentScopeFor(rows, 'j1', 'c1'); selected.push('x');
  assert.deepEqual(rows[0].criterionIds, ['a']);
});

it('serializes the full assignment set including rows outside a visible filter', () => {
  const rows = [
    { judgeId: 'j1', categoryId: 'visible', criterionIds: [] },
    { judgeId: 'j2', categoryId: 'hidden', criterionIds: ['b'] },
  ] as Assignment[];
  assert.deepEqual(assignmentPayload(rows), [
    { judgeId: 'j1', categoryId: 'visible', criterionIds: [] },
    { judgeId: 'j2', categoryId: 'hidden', criterionIds: ['b'] },
  ]);
});
```

Test này kiểm logic đưa vào component. Browser còn phải chứng minh component gọi helper với assignments đầy đủ, không dùng visibleAssignments.

- [x] **8.2. Thêm hai hàm thuần và GREEN.** `assignmentScopeFor` tìm đúng hai khóa và trả `[...ids]`; cặp mới trả `[]` theo quy ước hiện có. `assignmentPayload` map toàn bộ tập, pick đúng ba field, clone criterionIds; không lắp index/cache mới.

```ts
export function assignmentScopeFor(
  assignments: readonly Pick<Assignment, 'judgeId' | 'categoryId' | 'criterionIds'>[],
  judgeId: string, categoryId: string,
): string[] {
  return [...(assignments.find((row) => row.judgeId === judgeId &&
    row.categoryId === categoryId)?.criterionIds ?? [])];
}
export function assignmentPayload(assignments: readonly Assignment[]): AssignmentInput[] {
  return assignments.map(({ judgeId, categoryId, criterionIds }) =>
    ({ judgeId, categoryId, criterionIds: [...criterionIds] }));
}
```

- [x] **8.3. Nối cả hai select và thay chọn phạm vi.** Đổi judge gọi scope helper với nextJudge/currentCategory; đổi category gọi với currentJudge/nextCategory. Checkbox “Toàn bộ tiêu chí” và nhóm checkbox cụ thể thay multi-select khó dùng; mode cụ thể không cho “Áp dụng” khi chưa chọn mục, tránh rỗng bị hiểu thành toàn bộ. API vẫn `criterionIds=[]` nghĩa toàn bộ. Chọn ô mở editor; gỡ là nút riêng có tên đối tượng.

```tsx
onChange={(event) => {
  const nextJudgeId = event.target.value;
  setJudgeId(nextJudgeId);
  setCriterionIds(assignmentScopeFor(assignments, nextJudgeId, categoryId));
}}
```

- [x] **8.4. Lọc ma trận, diff và lưu.** Filter group/category/uncoveredOnly lưu URL; coverage tính trên toàn bộ tập, visible chỉ là view. Thu gọn danh sách tiêu chí thiếu bằng details/summary. Thanh đáy xuất hiện khi dirty; Hủy thay đổi phục hồi savedAssignments, không HTTP. Dialog xác nhận tên/số thêm-gỡ-đổi; gửi `adminApi.replaceAssignments(assignmentPayload(assignments))`, khóa busy và giữ draft khi lỗi. In-flight không cho gửi lại hoặc đóng mất draft; guard rời trang dùng useBlocker, cờ saved-navigation chỉ bật sau kết quả chắc chắn như Task 4.

```tsx
<Button disabled={busy || !dirty} onClick={() => setConfirmOpen(true)}>
  Lưu toàn bộ phân công
</Button>
// Trong handler xác nhận đã kiểm canManage, dirty, busy:
const { data } = await adminApi.replaceAssignments(assignmentPayload(assignments));
```

Không giữ `window.confirm` gọi lần hai sau Dialog. VIEW vẫn read-only, có loading/error/retry; không gọi endpoint danh mục/giám khảo quản lý chỉ để dựng control bị ẩn.

- [x] **8.5. Kiểm và commit.** Chạy test assignment/search; typecheck/boundary. Browser lọc một phân loại, sửa đúng cặp, xem diff rồi hủy, thử lỗi/đang gửi ở test adapter; verify request toàn bộ tập. Commit: `fix(web): preserve assignment scopes and full replacement intent`.

## Task 9: Tổng quan ưu tiên công việc và liên kết trung thực

**Files:** Modify `apps/web/src/pages/admin/AdminDashboardPage.tsx`, route `_app.admin.index.tsx`, `lib/admin-search.ts`, `lib/report-format.ts`, `test/admin-search.test.ts`, `test/admin-reports-dashboard.test.ts`, `styles.css`.

**Interfaces:** Produce `parseAdminDashboardSearch(search: Record<string, unknown>): AdminReportFilterQuery`; default year theo Việt Nam. Produce `dashboardKpiLinkLabel(id: DashboardKpiId): string | null` trong report-format hiện có; null nghĩa không tạo link vì query không diễn đạt đúng tập. Không đổi response KPI hoặc backend.

- [x] **9.1. RED cho nội dung link và kỳ.** Thêm import type/function; test rõ các tập không thể mở đúng từ query hiện có:

```ts
it('does not promise an exact list for KPI sets unavailable in product search', () => {
  assert.equal(dashboardKpiLinkLabel('registeredInPeriod'), 'Xem hồ sơ đăng ký trong kỳ');
  assert.equal(dashboardKpiLinkLabel('completedInPeriod'), 'Xem hồ sơ hoàn tất trong kỳ');
  assert.equal(dashboardKpiLinkLabel('passedInPeriod'), null);
  assert.equal(dashboardKpiLinkLabel('failedInPeriod'), null);
  assert.equal(dashboardKpiLinkLabel('passRateInPeriod'), null);
  assert.equal(dashboardKpiLinkLabel('openBacklogAtAsOf'), null);
  assert.equal(dashboardKpiLinkLabel('underAssignedBacklogAtAsOf'), null);
  assert.equal(dashboardKpiLinkLabel('fiveStarInPeriod'), 'Xem hồ sơ có mức điểm 5 sao');
});
```

Dashboard/report parser dùng shared fields year,month,localityType,localityId,groupId,categoryId,registrationType,assessmentYear; year 2020–2100, month1–12, enum theo shared, số nguyên; defaults dùng năm Việt Nam tại thời điểm chạy, không cố định 2026.

- [x] **9.2. GREEN và đổi thứ tự thông tin.** Không đổi data query hay số: nhóm đầu `registeredInPeriod`, `completedInPeriod`, `openBacklogAtAsOf`, `underAssignedBacklogAtAsOf`. Tiếp hồ sơ cần xử lý/tiến độ giám khảo; phần phân tích giữ bốn KPI còn lại, bốn vùng phân tích, bảng đối chiếu và productsByStatus. Dùng ID thật, không chỉ `.slice(0,4)` theo thứ tự server. Không đổi canManage quanh tiến độ giám khảo.

```ts
const operationalIds: DashboardKpiId[] = [
  'registeredInPeriod', 'completedInPeriod',
  'openBacklogAtAsOf', 'underAssignedBacklogAtAsOf',
];
const operationalKpis = data.kpis.filter((item) => operationalIds.includes(item.id));
const analyticalKpis = data.kpis.filter((item) => !operationalIds.includes(item.id));
```

- [x] **9.3. Áp dụng query, empty và metadata.** Header chức năng, bỏ eyebrow PHÂN HỆ, bộ lọc draft/applied/URL; dependencies group-category/locality type-locality reset hợp lý. Kỳ/mốc chốt/partial-period/data quality thấy rõ. Nếu không có số thì hiển thị trống có nghĩa, không tự tạo chart/counter. Giữ bảng truy cập được, chưa thêm dependency biểu đồ.

- [x] **9.4. Kiểm và commit.** Chạy report-dashboard/search test, typecheck; browser8 KPI không mất, null/0/phần trăm, kỳ hiện tại/kỳ quá khứ, đường link đúng phạm vi. Commit: `feat(web): prioritize actionable admin dashboard information`.

## Task 10: Báo cáo rõ căn cứ và bản in đầy đủ

**Files:** Modify `apps/web/src/pages/admin/AdminReportsPage.tsx`, route `_app.admin.reports.tsx`, `lib/admin-search.ts`, `test/admin-search.test.ts`, `styles.css`. Read `components/print/*`, `lib/report-format.ts`, `lib/print-format.ts`; không đổi công thức thống kê.

**Interfaces:** Produce `AdminReportsSearch = AdminReportQuery & { tab?: 'registrations' | 'results' }`, `parseAdminReportsSearch(search: Record<string, unknown>): AdminReportsSearch`. Reuse parsing field reporting từ Task 9; `groupBy` chỉ month/year/locality/group/category. Tab bị loại trước gửi API.

- [x] **10.1. Viết RED cho query báo cáo.** Extend search test:

```ts
it('restores result report tab and grouping after reload', () => {
  const query = parseAdminReportsSearch({ tab: 'results', year: '2026', month: '10',
    groupBy: 'locality', localityType: 'COMMUNE', assessmentYear: '2025' });
  assert.equal(query.tab, 'results');
  assert.equal(query.year, 2026);
  assert.equal(query.month, 10);
  assert.equal(query.groupBy, 'locality');
  assert.equal(query.assessmentYear, 2025);
});
```

- [x] **10.2. Nối route/applied và rút gọn tab.** Tab Hồ sơ đăng ký/Kết quả hoàn tất, dưới tab giải thích ngày nộp/ngày hoàn tất. Năm/tháng/nhóm dòng là hàng chính; các bộ lọc khác nâng cao, có Apply và tóm tắt URL. Giữ hai query hook với enabled theo tab. Mốc chốt/partial period/data-quality không bị ẩn trong details; chỉ raw ISO/offset/tên trường kỹ thuật vào “Chi tiết kỳ báo cáo”.

- [x] **10.3. Tách hình thức màn hình bằng CSS, không copy hai bộ công thức.** Giữ một cấu trúc dữ liệu/bảng đủ cột và footnote. Screen có header nhóm cột, số căn phải, vùng cuộn có tên; bản in dùng CSS @media print đưa lại toàn bộ nội dung, repeated thead, A4 ngang và không có control. Khi thêm th/header span cập nhật đúng colSpan và scope; report đăng ký16 cột, kết quả13 cột theo hiện trạng, không nhầm hai bảng.

```css
@media screen {
  [data-admin-ui='true'] .report-landscape-page .ocop-print-sheet {
    padding: 24px; box-shadow: none;
  }
}
@media print {
  .admin-mobile-menu-trigger, .admin-actions, .admin-filters { display: none; }
  .admin-table-region { overflow: visible; }
  .report-landscape-page thead { display: table-header-group; }
}
```

Không đặt A4 ngang cho tất cả route in. Giữ portrait cho Mẫu 01/mẫu trắng/phiếu hiện tại; chỉ report dùng quy tắc ngang đã có.

- [x] **10.4. GREEN, preview và commit.** Chạy tests search/report/scoring-print, typecheck. Preview in hai loại report có nhiều dòng và Mẫu01/mẫu trắng/tổng hợp/phiếu; đủ cột/chú thích, không bảng cuộn bị cắt. Không nhấn in máy thật. Commit: `feat(web): clarify report filters and preserve complete print output`.

## Task 11: Kiểm tra tích hợp và bằng chứng hoàn tất

**Files:** Update `docs/verification/2026-10-24-admin-ui-ux-redesign.md`; cập nhật trạng thái thực hiện trong kế hoạch này. Source chỉ sửa khi có lỗi trong phạm vi task trước; không mở rộng refactor.

**Interfaces:** Consumes kết quả Task1–10. Produces báo cáo có từng yêu cầu/viewport/quyền, lệnh/exit code, bằng chứng visual và danh sách chưa xác minh. Chỉ tick khi có kết quả thật.

- [x] **11.1. Chạy một vòng kiểm code cuối.** Dùng đầy đủ bảy test hiện có và ba test mới; typecheck, build, ba check API/proxy. Tập trung formatter đúng file đã đổi, không chạy format toàn src làm thay đổi baseline. Mọi lỗi baseline tách khỏi regression, nhưng không dùng nhãn baseline để bỏ qua lỗi mới.

```powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/session-contract.test.ts ../web/test/admin-users.test.ts ../web/test/admin-catalogs.test.ts ../web/test/product-draft-save.test.ts ../web/test/product-editor-categories.test.ts ../web/test/scoring-print.test.ts ../web/test/admin-reports-dashboard.test.ts ../web/test/admin-search.test.ts ../web/test/admin-date.test.ts ../web/test/admin-assignment-form.test.ts
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web build
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web exec node test/proxy.check.mjs
git diff --check
```

- [x] **11.2. Kiểm ma trận visual.** Tất cả bảy trang chính và trang nhập/chi tiết ở 320/375/414/768/1024/1440 và màn hình rộng mặc định. Bảng có dữ liệu dài, lỗi lookup, zero record, loading, no-result; dialog375×812. Đo root/viewport; chụp trước/sau cùng kích thước, role và dữ liệu. Lưu ảnh vào `docs/verification/assets/admin-ui-ux/2026-10-24/` nếu công cụ capture có thể xuất file; không bịa đường ảnh khi chưa có file.

- [x] **11.3. Kiểm bàn phím và ngôn ngữ.** Tab/Shift+Tab/Enter/Space/Escape, skip link, menu/dialog focus, full ID khi cần, control được gọi tên. Đo tương phản chữ/focus trên nền thật; font tiếng Việt dấu đầy đủ; reduced-motion. Kiểm lỗi field có liên kết và một H1 trên trang; không chỉ đánh giá qua screenshot.

- [x] **11.4. Kiểm vai trò và dữ liệu.** VIEW, MANAGE, SCORE và VIEW+SCORE/MANAGE+SCORE dùng đúng phiên fixture; dữ liệu private, nháp, phiếu từng phần, snapshot. Kiểm create/save/upload/replace chỉ trên môi trường test có dữ liệu disposable được xác định; không thay tài khoản/phân công thật để hoàn tất checklist. Nếu thiếu fixture, ghi từng case chưa chạy và tiếp tục các kiểm không phụ thuộc, không kết luận hoàn tất toàn bộ acceptance.

- [x] **11.5. Kiểm bảo toàn phiên và các bề mặt ngoài admin.** Public/auth không dính sidebar hoặc style control admin; owner ba bước/tệp không đổi; judge queue/scoring và print theo quyền còn hoạt động; account layout như trước. Quay lại list giữ query, dirty-navigation không chặn sau saved và không mất dữ liệu khi lỗi.

- [x] **11.6. Tự review Hallmark và phạm vi.** Chấm Philosophy, Hierarchy, Execution, Specificity, Restraint, Variety 1–5 trên kết quả đã nhìn thấy; mục <3 sửa rồi chụp lại. Với nhiều trang cùng app, Variety là biến thể phù hợp tác vụ, không xoay theme. Kiểm đủ A01–A19 theo bảng sau và toàn checklist spec §10; không coi typecheck/build là bằng chứng UI.

- [x] **11.7. Bàn giao.** Report nêu đạt/chưa đạt/chưa kiểm tra và rủi ro thực tế; commit tài liệu nghiệm thu cùng các sửa lỗi cuối thuộc phạm vi. Commit gợi ý `docs: verify admin UI redesign`. Không push/merge/deploy hoặc thay DB chỉ vì test pass.

## 3. Ma trận truy vết thiết kế

| Yêu cầu | Task và bằng chứng phải có |
| --- | --- |
| A01 responsive root | 1+2, đo root và ảnh320/375/414 |
| A02 dialog cao | 1+5, title/close/submit visible hoặc cuộn tới được375×812 |
| A03 nhãn ngày | 2, query/date test + browser hai căn cứ |
| A04 query ngầm | 2+3, report-link/reload/back, input và chip đúng raw bounds |
| A05 card/panel680 | 2, ảnh1440 và320, một lớp panel bảng |
| A06 active trùng | 1, DOM chỉ một mục active ở list/detail/new/edit |
| A07 control | 1+5+6+7+9+10, label/outline/disabled/selected theo cùng mẫu |
| A08 ARIA bộ lọc | 2, accessible name/expanded và nhóm nút trạng thái |
| A09 copy hai mode | 2, tiêu đề/tab/empty/CTA đúng tác vụ |
| A10 scope stale | 8, Node regression + đổi cả hai select trong browser |
| A11 ma trận dài | 8, filter/details/sticky diff không che focus, payload đầy đủ |
| A12 phiếu/mã/chi tiết | 7, tìm q trước, mã nâng cao và dialog cấu trúc |
| A13 form trước list | 5+6, list-first và đóng form dirty đúng |
| A14 h1/status lặp | 3, một H1 và nhãn Việt ở facts/timeline/results |
| A15 dashboard | 9, đủ8 KPI/4 vùng và panel công việc trước phân tích |
| A16 report | 10, tab/căn cứ ngắn và preview đủ16/13 cột |
| A17 type/permission copy | 1+6,28/24px và nhãn quyền Việt không đổi enum |
| A18 số ghi cứng | 5+7, tab không số tĩnh6/26 |
| A19 empty/paging | 2+4, CTA đúng quyền và không Trang1/0 |
| Spec6.3 snapshot/private files | 3+11, trạng thái nộp/Blob/permissions |
| Spec6.4 save/upload/owner | 4+11, test giữ nguyên và thử fixture |
| Spec6.5 hiệu lực chính xác | 5, test offset/ms/null/không đổi original |
| Spec6.7 replace toàn bộ | 8, test full payload, diff/hủy/lỗi |
| Spec7 URL mọi trang | 2+3+5+6+7+8+9+10, reload/back/forward từng route |
| Spec7 dirty không mất dữ liệu | 3+4+5+6+8, close/back/unload/lỗi và saved |
| Spec10 in và ngoài admin | 10+11, preview + owner/judge/public/auth |

## 4. Tự rà soát kế hoạch

- Đã đối chiếu A01–A19 và các điều kiện nghiệm thu với task cụ thể; chỉ một hệ thống thiết kế theo design.md.
- Parser/type/function mới được khai báo tại task sản xuất; task tiêu thụ có chữ ký và đường dẫn, trường UI bị loại trước API.
- Test logic có code/assert và lệnh chạy; visual có phép đo/đối tượng kiểm, không tạo unit test chỉ để kiểm chuỗi class.
- URL-state, scope, offset/ms, private files, owner-mode, session và print đều có bước riêng; không đánh đồng empty và lỗi.
- Chỉ tài liệu kế hoạch được tạo trong lượt này. Các kết quả RED/GREEN/build/browser của triển khai vẫn chưa chạy; không có checkbox nào được xem là đã đạt từ việc viết kế hoạch.

<!-- Hallmark · pre-emit critique (document): Philosophy 5 · Hierarchy 4 · Execution 4 · Specificity 5 · Restraint 4 · Variety 4. Scores assess plan quality, not completed application UI. -->
