import {
  ConflictException,
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { createReadStream } from 'node:fs';
import {
  assertAllowedDocument,
  assertDraftSize,
} from '../utils/document-files';
import { MAX_DRAFT_BYTES } from '../utils/private-storage';
import { FilesRepository } from '../repositories/files.repository';
import { FilesService } from './files.service';

jest.mock('node:fs', () => ({ createReadStream: jest.fn() }));

const unitUser = {
  sub: 2,
  username: 'unit',
  organizationId: 30,
  permissions: [],
};

const downloadRecord = {
  id: 99,
  originalName: 'report.pdf',
  storageKey: '44b4bb72-bdde-4bd8-83ee-58d4f35e3081',
  mimeType: 'application/pdf',
  sizeBytes: 10,
  context: {
    id: 11,
    kind: 'PROGRESS',
    status: 'DRAFT',
    ownerOrganizationId: 30,
    ownerUserId: 2,
    task: {
      assigningOrganizationId: 10,
      leadOrganizationId: 20,
      completedAt: null,
      closedAt: null,
      deletedAt: null,
      collaboratorOrganizationIds: [30],
    },
  },
};

const draftContext = downloadRecord.context;

function repositoryMock() {
  return {
    findDraftContext: jest.fn().mockResolvedValue(draftContext),
    draftSize: jest.fn().mockResolvedValue(0),
    addDraftFile: jest.fn(),
    removeDraftFile: jest.fn(),
    findDownload: jest.fn(),
    findWorkspaceDownload: jest.fn().mockResolvedValue(downloadRecord),
    findVersionDownload: jest.fn(),
    recordDownload: jest.fn(),
  };
}

describe('FilesService', () => {
  it('applies the 200MB limit independently to a draft', () => {
    expect(() => assertDraftSize(MAX_DRAFT_BYTES)).not.toThrow();
    expect(() => assertDraftSize(MAX_DRAFT_BYTES + 1)).toThrow(
      PayloadTooLargeException,
    );
  });

  it('accepts allowed extensions and rejects the rest by file name only', () => {
    expect(assertAllowedDocument('report.pdf')).toBe('pdf');
    expect(assertAllowedDocument('report.PDF')).toBe('pdf');
    expect(() => assertAllowedDocument('report.exe')).toThrow(
      UnsupportedMediaTypeException,
    );
    expect(() => assertAllowedDocument('../evil.pdf')).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('does not let a collaborator edit another user draft', async () => {
    const repository = repositoryMock();
    repository.findDraftContext.mockResolvedValue({
      ...(await repository.findDraftContext()),
      ownerUserId: 40,
    });
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );

    await expect(
      service.removeDraftFile(11, 99, unitUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('locks draft attachments when the task is closed', async () => {
    const repository = repositoryMock();
    repository.findDraftContext.mockResolvedValue({
      ...draftContext,
      task: {
        ...draftContext.task,
        closedAt: new Date('2026-08-12T00:00:00.000Z'),
      },
    });
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );

    await expect(
      service.removeDraftFile(11, 99, unitUser),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lets assigning and lead organizations read report files', async () => {
    const repository = repositoryMock();
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );
    (createReadStream as jest.Mock).mockReturnValue({});

    await expect(
      service.downloadWorkspaceFile(11, 99, {
        ...unitUser,
        organizationId: 10,
      }),
    ).resolves.toEqual(expect.objectContaining({ originalName: 'report.pdf' }));
    await expect(
      service.downloadWorkspaceFile(11, 99, {
        ...unitUser,
        organizationId: 20,
      }),
    ).resolves.toEqual(expect.objectContaining({ originalName: 'report.pdf' }));
  });

  it('denies a private download to a non-participant organization', async () => {
    const repository = repositoryMock();
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );

    await expect(
      service.downloadWorkspaceFile(11, 99, {
        ...unitUser,
        sub: 99,
        organizationId: 99,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an admin download cross-organization files but denies other outsiders', async () => {
    const repository = repositoryMock();
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );
    const outsider = { ...unitUser, sub: 99, organizationId: 99 };
    (createReadStream as jest.Mock).mockReturnValue({});

    await expect(
      service.downloadWorkspaceFile(11, 99, { ...outsider, isAdmin: true }),
    ).resolves.toEqual(expect.objectContaining({ originalName: 'report.pdf' }));
    await expect(
      service.downloadWorkspaceFile(11, 99, outsider),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
