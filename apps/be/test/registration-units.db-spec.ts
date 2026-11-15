import { apiRequest, withTestApp } from './support/db-app';
import { adminFixture } from './support/admin-fixture';

const unitsPath = '/my/registration-units';
const myProductsPath = '/my/products';

describe('Registration units (#24, #25, #26)', () => {
  it('enforces authentication, registrant role, validation, CRUD, and cross-account isolation (#24)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);

      const unauth = await apiRequest(baseUrl, unitsPath);
      expect(unauth.status).toBe(401);

      for (const actor of ['manager', 'viewer', 'scorer'] as const) {
        const forbidden = await f.call(actor, unitsPath);
        expect(forbidden.status).toBe(403);
      }

      const emptyList = await f.call('owner', unitsPath);
      expect(emptyList.status).toBe(200);
      expect(emptyList.body.data).toEqual([]);

      const invalidCreate = await f.call('owner', unitsPath, 'POST', {
        entityName: '   ',
        representativeName: '',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Thôn 1',
        provinceName: 'Tỉnh Thái Nguyên',
        localityName: 'Xã Tân Cương',
      });
      expect(invalidCreate.status).toBe(400);

      const forgedRegistrant = await f.call('owner', unitsPath, 'POST', {
        entityName: 'HTX Nông nghiệp A',
        representativeName: 'Nguyễn Văn A',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Xóm Hồng Thái 2, xã Tân Cương',
        provinceName: 'Tỉnh Thái Nguyên',
        localityName: 'Xã Tân Cương',
        registrantId: f.otherOwner.id,
      });
      expect(forgedRegistrant.status).toBe(400);

      const created = await f.call('owner', unitsPath, 'POST', {
        entityName: '  HTX Nông nghiệp Tân Cương  ',
        representativeName: '  Nguyễn Văn A  ',
        representativeTitle: '  Giám đốc  ',
        contactAddress: '  Xóm Hồng Thái 2, xã Tân Cương  ',
        provinceName: '  Tỉnh Thái Nguyên  ',
        localityName: '  Xã Tân Cương  ',
        localityCode: '  XP19001  ',
        phone: '  0912345678  ',
      });
      expect(created.status).toBe(201);
      expect(created.body.data).toMatchObject({
        entityName: 'HTX Nông nghiệp Tân Cương',
        representativeName: 'Nguyễn Văn A',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Xóm Hồng Thái 2, xã Tân Cương',
        provinceName: 'Tỉnh Thái Nguyên',
        localityName: 'Xã Tân Cương',
        localityCode: 'XP19001',
        phone: '0912345678',
      });
      expect(created.body.data).not.toHaveProperty('registrantId');
      const unitId = created.body.data.id as string;

      // Cross-account isolation: otherOwner cannot see, update, or delete owner's unit
      const otherList = await f.call('otherOwner', unitsPath);
      expect(otherList.status).toBe(200);
      expect(otherList.body.data).toEqual([]);

      const otherUpdate = await f.call(
        'otherOwner',
        `${unitsPath}/${unitId}`,
        'PUT',
        {
          entityName: 'Đơn vị giả mạo',
          representativeName: 'Kẻ lạ',
          representativeTitle: 'Giám đốc',
          contactAddress: 'Địa chỉ lạ',
          provinceName: 'Tỉnh Thái Nguyên',
          localityName: 'Xã Tân Cương',
        },
      );
      expect(otherUpdate.status).toBe(404);

      const otherDelete = await f.call(
        'otherOwner',
        `${unitsPath}/${unitId}`,
        'DELETE',
      );
      expect(otherDelete.status).toBe(404);

      // Owner updates and deletes their own unit
      const updated = await f.call('owner', `${unitsPath}/${unitId}`, 'PUT', {
        entityName: 'HTX Nông nghiệp Tân Cương (Mới)',
        representativeName: 'Nguyễn Văn A',
        representativeTitle: 'Chủ tịch HĐQT',
        contactAddress: 'Xóm Hồng Thái 1, xã Tân Cương',
        provinceName: 'Tỉnh Thái Nguyên',
        localityName: 'Xã Tân Cương',
        localityCode: '',
        phone: '',
      });
      expect(updated.status).toBe(200);
      expect(updated.body.data).toMatchObject({
        id: unitId,
        entityName: 'HTX Nông nghiệp Tân Cương (Mới)',
        representativeTitle: 'Chủ tịch HĐQT',
        contactAddress: 'Xóm Hồng Thái 1, xã Tân Cương',
        localityCode: null,
        phone: null,
      });

      const deleted = await f.call(
        'owner',
        `${unitsPath}/${unitId}`,
        'DELETE',
      );
      expect(deleted.status).toBe(200);
      expect(deleted.body.data).toEqual({ deleted: true });

      const afterDeleteList = await f.call('owner', unitsPath);
      expect(afterDeleteList.status).toBe(200);
      expect(afterDeleteList.body.data).toEqual([]);
    });
  });

  it('preserves product draft and submitted snapshot independently from saved registration units and keeps legacy products intact (#25, #26)', async () => {
    await withTestApp(async ({ app, prisma, baseUrl }) => {
      const f = await adminFixture(app, prisma, baseUrl);
      const category = await prisma.productCategory.findFirstOrThrow({
        where: { isActive: true },
      });

      // 1. Legacy product created before any registration unit exists
      const legacyDraft = await f.call('owner', myProductsPath, 'POST', {
        name: 'Sản phẩm cũ trước khi có Cấu hình chung',
        categoryId: category.id,
        localityId: f.locality.id,
        formData: {
          entityName: 'Cơ sở truyền thống Cũ',
          representativeName: 'Lê Văn Cũ',
          representativeTitle: 'Chủ cơ sở',
          contactAddress: 'Thôn Cũ, Xã Cũ',
          provinceName: f.locality.provinceName,
          localityName: f.locality.name,
          localityCode: f.locality.code,
          phone: '0901112222',
          email: f.owner.email,
          registrationType: 'FIRST',
          sampleQuantity: 1,
          assessmentYear: 2025,
          declarationAccepted: true,
        },
      });
      expect(legacyDraft.status).toBe(201);

      // Existing products must NOT auto-populate registration_units
      const unitsBefore = await f.call('owner', unitsPath);
      expect(unitsBefore.body.data).toEqual([]);

      // 2. Create a saved unit (#24 / #26 quick-save) and a product draft using its fields (#25)
      const savedUnitRes = await f.call('owner', unitsPath, 'POST', {
        entityName: 'HTX Chè Đặc Sản La Bằng',
        representativeName: 'Hoàng Thị D',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Xóm Rừng Vần, xã La Bằng',
        provinceName: f.locality.provinceName,
        localityName: f.locality.name,
        localityCode: f.locality.code,
        phone: '0988777666',
      });
      expect(savedUnitRes.status).toBe(201);
      const savedUnit = savedUnitRes.body.data;

      const productFromUnitRes = await f.call('owner', myProductsPath, 'POST', {
        name: 'Chè La Bằng Thượng Hạng',
        categoryId: category.id,
        localityId: null,
        formData: {
          entityName: savedUnit.entityName,
          representativeName: savedUnit.representativeName,
          representativeTitle: savedUnit.representativeTitle,
          contactAddress: savedUnit.contactAddress,
          provinceName: savedUnit.provinceName,
          localityName: savedUnit.localityName,
          localityCode: savedUnit.localityCode,
          phone: savedUnit.phone,
          email: f.owner.email,
          registrationType: 'FIRST',
          sampleQuantity: 2,
          assessmentYear: 2026,
          declarationAccepted: true,
        },
      });
      expect(productFromUnitRes.status).toBe(201);
      const productId = productFromUnitRes.body.data.id as string;

      // 3. Edit and then delete the saved unit: product draft and print data must keep their own copy
      await f.call('owner', `${unitsPath}/${savedUnit.id}`, 'PUT', {
        entityName: 'HTX Đã Đổi Tên Khác',
        representativeName: 'Người Đại Diện Mới',
        representativeTitle: 'Tổng giám đốc',
        contactAddress: 'Địa chỉ hoàn toàn mới',
        provinceName: f.locality.provinceName,
        localityName: f.locality.name,
        localityCode: f.locality.code,
        phone: '0999999999',
      });
      await f.call('owner', `${unitsPath}/${savedUnit.id}`, 'DELETE');

      const draftDetail = await f.call(
        'owner',
        `${myProductsPath}/${productId}`,
      );
      expect(draftDetail.status).toBe(200);
      expect(draftDetail.body.data.formData).toMatchObject({
        entityName: 'HTX Chè Đặc Sản La Bằng',
        representativeName: 'Hoàng Thị D',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Xóm Rừng Vần, xã La Bằng',
        phone: '0988777666',
        email: f.owner.email,
        assessmentYear: 2026,
      });

      const printData = await f.call(
        'owner',
        `${myProductsPath}/${productId}/registration-print-data`,
      );
      expect(printData.status).toBe(200);
      expect(printData.body.data.formData).toMatchObject({
        entityName: 'HTX Chè Đặc Sản La Bằng',
        representativeName: 'Hoàng Thị D',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Xóm Rừng Vần, xã La Bằng',
        phone: '0988777666',
      });

      // Legacy product also remains intact
      const legacyDetail = await f.call(
        'owner',
        `${myProductsPath}/${legacyDraft.body.data.id}`,
      );
      expect(legacyDetail.status).toBe(200);
      expect(legacyDetail.body.data.formData).toMatchObject({
        entityName: 'Cơ sở truyền thống Cũ',
        representativeName: 'Lê Văn Cũ',
        assessmentYear: 2025,
      });
    });
  });
});
