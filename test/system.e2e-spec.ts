import {
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/app';
import { PERMISSIONS_KEY } from '../src/decorators/permissions.decorator';
import { SystemController } from '../src/controllers/system.controller';
import { PrismaService } from '../src/prisma/prisma.service';
import { SystemRepository } from '../src/repositories/system.repository';
import { SystemService } from '../src/services/system.service';

const safeUser = {
  id: 2,
  username: 'managed-user',
  fullName: 'Managed User',
  organizationId: 10,
  status: 'ACTIVE',
  organization: { id: 10, code: 'UNIT', name: 'Test Unit' },
  permissionGroups: [{ id: 3, code: 'VIEWER', name: 'Viewer' }],
  createdAt: new Date('2026-07-24T00:00:00.000Z'),
  updatedAt: new Date('2026-07-24T00:00:00.000Z'),
};

describe('System endpoints', () => {
  let app: INestApplication;
  let server: Server;
  let accessToken: string;
  let effectivePermissions: string[];
  const systemService = {
    listUsers: jest.fn().mockResolvedValue([safeUser]),
    getUser: jest.fn().mockResolvedValue(safeUser),
    createUser: jest.fn().mockResolvedValue(safeUser),
    updateUser: jest.fn().mockResolvedValue(safeUser),
    deleteUser: jest.fn().mockResolvedValue({ success: true }),
    listUserGroups: jest.fn().mockResolvedValue([]),
    getUserGroup: jest.fn().mockResolvedValue({ id: 40 }),
    createUserGroup: jest.fn().mockResolvedValue({ id: 40 }),
    updateUserGroup: jest.fn().mockResolvedValue({ id: 40 }),
    deleteUserGroup: jest.fn().mockResolvedValue({ success: true }),
    lockUser: jest.fn().mockResolvedValue(safeUser),
    unlockUser: jest.fn().mockResolvedValue(safeUser),
    resetUserPassword: jest.fn().mockResolvedValue({ success: true }),
    listOrganizations: jest.fn().mockResolvedValue([]),
    getOrganization: jest.fn().mockResolvedValue({ id: 10 }),
    createOrganization: jest.fn().mockResolvedValue({ id: 10 }),
    updateOrganization: jest.fn().mockResolvedValue({ id: 10 }),
    deleteOrganization: jest.fn().mockResolvedValue({ success: true }),
    listPrograms: jest.fn().mockResolvedValue([]),
    getProgram: jest.fn().mockResolvedValue({ id: 20 }),
    createProgram: jest.fn().mockResolvedValue({ id: 20 }),
    updateProgram: jest.fn().mockResolvedValue({ id: 20 }),
    deleteProgram: jest.fn().mockResolvedValue({ success: true }),
    listPermissionGroups: jest.fn().mockResolvedValue([]),
    getPermissionGroup: jest.fn().mockResolvedValue({ id: 30 }),
    createPermissionGroup: jest.fn().mockResolvedValue({ id: 30 }),
    updatePermissionGroup: jest.fn().mockResolvedValue({ id: 30 }),
    deletePermissionGroup: jest.fn().mockResolvedValue({ success: true }),
    listPermissions: jest.fn().mockResolvedValue([]),
  };
  const systemRepository = {
    listEffectivePermissions: jest.fn().mockImplementation(() =>
      Promise.resolve({
        status: 'ACTIVE',
        isAdmin: false,
        organizationId: 10,
        permissions: effectivePermissions,
      }),
    ),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    process.env.DISABLE_SCHEDULER = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SystemService)
      .useValue(systemService)
      .overrideProvider(SystemRepository)
      .useValue(systemRepository)
      .compile();

    accessToken = await moduleRef.get(JwtService).signAsync(
      {
        sub: 1,
        username: 'admin',
        organizationId: 10,
        permissions: [
          'users.manage',
          'organizations.manage',
          'programs.manage',
          'permission_groups.manage',
        ],
      },
      {
        secret: process.env.JWT_SECRET,
        algorithm: 'HS256',
        issuer: 'congan-api',
        audience: 'congan-web',
        expiresIn: '15m',
      },
    );
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    effectivePermissions = [];
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['/api/v1/system/users', 'users.manage'],
    ['/api/v1/system/user-groups', 'users.manage'],
    ['/api/v1/system/organizations', 'organizations.manage'],
    ['/api/v1/system/programs', 'programs.manage'],
    ['/api/v1/system/permission-groups', 'permission_groups.manage'],
    ['/api/v1/system/permissions', 'permission_groups.manage'],
  ])('protects GET %s with fresh %s permission', async (url, permission) => {
    effectivePermissions = [permission];
    await request(server)
      .get(url)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    effectivePermissions = [];
    await request(server)
      .get(url)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
  });

  it('rejects non-whitelisted user fields at the HTTP boundary', async () => {
    effectivePermissions = ['users.manage'];

    await request(server)
      .post('/api/v1/system/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        username: 'managed-user',
        fullName: 'Managed User',
        password: 'strong-password-value',
        organizationId: 10,
        permissionGroupIds: [3],
        passwordHash: 'must-not-be-accepted',
      })
      .expect(400);
    expect(systemService.createUser).not.toHaveBeenCalled();
  });

  it('rejects duplicate user-group members at the HTTP boundary', async () => {
    effectivePermissions = ['users.manage'];

    await request(server)
      .post('/api/v1/system/user-groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Tổ A', userIds: [2, 2] })
      .expect(400);
    expect(systemService.createUserGroup).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only user-group name on create', async () => {
    effectivePermissions = ['users.manage'];

    await request(server)
      .post('/api/v1/system/user-groups')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ', userIds: [] })
      .expect(400);
    expect(systemService.createUserGroup).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only user-group name on update', async () => {
    effectivePermissions = ['users.manage'];

    await request(server)
      .patch('/api/v1/system/user-groups/40')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '   ' })
      .expect(400);
    expect(systemService.updateUserGroup).not.toHaveBeenCalled();
  });
});

describe('System permission metadata', () => {
  it.each([
    ['listUsers', 'users.manage'],
    ['getUser', 'users.manage'],
    ['createUser', 'users.manage'],
    ['updateUser', 'users.manage'],
    ['deleteUser', 'users.manage'],
    ['lockUser', 'users.manage'],
    ['unlockUser', 'users.manage'],
    ['resetUserPassword', 'users.manage'],
    ['listUserGroups', 'users.manage'],
    ['getUserGroup', 'users.manage'],
    ['createUserGroup', 'users.manage'],
    ['updateUserGroup', 'users.manage'],
    ['deleteUserGroup', 'users.manage'],
    ['listOrganizations', 'organizations.manage'],
    ['getOrganization', 'organizations.manage'],
    ['createOrganization', 'organizations.manage'],
    ['updateOrganization', 'organizations.manage'],
    ['deleteOrganization', 'organizations.manage'],
    ['listPrograms', 'programs.manage'],
    ['getProgram', 'programs.manage'],
    ['createProgram', 'programs.manage'],
    ['updateProgram', 'programs.manage'],
    ['deleteProgram', 'programs.manage'],
    ['listPermissionGroups', 'permission_groups.manage'],
    ['getPermissionGroup', 'permission_groups.manage'],
    ['createPermissionGroup', 'permission_groups.manage'],
    ['updatePermissionGroup', 'permission_groups.manage'],
    ['deletePermissionGroup', 'permission_groups.manage'],
    ['listPermissions', 'permission_groups.manage'],
  ])('%s requires exactly %s', (methodName, permission) => {
    const handler = (
      SystemController.prototype as unknown as Record<string, unknown>
    )[methodName];
    expect(Reflect.getMetadata(PERMISSIONS_KEY, handler as object)).toEqual([
      permission,
    ]);
  });
});

describe('SystemService user safety', () => {
  it('hashes a new password with Argon2id and strips sensitive fields', async () => {
    let passwordHash = '';
    const repository = {
      findUserByUsername: jest.fn().mockResolvedValue(null),
      findOrganizationById: jest.fn().mockResolvedValue({ id: 10 }),
      findPermissionGroupsByIds: jest.fn().mockResolvedValue([{ id: 3 }]),
      createUser: jest
        .fn()
        .mockImplementation((data: { passwordHash: string }) => {
          passwordHash = data.passwordHash;
          return Promise.resolve({
            ...safeUser,
            passwordHash,
            failedLoginCount: 4,
            refreshSessions: [{ tokenHash: 'secret' }],
          });
        }),
    };
    const service = new SystemService(
      repository as unknown as SystemRepository,
    );

    const result = await service.createUser(
      {
        username: 'managed-user',
        fullName: 'Managed User',
        password: 'strong-password-value',
        organizationId: 10,
        permissionGroupIds: [3],
      },
      1,
      {},
    );

    expect(passwordHash).toMatch(/^\$argon2id\$/);
    expect(JSON.stringify(result)).not.toContain('passwordHash');
    expect(JSON.stringify(result)).not.toContain('failedLoginCount');
    expect(JSON.stringify(result)).not.toContain('refreshSessions');
  });

  it('returns conflict for duplicate usernames and not-found for missing users', async () => {
    const repository = {
      findUserByUsername: jest.fn().mockResolvedValue({ id: 2 }),
      findUserById: jest.fn().mockResolvedValue(null),
    };
    const service = new SystemService(
      repository as unknown as SystemRepository,
    );

    await expect(
      service.createUser(
        {
          username: 'duplicate',
          fullName: 'Duplicate',
          password: 'strong-password-value',
          organizationId: 10,
          permissionGroupIds: [],
        },
        1,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.getUser(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('normalizes a user group and rejects a missing member', async () => {
    const repository = {
      findUserGroupByName: jest.fn().mockResolvedValue(null),
      findUsersByIds: jest.fn().mockResolvedValue([{ id: 2 }]),
      createUserGroup: jest.fn(),
    };
    const service = new SystemService(
      repository as unknown as SystemRepository,
    );

    await expect(
      service.createUserGroup(
        { name: '  Tổ A  ', description: '  Liên đơn vị  ', userIds: [2, 3] },
        1,
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createUserGroup).not.toHaveBeenCalled();
  });
});

describe('SystemRepository security transactions', () => {
  it.each([
    ['lockUser', 'SYSTEM_USER_LOCKED'],
    ['unlockUser', 'SYSTEM_USER_UNLOCKED'],
    ['resetUserPassword', 'SYSTEM_USER_PASSWORD_RESET'],
  ] as const)(
    '%s revokes sessions and writes audit',
    async (method, action) => {
      const auditActions: string[] = [];
      const transaction = {
        user: {
          update: jest.fn().mockResolvedValue(safeUser),
        },
        refreshSession: {
          updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        },
        auditLog: {
          create: jest
            .fn()
            .mockImplementation((args: { data: { action: string } }) => {
              auditActions.push(args.data.action);
              return Promise.resolve(undefined);
            }),
        },
      };
      const prisma = {
        $transaction: jest.fn(
          (callback: (client: typeof transaction) => Promise<unknown>) =>
            callback(transaction),
        ),
      };
      const repository = new SystemRepository(
        prisma as unknown as PrismaService,
      );
      const now = new Date('2026-07-24T00:00:00.000Z');

      if (method === 'lockUser') {
        await repository.lockUser(2, 1, 'Manual review', now, {});
      } else if (method === 'unlockUser') {
        await repository.unlockUser(2, 1, now, {});
      } else {
        await repository.resetUserPassword(2, 1, 'new-hash', now, {});
      }

      expect(transaction.refreshSession.updateMany).toHaveBeenCalledWith({
        where: { userId: 2, revokedAt: null },
        data: { revokedAt: now },
      });
      expect(auditActions).toContain(action);
    },
  );
});
