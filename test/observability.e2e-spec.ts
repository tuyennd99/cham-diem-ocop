import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  INestApplication,
  Injectable,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { Server } from 'node:http';
import request from 'supertest';
import { AuditLogsController } from '../src/controllers/audit-logs.controller';
import { DashboardController } from '../src/controllers/dashboard.controller';
import { NotificationsController } from '../src/controllers/notifications.controller';
import { configureApp } from '../src/config/app';
import { ADMIN_ONLY_KEY } from '../src/decorators/admin-only.decorator';
import { AuditRepository } from '../src/repositories/audit.repository';
import { DashboardRepository } from '../src/repositories/dashboard.repository';
import { NotificationsRepository } from '../src/repositories/notifications.repository';
import { AuditService } from '../src/services/audit.service';
import { DashboardService } from '../src/services/dashboard.service';
import { NotificationsService } from '../src/services/notifications.service';
import type { AccessTokenPayload } from '../src/types/auth';

@Injectable()
class TestAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const adminOnly = this.reflector.getAllAndOverride<boolean>(
      ADMIN_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    const principal = context
      .switchToHttp()
      .getRequest<Request & { user: AccessTokenPayload }>().user;
    if (adminOnly && !principal.isAdmin) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}

describe('Observability endpoints', () => {
  let app: INestApplication;
  let server: Server;
  const dashboardRepository = {
    loadSummaryRows: jest.fn(),
  };
  const notificationsRepository = {
    list: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    createForActiveUsers: jest.fn(),
    findDeadlineTargets: jest.fn(),
  };
  const auditRepository = {
    append: jest.fn(),
    list: jest.fn(),
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    process.env.DISABLE_SCHEDULER = 'true';
    const moduleRef = await Test.createTestingModule({
      controllers: [
        NotificationsController,
        DashboardController,
        AuditLogsController,
      ],
      providers: [
        NotificationsService,
        DashboardService,
        AuditService,
        { provide: NotificationsRepository, useValue: notificationsRepository },
        { provide: DashboardRepository, useValue: dashboardRepository },
        { provide: AuditRepository, useValue: auditRepository },
        { provide: APP_GUARD, useClass: TestAdminGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(
      (
        req: Request & { user?: AccessTokenPayload },
        _res: Response,
        next: NextFunction,
      ) => {
        req.user = {
          sub: 7,
          username: 'test-user',
          organizationId: 20,
          isAdmin: req.headers['x-test-admin'] === 'true',
        };
        next();
      },
    );
    configureApp(app);
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dashboardRepository.loadSummaryRows.mockResolvedValue([]);
    notificationsRepository.list.mockResolvedValue({ data: [], total: 0 });
    notificationsRepository.markRead.mockResolvedValue(true);
    notificationsRepository.markAllRead.mockResolvedValue(2);
    auditRepository.list.mockResolvedValue({ data: [], total: 0 });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns dashboard and statistics through the response contract', async () => {
    const headers = { 'x-test-permissions': 'dashboard.read' };

    await request(server)
      .get('/api/v1/dashboard/summary?year=2026')
      .set(headers)
      .expect(200)
      .expect(({ body }) => {
        const response = body as {
          data: { totalTasks: number; periodCounts: { total: number } };
        };
        expect(response.data.totalTasks).toBe(0);
        expect(response.data.periodCounts.total).toBe(0);
      });

    await request(server)
      .get('/api/v1/statistics/tasks?year=2026')
      .set(headers)
      .expect(200);
  });

  it('requires dashboard.read and audit.read on protected read endpoints', async () => {
    await request(server).get('/api/v1/statistics/tasks').expect(403);
    await request(server).get('/api/v1/audit-logs').expect(403);

    await request(server)
      .get('/api/v1/audit-logs')
      .set('x-test-permissions', 'audit.read')
      .expect(200);
  });

  it('supports per-user notification read and read-all operations', async () => {
    await request(server)
      .get('/api/v1/notifications?unreadOnly=true')
      .expect(200);
    await request(server)
      .post('/api/v1/notifications/12/read')
      .expect(200)
      .expect(({ body }) =>
        expect((body as { data: unknown }).data).toEqual({ success: true }),
      );
    await request(server)
      .post('/api/v1/notifications/read-all')
      .expect(200)
      .expect(({ body }) =>
        expect((body as { data: unknown }).data).toEqual({ updated: 2 }),
      );

    expect(notificationsRepository.markRead).toHaveBeenCalledWith(
      12,
      7,
      expect.any(Date),
    );
    expect(notificationsRepository.markAllRead).toHaveBeenCalledWith(
      7,
      expect.any(Date),
    );
  });

  it('exposes audit logs as read-only and rejects unknown filters', async () => {
    await request(server)
      .post('/api/v1/audit-logs')
      .set('x-test-permissions', 'audit.read')
      .send({})
      .expect(404);
    await request(server)
      .get('/api/v1/audit-logs?password=secret')
      .set('x-test-permissions', 'audit.read')
      .expect(400);
  });
});
