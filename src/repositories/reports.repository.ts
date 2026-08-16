import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ReportKind,
  ReportStatus,
  TaskType,
  UserStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';

const taskInclude = {
  program: { select: { id: true, code: true, name: true } },
  collaborators: { select: { organizationId: true } },
} satisfies Prisma.TaskInclude;

const workspaceInclude = {
  ownerOrganization: { select: { id: true, code: true, name: true } },
  ownerUser: { select: { id: true, username: true, fullName: true } },
  task: { include: taskInclude },
  draftAttachments: {
    include: {
      storedFile: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          checksum: true,
          createdAt: true,
        },
      },
    },
  },
  versions: {
    orderBy: { versionNumber: 'desc' },
    take: 1,
    include: {
      submittedBy: { select: { id: true, username: true, fullName: true } },
      reviewedBy: { select: { id: true, username: true, fullName: true } },
      attachments: {
        include: {
          storedFile: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              checksum: true,
              createdAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReportWorkspaceInclude;

type WorkspacePayload = Prisma.ReportWorkspaceGetPayload<{
  include: typeof workspaceInclude;
}>;

export interface ReportTaskView {
  id: number;
  code: string;
  name: string;
  type: TaskType;
  programId: number;
  startAt: Date | null;
  dueAt: Date | null;
  closedAt: Date | null;
  completedAt: Date | null;
  deletedAt: Date | null;
  assigningOrganizationId: number;
  leadOrganizationId: number;
  collaboratorOrganizationIds: number[];
  program: { id: number; code: string; name: string };
}

export interface ReportWorkspaceView {
  id: number;
  kind: ReportKind;
  status: ReportStatus;
  content: string | null;
  ownerOrganizationId: number;
  ownerUserId: number | null;
  ownerOrganization: { id: number; code: string; name: string };
  ownerUser: { id: number; username: string; fullName: string } | null;
  task: ReportTaskView;
  draftAttachments: unknown[];
  latestVersion: {
    id: number;
    versionNumber: number;
    content: string | null;
    status: ReportStatus;
    submittedBy: { id: number; username: string; fullName: string };
    submittedAt: Date;
    reviewedBy: { id: number; username: string; fullName: string } | null;
    reviewedAt: Date | null;
    rejectionReason: string | null;
    files: unknown[];
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HistoryFilters {
  page: number;
  limit: number;
  taskCode?: string;
  taskName?: string;
  submittedFrom?: string;
  submittedTo?: string;
  dueAt?: string;
  programId?: number;
  organizationId: number;
  userId: number;
  globalScope: boolean;
}

const versionHistoryInclude = {
  submittedBy: {
    select: {
      id: true,
      username: true,
      fullName: true,
      organization: { select: { id: true, code: true, name: true } },
    },
  },
  reviewedBy: {
    select: {
      id: true,
      username: true,
      fullName: true,
      organization: { select: { id: true, code: true, name: true } },
    },
  },
  attachments: {
    include: {
      storedFile: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          checksum: true,
          createdAt: true,
        },
      },
    },
  },
  workspace: {
    include: {
      ownerOrganization: { select: { id: true, code: true, name: true } },
      ownerUser: { select: { id: true, username: true, fullName: true } },
      task: { include: taskInclude },
    },
  },
} satisfies Prisma.ReportVersionInclude;

type VersionHistoryPayload = Prisma.ReportVersionGetPayload<{
  include: typeof versionHistoryInclude;
}>;

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findWorkspace(id: number): Promise<ReportWorkspaceView | null> {
    const row = await this.prisma.reportWorkspace.findUnique({
      where: { id },
      include: workspaceInclude,
    });
    return row ? this.toWorkspace(row) : null;
  }

  async findTaskContext(id: number): Promise<ReportTaskView | null> {
    const row = await this.prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });
    return row ? this.toTask(row) : null;
  }

  resolveUserOrg(userId: number) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { organizationId: true },
    });
  }

  async listTaskWorkspaces(taskId: number): Promise<ReportWorkspaceView[]> {
    const rows = await this.prisma.reportWorkspace.findMany({
      where: { taskId, kind: ReportKind.PROGRESS },
      include: workspaceInclude,
      orderBy: [{ ownerUserId: 'asc' }],
    });
    return rows.map((row) => this.toWorkspace(row));
  }

  async findOrCreateWorkspace(
    taskId: number,
    kind: ReportKind,
    owner: { organizationId: number; userId: number | null },
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT id FROM "tasks" WHERE id = ${taskId} FOR UPDATE`,
      );
      const task = await transaction.task.findUnique({
        where: { id: taskId },
        select: {
          deletedAt: true,
          closedAt: true,
          completedAt: true,
          leadOrganizationId: true,
          collaborators: { select: { organizationId: true } },
        },
      });
      if (!task || task.deletedAt || task.closedAt || task.completedAt) {
        return null;
      }
      const ownerUser = owner.userId
        ? await transaction.user.findFirst({
            where: {
              id: owner.userId,
              status: UserStatus.ACTIVE,
              deletedAt: null,
            },
            select: { organizationId: true },
          })
        : null;
      const collaboratorIds = task.collaborators.map(
        ({ organizationId }) => organizationId,
      );
      if (
        (kind === ReportKind.PROGRESS &&
          (!ownerUser ||
            ownerUser.organizationId !== owner.organizationId ||
            !collaboratorIds.includes(ownerUser.organizationId))) ||
        (kind === ReportKind.CONSOLIDATED &&
          (owner.userId !== null ||
            task.leadOrganizationId !== owner.organizationId))
      ) {
        return null;
      }
      const existing = await transaction.reportWorkspace.findFirst({
        where:
          kind === ReportKind.PROGRESS
            ? { taskId, kind, ownerUserId: owner.userId }
            : { taskId, kind },
        include: workspaceInclude,
      });
      if (existing) return this.toWorkspace(existing);
      const created = await transaction.reportWorkspace.create({
        data: {
          taskId,
          kind,
          ownerOrganizationId: owner.organizationId,
          ownerUserId: owner.userId,
        },
        include: workspaceInclude,
      });
      return this.toWorkspace(created);
    });
  }

  async saveDraft(
    id: number,
    content: string,
    actorId: number,
    meta: RequestMeta = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspaceContext(transaction, id);
      const before = await transaction.reportWorkspace.findUnique({
        where: { id },
        include: workspaceInclude,
      });
      if (
        !before ||
        (before.status !== ReportStatus.DRAFT &&
          before.status !== ReportStatus.REJECTED) ||
        before.task.deletedAt ||
        before.task.closedAt ||
        before.task.completedAt
      ) {
        return null;
      }
      const changed = await transaction.reportWorkspace.updateMany({
        where: {
          id,
          status: { in: [ReportStatus.DRAFT, ReportStatus.REJECTED] },
        },
        data: { content, status: ReportStatus.DRAFT },
      });
      if (changed.count !== 1) return null;
      const after = await transaction.reportWorkspace.findUniqueOrThrow({
        where: { id },
        include: workspaceInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'REPORT_DRAFT_SAVED',
          entityType: 'ReportWorkspace',
          entityId: id,
          beforeData: this.workspaceAudit(this.toWorkspace(before)),
          afterData: this.workspaceAudit(this.toWorkspace(after)),
          ...this.auditMeta(meta),
        },
      });
      return this.toWorkspace(after);
    });
  }

  async createVersionFromDraft(
    workspaceId: number,
    actorId: number,
    meta: RequestMeta = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspaceContext(transaction, workspaceId);
      const workspace = await transaction.reportWorkspace.findUnique({
        where: { id: workspaceId },
        include: {
          draftAttachments: { select: { storedFileId: true } },
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            select: { versionNumber: true },
          },
          task: {
            select: {
              deletedAt: true,
              closedAt: true,
              completedAt: true,
            },
          },
        },
      });
      if (
        !workspace ||
        (workspace.status !== ReportStatus.DRAFT &&
          workspace.status !== ReportStatus.REJECTED) ||
        workspace.task.deletedAt ||
        workspace.task.closedAt ||
        workspace.task.completedAt
      ) {
        return null;
      }
      const version = await transaction.reportVersion.create({
        data: {
          workspaceId,
          versionNumber: (workspace.versions[0]?.versionNumber ?? 0) + 1,
          content: workspace.content,
          submittedById: actorId,
          attachments: {
            create: workspace.draftAttachments.map(({ storedFileId }) => ({
              storedFileId,
            })),
          },
        },
        include: versionHistoryInclude,
      });
      await transaction.reportWorkspace.update({
        where: { id: workspaceId },
        data: { status: ReportStatus.SUBMITTED },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'REPORT_SUBMITTED',
          entityType: 'ReportVersion',
          entityId: version.id,
          beforeData: {
            workspaceId,
            status: workspace.status,
            content: workspace.content,
          },
          afterData: this.versionAudit(this.toVersion(version)),
          ...this.auditMeta(meta),
        },
      });
      return this.toVersion(version);
    });
  }

  approveLatest(workspaceId: number, actorId: number, meta: RequestMeta = {}) {
    return this.reviewLatest(
      workspaceId,
      actorId,
      ReportStatus.APPROVED,
      undefined,
      meta,
    );
  }

  rejectLatest(
    workspaceId: number,
    actorId: number,
    reason: string,
    meta: RequestMeta = {},
  ) {
    return this.reviewLatest(
      workspaceId,
      actorId,
      ReportStatus.REJECTED,
      reason,
      meta,
    );
  }

  returnLatest(
    workspaceId: number,
    actorId: number,
    reason: string,
    meta: RequestMeta = {},
  ) {
    return this.reviewLatest(
      workspaceId,
      actorId,
      ReportStatus.REJECTED,
      reason,
      meta,
      ReportStatus.APPROVED,
    );
  }

  async listHistory(filters: HistoryFilters) {
    const workspaceScope: Prisma.ReportWorkspaceWhereInput = filters.globalScope
      ? {}
      : {
          OR: [
            { task: { assigningOrganizationId: filters.organizationId } },
            { task: { leadOrganizationId: filters.organizationId } },
            { ownerUserId: filters.userId },
          ],
        };
    const where: Prisma.ReportVersionWhereInput = {
      submittedAt: {
        ...(filters.submittedFrom
          ? { gte: new Date(filters.submittedFrom) }
          : {}),
        ...(filters.submittedTo ? { lte: new Date(filters.submittedTo) } : {}),
      },
      workspace: {
        ...workspaceScope,
        task: {
          ...(filters.dueAt ? { dueAt: new Date(filters.dueAt) } : {}),
          ...(filters.taskCode
            ? {
                code: {
                  contains: filters.taskCode,
                  mode: Prisma.QueryMode.insensitive,
                },
              }
            : {}),
          ...(filters.taskName
            ? {
                name: {
                  contains: filters.taskName,
                  mode: Prisma.QueryMode.insensitive,
                },
              }
            : {}),
          ...(filters.programId ? { programId: filters.programId } : {}),
        },
      },
    };
    const [rows, total] = await Promise.all([
      this.prisma.reportVersion.findMany({
        where,
        include: versionHistoryInclude,
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.reportVersion.count({ where }),
    ]);
    return { data: rows.map((row) => this.toVersion(row)), total };
  }

  private async reviewLatest(
    workspaceId: number,
    actorId: number,
    status: typeof ReportStatus.APPROVED | typeof ReportStatus.REJECTED,
    rejectionReason?: string,
    meta: RequestMeta = {},
    fromStatus: ReportStatus = ReportStatus.SUBMITTED,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockWorkspaceContext(transaction, workspaceId);
      const workspace = await transaction.reportWorkspace.findUnique({
        where: { id: workspaceId },
        include: {
          task: {
            select: {
              id: true,
              deletedAt: true,
              closedAt: true,
              completedAt: true,
            },
          },
          versions: {
            where: { status: fromStatus },
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: {
              attachments: { select: { storedFileId: true } },
            },
          },
        },
      });
      const latest = workspace?.versions[0];
      const returningConsolidated =
        status === ReportStatus.REJECTED &&
        fromStatus === ReportStatus.APPROVED &&
        workspace?.kind === ReportKind.CONSOLIDATED;
      if (
        !workspace ||
        workspace.status !== fromStatus ||
        !latest ||
        workspace.task.deletedAt ||
        workspace.task.closedAt ||
        (workspace.task.completedAt && !returningConsolidated)
      ) {
        return null;
      }
      const reviewedAt = new Date();
      if (returningConsolidated) {
        const reopened = await transaction.task.updateMany({
          where: { id: workspace.taskId, completedAt: { not: null } },
          data: { completedAt: null, completedById: null },
        });
        if (reopened.count !== 1) return null;
      }
      if (
        status === ReportStatus.APPROVED &&
        workspace.kind === ReportKind.CONSOLIDATED
      ) {
        const completed = await transaction.task.updateMany({
          where: {
            id: workspace.taskId,
            deletedAt: null,
            closedAt: null,
            completedAt: null,
          },
          data: { completedAt: reviewedAt, completedById: actorId },
        });
        if (completed.count !== 1) return null;
      }
      await transaction.reportVersion.update({
        where: { id: latest.id },
        data: {
          status,
          reviewedById: actorId,
          reviewedAt,
          rejectionReason: rejectionReason ?? null,
        },
      });
      await transaction.reportWorkspace.update({
        where: { id: workspaceId },
        data: {
          status,
          ...(status === ReportStatus.REJECTED
            ? { content: latest.content }
            : {}),
        },
      });
      if (status === ReportStatus.REJECTED) {
        await transaction.draftAttachment.deleteMany({
          where: { workspaceId },
        });
        if (latest.attachments.length > 0) {
          await transaction.draftAttachment.createMany({
            data: latest.attachments.map(({ storedFileId }) => ({
              workspaceId,
              storedFileId,
            })),
            skipDuplicates: true,
          });
        }
      }
      const version = await transaction.reportVersion.findUniqueOrThrow({
        where: { id: latest.id },
        include: versionHistoryInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action:
            status === ReportStatus.APPROVED
              ? 'REPORT_APPROVED'
              : 'REPORT_REJECTED',
          entityType: 'ReportVersion',
          entityId: latest.id,
          reason: rejectionReason,
          beforeData: { status: latest.status, content: latest.content },
          afterData: this.versionAudit(this.toVersion(version)),
          ...this.auditMeta(meta),
        },
      });
      return this.toVersion(version);
    });
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

  private workspaceAudit(workspace: ReportWorkspaceView) {
    return {
      kind: workspace.kind,
      status: workspace.status,
      content: workspace.content,
      ownerOrganizationId: workspace.ownerOrganizationId,
      ownerUserId: workspace.ownerUserId,
      taskId: workspace.task.id,
    };
  }

  private versionAudit(version: ReturnType<ReportsRepository['toVersion']>) {
    return {
      workspaceId: version.workspaceId,
      versionNumber: version.versionNumber,
      status: version.status,
      content: version.content,
      submittedAt: version.submittedAt.toISOString(),
      reviewedAt: version.reviewedAt?.toISOString() ?? null,
      rejectionReason: version.rejectionReason,
      files: version.files.map((file) => {
        const safe = file as {
          id: number;
          originalName: string;
          mimeType: string;
          sizeBytes: number;
        };
        return {
          id: safe.id,
          originalName: safe.originalName,
          mimeType: safe.mimeType,
          sizeBytes: safe.sizeBytes,
        };
      }),
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

  private toTask(row: {
    id: number;
    code: string;
    name: string;
    type: TaskType;
    programId: number;
    startAt: Date | null;
    dueAt: Date | null;
    closedAt: Date | null;
    completedAt: Date | null;
    deletedAt: Date | null;
    assigningOrganizationId: number;
    leadOrganizationId: number;
    collaborators: { organizationId: number }[];
    program: { id: number; code: string; name: string };
  }): ReportTaskView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      programId: row.programId,
      startAt: row.startAt,
      dueAt: row.dueAt,
      closedAt: row.closedAt,
      completedAt: row.completedAt,
      deletedAt: row.deletedAt,
      assigningOrganizationId: row.assigningOrganizationId,
      leadOrganizationId: row.leadOrganizationId,
      collaboratorOrganizationIds: row.collaborators.map(
        ({ organizationId }) => organizationId,
      ),
      program: {
        id: row.program.id,
        code: row.program.code,
        name: row.program.name,
      },
    };
  }

  private toWorkspace(row: WorkspacePayload): ReportWorkspaceView {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      content: row.content,
      ownerOrganizationId: row.ownerOrganizationId,
      ownerUserId: row.ownerUserId,
      ownerOrganization: row.ownerOrganization,
      ownerUser: row.ownerUser,
      task: this.toTask(row.task),
      draftAttachments: row.draftAttachments.map(
        ({ storedFile }) => storedFile,
      ),
      latestVersion: row.versions[0]
        ? {
            id: row.versions[0].id,
            versionNumber: row.versions[0].versionNumber,
            content: row.versions[0].content,
            status: row.versions[0].status,
            submittedBy: row.versions[0].submittedBy,
            submittedAt: row.versions[0].submittedAt,
            reviewedBy: row.versions[0].reviewedBy,
            reviewedAt: row.versions[0].reviewedAt,
            rejectionReason: row.versions[0].rejectionReason,
            files: row.versions[0].attachments.map(
              ({ storedFile }) => storedFile,
            ),
          }
        : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toVersion(row: VersionHistoryPayload) {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      versionNumber: row.versionNumber,
      content: row.content,
      status: row.status,
      submittedBy: row.submittedBy,
      submittedAt: row.submittedAt,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      rejectionReason: row.rejectionReason,
      files: row.attachments.map(({ storedFile }) => storedFile),
      workspace: {
        id: row.workspace.id,
        kind: row.workspace.kind,
        ownerOrganization: row.workspace.ownerOrganization,
        ownerUser: row.workspace.ownerUser,
        task: this.toTask(row.workspace.task),
      },
    };
  }
}
