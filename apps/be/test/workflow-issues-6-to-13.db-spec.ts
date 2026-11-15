import {
  EvaluationStatus,
  ProductPublicationState,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { apiRequest, withTestApp } from './support/db-app';
import { adminFixture, draftPayload } from './support/admin-fixture';

describe('Issue #6 & Tickets #7–#13 workflow specification', () => {
  it('#7: enforces four roles, allows multi-role accounts, and rejects REGISTRANT + JUDGE (SCORE) on the same account', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);

      // 1. Creating a user with both REGISTRANT and JUDGE / SCORE must fail with 400
      const invalidCreate1 = await f.call('manager', '/admin/users', 'POST', {
        email: `conflict-1-${randomUUID()}@example.invalid`,
        fullName: 'Conflict Registrant Judge',
        password: 'StaffPassword1!',
        organizationUnitId: f.unit.id,
        staffPermissions: ['SCORE'],
        roles: ['REGISTRANT', 'JUDGE'],
        reason: 'Attempt invalid combination',
      });
      expect(invalidCreate1.status).toBe(400);

      const invalidCreate2 = await f.call('manager', '/admin/users', 'POST', {
        email: `conflict-2-${randomUUID()}@example.invalid`,
        fullName: 'Conflict Registrant Score',
        password: 'StaffPassword1!',
        organizationUnitId: f.unit.id,
        staffPermissions: ['SCORE'],
        roles: ['REGISTRANT'],
        reason: 'Attempt invalid combination',
      });
      expect(invalidCreate2.status).toBe(400);

      // 2. Creating a multi-role user with VIEWER (Chủ trì) + REGISTRANT (Người dùng) succeeds
      const multiRoleEmail = `chair-registrant-${randomUUID()}@example.invalid`;
      const multiCreate = await f.call('manager', '/admin/users', 'POST', {
        email: multiRoleEmail,
        fullName: 'Chủ trì kiêm Người đăng ký',
        password: 'StaffPassword1!',
        organizationUnitId: f.unit.id,
        staffPermissions: ['VIEW'],
        roles: ['VIEWER', 'REGISTRANT'],
        reason: 'Valid multi-role Chair + Registrant',
      });
      expect(multiCreate.status).toBe(201);
      expect(multiCreate.body.data.roles).toEqual(
        expect.arrayContaining(['VIEWER', 'REGISTRANT']),
      );
      const multiUserId = multiCreate.body.data.id as string;

      // 3. Updating staff-access to add SCORE while keeping REGISTRANT role is rejected with 400
      const invalidUpdate = await f.call(
        'manager',
        `/admin/users/${multiUserId}/staff-access`,
        'PUT',
        {
          staffPermissions: ['VIEW', 'SCORE'],
          roles: ['VIEWER', 'REGISTRANT', 'JUDGE'],
          organizationUnitId: f.unit.id,
          reason: 'Try adding Judge to Registrant',
        },
      );
      expect(invalidUpdate.status).toBe(400);

      // 4. Updating staff-access to VIEWER + JUDGE (Chủ trì + Giám khảo, without REGISTRANT) succeeds
      const validChairJudge = await f.call(
        'manager',
        `/admin/users/${multiUserId}/staff-access`,
        'PUT',
        {
          staffPermissions: ['VIEW', 'SCORE'],
          roles: ['VIEWER', 'JUDGE'],
          organizationUnitId: f.unit.id,
          reason: 'Switch to Chair + Judge',
        },
      );
      expect(validChairJudge.status).toBe(200);
      expect(validChairJudge.body.data.roles).toEqual(
        expect.arrayContaining(['VIEWER', 'JUDGE']),
      );
      expect(validChairJudge.body.data.roles).not.toContain('REGISTRANT');
    });
  });

  it('#9: allows creating and submitting product by provinceName + localityName without event selection or event date restrictions', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });

      const created = await f.call('owner', '/my/products', 'POST', {
        name: 'Sản phẩm tự phân giải xã phường #9',
        categoryId: category.id,
        localityId: null,
        formData: {
          entityName: 'HTX Nông nghiệp #9',
          representativeName: 'Trần Văn B',
          representativeTitle: 'Giám đốc',
          contactAddress: 'Xã Tân Lập, Tỉnh Thái Nguyên',
          provinceName: 'Tỉnh Thái Nguyên',
          localityName: 'Xã Tân Lập',
          localityCode: 'XP09999',
          phone: '0911222333',
          email: 'htx9@ocop.test',
          registrationType: 'FIRST',
          sampleQuantity: 2,
          assessmentYear: 2026,
          declarationAccepted: true,
        },
      });
      expect(created.status).toBe(201);
      expect(created.body.data.localityId).toBeTruthy();
      expect(created.body.data.locality).toMatchObject({
        name: 'Xã Tân Lập',
        provinceName: 'Tỉnh Thái Nguyên',
      });

      const submitRes = await f.call(
        'owner',
        `/my/products/${created.body.data.id}/submit`,
        'POST',
      );
      expect(submitRes.status).toBe(201);
      expect(submitRes.body.data).toMatchObject({
        status: ProductStatus.SUBMITTED,
        localityNameAtSubmit: 'Xã Tân Lập',
        provinceNameAtSubmit: 'Tỉnh Thái Nguyên',
      });
    });
  });

  it('#8, #11, #10, #12, #13: executes full approval/return, agency auto-assignment, manual add/remove/restore judge, reopen, and publication workflow', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);

      // #11: Verify 4 official Managing Agencies exist from migration 0019
      const agenciesRes = await f.call('viewer', '/admin/managing-agencies');
      expect(agenciesRes.status).toBe(200);
      expect(agenciesRes.body.data.map((a: { id: string }) => a.id)).toEqual([
        'agency-bnnmt',
        'agency-bct',
        'agency-byt',
        'agency-bvhttdl',
      ]);

      // Create an active test category with 2 simple criteria (total 100 pts) linked to BNNMT + BCT
      const suffix = randomUUID().slice(0, 8);
      const category = await prisma.productCategory.create({
        data: {
          id: `cat-wf-${suffix}`,
          name: `Phân loại kiểm thử luồng duyệt ${suffix}`,
          order: 99,
          isActive: true,
          agencyLinks: {
            create: [{ agencyId: 'agency-bnnmt' }, { agencyId: 'agency-bct' }],
          },
          criteriaSet: {
            create: {
              name: 'Bộ tiêu chí kiểm thử 100đ',
              isActive: true,
              version: '1',
              criteria: {
                create: [
                  {
                    code: 'A1',
                    name: 'Tiêu chí A1',
                    maxScore: 60,
                    sectionCode: 'A',
                    sectionName: 'Phần A',
                    order: 1,
                    subCriteria: {
                      create: {
                        code: 'A1.1',
                        content: 'Tiểu tiêu chí A1.1',
                        order: 1,
                        options: {
                          create: [
                            { label: 'Mức cao', points: 60, order: 1 },
                            { label: 'Mức TB', points: 40, order: 2 },
                          ],
                        },
                      },
                    },
                  },
                  {
                    code: 'B1',
                    name: 'Tiêu chí B1',
                    maxScore: 40,
                    sectionCode: 'B',
                    sectionName: 'Phần B',
                    order: 2,
                    subCriteria: {
                      create: {
                        code: 'B1.1',
                        content: 'Tiểu tiêu chí B1.1',
                        order: 1,
                        options: {
                          create: [
                            { label: 'Mức cao', points: 40, order: 1 },
                            { label: 'Mức TB', points: 20, order: 2 },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
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

      const subA = category.criteriaSet!.criteria[0].subCriteria[0];
      const subB = category.criteriaSet!.criteria[1].subCriteria[0];
      const scoreSheet = (ptsA: 60 | 40, ptsB: 40 | 20, note?: string) => [
        {
          subCriterionId: subA.id,
          optionId: subA.options.find((o) => o.points === ptsA)!.id,
          ...(note ? { note } : {}),
        },
        {
          subCriterionId: subB.id,
          optionId: subB.options.find((o) => o.points === ptsB)!.id,
        },
      ];

      // #11: Create 2 organization units: Unit BNNMT (with Judge 1 & Judge 3) and Unit BCT (initially 0 judges to test missing-agency warning, then Judge 2)
      const unitBnnmt = await f.call(
        'manager',
        '/admin/organization-units',
        'POST',
        {
          code: `U-BNNMT-${suffix}`,
          name: 'Hội đồng Sở Nông nghiệp và Môi trường',
          order: 1,
          isActive: true,
          managingAgencyId: 'agency-bnnmt',
          reason: 'Thiết lập đơn vị BNNMT',
        },
      );
      expect(unitBnnmt.status).toBe(201);
      expect(unitBnnmt.body.data.managingAgency).toMatchObject({
        id: 'agency-bnnmt',
        code: 'BNNMT',
      });

      const unitBct = await f.call(
        'manager',
        '/admin/organization-units',
        'POST',
        {
          code: `U-BCT-${suffix}`,
          name: 'Hội đồng Sở Công Thương',
          order: 2,
          isActive: true,
          managingAgencyId: 'agency-bct',
          reason: 'Thiết lập đơn vị BCT',
        },
      );
      expect(unitBct.status).toBe(201);

      const unitByt = await f.call(
        'manager',
        '/admin/organization-units',
        'POST',
        {
          code: `U-BYT-${suffix}`,
          name: 'Hội đồng Sở Y tế',
          order: 3,
          isActive: true,
          managingAgencyId: 'agency-byt',
          reason: 'Thiết lập đơn vị BYT',
        },
      );
      expect(unitByt.status).toBe(201);

      const judgePass = 'JudgePassword1!';
      const passwordHash = await bcrypt.hash(judgePass, 4);
      const makeJudge = async (
        label: string,
        unitId: string,
      ): Promise<{ id: string; token: string }> => {
        const email = `${label}-${suffix}@ocop.test`;
        const user = await prisma.user.create({
          data: {
            email,
            password: passwordHash,
            fullName: `Giám khảo ${label}`,
            role: Role.JUDGE,
            roles: [Role.JUDGE],
            staffPermissions: [StaffPermission.SCORE],
            organizationUnitId: unitId,
            verified: true,
            isActive: true,
          },
        });
        const login = await apiRequest<{ data: { accessToken: string } }>(
          baseUrl,
          '/auth/login',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: judgePass }),
          },
        );
        expect(login.status).toBe(200);
        return { id: user.id, token: login.body.data.accessToken };
      };

      const judge1Bnnmt = await makeJudge('gk1-bnnmt', unitBnnmt.body.data.id);
      const judge2Bct = await makeJudge('gk2-bct', unitBct.body.data.id);
      const judge3Bnnmt = await makeJudge('gk3-bnnmt', unitBnnmt.body.data.id);
      const judge4Byt = await makeJudge('gk4-byt', unitByt.body.data.id);

      const callAsJudge = (
        judge: { token: string },
        path: string,
        method = 'GET',
        body?: unknown,
      ) =>
        apiRequest<any>(baseUrl, path, {
          method,
          headers: {
            Authorization: `Bearer ${judge.token}`,
            'Content-Type': 'application/json',
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });

      // Temporarily deactivate judge3Bnnmt and judge2Bct before approval so only judge1Bnnmt is auto-assigned (testing missing BCT warning + manual addition later)
      await prisma.user.update({
        where: { id: judge3Bnnmt.id },
        data: { isActive: false },
      });
      await prisma.user.update({
        where: { id: judge2Bct.id },
        data: { isActive: false },
      });

      // =====================================================================
      // #8: Registrant creates & submits product -> Chair returns with reason -> Registrant edits & resubmits -> Chair approves
      // =====================================================================
      const created = await f.call(
        'owner',
        '/my/products',
        'POST',
        draftPayload(category.id, f.locality.id),
      );
      expect(created.status).toBe(201);
      const productId = created.body.data.id as string;

      const submit1 = await f.call(
        'owner',
        `/my/products/${productId}/submit`,
        'POST',
      );
      expect(submit1.status).toBe(201);
      expect(submit1.body.data.status).toBe(ProductStatus.SUBMITTED);

      // Unapproved product cannot be scored by any judge
      const preApproveEval = await callAsJudge(
        judge1Bnnmt,
        `/judge/products/${productId}/evaluation`,
      );
      expect([403, 409]).toContain(preApproveEval.status);

      // Chair (viewer) returns product without reason -> 400
      const returnNoReason = await f.call(
        'viewer',
        `/admin/products/${productId}/return`,
        'POST',
        { reason: '   ' },
      );
      expect(returnNoReason.status).toBe(400);

      // Chair returns product with reason -> 201, status RETURNED
      const returnRes = await f.call(
        'viewer',
        `/admin/products/${productId}/return`,
        'POST',
        { reason: 'Thiếu thông tin nhãn hàng hóa và bản công bố chất lượng' },
      );
      expect(returnRes.status).toBe(201);
      expect(returnRes.body.data).toMatchObject({
        status: ProductStatus.RETURNED,
        returnReason:
          'Thiếu thông tin nhãn hàng hóa và bản công bố chất lượng',
      });

      // Registrant sees returnReason, edits RETURNED product, and resubmits
      const ownerViewReturned = await f.call(
        'owner',
        `/my/products/${productId}`,
      );
      expect(ownerViewReturned.status).toBe(200);
      expect(ownerViewReturned.body.data).toMatchObject({
        status: ProductStatus.RETURNED,
        returnReason:
          'Thiếu thông tin nhãn hàng hóa và bản công bố chất lượng',
      });

      // Returned product cannot be deleted, only edited & resubmitted
      expect(
        (await f.call('owner', `/my/products/${productId}`, 'DELETE')).status,
      ).toBe(409);

      const editReturned = await f.call(
        'owner',
        `/my/products/${productId}`,
        'PUT',
        {
          ...draftPayload(category.id, f.locality.id),
          name: 'Sản phẩm đã bổ sung hồ sơ theo yêu cầu Chủ trì',
        },
      );
      expect(editReturned.status).toBe(200);
      expect(editReturned.body.data.name).toBe(
        'Sản phẩm đã bổ sung hồ sơ theo yêu cầu Chủ trì',
      );

      const resubmit = await f.call(
        'owner',
        `/my/products/${productId}/submit`,
        'POST',
      );
      expect(resubmit.status).toBe(201);
      expect(resubmit.body.data).toMatchObject({
        status: ProductStatus.SUBMITTED,
        returnReason: null,
      });

      // =====================================================================
      // #10: Chair approves product -> auto-assigns active judges in BNNMT & BCT, reports missing agency BCT
      // =====================================================================
      const approveRes = await f.call(
        'viewer',
        `/admin/products/${productId}/approve`,
        'POST',
        { reason: 'Hồ sơ hợp lệ, duyệt chuyển hội đồng chấm' },
      );
      expect(approveRes.status).toBe(201);
      expect(approveRes.body.data).toMatchObject({
        status: ProductStatus.APPROVED,
        missingAgencyNames: ['Bộ Công Thương'],
      });
      expect(approveRes.body.data.judgeAssignments).toHaveLength(1);
      expect(approveRes.body.data.judgeAssignments[0]).toMatchObject({
        judgeId: judge1Bnnmt.id,
        managingAgencyId: 'agency-bnnmt',
        isManual: false,
        isActive: true,
        mustSubmitToComplete: false,
      });

      // Re-activate judge2Bct and judge3Bnnmt for manual assignment tests
      await prisma.user.updateMany({
        where: { id: { in: [judge2Bct.id, judge3Bnnmt.id] } },
        data: { isActive: true },
      });

      // #11: Changing category-agency links after approval does NOT alter already approved product's requiredAgencies
      const updateCatLinks = await f.call(
        'manager',
        `/admin/categories/${category.id}`,
        'PUT',
        {
          managingAgencyIds: ['agency-bnnmt'],
          reason: 'Thử thay đổi liên kết cơ quan sau khi hồ sơ đã duyệt',
        },
      );
      expect(updateCatLinks.status).toBe(200);

      const detailAfterCatChange = await f.call(
        'viewer',
        `/admin/products/${productId}`,
      );
      expect(
        detailAfterCatChange.body.data.agencyCoverage.map(
          (c: { agency: { id: string } }) => c.agency.id,
        ),
      ).toEqual(['agency-bnnmt', 'agency-bct']);

      // Restore category links to BNNMT + BCT
      await f.call('manager', `/admin/categories/${category.id}`, 'PUT', {
        managingAgencyIds: ['agency-bnnmt', 'agency-bct'],
        reason: 'Khôi phục liên kết BNNMT + BCT',
      });

      // =====================================================================
      // #10: Judge 1 (auto-assigned) scores all criteria and submits (60 + 40 = 100 pts) -> Product COMPLETED (since >= 1 valid sheet and no pending manual judge)
      // =====================================================================
      const gk1Save = await callAsJudge(
        judge1Bnnmt,
        `/judge/products/${productId}/evaluation`,
        'PUT',
        { scores: scoreSheet(60, 40, 'Điểm GK1 BNNMT') },
      );
      expect(gk1Save.status).toBe(200);

      const gk1Submit = await callAsJudge(
        judge1Bnnmt,
        `/judge/products/${productId}/evaluation/submit`,
        'POST',
      );
      expect(gk1Submit.status).toBe(201);
      expect(gk1Submit.body.data.total).toBe(100);

      const afterGk1Detail = await f.call(
        'viewer',
        `/admin/products/${productId}`,
      );
      expect(afterGk1Detail.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 100,
        starRating: 5,
        publicationState: ProductPublicationState.UNPUBLISHED,
      });

      // =====================================================================
      // #12: Before publication, Registrant and Public see null finalScore/starRating
      // =====================================================================
      const ownerUnpublished = await f.call(
        'owner',
        `/my/products/${productId}`,
      );
      expect(ownerUnpublished.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        publicationState: ProductPublicationState.UNPUBLISHED,
        finalScore: null,
        starRating: null,
      });

      const publicUnpublished = await apiRequest<any>(
        baseUrl,
        `/products/${productId}`,
      );
      expect(publicUnpublished.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        publicationState: ProductPublicationState.UNPUBLISHED,
        finalScore: null,
        starRating: null,
      });

      // Chair publishes results -> Registrant and Public now see 100 pts / 5 stars
      const publish1 = await f.call(
        'viewer',
        `/admin/products/${productId}/publish-results`,
        'POST',
        { reason: 'Công bố kết quả đợt 1' },
      );
      expect(publish1.status).toBe(201);
      expect(publish1.body.data).toMatchObject({
        publicationState: ProductPublicationState.PUBLISHED,
        finalScore: 100,
        starRating: 5,
      });

      const ownerPublished = await f.call('owner', `/my/products/${productId}`);
      expect(ownerPublished.body.data).toMatchObject({
        publicationState: ProductPublicationState.PUBLISHED,
        finalScore: 100,
        starRating: 5,
      });

      // =====================================================================
      // #13: Adding manual judge to COMPLETED product is blocked until reopened
      // =====================================================================
      const addWhileCompleted = await f.call(
        'viewer',
        `/admin/products/${productId}/assignments`,
        'POST',
        {
          judgeId: judge2Bct.id,
          reason: 'Thử bổ sung khi đã hoàn tất',
        },
      );
      expect(addWhileCompleted.status).toBe(409);

      // Chair reopens COMPLETED product -> transitions to SCORING and publicationState UPDATING
      const reopenProd = await f.call(
        'viewer',
        `/admin/products/${productId}/reopen`,
        'POST',
        { reason: 'Mở lại hồ sơ để bổ sung giám khảo Sở Công Thương' },
      );
      expect(reopenProd.status).toBe(201);
      expect(reopenProd.body.data).toMatchObject({
        status: ProductStatus.SCORING,
        publicationState: ProductPublicationState.UPDATING,
        finalScore: null,
        starRating: null,
      });

      // Reject manual assignment of judge from unrelated agency (BYT)
      const addWrongAgency = await f.call(
        'viewer',
        `/admin/products/${productId}/assignments`,
        'POST',
        {
          judgeId: judge4Byt.id,
          reason: 'Giám khảo không thuộc cơ quan quản lý',
        },
      );
      expect(addWrongAgency.status).toBe(400);

      // Add Judge 2 (BCT) manually -> mustSubmitToComplete = true, so product stays SCORING even though Judge 1 already submitted!
      const addJudge2 = await f.call(
        'viewer',
        `/admin/products/${productId}/assignments`,
        'POST',
        {
          judgeId: judge2Bct.id,
          reason: 'Bổ sung giám khảo BCT',
        },
      );
      expect(addJudge2.status).toBe(201);
      expect(addJudge2.body.data).toMatchObject({
        status: ProductStatus.SCORING,
        missingAgencyNames: [],
      });

      // Judge 2 submits (40 + 20 = 60 pts) -> Now all mandatory manual judges submitted -> COMPLETED with average (100 + 60)/2 = 80 pts (4 stars), publicationState = UPDATING
      await callAsJudge(
        judge2Bct,
        `/judge/products/${productId}/evaluation`,
        'PUT',
        { scores: scoreSheet(40, 20, 'Điểm GK2 BCT') },
      );
      const gk2Submit = await callAsJudge(
        judge2Bct,
        `/judge/products/${productId}/evaluation/submit`,
        'POST',
      );
      expect(gk2Submit.status).toBe(201);

      const afterGk2Detail = await f.call(
        'viewer',
        `/admin/products/${productId}`,
      );
      expect(afterGk2Detail.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 80,
        starRating: 4,
        publicationState: ProductPublicationState.UPDATING,
      });

      // #12: While in UPDATING state, Registrant sees updating state and hidden score until Chair republishes
      const ownerWhileUpdating = await f.call(
        'owner',
        `/my/products/${productId}`,
      );
      expect(ownerWhileUpdating.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        publicationState: ProductPublicationState.UPDATING,
        finalScore: null,
        starRating: null,
      });

      // =====================================================================
      // #13: Remove Judge 2 -> evaluation becomes EXCLUDED, score recomputes to 100 pts, Judge 2 can still view read-only, Chair can view excluded sheet
      // =====================================================================
      const removeJudge2 = await f.call(
        'viewer',
        `/admin/products/${productId}/assignments/${judge2Bct.id}`,
        'DELETE',
        { reason: 'Tạm gỡ giám khảo BCT để kiểm tra lịch sử' },
      );
      expect(removeJudge2.status).toBe(200);
      expect(removeJudge2.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 100,
        starRating: 5,
      });

      // Removed Judge 2 can still view their excluded evaluation read-only, but cannot save or submit
      const gk2ReadExcluded = await callAsJudge(
        judge2Bct,
        `/judge/products/${productId}/evaluation`,
      );
      expect(gk2ReadExcluded.status).toBe(200);
      expect(gk2ReadExcluded.body.data.evaluation.status).toBe(
        EvaluationStatus.EXCLUDED,
      );
      expect(
        [403, 409].includes(
          (
            await callAsJudge(
              judge2Bct,
              `/judge/products/${productId}/evaluation`,
              'PUT',
              { scores: scoreSheet(60, 40) },
            )
          ).status,
        ),
      ).toBe(true);

      // Chair can see the EXCLUDED evaluation in product results
      const resultsWithExcluded = await f.call(
        'viewer',
        `/admin/products/${productId}/results`,
      );
      expect(resultsWithExcluded.status).toBe(200);
      expect(
        resultsWithExcluded.body.data.evaluations.map(
          (e: { status: string }) => e.status,
        ),
      ).toEqual(
        expect.arrayContaining([
          EvaluationStatus.SUBMITTED,
          EvaluationStatus.EXCLUDED,
        ]),
      );

      // Reopen product, then re-assign Judge 2: first without confirmRestore -> returns requiresRestoreConfirmation; then with confirmRestore: true -> restores SUBMITTED sheet (60 pts) and recomputes product to 80 pts!
      await f.call('viewer', `/admin/products/${productId}/reopen`, 'POST', {
        reason: 'Mở lại để giao lại GK2',
      });

      const restorePrompt = await f.call(
        'viewer',
        `/admin/products/${productId}/assignments`,
        'POST',
        {
          judgeId: judge2Bct.id,
          reason: 'Giao lại cho GK2',
        },
      );
      expect(restorePrompt.status).toBe(201);
      expect(restorePrompt.body.data).toMatchObject({
        requiresRestoreConfirmation: true,
        previousEvaluation: {
          previousStatus: EvaluationStatus.SUBMITTED,
          total: 60,
          scoreCount: 2,
        },
      });

      const restoreConfirmed = await f.call(
        'viewer',
        `/admin/products/${productId}/assignments`,
        'POST',
        {
          judgeId: judge2Bct.id,
          reason: 'Xác nhận khôi phục phiếu GK2',
          confirmRestore: true,
        },
      );
      expect(restoreConfirmed.status).toBe(201);
      expect(restoreConfirmed.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 80,
        starRating: 4,
      });

      // =====================================================================
      // #13: Reopen Judge 2's submitted evaluation so Judge 2 can fix a mistake and resubmit (60 + 20 = 80 pts -> average (100+80)/2 = 90 pts, 5 stars)
      // =====================================================================
      const gk2EvalId = restorePrompt.body.data.previousEvaluation.id as string;
      const reopenEval = await f.call(
        'viewer',
        `/admin/products/${productId}/evaluations/${gk2EvalId}/reopen`,
        'POST',
        { reason: 'Mở lại phiếu theo đề nghị của GK2 để sửa điểm' },
      );
      expect(reopenEval.status).toBe(201);
      // Since GK1 still has a valid SUBMITTED sheet (100 pts) and GK2 is no longer mandatory-pending, product stays COMPLETED at 100 pts while GK2 edits, or recomputes when GK2 resubmits
      expect(
        (
          await callAsJudge(
            judge2Bct,
            `/judge/products/${productId}/evaluation`,
            'PUT',
            { scores: scoreSheet(60, 20, 'GK2 đã sửa lại điểm') },
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await callAsJudge(
            judge2Bct,
            `/judge/products/${productId}/evaluation/submit`,
            'POST',
          )
        ).status,
      ).toBe(201);

      // Republish updated 90-point / 5-star result
      const publish2 = await f.call(
        'viewer',
        `/admin/products/${productId}/publish-results`,
        'POST',
        { reason: 'Công bố lại kết quả chính thức 90 điểm' },
      );
      expect(publish2.status).toBe(201);
      expect(publish2.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 90,
        starRating: 5,
        publicationState: ProductPublicationState.PUBLISHED,
      });
      expect(publish2.body.data.resultHistory.length).toBeGreaterThanOrEqual(3);

      const ownerFinal = await f.call('owner', `/my/products/${productId}`);
      expect(ownerFinal.body.data).toMatchObject({
        status: ProductStatus.COMPLETED,
        finalScore: 90,
        starRating: 5,
        publicationState: ProductPublicationState.PUBLISHED,
      });
    });
  });
});
