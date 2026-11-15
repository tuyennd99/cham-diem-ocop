import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { EvaluationStatus, Prisma, ProductStatus } from '@prisma/client';
import { formatProductCode } from '@ocop/shared';
import { adminFixture, draftPayload } from './support/admin-fixture';
import { apiRequest, withTestApp } from './support/db-app';

const migrationDir = resolve(__dirname, '../prisma/migrations');

describe('Product readable code (issues #20, #21, #22, #23)', () => {
  it('migrates legacy products in createdAt ASC, id ASC order, preserves IDs/FKs/counts, and syncs sequence without collision (#21)', async () => {
    const explicit = Object.prototype.hasOwnProperty.call(
      process.env,
      'TEST_DATABASE_URL',
    );
    const url = new URL(
      (explicit ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL) ??
        '',
    );
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      (explicit && !url.pathname.endsWith('_test')) ||
      url.searchParams.has('host') ||
      url.searchParams.has('hostaddr')
    ) {
      throw new Error(
        'Migration tests require a local database and an isolated generated schema',
      );
    }
    url.searchParams.delete('schema');
    if (url.searchParams.get('sslmode') === 'require') {
      url.searchParams.set('uselibpqcompat', 'true');
    }
    const client = new Client({
      connectionString: url.toString(),
      connectionTimeoutMillis: 5000,
    });
    const schema = `ocop_code_mig_${randomUUID().replaceAll('-', '')}`;
    let created = false;
    try {
      await client.connect();
      await client.query(`CREATE SCHEMA "${schema}"`);
      created = true;
      await client.query(`SET search_path TO "${schema}"`);

      const preMigrations = readdirSync(migrationDir)
        .filter((name) => /^00(0[1-9]|1[0-9])_/.test(name))
        .sort();
      for (const folder of preMigrations) {
        await client.query(
          readFileSync(resolve(migrationDir, folder, 'migration.sql'), 'utf8'),
        );
      }

      // Insert users, locality, category, and multiple legacy products (including tied createdAt timestamps)
      await client.query(`
        INSERT INTO users (id, email, password, "fullName", role, "updatedAt") VALUES
          ('reg-legacy', 'reg@example.invalid', 'unused', 'Người đăng ký cũ', 'REGISTRANT', now()),
          ('judge-legacy', 'judge@example.invalid', 'unused', 'Giám khảo cũ', 'JUDGE', now());
        INSERT INTO localities (id, code, name, "provinceName", "updatedAt") VALUES
          ('loc-legacy', 'XP01', 'Xã Cũ', 'Tỉnh Cũ', now());
        INSERT INTO product_categories (id, name, "order", "isActive", "updatedAt") VALUES
          ('cat-legacy', 'Danh mục cũ', 1, true, now());
      `);
      const categoryId = 'cat-legacy';

      // Insert 4 legacy products:
      // - prod-early (2026-01-01T00:00:00Z) -> should get 1
      // - prod-tie-b (2026-02-01T00:00:00Z) -> should get 3 (since 'prod-tie-a' < 'prod-tie-b')
      // - prod-tie-a (2026-02-01T00:00:00Z) -> should get 2
      // - prod-late  (2026-03-01T00:00:00Z) -> should get 4
      await client.query(
        `
        INSERT INTO products (id, "registrantId", "categoryId", "localityId", name, "formData", status, "createdAt", "updatedAt") VALUES
          ('prod-tie-b', 'reg-legacy', $1, 'loc-legacy', 'Hồ sơ trùng giờ B', '{}', 'SUBMITTED', '2026-02-01T00:00:00Z', now()),
          ('prod-early', 'reg-legacy', $1, 'loc-legacy', 'Hồ sơ sớm nhất', '{}', 'DRAFT', '2026-01-01T00:00:00Z', now()),
          ('prod-late', 'reg-legacy', $1, 'loc-legacy', 'Hồ sơ muộn nhất', '{}', 'COMPLETED', '2026-03-01T00:00:00Z', now()),
          ('prod-tie-a', 'reg-legacy', $1, 'loc-legacy', 'Hồ sơ trùng giờ A', '{}', 'APPROVED', '2026-02-01T00:00:00Z', now());
      `,
        [categoryId],
      );

      await client.query(`
        INSERT INTO attachments (id, "productId", type, "fileName", "filePath") VALUES
          ('att-legacy-1', 'prod-tie-a', 'IMAGE', 'img.png', 'private/img.png');
        INSERT INTO product_judge_assignments (id, "productId", "judgeId", "isActive") VALUES
          ('pja-legacy-1', 'prod-tie-a', 'judge-legacy', true);
        INSERT INTO evaluations (id, "judgeId", "productId", status, total, "updatedAt") VALUES
          ('eval-legacy-1', 'judge-legacy', 'prod-tie-a', 'SUBMITTED', 85, now());
      `);

      const beforeCounts = await client.query(`
        SELECT
          (SELECT count(*)::int FROM products) AS products,
          (SELECT count(*)::int FROM attachments) AS attachments,
          (SELECT count(*)::int FROM evaluations) AS evaluations,
          (SELECT count(*)::int FROM product_judge_assignments) AS assignments
      `);

      // Apply migration 0020_product_code_number
      await client.query(
        readFileSync(
          resolve(migrationDir, '0020_product_code_number/migration.sql'),
          'utf8',
        ),
      );

      const afterCounts = await client.query(`
        SELECT
          (SELECT count(*)::int FROM products) AS products,
          (SELECT count(*)::int FROM attachments) AS attachments,
          (SELECT count(*)::int FROM evaluations) AS evaluations,
          (SELECT count(*)::int FROM product_judge_assignments) AS assignments
      `);
      expect(afterCounts.rows[0]).toEqual(beforeCounts.rows[0]);

      const migratedProducts = await client.query(
        'SELECT id, "codeNumber", name FROM products ORDER BY "codeNumber" ASC',
      );
      expect(migratedProducts.rows).toEqual([
        { id: 'prod-early', codeNumber: 1, name: 'Hồ sơ sớm nhất' },
        { id: 'prod-tie-a', codeNumber: 2, name: 'Hồ sơ trùng giờ A' },
        { id: 'prod-tie-b', codeNumber: 3, name: 'Hồ sơ trùng giờ B' },
        { id: 'prod-late', codeNumber: 4, name: 'Hồ sơ muộn nhất' },
      ]);

      // Verify foreign keys on related records are preserved
      const fkCheck = await client.query(`
        SELECT
          (SELECT "productId" FROM attachments WHERE id = 'att-legacy-1') AS att_prod,
          (SELECT "productId" FROM evaluations WHERE id = 'eval-legacy-1') AS eval_prod,
          (SELECT "productId" FROM product_judge_assignments WHERE id = 'pja-legacy-1') AS pja_prod
      `);
      expect(fkCheck.rows[0]).toEqual({
        att_prod: 'prod-tie-a',
        eval_prod: 'prod-tie-a',
        pja_prod: 'prod-tie-a',
      });

      // Next insert without explicit codeNumber must allocate 5 without collision
      const nextInserted = await client.query(
        `INSERT INTO products (id, "registrantId", "categoryId", name, "formData", status, "updatedAt")
         VALUES ('prod-new-after-mig', 'reg-legacy', $1, 'Hồ sơ mới sau chuyển đổi', '{}', 'DRAFT', now())
         RETURNING id, "codeNumber"`,
        [categoryId],
      );
      expect(nextInserted.rows[0]).toEqual({
        id: 'prod-new-after-mig',
        codeNumber: 5,
      });

      // Verify unique constraint blocks duplicate codeNumber
      await expect(
        client.query(
          `INSERT INTO products (id, "codeNumber", "registrantId", "categoryId", name, "formData", status, "updatedAt")
           VALUES ('prod-dup', 2, 'reg-legacy', $1, 'Trùng số', '{}', 'DRAFT', now())`,
          [categoryId],
        ),
      ).rejects.toThrow(/unique constraint/);
    } finally {
      if (created) {
        await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      }
      await client.end();
    }
  });

  it('allocates unique codes under concurrent creation, keeps code immutable across lifecycle, allows gaps on delete, and supports search & print across all roles (#21, #22, #23)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
        include: {
          criteriaSet: {
            include: {
              criteria: {
                orderBy: { order: 'asc' },
                include: {
                  subCriteria: {
                    orderBy: { order: 'asc' },
                    include: { options: { orderBy: { order: 'asc' } } },
                  },
                },
              },
            },
          },
        },
      });

      // Link f.unit to category's managing agency so f.scorer is auto-assigned on approval
      const agencyLink = await prisma.productCategoryAgency.findFirstOrThrow({
        where: { categoryId: category.id },
      });
      await prisma.organizationUnit.update({
        where: { id: f.unit.id },
        data: { managingAgencyId: agencyLink.agencyId, isActive: true },
      });

      // 1. Concurrent creation (owner + manager on behalf) -> unique codeNumbers & formatted OCOP-XXXXXX codes
      const concurrentRequests = [
        ...Array.from({ length: 4 }, (_, i) =>
          f.call('owner', '/my/products', 'POST', {
            ...draftPayload(category.id, f.locality.id),
            name: `Sản phẩm đồng thời chủ thể ${i + 1}`,
          }),
        ),
        ...Array.from({ length: 4 }, (_, i) =>
          f.call('manager', '/admin/products', 'POST', {
            ...draftPayload(category.id, f.locality.id),
            name: `Sản phẩm đồng thời tạo hộ ${i + 1}`,
            registrantId: f.owner.id,
            reason: 'Tạo hộ đồng thời',
          }),
        ),
      ];
      const createdResponses = await Promise.all(concurrentRequests);
      for (const res of createdResponses) {
        expect(res.status).toBe(201);
        expect(typeof res.body.data.codeNumber).toBe('number');
        expect(res.body.data.code).toMatch(/^OCOP-\d{6,}$/);
        expect(res.body.data.code).toBe(
          formatProductCode(res.body.data.codeNumber),
        );
      }
      const assignedNumbers = createdResponses.map(
        (r) => r.body.data.codeNumber as number,
      );
      expect(new Set(assignedNumbers).size).toBe(createdResponses.length);

      // 2. Deleting a draft creates a gap and does not reissue the deleted codeNumber
      const draftToDelete = createdResponses[0].body.data;
      const deletedRes = await f.call(
        'owner',
        `/my/products/${draftToDelete.id}`,
        'DELETE',
      );
      expect(deletedRes.status).toBe(200);

      const afterDeleteCreate = await f.call('owner', '/my/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        name: 'Hồ sơ tạo sau khi xóa nháp',
      });
      expect(afterDeleteCreate.status).toBe(201);
      expect(afterDeleteCreate.body.data.codeNumber).toBeGreaterThan(
        Math.max(...assignedNumbers),
      );
      expect(afterDeleteCreate.body.data.codeNumber).not.toBe(
        draftToDelete.codeNumber,
      );

      // 3. Code remains immutable across edit -> submit -> return -> edit -> resubmit -> approve -> score -> publish
      const target = afterDeleteCreate.body.data;
      const initialId = target.id as string;
      const initialCodeNumber = target.codeNumber as number;
      const initialCode = target.code as string;

      // Reject any attempt to overwrite code or codeNumber via update payload
      const spoofAttempt = await f.call(
        'owner',
        `/my/products/${initialId}`,
        'PUT',
        {
          name: 'Tên cập nhật hợp lệ',
          code: 'OCOP-999999',
          codeNumber: 999999,
        },
      );
      expect(spoofAttempt.status).toBe(400);

      // Valid draft update keeps code unchanged
      const updatedDraft = await f.call(
        'owner',
        `/my/products/${initialId}`,
        'PUT',
        {
          ...draftPayload(category.id, f.locality.id),
          name: 'Mật ong hoa nhãn đặc sản',
        },
      );
      expect(updatedDraft.status).toBe(200);
      expect(updatedDraft.body.data).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
      });

      // Print draft registration includes the code
      const draftPrint = await f.call(
        'owner',
        `/my/products/${initialId}/registration-print-data`,
      );
      expect(draftPrint.status).toBe(200);
      expect(draftPrint.body.data.product).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
      });

      // Submit -> Return -> Resubmit -> Approve
      const submitted1 = await f.call(
        'owner',
        `/my/products/${initialId}/submit`,
        'POST',
      );
      expect(submitted1.status).toBe(201);
      expect(submitted1.body.data).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
        status: ProductStatus.SUBMITTED,
      });

      const returned = await f.call(
        'viewer',
        `/admin/products/${initialId}/return`,
        'POST',
        { reason: 'Bổ sung mô tả nguồn gốc' },
      );
      expect(returned.status).toBe(201);
      expect(returned.body.data).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
        status: ProductStatus.RETURNED,
      });

      const resubmitted = await f.call(
        'owner',
        `/my/products/${initialId}/submit`,
        'POST',
      );
      expect(resubmitted.status).toBe(201);
      expect(resubmitted.body.data).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
        status: ProductStatus.SUBMITTED,
      });

      const approved = await f.call(
        'viewer',
        `/admin/products/${initialId}/approve`,
        'POST',
        { reason: 'Đủ điều kiện chấm điểm' },
      );
      expect(approved.status).toBe(201);
      expect(approved.body.data).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
        status: ProductStatus.APPROVED,
      });

      // 4. Owner list & detail include code and keep old ID URL working
      const myList = await f.call('owner', '/my/products');
      expect(myList.status).toBe(200);
      const myTarget = myList.body.data.find(
        (item: { id: string }) => item.id === initialId,
      );
      expect(myTarget).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
      });
      const myDetail = await f.call('owner', `/my/products/${initialId}`);
      expect(myDetail.status).toBe(200);
      expect(myDetail.body.data).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
      });

      // Other owner cannot access by ID or by guessing code
      expect(
        (await f.call('otherOwner', `/my/products/${initialId}`)).status,
      ).toBe(404);
      expect(
        (await f.call('otherOwner', `/my/products/${initialCode}`)).status,
      ).toBe(404);

      // 5. Admin / Chair search by new code (case-insensitive, substring) and old ID, respecting DRAFT visibility boundary (#22)
      const digitsOnly = String(initialCodeNumber).padStart(6, '0');
      for (const q of [
        initialCode,
        initialCode.toLowerCase(),
        digitsOnly,
        initialId,
        initialId.slice(0, 8),
      ]) {
        const searchRes = await f.call(
          'viewer',
          `/admin/products?q=${encodeURIComponent(q)}`,
        );
        expect(searchRes.status).toBe(200);
        expect(
          searchRes.body.data.some(
            (item: { id: string; code: string }) =>
              item.id === initialId && item.code === initialCode,
          ),
        ).toBe(true);
      }

      // Chair (VIEW only) searching by a DRAFT product's code must NOT see the draft
      const remainingDraft = createdResponses[1].body.data;
      const viewerDraftSearch = await f.call(
        'viewer',
        `/admin/products?q=${encodeURIComponent(remainingDraft.code)}`,
      );
      expect(viewerDraftSearch.status).toBe(200);
      expect(viewerDraftSearch.body.data).toEqual([]);

      // Admin (MANAGE) searching by the same DRAFT product's code DOES see the draft
      const managerDraftSearch = await f.call(
        'manager',
        `/admin/products?q=${encodeURIComponent(remainingDraft.code)}`,
      );
      expect(managerDraftSearch.status).toBe(200);
      expect(
        managerDraftSearch.body.data.map((p: { id: string }) => p.id),
      ).toEqual([remainingDraft.id]);

      // 6. Judge queue and evaluation include product code; judge cannot access unassigned product (#22)
      const judgeQueue = await f.call('scorer', '/judge/products');
      expect(judgeQueue.status).toBe(200);
      expect(judgeQueue.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: initialId,
            codeNumber: initialCodeNumber,
            code: initialCode,
          }),
        ]),
      );

      const judgeEval = await f.call(
        'scorer',
        `/judge/products/${initialId}/evaluation`,
      );
      expect(judgeEval.status).toBe(200);
      expect(judgeEval.body.data.product).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
      });

      // Judge cannot access unassigned product by ID or by guessing code
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${remainingDraft.id}/evaluation`,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${remainingDraft.code}/evaluation`,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${initialCode}/evaluation`,
          )
        ).status,
      ).toBe(404);

      // Score and submit evaluation
      const allScores = category.criteriaSet!.criteria.flatMap((c) =>
        c.subCriteria.map((sub) => ({
          subCriterionId: sub.id,
          optionId: sub.options[sub.options.length - 1].id,
          note: 'Đạt chuẩn',
        })),
      );
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${initialId}/evaluation`,
            'PUT',
            { scores: allScores },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await f.call(
            'scorer',
            `/judge/products/${initialId}/evaluation/submit`,
            'POST',
          )
        ).status,
      ).toBe(201);

      // Admin evaluations list & search by new product code (q and productId)
      const evalByCodeQ = await f.call(
        'viewer',
        `/admin/evaluations?q=${encodeURIComponent(initialCode.toLowerCase())}`,
      );
      expect(evalByCodeQ.status).toBe(200);
      expect(evalByCodeQ.body.data).toHaveLength(1);
      expect(evalByCodeQ.body.data[0].product).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
      });

      const evalByCodeFilter = await f.call(
        'viewer',
        `/admin/evaluations?productId=${encodeURIComponent(initialCode)}`,
      );
      expect(evalByCodeFilter.status).toBe(200);
      expect(evalByCodeFilter.body.data).toHaveLength(1);
      expect(evalByCodeFilter.body.data[0].product.id).toBe(initialId);

      // 7. Public catalog search by new code (case-insensitive, substring) and old ID; drafts remain hidden (#23)
      for (const pubQ of [
        initialCode,
        initialCode.toLowerCase(),
        digitsOnly.slice(2),
        initialId,
      ]) {
        const pubRes = await apiRequest<any>(
          baseUrl,
          `/products?approvedOnly=true&q=${encodeURIComponent(pubQ)}`,
        );
        expect(pubRes.status).toBe(200);
        expect(
          pubRes.body.data.some(
            (item: { id: string; code: string }) =>
              item.id === initialId && item.code === initialCode,
          ),
        ).toBe(true);
      }

      // Searching public catalog by draft's code must return 0 results
      const pubDraftSearch = await apiRequest<any>(
        baseUrl,
        `/products?q=${encodeURIComponent(remainingDraft.code)}`,
      );
      expect(pubDraftSearch.status).toBe(200);
      expect(pubDraftSearch.body.data).toEqual([]);

      // Public detail by old ID returns code
      const pubDetail = await apiRequest<any>(
        baseUrl,
        `/products/${initialId}`,
      );
      expect(pubDetail.status).toBe(200);
      expect(pubDetail.body.data).toMatchObject({
        id: initialId,
        codeNumber: initialCodeNumber,
        code: initialCode,
      });

      // 8. Numbers > 6 digits (> 999999) are not truncated, and reprinting old snapshots preserves historical JSON while marking current code (#23)
      await prisma.$executeRaw(
        Prisma.sql`SELECT setval(pg_get_serial_sequence(${`${new URL(process.env.DATABASE_URL!).searchParams.get('schema')}.products`}, 'codeNumber'), 1234566, true)`,
      );

      const largeCodeCreate = await f.call('owner', '/my/products', 'POST', {
        ...draftPayload(category.id, f.locality.id),
        name: 'Sản phẩm số thứ tự lớn hơn 6 chữ số',
      });
      expect(largeCodeCreate.status).toBe(201);
      expect(largeCodeCreate.body.data.codeNumber).toBe(1234567);
      expect(largeCodeCreate.body.data.code).toBe('OCOP-1234567');

      const largeProductId = largeCodeCreate.body.data.id as string;

      // Simulate an old submitted product & old submitted evaluation whose stored snapshots did NOT have `code` or `codeNumber`
      const historicalRegSnapshot = {
        version: 2,
        submittedAt: '2026-05-10T08:00:00.000Z',
        product: {
          id: largeProductId,
          name: 'Tên lịch sử lúc nộp cũ',
          description: 'Mô tả lịch sử lúc nộp cũ',
        },
        registrant: {
          id: f.owner.id,
          fullName: 'Chủ thể lịch sử',
          email: f.owner.email,
          phone: '0901112222',
        },
        category: {
          id: category.id,
          name: 'Danh mục lịch sử',
        },
        locality: {
          id: f.locality.id,
          code: f.locality.code,
          name: 'Xã lịch sử',
          provinceName: 'Tỉnh lịch sử',
        },
        formData: draftPayload(category.id, f.locality.id).formData,
      };

      await prisma.product.update({
        where: { id: largeProductId },
        data: {
          status: ProductStatus.COMPLETED,
          submittedAt: new Date('2026-05-10T08:00:00.000Z'),
          completedAt: new Date('2026-05-12T08:00:00.000Z'),
          finalScore: 91,
          starRating: 5,
          publicationState: 'PUBLISHED',
          registrationSnapshot:
            historicalRegSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      const firstCrit = category.criteriaSet!.criteria[0];
      const firstSub = firstCrit.subCriteria[0];
      const firstOpt = firstSub.options[0];
      const historicalEvalSnapshot = {
        version: 2,
        submittedAt: '2026-05-11T09:00:00.000Z',
        product: {
          id: largeProductId,
          name: 'Tên lịch sử trong phiếu chấm cũ',
          description: null,
          formData: { entityName: 'Chủ thể lịch sử' },
          category: { id: category.id, name: 'Danh mục lịch sử' },
        },
        criteriaSet: {
          id: category.criteriaSet!.id,
          name: category.criteriaSet!.name,
          source: category.criteriaSet!.source,
          version: category.criteriaSet!.version,
          sourceHash: category.criteriaSet!.sourceHash,
        },
        judge: {
          id: f.scorer.id,
          fullName: 'Giám khảo lịch sử',
          organizationUnit: {
            id: f.unit.id,
            code: f.unit.code,
            name: 'Đơn vị lịch sử',
          },
        },
        assignedCriterionIds: [firstCrit.id],
        scores: [
          {
            criterion: {
              id: firstCrit.id,
              code: firstCrit.code,
              name: firstCrit.name,
            },
            subCriterion: {
              id: firstSub.id,
              code: firstSub.code,
              content: firstSub.content,
            },
            option: {
              id: firstOpt.id,
              label: firstOpt.label,
              points: firstOpt.points,
            },
            note: 'Ghi chú lịch sử',
          },
        ],
        total: firstOpt.points,
      };

      const oldEvaluation = await prisma.evaluation.create({
        data: {
          judgeId: f.scorer.id,
          productId: largeProductId,
          status: EvaluationStatus.SUBMITTED,
          submittedAt: new Date('2026-05-11T09:00:00.000Z'),
          total: firstOpt.points,
          submissionSnapshot:
            historicalEvalSnapshot as unknown as Prisma.InputJsonValue,
        },
      });

      const regPrintOldSnap = await f.call(
        'owner',
        `/my/products/${largeProductId}/registration-print-data`,
      );
      expect(regPrintOldSnap.status).toBe(200);
      expect(regPrintOldSnap.body.data.product).toMatchObject({
        id: largeProductId,
        codeNumber: 1234567,
        code: 'OCOP-1234567',
        codeFromCurrentProduct: true,
        name: 'Tên lịch sử lúc nộp cũ',
      });

      const resPrintOldSnap = await f.call(
        'owner',
        `/my/products/${largeProductId}/results/print-data`,
      );
      expect(resPrintOldSnap.status).toBe(200);
      expect(resPrintOldSnap.body.data.product).toMatchObject({
        id: largeProductId,
        codeNumber: 1234567,
        code: 'OCOP-1234567',
        codeFromCurrentProduct: true,
        name: 'Tên lịch sử lúc nộp cũ',
      });

      const evalPrintOldSnap = await f.call(
        'viewer',
        `/admin/evaluations/${oldEvaluation.id}/print-data`,
      );
      expect(evalPrintOldSnap.status).toBe(200);
      expect(evalPrintOldSnap.body.data.product).toMatchObject({
        id: largeProductId,
        codeNumber: 1234567,
        code: 'OCOP-1234567',
        codeFromCurrentProduct: true,
        name: 'Tên lịch sử trong phiếu chấm cũ',
      });

      // Verify historical snapshots in database were NOT mutated by reprinting
      const storedProductAfterPrint = await prisma.product.findUniqueOrThrow({
        where: { id: largeProductId },
      });
      expect(storedProductAfterPrint.registrationSnapshot).toEqual(
        historicalRegSnapshot,
      );
      const storedEvalAfterPrint = await prisma.evaluation.findUniqueOrThrow({
        where: { id: oldEvaluation.id },
      });
      expect(storedEvalAfterPrint.submissionSnapshot).toEqual(
        historicalEvalSnapshot,
      );
    });
  });
});
