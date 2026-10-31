import { ProductStatus, Role } from '@prisma/client';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MailService } from '../src/services/mail.service';
import { apiRequest, withTestApp } from './support/db-app';
import {
  buildHoneyScores,
  HONEY_E2E_POINTS,
  scenarioBuffers,
  type ScenarioCriterion,
} from './support/scenario-files';

const HONEY_CATEGORY_ID = 'honey-and-other-agri-food';

async function uploadRegistrantAttachment(
  baseUrl: string,
  token: string,
  productId: string,
  options: { name: string; mime: string; data: Buffer },
) {
  const form = new FormData();
  const bytes = new ArrayBuffer(options.data.byteLength);
  new Uint8Array(bytes).set(options.data);
  form.append('file', new Blob([bytes], { type: options.mime }), options.name);
  const response = await fetch(
    `${baseUrl}/api/my/products/${productId}/attachments`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    },
  );
  return {
    status: response.status,
    body: (await response.json()) as {
      data?: { id: string; type: string; fileName: string };
      message?: string;
    },
  };
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

describe('OCOP E2E honey flow, judge scoring, and public privacy (E2E-01..06, JDG-01..06, SCORE-01, SCORE-04, PUB-01..02)', () => {
  it('executes E2E-01..06 end-to-end and verifies JDG-01..06, SCORE-01, SCORE-04, PUB-01..02', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const otpInbox = new Map<string, string>();
      app.get(MailService).sendOtp = async (email, code, purpose) => {
        otpInbox.set(`${email}:${purpose}`, code);
      };

      // Seed an active verified Admin (MANAGE + VIEW)
      const adminPassword = 'AdminPassword@2026!';
      await prisma.user.create({
        data: {
          email: 'admin@ocop.test',
          password: await bcrypt.hash(adminPassword, 4),
          fullName: 'Quản trị hệ thống',
          role: Role.ADMIN,
          staffPermissions: ['MANAGE', 'VIEW'],
          verified: true,
          isActive: true,
        },
      });
      const adminLogin = await apiRequest<{ data: { accessToken: string } }>(
        baseUrl,
        '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'admin@ocop.test',
            password: adminPassword,
          }),
        },
      );
      expect(adminLogin.status).toBe(200);
      const adminToken = adminLogin.body.data.accessToken;

      // =========================================================================
      // E2E-01: Registrant registers, verifies OTP, logs in, sees empty products
      // =========================================================================
      const registrantEmail = 'htx.uminh@ocop.test';
      const registrantPassword = 'Chuthe@2026';

      const regRes = await apiRequest<{ data: { registrationToken: string } }>(baseUrl, '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registrantEmail,
          password: registrantPassword,
          fullName: 'Hợp tác xã Mật ong rừng U Minh Hạ',
          phone: '0912345678',
        }),
      });
      expect(regRes.status).toBe(200);

      expect(await prisma.user.findUnique({ where: { email: registrantEmail } })).toBeNull();
      const pending = await prisma.pendingAuth.findUniqueOrThrow({
        where: { tokenHash: createHash('sha256').update(regRes.body.data.registrationToken).digest('hex') },
      });
      const otpCode = otpInbox.get(`${registrantEmail}:REGISTER`);
      expect(otpCode).toMatch(/^\d{6}$/);
      expect(pending.otpHash).toBeTruthy();
      expect(pending.otpHash).not.toBe(otpCode);

      const verifyRes = await apiRequest(baseUrl, '/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationToken: regRes.body.data.registrationToken, code: otpCode }),
      });
      expect(verifyRes.status).toBe(200);

      const registrantLogin = await apiRequest<{
        data: { accessToken: string };
      }>(baseUrl, '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registrantEmail,
          password: registrantPassword,
        }),
      });
      expect(registrantLogin.status).toBe(200);
      const registrantToken = registrantLogin.body.data.accessToken;

      const emptyProducts = await apiRequest<{ data: unknown[] }>(
        baseUrl,
        '/my/products',
        { headers: authHeaders(registrantToken) },
      );
      expect(emptyProducts.status).toBe(200);
      expect(emptyProducts.body.data).toEqual([]);

      // =========================================================================
      // E2E-02: Admin creates SNNMT & SCT units, XP-UMINH-01 locality, and judges
      // =========================================================================
      const unitSnnmtRes = await apiRequest<{ data: { id: string; code: string } }>(
        baseUrl,
        '/admin/organization-units',
        {
          method: 'POST',
          headers: authHeaders(adminToken),
          body: JSON.stringify({
            code: 'SNNMT',
            name: 'Sở Nông nghiệp và Môi trường',
            order: 1,
            isActive: true,
            reason: 'Tạo đơn vị SNNMT phục vụ hội đồng OCOP',
          }),
        },
      );
      expect(unitSnnmtRes.status).toBe(201);
      const unitSnnmtId = unitSnnmtRes.body.data.id;

      const unitSctRes = await apiRequest<{ data: { id: string; code: string } }>(
        baseUrl,
        '/admin/organization-units',
        {
          method: 'POST',
          headers: authHeaders(adminToken),
          body: JSON.stringify({
            code: 'SCT',
            name: 'Sở Công Thương',
            order: 2,
            isActive: true,
            reason: 'Tạo đơn vị SCT phục vụ hội đồng OCOP',
          }),
        },
      );
      expect(unitSctRes.status).toBe(201);
      const unitSctId = unitSctRes.body.data.id;

      const localityRes = await apiRequest<{ data: { id: string; code: string } }>(
        baseUrl,
        '/admin/localities',
        {
          method: 'POST',
          headers: authHeaders(adminToken),
          body: JSON.stringify({
            code: 'XP-UMINH-01',
            name: 'Xã Khánh An',
            type: 'COMMUNE',
            provinceName: 'Tỉnh Cà Mau',
            effectiveFrom: '2020-01-01T00:00:00+07:00',
            isActive: true,
            reason: 'Khởi tạo danh mục địa bàn Xã Khánh An',
          }),
        },
      );
      expect(localityRes.status).toBe(201);
      const localityId = localityRes.body.data.id;

      const judge1Password = 'Judge1Ocop@2026!';
      const judge1Res = await apiRequest<{
        data: {
          id: string;
          email: string;
          verified: boolean;
          isActive: boolean;
          staffPermissions: string[];
        };
      }>(baseUrl, '/admin/users', {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          email: 'judge1@ocop.test',
          fullName: 'Giám khảo 1',
          phone: '0901000001',
          password: judge1Password,
          organizationUnitId: unitSnnmtId,
          staffPermissions: ['SCORE'],
          reason: 'Bổ sung giám khảo 1 thuộc SNNMT',
        }),
      });
      expect(judge1Res.status).toBe(201);
      expect(judge1Res.body.data).toMatchObject({
        email: 'judge1@ocop.test',
        verified: true,
        isActive: true,
        staffPermissions: ['SCORE'],
      });
      const judge1Id = judge1Res.body.data.id;

      const judge2Password = 'Judge2Ocop@2026!';
      const judge2Res = await apiRequest<{
        data: {
          id: string;
          email: string;
          verified: boolean;
          isActive: boolean;
          staffPermissions: string[];
        };
      }>(baseUrl, '/admin/users', {
        method: 'POST',
        headers: authHeaders(adminToken),
        body: JSON.stringify({
          email: 'judge2@ocop.test',
          fullName: 'Giám khảo 2',
          phone: '0901000002',
          password: judge2Password,
          organizationUnitId: unitSctId,
          staffPermissions: ['SCORE'],
          reason: 'Bổ sung giám khảo 2 thuộc SCT',
        }),
      });
      expect(judge2Res.status).toBe(201);
      expect(judge2Res.body.data).toMatchObject({
        email: 'judge2@ocop.test',
        verified: true,
        isActive: true,
        staffPermissions: ['SCORE'],
      });
      const judge2Id = judge2Res.body.data.id;

      // =========================================================================
      // E2E-03: Admin assigns judge1 and judge2 full scope on honey-and-other-agri-food
      // =========================================================================
      const assignRes = await apiRequest<{ data: unknown[] }>(
        baseUrl,
        '/admin/assignments',
        {
          method: 'PUT',
          headers: authHeaders(adminToken),
          body: JSON.stringify({
            assignments: [
              {
                judgeId: judge1Id,
                categoryId: HONEY_CATEGORY_ID,
                criterionIds: [],
              },
              {
                judgeId: judge2Id,
                categoryId: HONEY_CATEGORY_ID,
                criterionIds: [],
              },
            ],
          }),
        },
      );
      expect(assignRes.status).toBe(200);
      expect(assignRes.body.data).toHaveLength(2);

      // =========================================================================
      // E2E-04 & PUB-01 & PUB-02: Registrant creates draft, uploads JPG & PDF, submits
      // =========================================================================
      const sampleFormData = {
        entityName: 'Hợp tác xã Mật ong rừng U Minh Hạ',
        representativeName: 'Nguyễn Văn An',
        representativeTitle: 'Giám đốc Hợp tác xã',
        contactAddress: 'Ấp 3, Xã Khánh An, Huyện U Minh, Tỉnh Cà Mau',
        provinceName: 'Tỉnh Cà Mau',
        phone: '0912345678',
        email: 'htx.uminh@ocop.test',
        registrationType: 'FIRST',
        sampleQuantity: 6,
        assessmentYear: 2026,
        declarationAccepted: true,
      };

      const createDraftRes = await apiRequest<{
        data: { id: string; status: string };
      }>(baseUrl, '/my/products', {
        method: 'POST',
        headers: authHeaders(registrantToken),
        body: JSON.stringify({
          name: 'Mật ong rừng tràm U Minh nguyên chất 500ml',
          categoryId: HONEY_CATEGORY_ID,
          localityId,
          description:
            'Mật ong khai thác tự nhiên từ rừng tràm U Minh Hạ, đóng chai thủy tinh 500ml, có truy xuất nguồn gốc QR và chứng nhận ATTP.',
          formData: sampleFormData,
        }),
      });
      expect(createDraftRes.status).toBe(201);
      expect(createDraftRes.body.data.status).toBe(ProductStatus.DRAFT);
      const productId = createDraftRes.body.data.id;

      const jpgUpload = await uploadRegistrantAttachment(
        baseUrl,
        registrantToken,
        productId,
        {
          name: 'anh-chai-mat-ong.jpg',
          mime: 'image/jpeg',
          data: scenarioBuffers.validJpg(),
        },
      );
      expect(jpgUpload.status).toBe(201);
      expect(jpgUpload.body.data).toMatchObject({
        type: 'IMAGE',
        fileName: 'anh-chai-mat-ong.jpg',
      });
      const jpgId = jpgUpload.body.data!.id;

      const pdfUpload = await uploadRegistrantAttachment(
        baseUrl,
        registrantToken,
        productId,
        {
          name: 'giay-chung-nhan-attp.pdf',
          mime: 'application/pdf',
          data: scenarioBuffers.validPdf(),
        },
      );
      expect(pdfUpload.status).toBe(201);
      expect(pdfUpload.body.data).toMatchObject({
        type: 'EVIDENCE',
        fileName: 'giay-chung-nhan-attp.pdf',
      });
      const pdfId = pdfUpload.body.data!.id;

      // PUB-02: While DRAFT, public detail and public image return 404
      const draftPublicDetail = await apiRequest(
        baseUrl,
        `/products/${productId}`,
      );
      expect(draftPublicDetail.status).toBe(404);
      const draftPublicImage = await fetch(
        `${baseUrl}/api/products/${productId}/attachments/${jpgId}`,
      );
      expect(draftPublicImage.status).toBe(404);

      // Submit product (E2E-04)
      const submitProductRes = await apiRequest<{
        data: { id: string; status: string; submittedAt: string };
      }>(baseUrl, `/my/products/${productId}/submit`, {
        method: 'POST',
        headers: authHeaders(registrantToken),
      });
      expect(submitProductRes.status).toBe(201);
      expect(submitProductRes.body.data.status).toBe(ProductStatus.SUBMITTED);
      expect(submitProductRes.body.data.submittedAt).toBeTruthy();

      // PUB-02: After submit, public GET /products/:id returns 200 with IMAGE only, no formData, no EVIDENCE PDF
      const publicDetail = await apiRequest<{
        data: {
          id: string;
          name: string;
          status: string;
          attachments: Array<{ id: string; fileName: string; type?: string }>;
          formData?: unknown;
        };
      }>(baseUrl, `/products/${productId}`);
      expect(publicDetail.status).toBe(200);
      expect(publicDetail.body.data).toMatchObject({
        id: productId,
        name: 'Mật ong rừng tràm U Minh nguyên chất 500ml',
        status: ProductStatus.SUBMITTED,
        attachments: [{ id: jpgId, fileName: 'anh-chai-mat-ong.jpg' }],
      });
      expect(publicDetail.body.data).not.toHaveProperty('formData');
      expect(JSON.stringify(publicDetail.body.data)).not.toContain(
        '0912345678',
      );
      expect(JSON.stringify(publicDetail.body.data)).not.toContain(
        'Nguyễn Văn An',
      );
      expect(JSON.stringify(publicDetail.body.data)).not.toContain(pdfId);
      expect(
        (
          await fetch(
            `${baseUrl}/api/products/${productId}/attachments/${pdfId}`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await fetch(
            `${baseUrl}/api/products/${productId}/attachments/${jpgId}`,
          )
        ).status,
      ).toBe(200);

      // PUB-01: Case-insensitive search and pagination on public GET /products
      const publicSearch = await apiRequest<{
        data: Array<{ id: string }>;
        meta: { page: number; limit: number; total: number; totalPages: number };
      }>(
        baseUrl,
        `/products?q=${encodeURIComponent('u minh nguyên chất')}&categoryId=${HONEY_CATEGORY_ID}&page=1&limit=10`,
      );
      expect(publicSearch.status).toBe(200);
      expect(publicSearch.body.data.map((p) => p.id)).toEqual([productId]);
      expect(publicSearch.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });

      const publicPage2 = await apiRequest<{
        data: Array<{ id: string }>;
        meta: { page: number; limit: number; total: number };
      }>(baseUrl, `/products?page=2&limit=1`);
      expect(publicPage2.status).toBe(200);
      expect(publicPage2.body.data).toEqual([]);
      expect(publicPage2.body.meta).toMatchObject({
        page: 2,
        limit: 1,
        total: 1,
      });

      // =========================================================================
      // E2E-05 & JDG-01..05: Judge 1 queue, partial draft (31/32), 409 submit, full 32/32 (82 pts), 409 repeat
      // =========================================================================
      const judge1Login = await apiRequest<{ data: { accessToken: string } }>(
        baseUrl,
        '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'judge1@ocop.test',
            password: judge1Password,
          }),
        },
      );
      expect(judge1Login.status).toBe(200);
      const judge1Token = judge1Login.body.data.accessToken;

      const judge2Login = await apiRequest<{ data: { accessToken: string } }>(
        baseUrl,
        '/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'judge2@ocop.test',
            password: judge2Password,
          }),
        },
      );
      expect(judge2Login.status).toBe(200);
      const judge2Token = judge2Login.body.data.accessToken;

      // JDG-01: Judge 1 queue contains the submitted honey product (and excludes drafts/unassigned categories)
      const otherCategory = await prisma.productCategory.findFirstOrThrow({
        where: { id: { not: HONEY_CATEGORY_ID }, isActive: true },
      });
      await prisma.product.createMany({
        data: [
          {
            registrantId: (
              await prisma.user.findUniqueOrThrow({
                where: { email: registrantEmail },
              })
            ).id,
            categoryId: HONEY_CATEGORY_ID,
            name: 'Bản nháp mật ong không hiện trên hàng chờ',
            status: ProductStatus.DRAFT,
            formData: {},
          },
          {
            registrantId: (
              await prisma.user.findUniqueOrThrow({
                where: { email: registrantEmail },
              })
            ).id,
            categoryId: otherCategory.id,
            name: 'Hồ sơ ngoài phân công',
            status: ProductStatus.SUBMITTED,
            formData: {},
          },
        ],
      });

      const judge1Queue = await apiRequest<{
        data: Array<{ id: string; status: string }>;
      }>(baseUrl, '/judge/products', { headers: authHeaders(judge1Token) });
      expect(judge1Queue.status).toBe(200);
      expect(judge1Queue.body.data.map((p) => p.id)).toEqual([productId]);

      // Load evaluation sheet and verify 12 criteria, 32 subcriteria
      const judge1Sheet = await apiRequest<{
        data: {
          criteria: ScenarioCriterion[];
          evaluation: { status: string; scores: unknown[] };
        };
      }>(baseUrl, `/judge/products/${productId}/evaluation`, {
        headers: authHeaders(judge1Token),
      });
      expect(judge1Sheet.status).toBe(200);
      const criteria = judge1Sheet.body.data.criteria;
      expect(criteria).toHaveLength(12);
      const allSubCriteria = criteria.flatMap((c) => c.subCriteria);
      expect(allSubCriteria).toHaveLength(32);
      expect(Object.keys(HONEY_E2E_POINTS)).toHaveLength(32);

      const gk1FullScores = buildHoneyScores(criteria, 'gk1', undefined, {
        '1.1': 'Minh chứng rõ ràng',
      });
      expect(gk1FullScores).toHaveLength(32);

      // JDG-02: Judge 1 saves 31/32 subcriteria with note -> product transitions to SCORING
      const gk1PartialScores = gk1FullScores.slice(0, 31);
      const savePartialRes = await apiRequest<{
        data: { id: string; status: string };
      }>(baseUrl, `/judge/products/${productId}/evaluation`, {
        method: 'PUT',
        headers: authHeaders(judge1Token),
        body: JSON.stringify({ scores: gk1PartialScores }),
      });
      expect(savePartialRes.status).toBe(200);

      const reloadAfterPartial = await apiRequest<{
        data: {
          evaluation: {
            status: string;
            scores: Array<{ subCriterionId: string; note: string | null }>;
          };
        };
      }>(baseUrl, `/judge/products/${productId}/evaluation`, {
        headers: authHeaders(judge1Token),
      });
      expect(reloadAfterPartial.status).toBe(200);
      expect(reloadAfterPartial.body.data.evaluation.scores).toHaveLength(31);
      expect(reloadAfterPartial.body.data.evaluation.scores).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ note: 'Minh chứng rõ ràng' }),
        ]),
      );

      const productInScoring = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(productInScoring.status).toBe(ProductStatus.SCORING);

      // JDG-05: Submitting with 31/32 subcriteria returns 409 'Score every assigned subcriterion before submitting'
      const incompleteSubmitRes = await apiRequest<{ message: string }>(
        baseUrl,
        `/judge/products/${productId}/evaluation/submit`,
        {
          method: 'POST',
          headers: authHeaders(judge1Token),
        },
      );
      expect(incompleteSubmitRes.status).toBe(409);
      expect(incompleteSubmitRes.body.message).toContain(
        'Score every assigned subcriterion before submitting',
      );

      // E2E-05: Judge 1 saves all 32 subcriteria (total 82) and submits
      const saveFullGk1Res = await apiRequest(
        baseUrl,
        `/judge/products/${productId}/evaluation`,
        {
          method: 'PUT',
          headers: authHeaders(judge1Token),
          body: JSON.stringify({ scores: gk1FullScores }),
        },
      );
      expect(saveFullGk1Res.status).toBe(200);

      const submitGk1Res = await apiRequest<{
        data: { id: string; status: string; total: number };
      }>(baseUrl, `/judge/products/${productId}/evaluation/submit`, {
        method: 'POST',
        headers: authHeaders(judge1Token),
      });
      expect(submitGk1Res.status).toBe(201);
      expect(submitGk1Res.body.data).toMatchObject({
        status: 'SUBMITTED',
        total: 82,
      });

      const afterGk1Product = await prisma.product.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(afterGk1Product).toMatchObject({
        status: ProductStatus.SCORING,
        finalScore: null,
        starRating: null,
      });

      // JDG-04: Repeat save or submit on Judge 1's submitted evaluation returns 409
      const repeatSaveGk1 = await apiRequest(
        baseUrl,
        `/judge/products/${productId}/evaluation`,
        {
          method: 'PUT',
          headers: authHeaders(judge1Token),
          body: JSON.stringify({ scores: gk1FullScores }),
        },
      );
      expect(repeatSaveGk1.status).toBe(409);

      const repeatSubmitGk1 = await apiRequest(
        baseUrl,
        `/judge/products/${productId}/evaluation/submit`,
        {
          method: 'POST',
          headers: authHeaders(judge1Token),
        },
      );
      expect(repeatSubmitGk1.status).toBe(409);

      // =========================================================================
      // E2E-06: Judge 2 saves all 32 subcriteria (total 76) and submits -> COMPLETED, 79 pts, 4 stars
      // =========================================================================
      const gk2FullScores = buildHoneyScores(criteria, 'gk2');
      const saveFullGk2Res = await apiRequest(
        baseUrl,
        `/judge/products/${productId}/evaluation`,
        {
          method: 'PUT',
          headers: authHeaders(judge2Token),
          body: JSON.stringify({ scores: gk2FullScores }),
        },
      );
      expect(saveFullGk2Res.status).toBe(200);

      const submitGk2Res = await apiRequest<{
        data: { id: string; status: string; total: number };
      }>(baseUrl, `/judge/products/${productId}/evaluation/submit`, {
        method: 'POST',
        headers: authHeaders(judge2Token),
      });
      expect(submitGk2Res.status).toBe(201);
      expect(submitGk2Res.body.data).toMatchObject({
        status: 'SUBMITTED',
        total: 76,
      });

      // Verify finalScore = 79 and starRating = 4 across Registrant, Admin, and Public endpoints
      const registrantProduct = await apiRequest<{
        data: { status: string; finalScore: number; starRating: number };
      }>(baseUrl, `/my/products/${productId}`, {
        headers: authHeaders(registrantToken),
      });
      expect(registrantProduct.status).toBe(200);
      expect(registrantProduct.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 79,
        starRating: 4,
      });

      const adminProductDetail = await apiRequest<{
        data: { status: string; finalScore: number; starRating: number };
      }>(baseUrl, `/admin/products/${productId}`, {
        headers: authHeaders(adminToken),
      });
      expect(adminProductDetail.status).toBe(200);
      expect(adminProductDetail.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 79,
        starRating: 4,
      });

      const adminProductResults = await apiRequest<{
        data: {
          status: string;
          finalScore: number;
          starRating: number;
          evaluations: Array<{ total: number; status: string }>;
        };
      }>(baseUrl, `/admin/products/${productId}/results`, {
        headers: authHeaders(adminToken),
      });
      expect(adminProductResults.status).toBe(200);
      expect(adminProductResults.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 79,
        starRating: 4,
      });
      expect(
        adminProductResults.body.data.evaluations
          .map((e) => e.total)
          .sort((a, b) => a - b),
      ).toEqual([76, 82]);

      const completedPublicDetail = await apiRequest<{
        data: { status: string; finalScore: number; starRating: number };
      }>(baseUrl, `/products/${productId}`);
      expect(completedPublicDetail.status).toBe(200);
      expect(completedPublicDetail.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 79,
        starRating: 4,
      });

      // =========================================================================
      // JDG-06 & SCORE-01 & SCORE-04: Second honey product, concurrent submit (85 & 78 -> 81.5), immutable after COMPLETED
      // =========================================================================
      const createSecondRes = await apiRequest<{ data: { id: string } }>(
        baseUrl,
        '/my/products',
        {
          method: 'POST',
          headers: authHeaders(registrantToken),
          body: JSON.stringify({
            name: 'Mật ong rừng tràm U Minh Hạ lô 2 (SCORE-01)',
            categoryId: HONEY_CATEGORY_ID,
            localityId,
            description: 'Hồ sơ kiểm thử nộp đồng thời và tính trung bình 81.5 điểm.',
            formData: sampleFormData,
          }),
        },
      );
      expect(createSecondRes.status).toBe(201);
      const secondProductId = createSecondRes.body.data.id;

      const submitSecondRes = await apiRequest(
        baseUrl,
        `/my/products/${secondProductId}/submit`,
        {
          method: 'POST',
          headers: authHeaders(registrantToken),
        },
      );
      expect(submitSecondRes.status).toBe(201);

      // GK1 overrides subcriterion '7' -> 3 points (82 + 3 = 85)
      // GK2 overrides subcriterion '6.3' -> 4 points (76 - 2 + 4 = 78)
      const gk1Scores85 = buildHoneyScores(criteria, 'gk1', { '7': 3 });
      const gk2Scores78 = buildHoneyScores(criteria, 'gk2', { '6.3': 4 });

      expect(
        (
          await apiRequest(
            baseUrl,
            `/judge/products/${secondProductId}/evaluation`,
            {
              method: 'PUT',
              headers: authHeaders(judge1Token),
              body: JSON.stringify({ scores: gk1Scores85 }),
            },
          )
        ).status,
      ).toBe(200);

      expect(
        (
          await apiRequest(
            baseUrl,
            `/judge/products/${secondProductId}/evaluation`,
            {
              method: 'PUT',
              headers: authHeaders(judge2Token),
              body: JSON.stringify({ scores: gk2Scores78 }),
            },
          )
        ).status,
      ).toBe(200);

      // JDG-06: Both judges submit concurrently
      const [concurrent1, concurrent2] = await Promise.all([
        apiRequest<{ data: { total: number; status: string } }>(
          baseUrl,
          `/judge/products/${secondProductId}/evaluation/submit`,
          {
            method: 'POST',
            headers: authHeaders(judge1Token),
          },
        ),
        apiRequest<{ data: { total: number; status: string } }>(
          baseUrl,
          `/judge/products/${secondProductId}/evaluation/submit`,
          {
            method: 'POST',
            headers: authHeaders(judge2Token),
          },
        ),
      ]);
      expect(concurrent1.status).toBe(201);
      expect(concurrent2.status).toBe(201);
      expect(concurrent1.body.data.total).toBe(85);
      expect(concurrent2.body.data.total).toBe(78);

      const secondProductCompleted = await prisma.product.findUniqueOrThrow({
        where: { id: secondProductId },
      });
      expect(secondProductCompleted).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 81.5,
        starRating: 4,
      });
      expect(secondProductCompleted.completedAt).toBeInstanceOf(Date);

      const completedEvents = await prisma.productStatusEvent.findMany({
        where: {
          productId: secondProductId,
          toStatus: ProductStatus.COMPLETED,
        },
      });
      expect(completedEvents).toHaveLength(1);

      // SCORE-04: Admin changes assignments (removes judge2 or adds judge3) -> completed product remains 81.5 / 4 stars
      const replaceAfterCompleted = await apiRequest(
        baseUrl,
        '/admin/assignments',
        {
          method: 'PUT',
          headers: authHeaders(adminToken),
          body: JSON.stringify({
            assignments: [
              {
                judgeId: judge1Id,
                categoryId: HONEY_CATEGORY_ID,
                criterionIds: [],
              },
              {
                judgeId: judge2Id,
                categoryId: otherCategory.id,
                criterionIds: [],
              },
            ],
          }),
        },
      );
      expect(replaceAfterCompleted.status).toBe(200);

      const afterReassign = await apiRequest<{
        data: { status: string; finalScore: number; starRating: number };
      }>(baseUrl, `/admin/products/${secondProductId}`, {
        headers: authHeaders(adminToken),
      });
      expect(afterReassign.status).toBe(200);
      expect(afterReassign.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 81.5,
        starRating: 4,
      });
    });
  });
});
