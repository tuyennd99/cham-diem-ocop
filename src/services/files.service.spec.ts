import {
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
  permissions: ['progress.edit'],
};

function repositoryMock() {
  return {
    findDraftContext: jest.fn().mockResolvedValue({
      id: 11,
      kind: 'PROGRESS',
      status: 'DRAFT',
      ownerOrganizationId: 30,
      reportingPeriod: {
        status: 'OPEN',
        task: {
          leadOrganizationId: 20,
          collaboratorOrganizationIds: [30],
        },
      },
    }),
    draftSize: jest.fn().mockResolvedValue(0),
    addDraftFile: jest.fn(),
    removeDraftFile: jest.fn(),
    findDownload: jest.fn(),
    findWorkspaceDownload: jest.fn(),
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

  it('does not let a collaborator edit another organization draft', async () => {
    const repository = repositoryMock();
    repository.findDraftContext.mockResolvedValue({
      ...(await repository.findDraftContext()),
      ownerOrganizationId: 40,
    });
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );

    await expect(
      service.removeDraftFile(11, 99, unitUser),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires read permission again before opening a private download', async () => {
    const repository = repositoryMock();
    repository.findWorkspaceDownload = jest.fn().mockResolvedValue({
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
        reportingPeriod: {
          status: 'OPEN',
          task: {
            leadOrganizationId: 20,
            completedAt: null,
            collaboratorOrganizationIds: [30],
          },
        },
      },
    });
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );

    await expect(
      service.downloadWorkspaceFile(11, 99, {
        ...unitUser,
        permissions: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('uses tasks.read.all for cross-organization private downloads', async () => {
    const repository = repositoryMock();
    repository.findWorkspaceDownload.mockResolvedValue({
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
        reportingPeriod: {
          status: 'OPEN',
          task: {
            leadOrganizationId: 20,
            completedAt: null,
            collaboratorOrganizationIds: [30],
          },
        },
      },
    });
    const service = new FilesService(
      repository as unknown as FilesRepository,
      'E:\\private-storage',
    );
    const outsider = {
      ...unitUser,
      organizationId: 99,
      permissions: ['tasks.read', 'tasks.read.all'],
    };
    (createReadStream as jest.Mock).mockReturnValue({});

    await expect(service.downloadWorkspaceFile(11, 99, outsider)).resolves.toEqual(
      expect.objectContaining({ originalName: 'report.pdf' }),
    );
    await expect(
      service.downloadWorkspaceFile(11, 99, {
        ...outsider,
        permissions: ['tasks.read'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
