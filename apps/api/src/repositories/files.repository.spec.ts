import { PrismaService } from '../prisma/prisma.service';
import { FilesRepository } from './files.repository';

// Regression guard for FilesRepository['toContext']: it maps a
// ReportWorkspace + Task row into the DraftFileContext used to authorize
// file upload/download/delete. tsc cannot catch a swap between two `number`
// fields (e.g. assigningOrganizationId <-> leadOrganizationId), so every
// source id below is distinct — equal ids would make a swap invisible.
const row = {
  id: 1,
  kind: 'PROGRESS',
  status: 'DRAFT',
  ownerOrganizationId: 40,
  ownerUserId: 41,
  task: {
    assigningOrganizationId: 10,
    leadOrganizationId: 20,
    completedAt: null,
    closedAt: null,
    deletedAt: null,
    collaborators: [{ organizationId: 30 }, { organizationId: 31 }],
  },
};

function repository() {
  const prisma = {} as unknown as PrismaService;
  return new FilesRepository(prisma);
}

describe('FilesRepository toContext mapping', () => {
  it('maps every field to its own source value, not a sibling field', () => {
    const repo = repository() as unknown as {
      toContext: (row: unknown) => {
        id: number;
        kind: string;
        status: string;
        ownerOrganizationId: number;
        ownerUserId: number | null;
        task: {
          assigningOrganizationId: number;
          leadOrganizationId: number;
          completedAt: Date | null;
          closedAt: Date | null;
          deletedAt: Date | null;
          collaboratorOrganizationIds: number[];
        };
      };
    };

    const context = repo.toContext(row);

    expect(context.id).toBe(row.id);
    expect(context.ownerOrganizationId).toBe(row.ownerOrganizationId);
    expect(context.ownerUserId).toBe(row.ownerUserId);
    // These two would swap silently if the mapping wrote
    // assigningOrganizationId: row.task.leadOrganizationId (or vice versa).
    expect(context.task.assigningOrganizationId).toBe(
      row.task.assigningOrganizationId,
    );
    expect(context.task.leadOrganizationId).toBe(row.task.leadOrganizationId);
    expect(context.task.collaboratorOrganizationIds).toEqual([30, 31]);
  });
});
