import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import { mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { configureApp } from '../src/config/app';
import { ConsolidatedReportsController } from '../src/controllers/consolidated-reports.controller';
import { ProgressReportsController } from '../src/controllers/progress-reports.controller';
import { ReportHistoryController } from '../src/controllers/report-history.controller';
import { FilesService } from '../src/services/files.service';
import { ReportsService } from '../src/services/reports.service';

class TestPrincipalGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    context.switchToHttp().getRequest<{ user?: unknown }>().user = {
      sub: 2,
      username: 'unit',
      organizationId: 30,
      permissions: [
        'tasks.read',
        'progress.edit',
        'progress.submit',
        'progress.review',
        'consolidated.edit',
        'consolidated.submit',
        'consolidated.review',
        'report_history.read',
      ],
    };
    return true;
  }
}

describe('Report endpoints', () => {
  let app: INestApplication;
  let server: Server;
  let storagePath: string;
  const reports = {
    openProgress: jest.fn().mockResolvedValue({ id: 11 }),
    openConsolidated: jest.fn().mockResolvedValue({ id: 12 }),
    get: jest.fn().mockResolvedValue({ id: 11 }),
    saveDraft: jest.fn().mockResolvedValue({ id: 11, status: 'DRAFT' }),
    submit: jest.fn().mockResolvedValue({ id: 101, versionNumber: 1 }),
    approve: jest.fn().mockResolvedValue({ id: 101, status: 'APPROVED' }),
    reject: jest.fn().mockResolvedValue({ id: 101, status: 'REJECTED' }),
    history: jest.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
  };
  const files = {
    uploadDraftFile: jest.fn(),
    removeDraftFile: jest.fn().mockResolvedValue({ id: 9 }),
    downloadWorkspaceFile: jest.fn(),
    downloadVersionFile: jest.fn(),
  };

  beforeAll(async () => {
    storagePath = await mkdtemp(join(tmpdir(), 'reports-e2e-'));
    process.env.STORAGE_PATH = storagePath;
    process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-characters';
    process.env.CSRF_SECRET = 'test-csrf-secret-at-least-32-characters';
    const moduleRef = await Test.createTestingModule({
      controllers: [
        ProgressReportsController,
        ConsolidatedReportsController,
        ReportHistoryController,
      ],
      providers: [
        { provide: ReportsService, useValue: reports },
        { provide: FilesService, useValue: files },
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
    await rm(storagePath, { recursive: true, force: true });
  });

  it('maps progress draft, submit, approve, reject, and draft file removal', async () => {
    await request(server).get('/api/v1/progress-reports/tasks/7').expect(200);
    await request(server)
      .patch('/api/v1/progress-reports/11')
      .send({ content: 'Tiến độ' })
      .expect(200);
    await request(server)
      .post('/api/v1/progress-reports/11/submit')
      .expect(201);
    await request(server)
      .post('/api/v1/progress-reports/11/approve')
      .expect(201);
    await request(server)
      .post('/api/v1/progress-reports/11/reject')
      .send({ reason: 'Thiếu tài liệu' })
      .expect(201);
    await request(server)
      .delete('/api/v1/progress-reports/11/files/9')
      .expect(200);

    expect(reports.openProgress).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ sub: 2 }),
    );
    expect(reports.saveDraft).toHaveBeenCalledWith(
      11,
      'PROGRESS',
      'Tiến độ',
      expect.objectContaining({ organizationId: 30 }),
      expect.objectContaining({ requestId: expect.any(String) as string }),
    );
    expect(files.removeDraftFile).toHaveBeenCalledWith(
      11,
      9,
      expect.objectContaining({ sub: 2 }),
      expect.objectContaining({ requestId: expect.any(String) as string }),
    );
  });

  it('maps consolidated workspace and submit flow', async () => {
    await request(server).get('/api/v1/consolidated-reports/tasks/7').expect(200);
    await request(server)
      .post('/api/v1/consolidated-reports/12/submit')
      .expect(201);

    expect(reports.openConsolidated).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ sub: 2 }),
    );
    expect(reports.submit).toHaveBeenCalledWith(
      12,
      'CONSOLIDATED',
      expect.objectContaining({ sub: 2 }),
      expect.objectContaining({ requestId: expect.any(String) as string }),
    );
  });

  it('stores an uploaded document privately under a UUID physical name', async () => {
    let uploadedPath = '';
    files.uploadDraftFile.mockImplementationOnce(
      async (
        _workspaceId: number,
        file: { filename: string; path: string },
      ) => {
        uploadedPath = file.path;
        await unlink(file.path);
        return { id: 9, originalName: 'report.pdf' };
      },
    );

    await request(server)
      .post('/api/v1/progress-reports/11/files')
      .attach('file', Buffer.from('%PDF-1.7 test'), {
        filename: 'report.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(resolve(uploadedPath).startsWith(resolve(storagePath))).toBe(true);
    expect(uploadedPath).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('maps allowlisted history filters', async () => {
    await request(server)
      .get('/api/v1/report-history')
      .query({
        taskCode: 'NV-01',
        submittedFrom: '2026-01-01T00:00:00.000Z',
        programId: 3,
      })
      .expect(200);

    expect(reports.history).toHaveBeenCalledWith(
      expect.objectContaining({
        taskCode: 'NV-01',
        programId: 3,
      }),
      expect.objectContaining({ sub: 2 }),
    );
  });

  it('rejects a blank rejection reason at the HTTP boundary', async () => {
    await request(server)
      .post('/api/v1/progress-reports/11/reject')
      .send({ reason: '' })
      .expect(400);
  });
});
