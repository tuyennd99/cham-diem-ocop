import { ADMIN_GROUP_CODE } from '../constants/role';
import { SystemRepository } from '../repositories/system.repository';
import { SystemService } from './system.service';

const user = {
  id: 9,
  username: 'managed-user',
  fullName: 'Managed User',
  organizationId: 10,
  status: 'ACTIVE',
};

const editorGroup = {
  id: 7,
  code: 'EDITOR',
  permissions: [{ permission: { code: 'tasks.update' } }],
};

describe('SystemService authorization administration', () => {
  let service: SystemService;
  let repository: Record<string, jest.Mock>;

  beforeEach(() => {
    repository = {
      findUserById: jest.fn().mockResolvedValue(user),
      findUserByUsername: jest.fn().mockResolvedValue(null),
      findOrganizationById: jest.fn().mockResolvedValue({ id: 10 }),
      findPermissionGroupById: jest.fn().mockResolvedValue(editorGroup),
      findPermissionGroupByCode: jest.fn().mockResolvedValue(null),
      findPermissionGroupsByIds: jest.fn().mockResolvedValue([editorGroup]),
      findPermissionsByIds: jest
        .fn()
        .mockResolvedValue([{ id: 2, code: 'tasks.update' }]),
      listEffectivePermissions: jest.fn().mockResolvedValue({
        status: 'ACTIVE',
        isAdmin: false,
        organizationId: 10,
        permissions: ['users.manage'],
      }),
      createUser: jest.fn().mockResolvedValue(user),
      updateUser: jest.fn().mockResolvedValue(user),
      deleteUser: jest.fn().mockResolvedValue(undefined),
      lockUser: jest.fn().mockResolvedValue(user),
      createPermissionGroup: jest.fn().mockResolvedValue(editorGroup),
      updatePermissionGroup: jest.fn().mockResolvedValue(editorGroup),
      deletePermissionGroup: jest.fn().mockResolvedValue(undefined),
    };
    service = new SystemService(repository as unknown as SystemRepository);
  });

  it('rejects permission changes to ADMIN', async () => {
    repository.findPermissionGroupById.mockResolvedValue({
      id: 1,
      code: ADMIN_GROUP_CODE,
      permissions: [],
    });

    await expect(
      service.updatePermissionGroup(1, { permissionIds: [2] }, 1, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'SYSTEM_GROUP_PROTECTED',
        message: expect.any(String),
      },
    });
  });

  it('rejects changing permission groups for user 1', async () => {
    repository.findUserById.mockResolvedValue({ ...user, id: 1 });

    await expect(
      service.updateUser(1, { permissionGroupIds: [2] }, 1, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'DEFAULT_ADMIN_PROTECTED',
        message: expect.any(String),
      },
    });
  });

  it('rejects deleting user 1', async () => {
    repository.findUserById.mockResolvedValue({ ...user, id: 1 });

    await expect(service.deleteUser(1, 2, {})).rejects.toMatchObject({
      response: {
        errorCode: 'DEFAULT_ADMIN_PROTECTED',
        message: expect.any(String),
      },
    });
  });

  it('rejects locking user 1', async () => {
    repository.findUserById.mockResolvedValue({ ...user, id: 1 });

    await expect(
      service.lockUser(1, 'Manual review', 2, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'DEFAULT_ADMIN_PROTECTED',
        message: expect.any(String),
      },
    });
  });

  it('rejects deleting ADMIN', async () => {
    repository.findPermissionGroupById.mockResolvedValue({
      id: 5,
      code: ADMIN_GROUP_CODE,
      permissions: [],
    });

    await expect(service.deletePermissionGroup(5, 1, {})).rejects.toMatchObject(
      {
        response: {
          errorCode: 'SYSTEM_GROUP_PROTECTED',
          message: expect.any(String),
        },
      },
    );
  });

  it('rejects a permission union larger than the actor permissions', async () => {
    await expect(
      service.updateUser(9, { permissionGroupIds: [7] }, 8, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PRIVILEGE_ESCALATION',
        message: expect.any(String),
      },
    });
  });

  it('rejects excessive permission groups when creating a user', async () => {
    await expect(
      service.createUser(
        {
          username: 'new-user',
          fullName: 'New User',
          password: 'strong-password-value',
          organizationId: 10,
          permissionGroupIds: [7],
        },
        8,
        {},
      ),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PRIVILEGE_ESCALATION',
        message: expect.any(String),
      },
    });
  });

  it('rejects assigning ADMIN by a non-admin', async () => {
    repository.findPermissionGroupsByIds.mockResolvedValue([
      {
        id: 1,
        code: ADMIN_GROUP_CODE,
        permissions: [],
      },
    ]);

    await expect(
      service.updateUser(9, { permissionGroupIds: [1] }, 8, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PRIVILEGE_ESCALATION',
        message: expect.any(String),
      },
    });
  });

  it('rejects unavailable actors from granting permissions', async () => {
    repository.listEffectivePermissions.mockResolvedValue(null);

    await expect(
      service.updateUser(9, { permissionGroupIds: [7] }, 8, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PRIVILEGE_ESCALATION',
        message: expect.any(String),
      },
    });
  });

  it('rejects excessive permissions when creating a permission group', async () => {
    await expect(
      service.createPermissionGroup(
        { code: 'EDITOR', name: 'Editor', permissionIds: [2] },
        8,
        {},
      ),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PRIVILEGE_ESCALATION',
        message: expect.any(String),
      },
    });
  });

  it('rejects excessive permissions when updating a non-ADMIN group', async () => {
    await expect(
      service.updatePermissionGroup(7, { permissionIds: [2] }, 8, {}),
    ).rejects.toMatchObject({
      response: {
        errorCode: 'PRIVILEGE_ESCALATION',
        message: expect.any(String),
      },
    });
  });

  it('allows a non-admin to assign a subset of their permissions', async () => {
    repository.listEffectivePermissions.mockResolvedValue({
      status: 'ACTIVE',
      isAdmin: false,
      organizationId: 10,
      permissions: ['tasks.update', 'users.manage'],
    });

    await expect(
      service.updateUser(9, { permissionGroupIds: [7] }, 8, {}),
    ).resolves.toMatchObject({ id: 9 });
  });

  it('allows an admin to grant permissions outside its explicit union', async () => {
    repository.listEffectivePermissions.mockResolvedValue({
      status: 'ACTIVE',
      isAdmin: true,
      organizationId: 10,
      permissions: [],
    });

    await expect(
      service.updateUser(9, { permissionGroupIds: [7] }, 1, {}),
    ).resolves.toMatchObject({ id: 9 });
  });
});
