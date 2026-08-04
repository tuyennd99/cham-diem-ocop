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
import { AuthRepository } from '../src/repositories/auth.repository';
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
  createdAt: new Date('2026-07-24T00:00:00.000Z'),
  updatedAt: new Date('2026-07-24T00:00:00.000Z'),
};

const activeUser = {
  id: 1,
  username: 'admin',
  status: 'ACTIVE',
  organizationId: 10,
};

describe('System endpoints (admin only)', () => {
  let app: INestApplication;
  let server: Server;
  let bearerToken: string;
  const systemService = {
    listUsers: jest.fn().mockResolvedValue([safeUser]),
    getUser: jest.fn().mockResolvedValue(safeUser),
    createUser: jest.fn().mockResolvedValue(safeUser),
    updateUser: jest.fn().mockResolvedValue(safeUser),
    deleteUser: jest.fn().mockResolvedValue({ success: true }),
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
  };
  // AccountGuard resolves admin from AuthRepository.findUserById → id === 1.
  const authRepository = {
    findUserById: jest.fn().mockResolvedValue(activeUser),
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
      .overrideProvider(AuthRepository)
      .useValue(authRepository)
      .compile();

    bearerToken =
      'Bearer ' +
      (await moduleRef.get(JwtService).signAsync(
        { sub: 1, username: 'admin', organizationId: 10 },
        {
          secret: process.env.JWT_SECRET,
          algorithm: 'HS256',
          issuer: 'congan-api',
          audience: 'congan-web',
          expiresIn: '15m',
        },
      ));
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    authRepository.findUserById.mockResolvedValue(activeUser);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    '/api/v1/system/users',
    '/api/v1/system/organizations',
    '/api/v1/system/programs',
  ])('rejects a normal user at %s', async (url) => {
    authRepository.findUserById.mockResolvedValue({ ...activeUser, id: 2 });
    await request(server)
      .get(url)
      .set('Authorization', bearerToken)
      .expect(403);
  });

  it('allows admin id 1 to list users', async () => {
    authRepository.findUserById.mockResolvedValue({ ...activeUser, id: 1 });
    await request(server)
      .get('/api/v1/system/users')
      .set('Authorization', bearerToken)
      .expect(200);
  });

  it.each([
    '/api/v1/system/permission-groups',
    '/api/v1/system/permissions',
  ])('removes RBAC endpoint %s', (url) =>
    request(server).get(url).set('Authorization', bearerToken).expect(404),
  );

  it('rejects removed user group fields at the HTTP boundary', async () => {
    authRepository.findUserById.mockResolvedValue({ ...activeUser, id: 1 });
    await request(server)
      .post('/api/v1/system/users')
      .set('Authorization', bearerToken)
      .send({
        username: 'managed-user',
        fullName: 'Managed User',
        password: 'strong-password-value',
        organizationId: 10,
        permissionGroupIds: [3],
      })
      .expect(400);
    expect(systemService.createUser).not.toHaveBeenCalled();
  });
});

describe('SystemService user safety', () => {
  it('hashes a new password with Argon2id and strips sensitive fields', async () => {
    let passwordHash = '';
    const repository = {
      findUserByUsername: jest.fn().mockResolvedValue(null),
      findOrganizationById: jest.fn().mockResolvedValue({ id: 10 }),
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
        },
        1,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(service.getUser(999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
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
