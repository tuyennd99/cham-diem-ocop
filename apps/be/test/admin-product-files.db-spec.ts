import { readdirSync } from 'node:fs';
import { adminFixture } from './support/admin-fixture';
import { apiRequest, withTestApp } from './support/db-app';
import { scenarioBuffers } from './support/scenario-files';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const pdf = Buffer.from('%PDF-1.4\nprivate evidence');

async function uploadMy(
  baseUrl: string,
  authorization: string,
  productId: string,
  options: {
    field?: string;
    name?: string;
    mime?: string;
    data?: Buffer;
  } = {},
) {
  const form = new FormData();
  const data = options.data ?? png;
  const bytes = new ArrayBuffer(data.byteLength);
  new Uint8Array(bytes).set(data);
  form.append(
    options.field ?? 'file',
    new Blob([bytes], { type: options.mime ?? 'application/pdf' }),
    options.name ?? 'document.pdf',
  );
  return fetch(`${baseUrl}/api/my/products/${productId}/attachments`, {
    method: 'POST',
    headers: { authorization },
    body: form,
  });
}

async function upload(
  baseUrl: string,
  authorization: string,
  productId: string,
  options: {
    field?: string;
    name?: string;
    mime?: string;
    data?: Buffer;
    reason?: string | null;
    unexpectedField?: string;
  } = {},
) {
  const form = new FormData();
  const data = options.data ?? png;
  const bytes = new ArrayBuffer(data.byteLength);
  new Uint8Array(bytes).set(data);
  form.append(
    options.field ?? 'file',
    new Blob([bytes], { type: options.mime ?? 'image/png' }),
    options.name ?? 'image.png',
  );
  if (!Object.hasOwn(options, 'reason')) {
    form.append('reason', 'Admin evidence update');
  } else if (options.reason !== null) {
    form.append('reason', options.reason ?? '');
  }
  if (options.unexpectedField !== undefined) {
    form.append('unexpected', options.unexpectedField);
  }
  return fetch(`${baseUrl}/api/admin/products/${productId}/attachments`, {
    method: 'POST',
    headers: { authorization },
    body: form,
  });
}

describe('admin private product files', () => {
  it('allows MANAGE drafts and VIEW submitted evidence only, without changing public file behavior', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });
      const draft = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          name: 'Private file draft',
          formData: {},
        },
      });
      const imageUpload = await upload(
        baseUrl,
        f.headers('manager').authorization,
        draft.id,
      );
      expect(imageUpload.status).toBe(201);
      const image = (
        (await imageUpload.json()) as { data: { id: string; type: string } }
      ).data;
      expect(image).toMatchObject({ type: 'IMAGE' });
      expect(image).not.toHaveProperty('filePath');

      const evidenceUpload = await upload(
        baseUrl,
        f.headers('manager').authorization,
        draft.id,
        {
          name: 'proof.pdf',
          mime: 'application/pdf',
          data: pdf,
        },
      );
      expect(evidenceUpload.status).toBe(201);
      const evidence = (
        (await evidenceUpload.json()) as { data: { id: string; type: string } }
      ).data;
      expect(evidence).toMatchObject({ type: 'EVIDENCE' });

      const draftAttachments = await f.call(
        'manager',
        `/admin/products/${draft.id}/attachments`,
      );
      expect(draftAttachments.body.data).toHaveLength(2);
      expect(JSON.stringify(draftAttachments.body)).not.toContain('filePath');
      expect(
        (await f.call('viewer', `/admin/products/${draft.id}/attachments`))
          .status,
      ).toBe(404);
      expect(
        (
          await fetch(
            `${baseUrl}/api/admin/products/${draft.id}/attachments/${evidence.id}`,
            {
              headers: { authorization: f.headers('viewer').authorization },
            },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await fetch(
            `${baseUrl}/api/admin/products/${draft.id}/attachments/${evidence.id}`,
            {
              headers: { authorization: f.headers('scorer').authorization },
            },
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await fetch(
            `${baseUrl}/api/admin/products/${draft.id}/attachments/${evidence.id}`,
          )
        ).status,
      ).toBe(401);
      expect(
        (
          await fetch(
            `${baseUrl}/api/my/products/${draft.id}/attachments/${evidence.id}`,
            {
              headers: f.headers('otherOwner'),
            },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await fetch(
            `${baseUrl}/api/admin/products/${draft.id}/attachments/${evidence.id}`,
            {
              headers: f.headers('manager'),
            },
          )
        ).status,
      ).toBe(200);

      await prisma.product.update({
        where: { id: draft.id },
        data: { status: 'SUBMITTED' },
      });
      expect(
        (await f.call('viewer', `/admin/products/${draft.id}/attachments`))
          .status,
      ).toBe(200);
      const readEvidence = await fetch(
        `${baseUrl}/api/admin/products/${draft.id}/attachments/${evidence.id}`,
        {
          headers: f.headers('viewer'),
        },
      );
      expect(readEvidence.status).toBe(200);
      expect(Buffer.from(await readEvidence.arrayBuffer()).equals(pdf)).toBe(
        true,
      );
      expect(
        (
          await fetch(
            `${baseUrl}/api/admin/products/${draft.id}/attachments/${image.id}`,
            {
              headers: f.headers('viewer'),
            },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await fetch(
            `${baseUrl}/api/admin/products/${draft.id}/attachments/missing`,
            {
              headers: f.headers('manager'),
            },
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await fetch(
            `${baseUrl}/api/products/${draft.id}/attachments/${evidence.id}`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await fetch(
            `${baseUrl}/api/products/${draft.id}/attachments/${image.id}`,
          )
        ).status,
      ).toBe(200);

      const auditCount = await prisma.auditLog.count({
        where: { entityId: draft.id },
      });
      const attachmentCount = await prisma.attachment.count({
        where: { productId: draft.id },
      });
      expect(
        (await upload(baseUrl, f.headers('manager').authorization, draft.id))
          .status,
      ).toBe(409);
      expect(
        (
          await f.call(
            'manager',
            `/admin/products/${draft.id}/attachments/${evidence.id}`,
            'DELETE',
            {
              reason: 'Must remain submitted',
            },
          )
        ).status,
      ).toBe(409);
      expect(
        await prisma.auditLog.count({ where: { entityId: draft.id } }),
      ).toBe(auditCount);
      expect(
        await prisma.attachment.count({ where: { productId: draft.id } }),
      ).toBe(attachmentCount);
    });
  });

  it('rejects invalid or over-cap uploads and removes temporary files without writing audits', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });
      const product = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          name: 'Upload validation',
          formData: {},
        },
      });
      const auth = f.headers('manager').authorization;
      const invalidImage = await upload(baseUrl, auth, product.id, {
        name: 'fake.png',
        mime: 'image/png',
        data: Buffer.from('%PDF-not-png'),
      });
      expect(invalidImage.status).toBe(415);
      expect(readdirSync(process.env.STORAGE_PATH!)).toEqual([]);

      const invalidField = await upload(baseUrl, auth, product.id, {
        field: 'wrong',
        name: 'image.png',
        mime: 'image/png',
        data: png,
      });
      expect(invalidField.status).toBe(400);
      expect(readdirSync(process.env.STORAGE_PATH!)).toEqual([]);

      const oversizedImage = await upload(baseUrl, auth, product.id, {
        name: 'large.png',
        mime: 'image/png',
        data: Buffer.alloc(10 * 1024 * 1024 + 1, 1),
      });
      expect(oversizedImage.status).toBe(413);
      expect(readdirSync(process.env.STORAGE_PATH!)).toEqual([]);
      await prisma.attachment.createMany({
        data: Array.from({ length: 20 }, (_, index) => ({
          productId: product.id,
          type: 'IMAGE' as const,
          fileName: `existing-${index}.png`,
          filePath: `existing-${index}`,
        })),
      });
      expect((await upload(baseUrl, auth, product.id)).status).toBe(409);
      expect(readdirSync(process.env.STORAGE_PATH!)).toEqual([]);
      expect(
        await prisma.attachment.count({ where: { productId: product.id } }),
      ).toBe(20);
      expect(
        await prisma.auditLog.count({ where: { entityId: product.id } }),
      ).toBe(0);
    });
  });

  it('cleans uploaded files when multipart body validation rejects a reason or unknown field', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });
      const product = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          name: 'Multipart body validation',
          formData: {},
        },
      });
      const auth = f.headers('manager').authorization;
      const rejectedRequests = [
        { reason: null },
        { reason: '' },
        { unexpectedField: 'reject unknown multipart fields' },
      ];

      for (const options of rejectedRequests) {
        const response = await upload(baseUrl, auth, product.id, options);
        expect(response.status).toBe(400);
        expect(
          await prisma.attachment.count({ where: { productId: product.id } }),
        ).toBe(0);
        expect(
          await prisma.auditLog.count({ where: { entityId: product.id } }),
        ).toBe(0);
        expect(readdirSync(process.env.STORAGE_PATH!)).toEqual([]);
      }
    });
  });

  it('serializes upload and submission on the product row', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });
      const product = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          name: 'Upload submit race',
          formData: {
            entityName: 'Test entity',
            representativeName: 'Test representative',
            representativeTitle: 'Director',
            contactAddress: 'Test address',
            provinceName: 'Test province',
            email: 'contact@example.invalid',
            registrationType: 'FIRST',
            sampleQuantity: 1,
            assessmentYear: 2026,
            declarationAccepted: true,
          },
        },
      });
      const [uploadResponse, submitResponse] = await Promise.all([
        upload(baseUrl, f.headers('manager').authorization, product.id),
        f.call('manager', `/admin/products/${product.id}/submit`, 'POST', {
          reason: 'Submit concurrently',
        }),
      ]);
      expect([201, 409]).toContain(uploadResponse.status);
      expect(submitResponse.status).toBe(201);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: product.id } }))
          .status,
      ).toBe('SUBMITTED');
      if (uploadResponse.status === 201) {
        const created = (await uploadResponse.json()) as {
          data: { id: string };
        };
        expect(
          await prisma.attachment.count({
            where: { id: created.data.id, productId: product.id },
          }),
        ).toBe(1);
      }
      expect(
        (
          await f.call(
            'manager',
            `/admin/products/${product.id}/attachments/${'missing'}`,
            'DELETE',
            {
              reason: 'No post-submit attachment deletion',
            },
          )
        ).status,
      ).toBe(409);
    });
  });

  it('enforces private PDF route access control across my/public/judge/admin routes and registrant 10 MiB / signature / 20-file boundaries (FILE-04, FILE-05)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });
      const draft = await prisma.product.create({
        data: {
          registrantId: f.owner.id,
          categoryId: category.id,
          localityId: f.locality.id,
          name: 'Hồ sơ kiểm thử FILE-04 & FILE-05',
          formData: {},
        },
      });
      const ownerAuth = f.headers('owner').authorization;

      // FILE-05: Empty file (0 bytes) -> 415
      const emptyRes = await uploadMy(baseUrl, ownerAuth, draft.id, {
        name: 'empty.pdf',
        mime: 'application/pdf',
        data: scenarioBuffers.emptyBuffer(),
      });
      expect(emptyRes.status).toBe(415);

      // FILE-05: Fake signature (.pdf extension & MIME but MZ header) -> 415
      const fakeSigRes = await uploadMy(baseUrl, ownerAuth, draft.id, {
        name: 'gia-mao.pdf',
        mime: 'application/pdf',
        data: scenarioBuffers.fakeSignaturePdf(),
      });
      expect(fakeSigRes.status).toBe(415);

      // FILE-05: Over 10 MiB (10485761 bytes) -> 413
      const over10MibData = scenarioBuffers.overLimitPdf();
      expect(over10MibData.byteLength).toBe(10485761);
      const over10MibRes = await uploadMy(baseUrl, ownerAuth, draft.id, {
        name: 'file-qua-dung-luong.pdf',
        mime: 'application/pdf',
        data: over10MibData,
      });
      expect(over10MibRes.status).toBe(413);
      expect(
        await prisma.attachment.count({ where: { productId: draft.id } }),
      ).toBe(0);

      // FILE-05: Exact 10 MiB (10485760 bytes) with valid PDF header -> 201 accepted
      const exact10MibData = scenarioBuffers.validPdf(10 * 1024 * 1024);
      expect(exact10MibData.byteLength).toBe(10485760);
      const exact10MibRes = await uploadMy(baseUrl, ownerAuth, draft.id, {
        name: 'exact-10mib.pdf',
        mime: 'application/pdf',
        data: exact10MibData,
      });
      expect(exact10MibRes.status).toBe(201);
      const exactPdf = (
        (await exact10MibRes.json()) as {
          data: { id: string; type: string; fileName: string };
        }
      ).data;
      expect(exactPdf).toMatchObject({
        type: 'EVIDENCE',
        fileName: 'exact-10mib.pdf',
      });

      // FILE-05: Pre-seed 19 more attachments (total 20) via prisma.attachment.createMany to avoid hitting 20 req/min throttle, then upload 21st file -> 409
      await prisma.attachment.createMany({
        data: Array.from({ length: 19 }, (_, index) => ({
          productId: draft.id,
          type: 'IMAGE' as const,
          fileName: `seeded-${index}.jpg`,
          filePath: `seeded-key-${index}`,
        })),
      });
      expect(
        await prisma.attachment.count({ where: { productId: draft.id } }),
      ).toBe(20);

      const file21Res = await uploadMy(baseUrl, ownerAuth, draft.id, {
        name: 'file-21.pdf',
        mime: 'application/pdf',
        data: scenarioBuffers.validPdf(),
      });
      expect(file21Res.status).toBe(409);
      expect(
        await prisma.attachment.count({ where: { productId: draft.id } }),
      ).toBe(20);

      // Transition product to SUBMITTED to test FILE-04 across all routes
      await prisma.product.update({
        where: { id: draft.id },
        data: { status: 'SUBMITTED', submittedAt: new Date() },
      });

      // FILE-04: Unauthenticated on /api/my/products/:id/attachments/:pdfId -> 401
      expect(
        (
          await fetch(
            `${baseUrl}/api/my/products/${draft.id}/attachments/${exactPdf.id}`,
          )
        ).status,
      ).toBe(401);

      // FILE-04: Public route /api/products/:id/attachments/:pdfId -> 404
      expect(
        (
          await fetch(
            `${baseUrl}/api/products/${draft.id}/attachments/${exactPdf.id}`,
          )
        ).status,
      ).toBe(404);

      // FILE-04: Other registrant on /api/my/products/:id/attachments/:pdfId -> 404
      expect(
        (
          await fetch(
            `${baseUrl}/api/my/products/${draft.id}/attachments/${exactPdf.id}`,
            { headers: f.headers('otherOwner') },
          )
        ).status,
      ).toBe(404);

      // FILE-04: Unassigned SCORE judge on /api/judge/products/:id/attachments/:pdfId -> 403
      expect(
        (
          await fetch(
            `${baseUrl}/api/judge/products/${draft.id}/attachments/${exactPdf.id}`,
            { headers: f.headers('scorer') },
          )
        ).status,
      ).toBe(403);

      // FILE-04: Owner on /api/my/products/:id/attachments/:pdfId -> 200
      const ownerDownload = await fetch(
        `${baseUrl}/api/my/products/${draft.id}/attachments/${exactPdf.id}`,
        { headers: f.headers('owner') },
      );
      expect(ownerDownload.status).toBe(200);
      await ownerDownload.arrayBuffer();

      // FILE-04: VIEW on /api/admin/products/:id/attachments/:pdfId -> 200
      const viewerDownload = await fetch(
        `${baseUrl}/api/admin/products/${draft.id}/attachments/${exactPdf.id}`,
        { headers: f.headers('viewer') },
      );
      expect(viewerDownload.status).toBe(200);
      await viewerDownload.arrayBuffer();

      // FILE-04: Assigned SCORE judge on /api/judge/products/:id/attachments/:pdfId -> 200
      await prisma.judgeAssignment.create({
        data: {
          judgeId: f.scorer.id,
          categoryId: category.id,
          criterionIds: [],
        },
      });
      const judgeDownload = await fetch(
        `${baseUrl}/api/judge/products/${draft.id}/attachments/${exactPdf.id}`,
        { headers: f.headers('scorer') },
      );
      expect(judgeDownload.status).toBe(200);
      await judgeDownload.arrayBuffer();
    });
  });
});
