import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createPrismaAdapter, PrismaClient } from '../src/prisma/client';
import { hashPassword } from '../prisma/seed/password';
import { Server } from 'node:http';
import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';

interface ApiBody<T> {
  data: T;
  meta?: {
    total: number;
  };
}

const testUrl = process.env.TEST_DATABASE_URL;
if (
  !testUrl ||
  !/^postgresql:\/\/[^/]+@(?:127\.0\.0\.1|localhost):5433\/congan_task_test(?:\?|$)/.test(
    testUrl,
  )
) {
  throw new Error(
    'TEST_DATABASE_URL must target congan_task_test on localhost:5433',
  );
}

jest.setTimeout(120_000);

describe('full application on PostgreSQL', () => {
  let app: INestApplication;
  let server: Server;
  let prisma: PrismaClient;
  let storagePath: string;
  let password: string;
  let staffUsername: string;
  let leadUsername: string;
  let collaboratorUsername: string;
  let staffOrganizationId: number;
  let leadOrganizationId: number;
  let collaboratorOrganizationId: number;
  let programId: number;

  beforeAll(async () => {
    process.env.DATABASE_URL = testUrl;
    process.env.JWT_SECRET = 'database-e2e-jwt-secret-at-least-32-bytes';
    process.env.CSRF_SECRET = 'database-e2e-csrf-secret-at-least-32-bytes';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
    process.env.DISABLE_SCHEDULER = 'true';
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    storagePath = resolve(process.cwd(), 'storage', `db-e2e-${suffix}`);
    process.env.STORAGE_PATH = storagePath;
    password = 'Database-E2E-password-123!';
    staffUsername = `staff-${suffix}`;
    leadUsername = `lead-${suffix}`;
    collaboratorUsername = `collaborator-${suffix}`;

    prisma = new PrismaClient({ adapter: createPrismaAdapter(testUrl) });
    await prisma.$connect();
    const [staffGroup, unitGroup] = await Promise.all([
      ensureGroup(prisma, 'THUONG_TRUC', [
        'tasks.read',
        'tasks.create',
        'tasks.update',
        'tasks.delete',
        'tasks.assign',
        'tasks.close',
        'tasks.complete',
        'users.manage',
        'consolidated.review',
        'report_history.read',
        'dashboard.read',
        'audit.read',
      ]),
      ensureGroup(prisma, 'DON_VI', [
        'tasks.read',
        'progress.edit',
        'progress.submit',
        'progress.review',
        'consolidated.edit',
        'consolidated.submit',
        'report_history.read',
        'dashboard.read',
      ]),
    ]);
    const [staffOrganization, leadOrganization, collaboratorOrganization] =
      await Promise.all([
        prisma.organization.create({
          data: {
            code: `staff-${suffix}`,
            name: `Thường trực ${suffix}`,
            isAssigningAuthority: true,
            isExecutingUnit: false,
          },
        }),
        prisma.organization.create({
          data: {
            code: `lead-${suffix}`,
            name: `Chủ trì ${suffix}`,
            isExecutingUnit: true,
          },
        }),
        prisma.organization.create({
          data: {
            code: `collab-${suffix}`,
            name: `Phối hợp ${suffix}`,
            isExecutingUnit: true,
          },
        }),
      ]);
    staffOrganizationId = staffOrganization.id;
    leadOrganizationId = leadOrganization.id;
    collaboratorOrganizationId = collaboratorOrganization.id;
    const passwordHash = await hashPassword(password);
    await Promise.all([
      createUser(
        prisma,
        staffUsername,
        staffOrganization.id,
        staffGroup.id,
        passwordHash,
      ),
      createUser(
        prisma,
        leadUsername,
        leadOrganization.id,
        unitGroup.id,
        passwordHash,
      ),
      createUser(
        prisma,
        collaboratorUsername,
        collaboratorOrganization.id,
        unitGroup.id,
        passwordHash,
      ),
    ]);
    const program = await prisma.program.create({
      data: {
        code: `full-e2e-${suffix}`,
        name: `Full E2E ${suffix}`,
      },
    });
    programId = program.id;

    const { AppModule } =
      jest.requireActual<typeof import('../src/app.module')>(
        '../src/app.module',
      );
    const { configureApp } =
      jest.requireActual<typeof import('../src/config/app')>(
        '../src/config/app',
      );
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    if (storagePath) await rm(storagePath, { recursive: true, force: true });
  });

  it('runs auth, permission, task, report, file, history, dashboard and audit over real repositories', async () => {
    const [staffToken, leadToken, collaboratorToken] = await Promise.all([
      login(server, staffUsername, password),
      login(server, leadUsername, password),
      login(server, collaboratorUsername, password),
    ]);

    const organizationLookups = await request(server)
      .get('/api/v1/tasks/lookups/organizations')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    const programLookups = await request(server)
      .get('/api/v1/tasks/lookups/programs')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    const organizationLookupBody =
      readBody<ApiBody<Array<{ id: number }>>>(organizationLookups);
    const programLookupBody =
      readBody<ApiBody<Array<{ id: number }>>>(programLookups);
    expect(
      organizationLookupBody.data.some(
        (organization: { id: number }) =>
          organization.id === collaboratorOrganizationId,
      ),
    ).toBe(true);
    expect(
      programLookupBody.data.some(
        (program: { id: number }) => program.id === programId,
      ),
    ).toBe(true);

    const dueAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    const taskInput = {
      code: `http-${Date.now()}`,
      name: 'Nhiệm vụ kiểm thử HTTP/PostgreSQL',
      description: 'Luồng tích hợp đầy đủ',
      expectedOutput: 'Báo cáo PDF',
      type: 'DOT_XUAT',
      programId,
      assigningOrganizationId: staffOrganizationId,
      leadOrganizationId,
      collaboratorOrganizationIds: [collaboratorOrganizationId],
      dueAt,
    };
    await request(server)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .send(taskInput)
      .expect(403);

    const taskResponse = await request(server)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(taskInput)
      .expect(201);
    const task = readBody<
      ApiBody<{
        id: number;
        code: string;
        collaboratorOrganizationIds: number[];
      }>
    >(taskResponse).data;
    expect(task.collaboratorOrganizationIds).toEqual([
      collaboratorOrganizationId,
    ]);
    const taskId = task.id;

    const persistedTask = await request(server)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(
      readBody<
        ApiBody<{
          collaboratorOrganizationIds: number[];
        }>
      >(persistedTask).data,
    ).toEqual(
      expect.objectContaining({
        collaboratorOrganizationIds: [collaboratorOrganizationId],
      }),
    );

    const periodsResponse = await request(server)
      .get(`/api/v1/tasks/${taskId}/reporting-periods`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .expect(200);
    const periodId =
      readBody<ApiBody<Array<{ id: number }>>>(periodsResponse).data[0].id;

    const opened = await request(server)
      .get(`/api/v1/progress-reports/periods/${periodId}`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .expect(200);
    const workspaceId = readBody<ApiBody<{ id: number }>>(opened).data.id;

    await request(server)
      .patch(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        leadOrganizationId: collaboratorOrganizationId,
        collaboratorOrganizationIds: [leadOrganizationId],
      })
      .expect(409);

    await request(server)
      .patch(`/api/v1/progress-reports/${workspaceId}`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .send({ content: 'Nội dung phiên bản đã gửi' })
      .expect(200);
    await request(server)
      .post(`/api/v1/progress-reports/${workspaceId}/files`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .attach('file', Buffer.from('%PDF-1.4\nDatabase E2E\n%%EOF'), {
        filename: 'evidence.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    await request(server)
      .post(`/api/v1/progress-reports/${workspaceId}/submit`)
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .expect(201);

    const reviewQueue = await request(server)
      .get(`/api/v1/reporting-periods/${periodId}/report-workspaces`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(200);
    expect(
      readBody<ApiBody<Array<{ id: number }>>>(reviewQueue).data,
    ).toHaveLength(1);
    await request(server)
      .post(`/api/v1/progress-reports/${workspaceId}/approve`)
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(201);

    await request(server)
      .post(`/api/v1/tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(201);

    const completedTask = await request(server)
      .get(`/api/v1/tasks/${taskId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(
      readBody<ApiBody<{ completedAt: string | null }>>(completedTask).data
        .completedAt,
    ).toEqual(expect.any(String));

    const history = await request(server)
      .get('/api/v1/report-history')
      .query({ taskCode: task.code })
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .expect(200);
    const historyBody = readBody<
      ApiBody<
        Array<{
          id: number;
          content: string;
          files: { id: number }[];
        }>
      >
    >(history);
    expect(historyBody.meta?.total).toBe(1);
    const version = historyBody.data[0];
    expect(version.content).toBe('Nội dung phiên bản đã gửi');
    expect(version.files).toHaveLength(1);

    await request(server)
      .get(
        `/api/v1/report-history/versions/${version.id}/files/${version.files[0].id}/download`,
      )
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .expect('Content-Type', /application\/pdf/)
      .expect('Content-Disposition', /evidence\.pdf/)
      .expect(200);

    const dashboard = await request(server)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${collaboratorToken}`)
      .expect(200);
    expect(
      readBody<ApiBody<{ totalTasks: number }>>(dashboard).data.totalTasks,
    ).toBeGreaterThanOrEqual(1);

    const notifications = await request(server)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${leadToken}`)
      .expect(200);
    expect(
      readBody<ApiBody<unknown[]>>(notifications).meta?.total,
    ).toBeGreaterThanOrEqual(1);

    const audit = await request(server)
      .get('/api/v1/audit-logs')
      .query({ entityType: 'Task', entityId: taskId })
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(200);
    expect(
      readBody<ApiBody<Array<{ action: string }>>>(audit).data.some(
        (entry: { action: string }) => entry.action === 'TASK_CREATED',
      ),
    ).toBe(true);
  });
});

async function login(server: Server, username: string, password: string) {
  const response = await request(server)
    .post('/api/v1/auth/login')
    .set('Origin', 'http://localhost:3000')
    .send({ username, password })
    .expect(200);
  return readBody<ApiBody<{ accessToken: string }>>(response).data.accessToken;
}

function readBody<T>(response: { body: unknown }): T {
  return response.body as T;
}

async function ensureGroup(
  prisma: PrismaClient,
  code: string,
  permissionCodes: string[],
) {
  const group = await prisma.permissionGroup.upsert({
    where: { code },
    update: {},
    create: { code, name: code },
  });
  for (const permissionCode of permissionCodes) {
    const permission = await prisma.permission.upsert({
      where: { code: permissionCode },
      update: {},
      create: { code: permissionCode, name: permissionCode },
    });
    await prisma.permissionGroupPermission.upsert({
      where: {
        permissionGroupId_permissionId: {
          permissionGroupId: group.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        permissionGroupId: group.id,
        permissionId: permission.id,
      },
    });
  }
  return group;
}

function createUser(
  prisma: PrismaClient,
  username: string,
  organizationId: number,
  permissionGroupId: number,
  passwordHash: string,
) {
  return prisma.user.create({
    data: {
      username,
      fullName: username,
      passwordHash,
      organizationId,
      permissionGroups: { create: { permissionGroupId } },
    },
  });
}
