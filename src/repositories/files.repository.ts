import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, ReportKind, ReportStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';

const fileContextInclude = {
  task: {
    include: {
      program: {
        select: {
          assigningOrganizationId: true,
          leadOrganizationId: true,
          collaborators: { select: { organizationId: true } },
        },
      },
    },
  },
} satisfies Prisma.ReportWorkspaceInclude;

type FileContextPayload = Prisma.ReportWorkspaceGetPayload<{
  include: typeof fileContextInclude;
}>;

export interface DraftFileContext {
  id: number;
  kind: ReportKind;
  status: ReportStatus;
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
}

export interface StoredFileInput {
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
}

export interface DownloadRecord {
  id: number;
  originalName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  context: DraftFileContext;
}

@Injectable()
export class FilesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDraftContext(
    workspaceId: number,
  ): Promise<DraftFileContext | null> {
    const row = await this.prisma.reportWorkspace.findUnique({
      where: { id: workspaceId },
      include: fileContextInclude,
    });
    return row ? this.toContext(row) : null;
  }

  async draftSize(workspaceId: number) {
    const result = await this.prisma.storedFile.aggregate({
      where: { drafts: { some: { workspaceId } } },
      _sum: { sizeBytes: true },
    });
    return result._sum.sizeBytes ?? 0;
  }

  async addDraftFile(
    workspaceId: number,
    file: StoredFileInput,
    actorId: number,
    maxDraftBytes: number,
    meta: RequestMeta = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspaceContext(transaction, workspaceId);
      const workspace = await transaction.reportWorkspace.findUnique({
        where: { id: workspaceId },
        include: fileContextInclude,
      });
      if (!workspace || !this.isEditable(this.toContext(workspace))) {
        throw new ConflictException('Report draft is locked');
      }
      const size = await transaction.storedFile.aggregate({
        where: { drafts: { some: { workspaceId } } },
        _sum: { sizeBytes: true },
      });
      if ((size._sum.sizeBytes ?? 0) + file.sizeBytes > maxDraftBytes) {
        return null;
      }
      const stored = await transaction.storedFile.create({
        data: { ...file, uploadedById: actorId },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          checksum: true,
          createdAt: true,
        },
      });
      await transaction.draftAttachment.create({
        data: { workspaceId, storedFileId: stored.id },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'REPORT_FILE_UPLOADED',
          entityType: 'StoredFile',
          entityId: stored.id,
          afterData: {
            workspaceId,
            originalName: stored.originalName,
            mimeType: stored.mimeType,
            sizeBytes: stored.sizeBytes,
          },
          ...this.auditMeta(meta),
        },
      });
      return stored;
    });
  }

  async removeDraftFile(
    workspaceId: number,
    storedFileId: number,
    actorId: number,
    meta: RequestMeta = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspaceContext(transaction, workspaceId);
      const workspace = await transaction.reportWorkspace.findUnique({
        where: { id: workspaceId },
        include: fileContextInclude,
      });
      if (!workspace || !this.isEditable(this.toContext(workspace))) {
        throw new ConflictException('Report draft is locked');
      }
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "stored_files" WHERE "id" = ${storedFileId} FOR UPDATE`,
      );
      const attachment = await transaction.draftAttachment.findUnique({
        where: { workspaceId_storedFileId: { workspaceId, storedFileId } },
        include: { storedFile: { select: { storageKey: true } } },
      });
      if (!attachment) return null;
      await transaction.draftAttachment.delete({
        where: { workspaceId_storedFileId: { workspaceId, storedFileId } },
      });
      const draftReferences = await transaction.draftAttachment.count({
        where: { storedFileId },
      });
      const versionReferences = await transaction.versionAttachment.count({
        where: { storedFileId },
      });
      const orphaned = draftReferences + versionReferences === 0;
      if (orphaned) {
        await transaction.storedFile.delete({ where: { id: storedFileId } });
      }
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'REPORT_FILE_REMOVED',
          entityType: 'StoredFile',
          entityId: storedFileId,
          beforeData: { workspaceId, storedFileId },
          afterData: { removed: true, orphaned },
          ...this.auditMeta(meta),
        },
      });
      return { storageKey: attachment.storedFile.storageKey, orphaned };
    });
  }

  async findWorkspaceDownload(
    workspaceId: number,
    storedFileId: number,
  ): Promise<DownloadRecord | null> {
    const row = await this.prisma.storedFile.findFirst({
      where: {
        id: storedFileId,
        OR: [
          { drafts: { some: { workspaceId } } },
          {
            versions: {
              some: { reportVersion: { workspaceId } },
            },
          },
        ],
      },
      include: {
        drafts: {
          where: { workspaceId },
          include: {
            workspace: { include: fileContextInclude },
          },
          take: 1,
        },
        versions: {
          where: { reportVersion: { workspaceId } },
          include: {
            reportVersion: {
              include: {
                workspace: { include: fileContextInclude },
              },
            },
          },
          take: 1,
        },
      },
    });
    if (!row) return null;
    const workspace =
      row.drafts[0]?.workspace ??
      row.versions[0]?.reportVersion.workspace ??
      null;
    if (!workspace) return null;
    return {
      id: row.id,
      originalName: row.originalName,
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      context: this.toContext(workspace),
    };
  }

  async findVersionDownload(
    versionId: number,
    storedFileId: number,
  ): Promise<DownloadRecord | null> {
    const row = await this.prisma.storedFile.findFirst({
      where: {
        id: storedFileId,
        versions: { some: { reportVersionId: versionId } },
      },
      include: {
        versions: {
          where: { reportVersionId: versionId },
          include: {
            reportVersion: {
              include: {
                workspace: { include: fileContextInclude },
              },
            },
          },
        },
      },
    });
    const workspace = row?.versions[0]?.reportVersion.workspace;
    if (!row || !workspace) return null;
    return {
      id: row.id,
      originalName: row.originalName,
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      context: this.toContext(workspace),
    };
  }

  recordDownload(
    storedFileId: number,
    actorId: number,
    meta: RequestMeta = {},
  ) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'REPORT_FILE_DOWNLOADED',
        entityType: 'StoredFile',
        entityId: storedFileId,
        ...this.auditMeta(meta),
      },
    });
  }

  private toContext(row: FileContextPayload): DraftFileContext {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      ownerOrganizationId: row.ownerOrganizationId,
      ownerUserId: row.ownerUserId,
      task: {
        assigningOrganizationId: row.task.program.assigningOrganizationId,
        leadOrganizationId: row.task.program.leadOrganizationId,
        completedAt: row.task.completedAt,
        closedAt: row.task.closedAt,
        deletedAt: row.task.deletedAt,
        collaboratorOrganizationIds: row.task.program.collaborators.map(
          ({ organizationId }) => organizationId,
        ),
      },
    };
  }

  private auditMeta(meta: RequestMeta) {
    return {
      organizationId: meta.organizationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      requestId:
        meta.requestId && /^[A-Za-z0-9._-]{1,100}$/.test(meta.requestId)
          ? meta.requestId
          : randomUUID(),
    };
  }

  private lockWorkspaceContext(
    transaction: Prisma.TransactionClient,
    workspaceId: number,
  ) {
    return transaction.$queryRaw(
      Prisma.sql`
        SELECT rw."id"
        FROM "report_workspaces" rw
        JOIN "tasks" task ON task."id" = rw."taskId"
        WHERE rw."id" = ${workspaceId}
        FOR UPDATE OF task, rw
      `,
    );
  }

  private isEditable(context: DraftFileContext) {
    return (
      (context.status === ReportStatus.DRAFT ||
        context.status === ReportStatus.REJECTED) &&
      context.task.completedAt === null &&
      context.task.closedAt === null &&
      context.task.deletedAt === null
    );
  }
}
