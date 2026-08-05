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
import {
  SubTasksController,
  TasksController,
} from '../src/controllers/tasks.controller';
import { SubTasksService } from '../src/services/subtask.service';
import { ReportsService } from '../src/services/reports.service';
import { TasksService } from '../src/services/tasks.service';

class TestPrincipalGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    request.user = {
      sub: 1,
      username: 'thuongtruc',
      organizationId: 10,
    };
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
    close: jest.fn().mockResolvedValue({ id: 1, closedAt: new Date() }),
  };
  const subtasksService = {
    list: jest.fn().mockResolvedValue([]),
    cancel: jest.fn().mockResolvedValue({ id: 2, status: 'CANCELED' }),
  };
  const reportsService = {
    listSubtaskWorkspaces: jest.fn().mockResolvedValue([]),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController, SubTasksController],
      providers: [
        { provide: TasksService, useValue: tasksService },
        { provide: SubTasksService, useValue: subtasksService },
        { provide: ReportsService, useValue: reportsService },
        { provide: APP_GUARD, useClass: TestPrincipalGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists tasks with the authenticated principal', async () => {
    await request(server).get('/api/v1/tasks').expect(200);
    expect(tasksService.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
      expect.objectContaining({ sub: 1, organizationId: 10 }),
    );
  });

  it('rejects an empty collaborator list at the HTTP boundary', async () => {
    await request(server)
      .post('/api/v1/tasks')
      .send({
        code: 'NV-001',
        name: 'Nhiệm vụ',
        type: 'DOT_XUAT',
        programId: 1,
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [],
        dueAt: '2026-08-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('allows task creation with tasks.create and tasks.assign', async () => {
    await request(server)
      .post('/api/v1/tasks')
      .send({
        code: 'NV-001',
        name: 'Nhiệm vụ',
        type: 'DOT_XUAT',
        programId: 1,
        assigningOrganizationId: 10,
        leadOrganizationId: 20,
        collaboratorOrganizationIds: [30],
        dueAt: '2026-08-01T00:00:00.000Z',
      })
      .expect(201);
  });

  it('maps close and subtask cancellation endpoints', async () => {
    await request(server)
      .post('/api/v1/tasks/1/close')
      .send({ reason: 'Kết thúc chương trình' })
      .expect(201);
    await request(server)
      .post('/api/v1/reporting-subtasks/2/cancel')
      .send({ reason: 'Không còn yêu cầu báo cáo' })
      .expect(201);

    expect(tasksService.close).toHaveBeenCalledWith(
      1,
      'Kết thúc chương trình',
      expect.objectContaining({ sub: 1 }),
      expect.objectContaining({ requestId: expect.any(String) as string }),
    );
    expect(subtasksService.cancel).toHaveBeenCalledWith(
      2,
      'Không còn yêu cầu báo cáo',
      expect.objectContaining({ sub: 1 }),
      expect.objectContaining({ requestId: expect.any(String) as string }),
    );
  });

  it('lists submitted report workspaces for a reporting subtask', async () => {
    await request(server)
      .get('/api/v1/reporting-subtasks/2/report-workspaces')
      .expect(200);

    expect(reportsService.listSubtaskWorkspaces).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ sub: 1 }),
    );
  });
});
