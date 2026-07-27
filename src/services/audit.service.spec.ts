import { ForbiddenException } from '@nestjs/common';
import type { AuditRepository } from '../repositories/audit.repository';
import { AuditService } from './audit.service';

const auditor = {
  sub: 1,
  username: 'auditor',
  organizationId: 1,
  permissions: ['audit.read'],
  isAdmin: false,
};

describe('AuditService', () => {
  let repository: jest.Mocked<Pick<AuditRepository, 'append' | 'list'>>;
  let service: AuditService;

  beforeEach(() => {
    repository = {
      append: jest.fn(),
      list: jest.fn(),
    };
    service = new AuditService(repository as AuditRepository);
  });

  it('removes secrets recursively before appending immutable audit data', async () => {
    repository.append.mockResolvedValue({ id: 10 });

    await service.append({
      actorId: 1,
      organizationId: 2,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: 9,
      beforeData: {
        username: 'old',
        passwordHash: 'never-log',
        nested: { refreshToken: 'never-log', status: 'ACTIVE' },
      },
      afterData: {
        username: 'new',
        authorization: 'Bearer secret',
        file: { storageKey: '/private/file', originalName: 'safe.pdf' },
      },
      reason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      requestId: 'req-1',
    });

    expect(repository.append).toHaveBeenCalledWith({
      actorId: 1,
      organizationId: 2,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: 9,
      beforeData: {
        username: 'old',
        nested: { status: 'ACTIVE' },
      },
      afterData: {
        username: 'new',
        file: { originalName: 'safe.pdf' },
      },
      reason: null,
      ipAddress: '127.0.0.1',
      userAgent: 'jest',
      requestId: 'req-1',
    });
  });

  it('sanitizes legacy audit data when reading it', async () => {
    repository.list.mockResolvedValue({
      total: 1,
      data: [
        {
          id: 1,
          actorId: 1,
          organizationId: 2,
          action: 'LOGIN',
          entityType: 'User',
          entityId: 1,
          beforeData: null,
          afterData: { tokenHash: 'hidden', status: 'ACTIVE' },
          reason: null,
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
          requestId: 'req-1',
          createdAt: new Date('2026-07-24T00:00:00.000Z'),
          actor: { id: 1, username: 'auditor', fullName: 'Auditor' },
          organization: { id: 2, code: 'DV-2', name: 'Đơn vị 2' },
        },
      ],
    });

    const result = await service.list({ page: 1, limit: 20 }, auditor);

    expect(result.data[0]?.afterData).toEqual({ status: 'ACTIVE' });
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  });

  it('requires audit.read for audit log access', async () => {
    await expect(
      service.list(
        { page: 1, limit: 20 },
        { ...auditor, permissions: [], isAdmin: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.list).not.toHaveBeenCalled();
  });
});
