import { NotFoundException } from '@nestjs/common';
import { MyRegistrationUnitsController } from '../controllers/my-registration-units.controller';
import { ProductsService } from './products.service';
import type { ProductsRepository } from '../repositories/products.repository';
import type { AccessTokenPayload } from '../types/auth';

describe('MyRegistrationUnitsController & ProductsService registration units', () => {
  const registrantA: AccessTokenPayload = {
    sub: 'user-a',
    email: 'a@example.com',
    role: 'REGISTRANT',
    roles: ['REGISTRANT'],
    tokenVersion: 0,
  };
  const registrantB: AccessTokenPayload = {
    sub: 'user-b',
    email: 'b@example.com',
    role: 'REGISTRANT',
    roles: ['REGISTRANT'],
    tokenVersion: 0,
  };

  function createHarness() {
    const store = new Map<
      string,
      {
        id: string;
        registrantId: string;
        entityName: string;
        representativeName: string;
        representativeTitle: string;
        contactAddress: string;
        provinceName: string;
        localityName: string;
        localityCode: string | null;
        phone: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
    >();
    let seq = 1;

    const repository: Partial<ProductsRepository> = {
      listRegistrationUnits: jest.fn((registrantId: string) =>
        Promise.resolve(
          [...store.values()]
            .filter((item) => item.registrantId === registrantId)
            .map(({ registrantId: _owner, ...rest }) => rest),
        ),
      ),
      createRegistrationUnit: jest.fn((registrantId, input) => {
        const now = new Date();
        const record = {
          id: `unit-${seq++}`,
          registrantId,
          ...input,
          createdAt: now,
          updatedAt: now,
        };
        store.set(record.id, record);
        const { registrantId: _owner, ...publicRecord } = record;
        return Promise.resolve(publicRecord);
      }),
      updateRegistrationUnit: jest.fn((id, registrantId, input) => {
        const current = store.get(id);
        if (!current || current.registrantId !== registrantId) {
          return Promise.resolve(null);
        }
        const updated = {
          ...current,
          ...input,
          updatedAt: new Date(),
        };
        store.set(id, updated);
        const { registrantId: _owner, ...publicRecord } = updated;
        return Promise.resolve(publicRecord);
      }),
      removeRegistrationUnit: jest.fn((id, registrantId) => {
        const current = store.get(id);
        if (!current || current.registrantId !== registrantId) {
          return Promise.resolve(false);
        }
        store.delete(id);
        return Promise.resolve(true);
      }),
    };

    const service = new ProductsService(repository as ProductsRepository);
    const controller = new MyRegistrationUnitsController(service);
    return { controller, service, repository, store };
  }

  it('creates, lists, updates, and deletes registration units scoped strictly to user.sub', async () => {
    const { controller } = createHarness();

    const createdA = await controller.create(registrantA, {
      entityName: '  HTX Nông nghiệp A  ',
      representativeName: '  Nguyễn Văn A  ',
      representativeTitle: '  Giám đốc  ',
      contactAddress: '  Thôn 1, xã Tân Cương  ',
      provinceName: '  Tỉnh Thái Nguyên  ',
      localityName: '  Xã Tân Cương  ',
      localityCode: '  XP19001  ',
      phone: '  0912345678  ',
    });

    expect(createdA).toMatchObject({
      id: 'unit-1',
      entityName: 'HTX Nông nghiệp A',
      representativeName: 'Nguyễn Văn A',
      representativeTitle: 'Giám đốc',
      contactAddress: 'Thôn 1, xã Tân Cương',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Xã Tân Cương',
      localityCode: 'XP19001',
      phone: '0912345678',
    });
    expect(createdA).not.toHaveProperty('registrantId');

    await controller.create(registrantB, {
      entityName: 'Công ty TNHH B',
      representativeName: 'Trần Thị B',
      representativeTitle: 'Tổng giám đốc',
      contactAddress: 'Số 10, phường Phan Đình Phùng',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Phường Phan Đình Phùng',
      localityCode: null,
      phone: null,
    });

    const listA = await controller.list(registrantA);
    const listB = await controller.list(registrantB);
    expect(listA).toHaveLength(1);
    expect(listA[0]?.entityName).toBe('HTX Nông nghiệp A');
    expect(listB).toHaveLength(1);
    expect(listB[0]?.entityName).toBe('Công ty TNHH B');

    await expect(
      controller.update(createdA.id, registrantB, {
        entityName: 'Đơn vị bị chiếm quyền',
        representativeName: 'Kẻ lạ',
        representativeTitle: 'Giám đốc',
        contactAddress: 'Địa chỉ giả',
        provinceName: 'Tỉnh Thái Nguyên',
        localityName: 'Xã Tân Cương',
      }),
    ).rejects.toThrow(NotFoundException);

    await expect(controller.remove(createdA.id, registrantB)).rejects.toThrow(
      NotFoundException,
    );

    const updatedA = await controller.update(createdA.id, registrantA, {
      entityName: 'HTX Nông nghiệp A (Cập nhật)',
      representativeName: 'Nguyễn Văn A',
      representativeTitle: 'Chủ tịch HĐQT',
      contactAddress: 'Thôn 2, xã Tân Cương',
      provinceName: 'Tỉnh Thái Nguyên',
      localityName: 'Xã Tân Cương',
      localityCode: '',
      phone: '',
    });

    expect(updatedA).toMatchObject({
      id: createdA.id,
      entityName: 'HTX Nông nghiệp A (Cập nhật)',
      representativeTitle: 'Chủ tịch HĐQT',
      contactAddress: 'Thôn 2, xã Tân Cương',
      localityCode: null,
      phone: null,
    });

    await expect(controller.remove(createdA.id, registrantA)).resolves.toEqual({
      deleted: true,
    });
    await expect(controller.list(registrantA)).resolves.toEqual([]);
    await expect(controller.list(registrantB)).resolves.toHaveLength(1);
  });
});
