import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { configureApp } from '../src/config/app';
import { SubTasksController } from '../src/controllers/subtask.controller';
import { TasksController } from '../src/controllers/tasks.controller';
import { ReportsService } from '../src/services/reports.service';
import { TasksService } from '../src/services/tasks.service';

class TestPrincipalGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<{ user?: unknown }>();
    req.user = { sub: 1, username: 'thuongtruc', organizationId: 10 };
    return true;
  }
}

describe('Task endpoints', () => {
  let app: INestApplication;
  let server: Server;
  const tasksService = {
    list: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    get: jest.fn().mockResolvedValue({ id: 1, code: 'NV-001' }),
    create: jest.fn().mockResolvedValue({ id: 1, code: 'NV-001' }),
    update: jest.fn().mockResolvedValue({ id: 1, code: 'NV-001' }),
    remove: jest.fn().mockResolvedValue({ id: 1, deletedAt: new Date() }),
  };
  const reportsService = {
    listTaskWorkspaces: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController, SubTasksController],
      providers: [
        { provide: TasksService, useValue: tasksService },
        { provide: ReportsService, useValue: reportsService },
        { provide: APP_GUARD, useClass: TestPrincipalGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('lists tasks with the authenticated principal', async () => {
    await request(server).get('/api/v1/tasks').expect(200);
    expect(tasksService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      expect.objectContaining({ sub: 1, organizationId: 10 }),
    );
  });

  it('rejects Program organization fields on child Task writes', async () => {
    await request(server)
      .post('/api/v1/tasks')
      .send({
        code: 'NV-001',
        name: 'Nhiệm vụ con',
        type: 'DOT_XUAT',
        programId: 1,
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        dueAt: '2026-08-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('allows child Task creation without organization fields', async () => {
    await request(server)
      .post('/api/v1/tasks')
      .send({
        code: 'NV-001',
        name: 'Nhiệm vụ con',
        type: 'DOT_XUAT',
        programId: 1,
        dueAt: '2026-08-01T00:00:00.000Z',
      })
      .expect(201);
  });

  it('lists report workspaces for a child Task', async () => {
    await request(server).get('/api/v1/tasks/2/report-workspaces').expect(200);
    expect(reportsService.listTaskWorkspaces).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ sub: 1 }),
    );
  });
});
