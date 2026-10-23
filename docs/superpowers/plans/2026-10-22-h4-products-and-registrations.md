# H4-C — Products and Registration Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** MANAGE nhập hộ/sửa/nộp nháp cho chủ thể, MANAGE/VIEW đọc hồ sơ/tệp theo quyền; Sản phẩm và Phiếu đăng ký dùng một Product, locality và thông tin lúc nộp được giữ bất biến.

**Architecture:** Mở rộng ProductsRepository/ProductsService hiện có bằng actor nội bộ rõ ràng và cùng transaction/khóa trạng thái. AdminProductsController chỉ nối HTTP với dịch vụ đó và read API AdminService; hai màn admin tái sử dụng editor/detail, query keys và một quy trình lưu/upload.

**Tech Stack:** Prisma/PostgreSQL, NestJS/Multer/private storage, Axios, React, TanStack Query/Router và form/UI đã tích hợp; Jest/node:test.

**Spec:** docs/superpowers/specs/2026-10-17-admin-modules-spec.md mục 3, 6, 8.1–8.2, 11–14; kế hoạch tổng 2026-10-22-h4-admin-modules.md. Consumes A và B hoàn tất.

## Global Constraints

- “Một Product hiện tại là một lần đăng ký/đánh giá sản phẩm.”
- “registrantId là chủ hồ sơ, createdById/audit là người thực hiện.”
- “Sau nộp không sửa thông tin, nhóm, địa bàn hoặc tệp bằng quyền admin để làm thay đổi hồ sơ đã chấm.”
- “formData tiếp tục là replace toàn bộ theo contract hiện có; sửa một trường không được làm mất các trường còn lại.”
- “Giữ ID và tệp đã thành công khi lỗi một phần.”
- “Quyền admin/VIEW đọc tệp phải được kiểm tra tại API tệp mới, không chuyển thư mục storage thành static public.”
- Áp dụng toàn bộ Global Constraints của kế hoạch tổng: file tùy chọn, 10 MiB/tệp,20 tệp/hồ sơ, schema cô lập, không UI tự tính điểm hay thay snapshot.

## File map và interfaces

**Create:**

- apps/be/prisma/migrations/0013_registration_snapshot/migration.sql.
- apps/be/src/controllers/admin-products.controller.ts.
- apps/be/src/dtos/admin-products.dto.ts.
- apps/be/src/types/product-mutation.ts — trusted actor union, không phải request DTO.
- apps/be/src/utils/registration-snapshot.ts — fixed BE snapshot builder.
- apps/be/test/admin-products.db-spec.ts; apps/be/test/admin-product-files.db-spec.ts.
- apps/web/src/api/admin-products.ts; apps/web/src/queries/admin-products.ts; apps/web/src/queries/product-drafts.ts.
- apps/web/src/lib/save-product-draft.ts; apps/web/test/product-draft-save.test.ts.
- apps/web/src/pages/admin/AdminRegistrationsPage.tsx; apps/web/src/pages/admin/AdminProductDetailPage.tsx.
- apps/web/src/components/products/ProductDraftEditor.tsx.
- apps/web/src/routes/_app.admin.registrations.index.tsx; apps/web/src/routes/_app.admin.registrations.new.tsx; apps/web/src/routes/_app.admin.registrations.$id.tsx; apps/web/src/routes/_app.admin.registrations.$id.edit.tsx.

**Modify:**

- apps/be/prisma/schema.prisma; apps/be/src/dtos/products.dto.ts; apps/be/src/dtos/admin.dto.ts.
- apps/be/src/repositories/products.repository.ts; apps/be/src/repositories/admin.repository.ts.
- apps/be/src/services/products.service.ts; apps/be/src/services/admin.service.ts.
- apps/be/src/controllers/admin.controller.ts; apps/be/src/controllers/my-products.controller.ts; apps/be/src/controllers/index.ts.
- apps/be/src/utils/product-status.ts — thêm reason tùy chọn cho event, giữ tham số thời điểm hiện có.
- apps/be/src/repositories/products.repository.spec.ts; apps/be/test/backend.db-spec.ts; apps/be/test/evaluation.db-spec.ts; apps/be/test/seed.db-spec.ts; apps/be/test/staff-access.db-spec.ts; apps/be/test/openapi.db-spec.ts — cập nhật direct callers/fixtures của mutation signatures và locality yêu cầu khi nộp mới.
- packages/shared/src/index.ts; apps/web/src/types/product.ts; apps/web/src/types/admin.ts; apps/web/src/types/registrant.ts.
- apps/web/src/api/my-products.ts; apps/web/src/api/products.ts; apps/web/src/api/index.ts; apps/web/src/queries/registrant.ts; apps/web/src/constants/api.ts; apps/web/src/constants/query-key.ts.
- apps/web/src/pages/admin/AdminProductsPage.tsx; apps/web/src/pages/admin/AdminProductResultsPage.tsx; apps/web/src/layouts/AppLayout.tsx.
- apps/web/src/pages/registrant/ProductEditorPage.tsx; apps/web/src/pages/registrant/MyProductDetailPage.tsx; apps/web/src/pages/registrant/AttachmentLink.tsx.
- apps/web/src/routes/_app.admin.products.$id.tsx; apps/web/src/lib/query-client.ts; apps/web/test/session-contract.test.ts.
- docs/verification/2026-10-22-h4-admin-modules.md; apps/be/README.md; apps/web/README.md.

Không chỉnh migration0011/0012.

### HTTP contract

| Endpoint | Quyền và body/response |
|---|---|
| GET /admin/products | VIEW hiệu lực; ProductQuery bên dưới + meta; MANAGE thấy nháp, VIEW loại DRAFT trong WHERE trước count/paging. |
| GET /admin/products/:id | Cùng scope; metadata/registration/attachments/progress, không filePath/password; nháp không được phép trả404. |
| POST /admin/products | MANAGE; ProductWriteDto + registrantId + reason; chủ thể active verified REGISTRANT; không role/token giả. |
| PUT /admin/products/:id | MANAGE; ProductUpdateDto + reason; chỉ nháp; registrantId/createdById/status/score/snapshot không được nhận. |
| DELETE /admin/products/:id | MANAGE; {reason}; chỉ nháp; audit còn lại sau khi Product bị xóa. |
| POST /admin/products/:id/submit | MANAGE; {reason}; cùng form/locality/catalog validator với owner; không cho thời điểm/snapshot vào body. |
| GET /admin/products/:id/attachments | VIEW theo quyền hồ sơ; metadata[] không storage key. |
| POST /admin/products/:id/attachments | MANAGE + DRAFT; multipart file,reason; trả attachment metadata. |
| GET /admin/products/:id/attachments/:attachmentId | VIEW theo quyền hồ sơ; binary từ private storage. |
| DELETE /admin/products/:id/attachments/:attachmentId | MANAGE + DRAFT; {reason}. |
| GET /admin/products/:id/results | Giữ endpoint/logic H3; MANAGE thấy tiến độ/nháp phiếu hiện tại, VIEW chỉ SUBMITTED. |

Di chuyển GET products và GET products/:id/results từ AdminController sang AdminProductsController để không đăng ký trùng route. AdminProductsController inject AdminService cho read và ProductsService cho mutation/file; không thêm service chỉ làm wrapper.

~~~ts
export interface AdminProductQuery {
  page?: number; limit?: number; q?: string; groupId?: string; categoryId?: string;
  registrantId?: string; registrantQ?: string; localityId?: string; unmappedLocality?: boolean;
  status?: ProductStatus; registrationType?: ProductRegistrationType; assessmentYear?: number;
  dateBasis?: 'submittedAt' | 'completedAt'; from?: string; toExclusive?: string;
  starRating?: 1 | 2 | 3 | 4 | 5;
  sortBy?: 'submittedAt' | 'name' | 'finalScore'; sortDirection?: 'asc' | 'desc';
}
export type ProductMutationActor =
  | { kind: 'OWNER'; id: string }
  | { kind: 'MANAGER'; id: string; reason: string; meta: RequestMeta };
// Type aliases trong products.repository.ts; dates vẫn là Date của Prisma.
type DbProductDetail = Prisma.ProductGetPayload<{ include: typeof registrantProductInclude }>;
type DbAttachmentMetadata = Pick<Attachment, 'id' | 'type' | 'fileName' | 'createdAt'>;
// Repository mutation signatures after C1:
create(input: ProductDraftCreate, actor: ProductMutationActor): Promise<DbProductDetail>;
updateDraft(id: string, actor: ProductMutationActor, input: ProductDraftChanges): Promise<DbProductDetail | null>;
submitDraft(id: string, actor: ProductMutationActor): Promise<DbProductDetail | null>;
deleteDraft(id: string, actor: ProductMutationActor): Promise<string[] | null>;
addAttachment(id: string, actor: ProductMutationActor, file: StoredAttachmentInput): Promise<DbAttachmentMetadata | null>;
removeAttachment(id: string, attachmentId: string, actor: ProductMutationActor): Promise<string | null>;
~~~

ProductDraftCreate có registrantId,categoryId,name,description?,formData:Prisma.InputJsonValue,localityId?:string|null. ProductDraftChanges chỉ categoryId?,name?,description?,formData?:Prisma.InputJsonValue,localityId?:string|null. StoredAttachmentInput có type:'IMAGE'|'EVIDENCE',fileName:string,filePath:string như input hiện tại; RequestMeta từ src/types/auth.ts. Response type BE dùng Prisma inference, không dùng string ngày FE thay Date của Prisma.

ProductsService thêm createForAdmin(input,principal,meta), updateForAdmin(id,input,principal,meta), removeForAdmin(id,reason,principal,meta), submitForAdmin(id,reason,principal,meta), getForAdmin(id,principal), listAdminAttachments(id,principal), addAdminAttachment(id,file,reason,principal,meta), removeAdminAttachment(id,attachmentId,reason,principal,meta), getAdminAttachment(id,attachmentId,principal). principal là AuthenticatedPrincipal; input dùng AdminProductCreateDto/AdminProductUpdateDto; meta là RequestMeta; file là UploadedPrivateFile|undefined. Controller chuyển đúng DTO/principal/metadata; ProductsService tạo MANAGER actor có reason/meta từ request đã kiểm chứng. Hàm owner hiện có giữ public signature; chỉ thay cách gọi repository sang OWNER actor.

q/registrantQ trim<=100, ID<=100, assessmentYear2020..2100, boolean whitelist. dateBasis mặc định submittedAt; from/toExclusive phải cùng có, ISO có Z/offset và from<toExclusive. FE ngày lịch chuyển sang 00:00+07:00 và ngày kế tiếp trước khi gọi. Chỉ sort field allowlist, default submittedAt desc nulls last rồi id desc; score null luôn cuối, không đổi null thành0. localityId và unmappedLocality=true loại trừ nhau; starRating chỉ match COMPLETED. q tìm tên/ID/entityName, registrantQ tìm tên/email chủ thể trong cùng tập hồ sơ đã được phân quyền; VIEW không cần gọi /admin/users.

### Snapshot contract sản xuất cho H5

~~~ts
export interface RegistrationSnapshotV1 {
  version: 1; submittedAt: string;
  product: { id: string; name: string; description: string | null };
  registrant: { id: string; fullName: string; email: string; phone: string | null };
  category: { id: string; name: string; classificationGroup: string;
    classificationSubgroup: string | null; group: { id: string; code: string; name: string } };
  locality: { id: string; code: string; name: string; type: LocalityType; provinceName: string };
  formData: ProductApplicationForm;
}
~~~

Product.registrationSnapshot nullable JSON. Tạo snapshot bằng allowlist sau validate, không spread toàn bộ Prisma row/form JSON không kiểm chứng. Legacy Product giữ null và UI nhãn Chưa có thông tin lưu tại thời điểm nộp; không nhận field này từ FE. Detail owner/admin được đọc snapshot; public projection hiện có không thêm snapshot/contact/private data.

buildRegistrationSnapshot(input) nhận submittedAt:Date; product là Pick<Product,'id'|'name'|'description'|'formData'>; registrant là Pick<User,'id'|'fullName'|'email'|'phone'>; category là Pick<ProductCategory,'id'|'name'|'classificationGroup'|'classificationSubgroup'>; group là Pick<ProductGroup,'id'|'code'|'name'>; locality là Pick<Locality,'id'|'code'|'name'|'type'|'provinceName'>. Các model types lấy từ @prisma/client; output RegistrationSnapshotV1 với submittedAt.toISOString() và formData đã qua cùng validator nộp hiện có.

RegistrantProduct bổ sung localityId:string|null, locality:LocalityRecord|null, createdById:string|null, completedAt:string|null, registrationSnapshot:RegistrationSnapshotV1|null. AdminProductDetail mở rộng cùng record với registrant:{id,fullName,email,phone}, createdBy:{id,fullName}|null và statusEvents:{fromStatus,toStatus,sequence,actorId,reason,createdAt}[]. Progress/evaluations qua endpoint results hiện có, không đưa phiếu IN_PROGRESS vào response VIEW.

### Task C1: Dùng chung mutation owner/admin, locality và snapshot tại nộp

**Files:** schema/migration, ProductMutationActor, DTO products/admin-products, ProductsRepository/ProductsService, registration-snapshot, product-status; admin-products controller/register; BE specs trong file map. Reuse apps/be/src/utils/category-availability.ts từ B để kiểm bộ100 điểm.
**Consumes:** A verified-owner lookup/audit, B locality/categories, H3 locks/event/snapshots.
**Produces:** Create/edit/submit/delete admin và owner cùng invariant; snapshot version1 phục vụ H5.

- [ ] **Step 1 — Viết ca đỏ nhập hộ và snapshot.** Import withTestApp/adminFixture/draftPayload từ A.

~~~ts
it('keeps one owner-visible record and snapshots locality on manager submission', async () => {
  await withTestApp(async ({ app, prisma, baseUrl }) => {
    const f = await adminFixture(app, prisma, baseUrl);
    const category = await prisma.productCategory.findFirstOrThrow({ where: { isActive: true } });
    const created = await f.call('manager', '/admin/products', 'POST', {
      ...draftPayload(category.id, f.locality.id), registrantId: f.owner.id, reason: 'Enter on behalf',
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id;
    expect((await f.call('owner', '/my/products/' + id)).status).toBe(200);
    expect((await f.call('viewer', '/admin/products/' + id)).status).toBe(404);
    expect((await f.call('manager', '/admin/products/' + id + '/submit', 'POST',
      { reason: 'Submit on behalf' })).status).toBe(200);
    const before = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(before).toMatchObject({ registrantId: f.owner.id, createdById: f.manager.id,
      status: 'SUBMITTED', localityNameAtSubmit: f.locality.name });
    expect(before.registrationSnapshot).toMatchObject({
      version: 1, locality: { id: f.locality.id, name: f.locality.name },
    });
    await prisma.locality.update({ where: { id: f.locality.id }, data: { name: 'Renamed' } });
    const after = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(after.registrationSnapshot).toEqual(before.registrationSnapshot);
    const events = await prisma.productStatusEvent.findMany({ where: { productId: id } });
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.actorId === f.manager.id)).toBe(true);
  });
});
~~~

Thêm ca: draft formData={} và locality null lưu được nếu name/category hợp lệ; nộp thiếu locality/form400, inactive/out-of-effective locality409; owner/VIEW/SCORE không nhập hộ; owner khác404; chủ thể disabled/unverified hoặc nội bộ không làm chủ hồ sơ; PUT đổi owner/status/snapshot bị400; mọi mutation sau nộp409; retry không thêm event hoặc đổi submittedAt; snapshot/name/user/group đổi sau nộp không đổi JSON; audit lỗi rollback; null snapshot cũ giữ nguyên.

- [ ] **Step 2 — Chạy đỏ.**

~~~powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-products.db-spec.ts
~~~

- [ ] **Step 3 — Migration nullable, không tạo dữ liệu lịch sử giả.**

~~~sql
ALTER TABLE "products" ADD COLUMN "registrationSnapshot" JSONB;
~~~

Cập nhật schema/client/shared/DTO/types. Thêm localityId nullable cho nháp ở cả owner/admin DTO và output; field ở top-level, không giấu trong formData. Export RegistrationSnapshotV1 cho H5.

- [ ] **Step 4 — Thay caller thật bằng actor nội bộ và giữ transaction chung.** Owner service tạo {kind:'OWNER',id:principal.sub}; ProductsService admin tạo {kind:'MANAGER',id:principal.sub,reason,meta}. DTO không có actor/canManage/registrant token; manager create chọn registrantId được kiểm trong transaction. Không gọi service owner với principal giả.

Khóa group ID liên quan → category ID theo thứ tự → owner row khi cần kiểm active/verified → product row → locality row; đọc lại trạng thái/liên kết sau lock. Reuse lockEvaluationCategory/databaseObject, không raw SQL gắn public. Nhánh OWNER luôn có registrantId=actor.id trong WHERE; MANAGER bỏ ownership filter nhưng giữ DRAFT và guard DB-derived principal. Chỉ cho sửa locality cũ retired nếu giữ nguyên; đổi lựa chọn cần active/đúng hiệu lực.

~~~ts
const submittedAt = new Date();
const reason = actor.kind === 'MANAGER' ? actor.reason : undefined;
// Sau khóa product/locality và validate form/catalog/owner.
const registrationSnapshot = buildRegistrationSnapshot({
  product, registrant, category, group, locality, submittedAt,
});
await tx.product.update({ where: { id }, data: {
  status: 'SUBMITTED', submittedAt,
  localityCodeAtSubmit: locality.code, localityNameAtSubmit: locality.name,
  localityTypeAtSubmit: locality.type, provinceNameAtSubmit: locality.provinceName,
  registrationSnapshot,
} });
await recordProductStatusEvent(tx, id, 'DRAFT', 'SUBMITTED', actor.id, submittedAt, reason);
if (actor.kind === 'MANAGER') {
  await writeAudit(tx, { actorId: actor.id, action: 'product.submit_on_behalf',
    entityType: 'Product', entityId: id, beforeData: { status: 'DRAFT' },
    afterData: { status: 'SUBMITTED', registrantId: product.registrantId }, reason, ...actor.meta });
}
~~~

Audit admin create/update/delete/submit ghi before/after allowlist, actual actor/owner,reason,RequestMeta; không filePath/token. createdById chỉ đặt khi create, không thay khi người khác sửa; ProductStatusEvent chỉ ghi khi thực đổi trạng thái. Owner/admin dùng cùng required-form validator đang có, thêm locality kiểm trong tx; không thêm yêu cầu ảnh/minh chứng.

- [ ] **Step 5 — Cập nhật fixtures nộp mới với locality hợp lệ, chạy xanh và commit.** Direct DB fixtures cho hồ sơ lịch sử có thể null để kiểm dữ liệu cũ; không sửa fixture để né rule mới ở HTTP.

~~~powershell
pnpm --filter @ocop/api exec prisma generate
pnpm --filter @ocop/api exec prisma validate
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-products.db-spec.ts test/backend.db-spec.ts test/evaluation.db-spec.ts test/seed.db-spec.ts test/staff-access.db-spec.ts test/openapi.db-spec.ts
pnpm --filter @ocop/api test --runInBand
pnpm --filter @ocop/api typecheck
git diff --check
git add apps/be packages/shared/src/index.ts
git commit -m "feat(products): support audited admin drafts and registration snapshots"
~~~

### Task C2: Tìm kiếm/detail và binary nội bộ không lộ nháp

**Files:** AdminProductsController, admin DTO/service/repository, ProductsService/Repository/file paths hiện có; admin-products/admin-product-files/openapi DB specs; web/shared response types.
**Consumes:** C1 same-object policy, H3 effective permissions/evaluation visibility, private-storage/inspectProductUpload, trần20 tệp của baseline.
**Produces:** Read/filter/file endpoints của contract; inputs cho hai menu ở C3.

- [ ] **Step 1 — Viết ca đỏ count/paging theo quyền; fixture có một hồ sơ nhiều tệp và hai phiếu không được nhân bản.**

~~~ts
it('filters before paging/counting and keeps draft data out of VIEW', async () => {
  await withTestApp(async ({ app, prisma, baseUrl }) => {
    const f = await adminFixture(app, prisma, baseUrl);
    const category = await prisma.productCategory.findFirstOrThrow();
    await prisma.product.create({ data: { registrantId: f.owner.id,
      categoryId: category.id, name: 'Needle private', formData: {} } });
    const visible = await prisma.product.create({ data: { registrantId: f.owner.id,
      categoryId: category.id, name: 'Needle public', formData: {},
      status: 'SUBMITTED', submittedAt: new Date('2026-10-01T00:00:00+07:00') } });
    const result = await f.call('viewer', '/admin/products?q=Needle&limit=1&page=1');
    expect(result.status).toBe(200);
    expect(result.body.meta.total).toBe(1);
    expect(result.body.data.map((row: { id: string }) => row.id)).toEqual([visible.id]);
    expect(JSON.stringify(result.body)).not.toMatch(/filePath|password|tokenVersion/);
  });
});
~~~

Trong admin-product-files.db-spec.ts thêm các ca độc lập dùng f.headers và fetch để đọc binary; apiRequest chỉ dành JSON:
- Upload PNG/PDF đúng magic byte200/201; giả MIME/extension415; >10MiB413; field khác file400; file thứ21 là409 dưới khóa product.
- VIEW GET submitted evidence200; GET draft/mismatched attachment404; SCORE-only admin file403; owner khác qua /my cũng404; unauth401.
- Sau submit admin PUT/delete/upload/delete-file409; request bị từ chối dọn file UUID vừa lưu; không tạo thêm Attachment/audit khi fail.
- Upload/delete song song submit được serialize: submit trước thì mutation409, mutation trước thì snapshot nộp nhất quán; không attachment thay sau nộp.
- Không có endpoint filePath/static public; public evidence vẫn404, public ảnh SUBMITTED/SCORING vẫn hoạt động theo contract hiện tại.

- [ ] **Step 2 — Chạy đỏ rồi triển khai query/response allowlist.**

~~~powershell
pnpm --filter @ocop/api test:db --runTestsByPath test/admin-products.db-spec.ts test/admin-product-files.db-spec.ts
~~~

Dùng một ProductWhereInput cho findMany và count trong transaction isolation RepeatableRead để cùng snapshot trong một response, include quan hệ select không N+1. Không JOIN row ảnh/phiếu để paging Product. FROM/TO half-open, JSON registrationType/assessmentYear dùng Prisma path filter hoặc SQL tham số; không ghép sort/query string vào SQL. Ảnh đại diện chỉ metadata IMAGE hợp lệ, finalScore null giữ null. Kiểm nhóm/category/status/date cùng lúc trong WHERE.

~~~ts
const direction: Prisma.SortOrder = query.sortDirection ?? 'desc';
const orderBy: Prisma.ProductOrderByWithRelationInput[] = query.sortBy === 'name'
  ? [{ name: direction }, { id: direction }]
  : query.sortBy === 'finalScore'
    ? [{ finalScore: { sort: direction, nulls: 'last' } }, { id: direction }]
    : [{ submittedAt: { sort: direction, nulls: 'last' } }, { id: direction }];
~~~

Kiểm từng filter, combined filters, tie ID, trang cuối/rỗng, khoảng nửa kín và điểm chưa có. Không thêm index đoán trước; nếu query plan của truy vấn thực tế cần index, tạo migration kế tiếp có test giữ dữ liệu và ghi EXPLAIN trong biên bản.

- [ ] **Step 3 — Thêm handler tệp qua storage hiện tại.** Dùng FileInterceptor('file', productUploadOptions()), throttle20 request/phút như owner; guard MANAGE trước interceptor. ProductsService reuse kiểm magic bytes/path/max size, safe unlink khi error; repository giữ max20 trong cùng khóa product. Attachment response chỉ id,type,fileName,createdAt; admin file đọc phải kiểm Product+attachmentId+permission trước openStoredFile/asDownload. Cùng cơ chế dọn tệp khi delete nháp; lỗi I/O không giả báo thành công, không thêm queue mới.

- [ ] **Step 4 — Chạy xanh, toàn bộ regression DB, typecheck/build và commit.**

~~~powershell
pnpm --filter @ocop/api test:db
pnpm --filter @ocop/api test --runInBand
pnpm --filter @ocop/api typecheck
pnpm --filter @ocop/api build
git diff --check
git add apps/be packages/shared/src/index.ts
git commit -m "feat(admin): add product filtering and protected file access"
~~~

### Task C3: Hai menu, một editor và phục hồi upload lỗi một phần

**Files:** Toàn bộ web files C trong file map và verification/docs.
**Consumes:** A lookup REGISTRANT active verified; B locality/catalog lookup; C1/C2 admin API; owner API cùng DTO.
**Produces:** /admin/products, /admin/registrations, shared draft editor và tab chi tiết; owner editor giữ flow/UI mới ở main.

- [ ] **Step 1 — Tạo test đỏ cho orchestration thực sự, không thêm framework UI.** saveProductDraft có input existingProduct?,payload,files,commands; ID và số tệp hiện có lấy từ existingProduct, không giữ một existingId khác có thể lệch. ProductDraftCommands có create(payload),update(id,payload),upload(id,file),detail(id), đều là hàm nghiệp vụ trả ApiResult<RegistrantProduct hoặc ProductAttachmentRecord>. Hai implementation thật do hooks owner/admin nối vào; manager closure chứa registrantId/reason.

~~~ts
export interface ProductDraftCommands {
  create(payload: ProductWriteInput): Promise<ApiResult<RegistrantProduct>>;
  update(id: string, payload: ProductWriteInput): Promise<ApiResult<RegistrantProduct>>;
  upload(id: string, file: File): Promise<ApiResult<ProductAttachmentRecord>>;
  detail(id: string): Promise<ApiResult<RegistrantProduct>>;
}
export type DraftSaveResult =
  | { kind: 'saved'; product: RegistrantProduct }
  | { kind: 'upload-failed'; product: RegistrantProduct; message: string;
      requiresReview: boolean; remainingFiles: File[] };
export function saveProductDraft(input: {
  existingProduct?: RegistrantProduct; payload: ProductWriteInput;
  files: File[]; commands: ProductDraftCommands;
}): Promise<DraftSaveResult>;
~~~

~~~ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { saveProductDraft } from '../src/lib/save-product-draft';
import type { RegistrantProduct } from '../src/types/registrant';

it('keeps the created ID and first file after the second upload fails', async () => {
  const draft = { id: 'draft-1', attachments: [] } as unknown as RegistrantProduct;
  const first = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'one.png', { type: 'image/png' });
  const second = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'two.png', { type: 'image/png' });
  let creates = 0;
  let uploads = 0;
  const result = await saveProductDraft({
    payload: { name: 'Test', categoryId: 'category-1', formData: {} },
    files: [first, second],
    commands: {
      create: async () => { creates++; return { data: draft }; },
      update: async () => { throw new Error('Must not create twice'); },
      upload: async () => {
        uploads++;
        if (uploads === 2) throw new Error('Connection lost');
        return { data: { id: 'file-1', fileName: first.name, type: 'IMAGE' as const } };
      },
      detail: async () => ({ data: { ...draft,
        attachments: [{ id: 'file-1', fileName: first.name, type: 'IMAGE' as const }] } }),
    },
  });
  assert.equal(creates, 1);
  assert.equal(result.product.id, 'draft-1');
  assert.equal(result.product.attachments[0].id, 'file-1');
  assert.equal(result.kind, 'upload-failed');
  if (result.kind === 'upload-failed') {
    assert.equal(result.requiresReview, true);
    assert.deepEqual(result.remainingFiles, []);
  }
});
~~~

Thêm test: mọi file phải hợp lệ trước create/update; tổngexisting+selected<=20; deterministic4xx chỉ giữ các File chưa thành công, retry update ID cũ; network/5xx refetch thất bại vẫn giữ ID/file đã biết và yêu cầu kiểm tra; hai File khác nhau trùng tên/size/lastModified không bị dedupe nhầm; formData replace giữ toàn bộ field khi sửa một field.

- [ ] **Step 2 — Chạy đỏ và triển khai helper/hook bằng flow dưới.**

~~~powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-draft-save.test.ts
~~~

Validate toàn bộ selection trước write. Lưu draft một lần, nối từng attachment thành công vào product state. Khi upload fail: nếu lỗi network/5xx thì dừng, đọc lại detail, trả requiresReview=true và remainingFiles=[]; lỗi4xx trả requiresReview=false,remainingFiles là phần chưa thành công. Không tự upload lại, không nhận diện file theo tên như khóa duy nhất. Create mất response thì không tự retry; dẫn người dùng xem danh sách nháp trước khi tạo lại.

~~~ts
// Nhánh unknown upload outcome trong saveProductDraft.
let latest = product;
let refreshMessage = '';
try { latest = (await commands.detail(product.id)).data; }
catch (error) { refreshMessage = ' Chưa tải lại được hồ sơ: ' + messageOf(error); }
return {
  kind: 'upload-failed', product: latest, requiresReview: true, remainingFiles: [],
  message: 'Chưa xác nhận tải tệp. Kiểm tra danh sách tệp trước khi chọn lại.' + refreshMessage,
};
~~~

Query hooks chứa mutation retry:false, cache scope phân biệt owner/admin và quyền đọc nháp. saveProductDraft thuộc nghiệp vụ lưu hồ sơ, không trở thành generic CRUD engine. Editor dùng form library/components ở baseline, không thay lại giao diện bằng bản H3 cũ.

- [ ] **Step 3 — Gắn API, routes và UI.** adminProductsApi xuất list/detail/create/update/remove/submit/attachments/upload/attachment/removeAttachment/results; wrapper owner giữ myProductsApi. Query key chứa mode,canManage và full query; server response meta dùng ở cả hai list, không lọc từ20 dòng trên client.

/admin/products hiển thị ảnh,ID,tên,chủ thể,group/category,locality,năm khai báo,registrationType,submittedAt,status,score/stars khi COMPLETED. /admin/registrations dùng cùng dataset/API nhưng ưu tiên trường phiếu. Cả hai link cùng ID, Thêm/Sửa đều tới /admin/registrations/new hoặc /admin/registrations/$id/edit. MANAGE có nút ghi; VIEW không gọi owner lookup, không thấy nháp/nút tạo. Filter chủ thể cho VIEW dùng registrantQ/registrantId trên product query, không gọi user list.

AdminProductDetailPage dùng lại ở products/$id và registrations/$id, tabs Thông tin/Phiếu đăng ký/Tệp/Tiến độ/Kết quả; reuse AdminProductResultsPage. Parent detail route phải render Outlet cho nested edit để không nuốt trang editor. New/edit requirePermission('MANAGE'), list/detail requirePermission('VIEW'); đăng ký chủ thể vẫn guard REGISTRANT.

ProductDraftEditor nhận mode:'owner'|'admin',productId?; wrapper owner giữ URL cũ, wrapper admin thêm selector chủ thể từ useAdminUsers({kind:'REGISTRANT',isActive:true,verified:true,q,...}). Khi edit chỉ hiển thị chủ thể read-only. Catalog/locality lựa chọn active, nếu draft giữ retired value thì append disabled option+cảnh báo, không tự xóa giá trị. Không có địa bàn thì vẫn lưu nháp, nộp có hướng dẫn quản trị nhập danh mục thật.

Lookup chủ thể/địa bàn và bộ lọc admin phải hỗ trợ tìm/phân trang server; không coi20 hoặc100 kết quả đầu là toàn bộ danh mục. Giá trị đang chọn lấy từ detail vẫn hiển thị dù không thuộc trang lookup hiện tại. Địa chỉ/provinceName của form là liên hệ riêng, không ghi đè tự động bằng locality được chọn.

Private thumbnail dùng authorized Blob/object URL và revoke khi unmount; không dùng publicAttachmentUrl cho nháp/evidence. Upload-failed giữ form/ID/metadata và hiển thị kiểm tra tệp; nộp chặn khi trạng thái outcome chưa rõ. Sửa một field giữ full formData trước PUT; sau nộp field/file controls chỉ đọc.

- [ ] **Step 4 — Thu hồi cache nhạy cảm khi cùng user đổi quyền/token.** Sửa lib/query-client.ts subscription để clear query cache khi userId,accessToken hoặc normalized staffPermissions thay đổi, không chỉ userId. Mở rộng session-contract.test.ts kiểm cùng user mất MANAGE không còn cache user list/draft. Không xóa cache vì /auth/me cập nhật tên nhưng giữ token/quyền.

- [ ] **Step 5 — Chạy checks, browser acceptance, review và commit.**

~~~powershell
pnpm --filter @ocop/api exec node --import tsx --test ../web/test/product-draft-save.test.ts ../web/test/session-contract.test.ts ../web/test/product-editor-categories.test.ts
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec node test/api-boundary.check.mjs
pnpm --filter @ocop/web exec node test/api-integration.check.mjs
pnpm --filter @ocop/web exec node test/proxy.check.mjs
pnpm --filter @ocop/web build
git diff --check
git add apps/web apps/be/README.md docs/verification/2026-10-22-h4-admin-modules.md
git commit -m "feat(web): unify admin products and registration editing"
~~~

Browser fixture acceptance bắt buộc:
1. Manager tạo từ mỗi điểm vào; record xuất hiện ở cả hai list với cùng ID; owner thấy trong /my/products.
2. Nháp thiếu locality/form vẫn lưu; thêm locality hợp lệ và đủ form mới nộp; manager event/audit khác owner.
3. VIEW mở URL nháp và binary nháp thất bại, không owner lookup request; hồ sơ đã nộp đọc/tải được.
4. Upload hai file: file1 thành công, file2 mô phỏng disconnect/5xx; ID và file1 còn, metadata reload, không request upload thứ3 tự động; refetch fail có hướng mở hồ sơ kiểm tra.
5. Retire category/locality trong lúc mở editor: nháp vẫn giữ lựa chọn/cảnh báo, nộp409 giữ form; hồ sơ đã nộp không mất dữ liệu/snapshot.
6. Sửa/upload/delete/nộp đồng thời từ owner/admin giữ trạng thái và trần20; sau SUBMITTED cả hai UI/API đều không sửa.
7. Null score hiển thị —; filter từ hai menu khớp meta tổng và trang; phiên mất quyền không giữ draft/user cache.
8. PUBLIC SUBMITTED/SCORING chưa có điểm vẫn hiển thị; upload ảnh/minh chứng vẫn tùy chọn; owner editor/form mới không bị hồi quy.

## Self-review và bàn giao

PROD-01/REG-01..02 và phần binary/upload của FILE-01 có test DB và browser mapping cụ thể. H5 dùng RegistrationSnapshotV1 cùng Product ID cho registration-print-data; H4 không tự tạo trang in hoặc đánh dấu đã nghiệm thu PRINT-01..03/FILE-01 print-data. Nghiệm thu cuối H4 chạy ma trận và các lệnh trong kế hoạch tổng.
