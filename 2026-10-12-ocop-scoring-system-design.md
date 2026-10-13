# Thiết kế hệ thống chấm điểm OCOP

Ngày: 2026-10-12
Căn cứ: Quyết định 26/2026/QĐ-TTg — Bộ tiêu chí và quy trình đánh giá OCOP (giấy đăng ký tr.149–155, bộ tiêu chí 26 tiêu chí theo nhóm sản phẩm).

## 1. Mục tiêu

Hệ thống web cho phép:
- **Người đăng ký** tạo tài khoản, nộp hồ sơ đăng ký sản phẩm OCOP (theo mẫu giấy đăng ký tr.149–155), upload ảnh sản phẩm + file minh chứng (không bắt buộc).
- **Giám khảo** chấm sản phẩm theo bộ tiêu chí (26 tiêu chí, mỗi tiêu chí có các phần nhỏ với mức điểm cố định). Nhiều giám khảo chấm 1 sản phẩm, điểm cuối = trung bình.
- **Admin** tạo tài khoản giám khảo, phân công chấm theo nhóm sản phẩm (có thể giới hạn theo tiêu chí), xem kết quả.
- **Landing page** công khai hiển thị tất cả sản phẩm đã đăng ký kèm trạng thái chấm và xếp hạng sao.
- Hệ thống **tự xếp sao** theo điểm trung bình: ≥90 = 5★, 70–89 = 4★, 50–69 = 3★, 30–49 = 2★, <30 = 1★.
- Hỗ trợ **nhiều bộ tiêu chí** theo nhóm sản phẩm (thực phẩm, đồ uống, thảo dược, thủ công mỹ nghệ…) ngay từ đầu.

Không cần SEO (hệ thống chủ yếu nội bộ/nghiệp vụ).

## 2. Kiến trúc

Monorepo (pnpm workspace):

```
cham-diem-ocop/
├── apps/
│   ├── web/      # FE: TanStack Start + shadcn (từ base có sẵn của chủ dự án)
│   └── api/      # BE: NestJS + Prisma + PostgreSQL
├── packages/
│   └── shared/   # types/interface dùng chung
└── package.json
```

- FE gọi BE qua REST, prefix `/api`.
- Deploy: VPS VNPT Cloud, Node chạy cả web (TanStack Start server) và api; PostgreSQL cùng máy.
- File upload lưu disk local trên VPS, serve tĩnh qua NestJS. Chuyển S3 sau nếu cần.

## 3. Vai trò & xác thực

- 3 role: `REGISTRANT` (tự đăng ký), `JUDGE`, `ADMIN` (admin tạo).
- JWT (hạn 7 ngày) + bcrypt. Guard NestJS theo role.
- **Email OTP** cho: xác thực đăng ký tài khoản, quên mật khẩu.
  - Gửi qua nodemailer + SMTP Brevo (free tier), config bằng env.
  - OTP 6 số, hạn 5 phút, lưu bảng `OtpCode` trong Postgres (không cần Redis).
  - `OtpService` tách kênh gửi thành `MailChannel` / `SmsChannel` interface — giai đoạn 1 chỉ có mail; khi có brandname SMS (eSMS/VNPT SMS/Zalo ZNS) thì cắm `SmsChannel`, không sửa luồng.
- Bỏ qua giai đoạn 1: refresh token, social login.

## 4. Data model (Prisma)

```prisma
enum Role { REGISTRANT JUDGE ADMIN }
enum ProductStatus { DRAFT SUBMITTED SCORING COMPLETED }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String            // bcrypt hash
  fullName  String
  phone     String?
  role      Role     @default(REGISTRANT)
  verified  Boolean  @default(false)   // qua OTP
  products    Product[]
  assignments JudgeAssignment[]
  evaluations Evaluation[]
}

model OtpCode {
  id        String   @id @default(cuid())
  email     String
  code      String
  purpose   String            // REGISTER | RESET_PASSWORD
  expiresAt DateTime
  usedAt    DateTime?
}

model ProductCategory {        // nhóm: thực phẩm, đồ uống, thảo dược...
  id    String @id @default(cuid())
  name  String
  criteriaSet CriteriaSet?
  products    Product[]
}

model CriteriaSet {            // 1 bộ tiêu chí / nhóm sản phẩm
  id         String @id @default(cuid())
  categoryId String @unique
  criteria   Criterion[]
}

model Criterion {              // 26 tiêu chí
  id       String @id @default(cuid())
  setId    String
  code     String              // số thứ tự theo văn bản
  name     String
  maxScore Int
  order    Int
  subCriteria SubCriterion[]
}

model SubCriterion {           // phần nhỏ trong tiêu chí
  id          String @id @default(cuid())
  criterionId String
  content     String
  order       Int
  options     ScoreOption[]    // các mức điểm cố định
}

model ScoreOption {
  id             String @id @default(cuid())
  subCriterionId String
  label          String        // mô tả mức đạt
  points         Int
}

model Product {                // hồ sơ đăng ký (mẫu tr.149–155)
  id           String @id @default(cuid())
  registrantId String
  categoryId   String
  name         String
  description  String?
  formData     Json            // các trường còn lại của giấy đăng ký
  status       ProductStatus @default(DRAFT)
  finalScore   Float?
  starRating   Int?
  attachments  Attachment[]
  evaluations  Evaluation[]
}

model Attachment {
  id        String @id @default(cuid())
  productId String
  type      String             // IMAGE | EVIDENCE
  fileName  String
  filePath  String
}

model JudgeAssignment {
  judgeId      String
  categoryId   String
  criterionIds String[]        // rỗng = chấm tất cả tiêu chí của bộ
  @@id([judgeId, categoryId])
}

model Evaluation {             // 1 giám khảo × 1 sản phẩm
  id        String @id @default(cuid())
  judgeId   String
  productId String
  status    String             // IN_PROGRESS | SUBMITTED
  total     Int?
  scores    Score[]
  @@unique([judgeId, productId])
}

model Score {                  // điểm từng phần nhỏ
  evaluationId   String
  subCriterionId String
  optionId       String        // mức điểm giám khảo chọn
  note           String?
  @@id([evaluationId, subCriterionId])
}
```

Ghi chú:
- `formData Json`: giấy đăng ký nhiều trường văn bản không cần query riêng → Json. Trường cần query (tên, nhóm, trạng thái) là cột riêng.
- Giám khảo chọn `ScoreOption` thay vì gõ điểm tự do — khớp cách chấm theo mức của bộ tiêu chí OCOP.

## 5. Luồng chấm điểm

1. Người đăng ký nộp hồ sơ → `SUBMITTED`.
2. Giám khảo được phân công nhóm đó thấy sản phẩm trong hàng chờ; bắt đầu chấm → sản phẩm `SCORING`.
3. Giám khảo chọn mức điểm từng sub-criterion (chỉ các tiêu chí trong phân công nếu `criterionIds` giới hạn), lưu nháp tùy ý.
4. Nộp phiếu: BE kiểm đủ điểm cho mọi sub-criterion thuộc phạm vi phân công, tính `total`, khóa phiếu (`SUBMITTED`).
5. Khi **tất cả giám khảo được phân công vào nhóm của sản phẩm** đã nộp phiếu: `finalScore` = trung bình các `total`, map sao (≥90=5, 70–89=4, 50–69=3, 30–49=2, <30=1), sản phẩm → `COMPLETED`.
6. Trường hợp giám khảo chỉ chấm một phần tiêu chí (phân công theo tiêu chí): tổng điểm 1 "lượt chấm đầy đủ" = gộp điểm các phiếu phủ đủ 26 tiêu chí; điểm trung bình tính trên điểm gộp. Giai đoạn 1 đơn giản hóa: nếu dùng phân công theo tiêu chí, admin chịu trách nhiệm phân công sao cho các giám khảo phủ đủ bộ tiêu chí; hệ thống cộng gộp theo tiêu chí rồi chia trung bình trên từng tiêu chí trước khi cộng tổng.

## 6. API (NestJS, prefix `/api`)

**Auth**
- `POST /auth/register` → tạo user chưa verified + gửi OTP email
- `POST /auth/verify-otp` → kích hoạt tài khoản
- `POST /auth/login` → JWT (chỉ user verified)
- `POST /auth/forgot-password` → gửi OTP
- `POST /auth/reset-password` (email + OTP + mật khẩu mới)
- `GET /auth/me`

**Public**
- `GET /categories`
- `GET /products` — phân trang, lọc nhóm; trả tên, ảnh, nhóm, trạng thái, sao
- `GET /products/:id` — chi tiết công khai (ẩn formData nhạy cảm: thông tin liên hệ, giấy tờ)

**Registrant**
- `GET /my/products`
- `POST /my/products` (DRAFT)
- `PUT /my/products/:id` (chỉ khi DRAFT)
- `POST /my/products/:id/submit`
- `POST /my/products/:id/attachments` — multer, disk, max 10MB/file, mime: ảnh + pdf
- `DELETE /my/products/:id/attachments/:attId` (chỉ khi DRAFT)

**Judge**
- `GET /judge/products` — theo phân công, trạng thái SUBMITTED/SCORING
- `GET /judge/products/:id/evaluation` — phiếu chấm (tiêu chí trong phạm vi + điểm đã lưu)
- `PUT /judge/products/:id/evaluation` — lưu nháp
- `POST /judge/products/:id/evaluation/submit`

**Admin**
- `GET/POST/PUT/DELETE /admin/judges`
- `POST /admin/judges/:id/reset-password`
- `GET/PUT /admin/assignments`
- `GET /admin/products` — tất cả hồ sơ, mọi trạng thái
- `GET /admin/products/:id/results` — bảng điểm từng giám khảo + trung bình + sao

Validation: class-validator DTO. Lỗi trả chuẩn `{statusCode, message}`.

Quản lý tiêu chí (categories/criteria) qua **seed script**, không làm UI quản trị tiêu chí — tiêu chí là văn bản pháp quy, ít thay đổi.

## 7. Màn hình (TanStack Start + shadcn)

**Public**
- `/` — landing: hero giới thiệu OCOP, grid sản phẩm (ảnh, tên, nhóm, badge trạng thái/sao), lọc theo nhóm
- `/products/:id` — chi tiết công khai
- `/login`, `/register` (+ bước OTP), `/forgot-password`

**Registrant** (`/my`)
- `/my/products` — hồ sơ của tôi + trạng thái
- `/my/products/new` và `/my/products/:id/edit` — form nhiều bước theo mẫu tr.149–155: thông tin chủ thể → thông tin sản phẩm → upload → xem lại → nộp. Lưu nháp.

**Judge** (`/judge`)
- `/judge` — hàng chờ chấm
- `/judge/products/:id` — phiếu chấm: sidebar tiêu chí, radio mức điểm từng phần nhỏ + ghi chú, tổng điểm realtime, Lưu nháp / Nộp

**Admin** (`/admin`)
- `/admin/judges`, `/admin/assignments`, `/admin/products` (+ xem bảng điểm chi tiết)

Route guard theo role trong JWT. Form: react-hook-form + zod.

## 8. Seed bộ tiêu chí

- Trích từ PDF Quyết định 26/2026/QĐ-TTg: mỗi nhóm sản phẩm 1 bộ (26 tiêu chí → sub-criteria → mức điểm) thành file JSON trong `apps/api/prisma/seed-data/`.
- `prisma db seed` nạp categories + criteria sets.
- Mẫu giấy đăng ký (tr.149–155) → định nghĩa schema zod cho `formData` của form nhiều bước.

## 9. Kiểm thử

- e2e API (Jest + supertest): auth + OTP, nộp hồ sơ, phân công, chấm + nộp phiếu, tính trung bình + xếp sao (các ngưỡng biên 90/70/50/30).
- Unit cho hàm tính điểm gộp/trung bình/map sao.
- FE: kiểm tra tay giai đoạn 1.

## 10. Ngoài phạm vi giai đoạn 1

SMS OTP (đã chừa `SmsChannel`), refresh token, social login
UI quản trị tiêu chí
S3/object storage
Thông báo email tiến độ chấm
SEO/SSR tối ưu công khai
