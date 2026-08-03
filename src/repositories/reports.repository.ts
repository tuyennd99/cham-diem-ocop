import { Injectable } from '@nestjs/common';
import {
  Frequency,
  PeriodStatus,
  Prisma,
  ReportKind,
  ReportStatus,
  TaskType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';

const workspaceInclude = {
  ownerOrganization: { select: { id: true, code: true, name: true } },
  reportingPeriod: {
    include: {
      task: {
        include: {
          collaborators: { select: { organizationId: true } },
          program: { select: { id: true, code: true, name: true } },
        },
      },
    },
  },
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

export interface ReportWorkspaceView {
  id: number;
  kind: ReportKind;
  status: ReportStatus;
  content: string | null;
  ownerOrganizationId: number;
  ownerOrganization: { id: number; code: string; name: string };
  reportingPeriod: {
    id: number;
    status: PeriodStatus;
    frequency: Frequency | null;
    year: number;
    sequence: number;
    periodStartAt: Date;
    dueAt: Date;
    task: {
      id: number;
      code: string;
      name: string;
      type: TaskType;
      programId: number;
      assigningOrganizationId: number;
      leadOrganizationId: number;
      completedAt: Date | null;
      deletedAt: Date | null;
      collaboratorOrganizationIds: number[];
      program: { id: number; code: string; name: string };
    };
  };
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

export interface PeriodReportContext {
  id: number;
  status: PeriodStatus;
  task: {
    id: number;
    type: TaskType;
    assigningOrganizationId: number;
    leadOrganizationId: number;
    completedAt: Date | null;
    deletedAt: Date | null;
    collaboratorOrganizationIds: number[];
  };
  approvedProgressCount: number;
}

export interface HistoryFilters {
  page: number;
  limit: number;
  taskCode?: string;
  taskName?: string;
  submittedFrom?: string;
  submittedTo?: string;
  reportingPeriod?: Frequency;
  dueAt?: string;
  programId?: number;
  organizationId: number;
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
      reportingPeriod: {
        include: {
          task: {
            include: {
              program: { select: { id: true, code: true, name: true } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ReportVersionInclude;

type VersionHistoryPayload = Prisma.ReportVersionGetPayload<{
  include: typeof versionHistoryInclude;
}>;

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) { }

  async findWorkspace(id: number): Promise<ReportWorkspaceView | null> {
    const row = await this.prisma.reportWorkspace.findUnique({
      where: { id },
      include: workspaceInclude,
    });
    return row ? this.toWorkspace(row) : null;
  }

  async findPeriodContext(id: number): Promise<PeriodReportContext | null> {
    const row = await this.prisma.reportingPeriod.findUnique({
      where: { id },
      include: {
        task: {
          include: { collaborators: { select: { organizationId: true } } },
        },
        workspaces: {
          where: {
            kind: ReportKind.PROGRESS,
            status: ReportStatus.APPROVED,
          },
          select: { id: true, ownerOrganizationId: true },
        },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      status: row.status,
      task: {
        id: row.task.id,
        type: row.task.type,
        assigningOrganizationId: row.task.assigningOrganizationId,
        leadOrganizationId: row.task.leadOrganizationId,
        completedAt: row.task.completedAt,
        deletedAt: row.task.deletedAt,
        collaboratorOrganizationIds: row.task.collaborators.map(
          ({ organizationId }) => organizationId,
        ),
      },
      approvedProgressCount: row.workspaces.filter(({ ownerOrganizationId }) =>
        row.task.collaborators.some(
          ({ organizationId }) => organizationId === ownerOrganizationId,
        ),
      ).length,
    };
  }

  async listPeriodWorkspaces(
    reportingPeriodId: number,
  ): Promise<ReportWorkspaceView[]> {
    const rows = await this.prisma.reportWorkspace.findMany({
      where: {
        reportingPeriodId,
        status: { not: ReportStatus.DRAFT },
      },
      include: workspaceInclude,
      orderBy: [{ kind: 'asc' }, { ownerOrganizationId: 'asc' }],
    });
    return rows.map((row) => this.toWorkspace(row));
  }

  async findOrCreateWorkspace(
    reportingPeriodId: number,
    kind: ReportKind,
    ownerOrganizationId: number,
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`
          SELECT rp."id"
          FROM "reporting_periods" rp
          JOIN "tasks" task ON task."id" = rp."taskId"
          WHERE rp."id" = ${reportingPeriodId}
          FOR UPDATE OF task, rp
        `,
      );
      const period = await transaction.reportingPeriod.findUnique({
        where: { id: reportingPeriodId },
        select: {
          status: true,
          task: {
            select: {
              type: true,
              deletedAt: true,
              closedAt: true,
              completedAt: true,
              leadOrganizationId: true,
              collaborators: { select: { organizationId: true } },
            },
          },
        },
      });
      if (
        !period ||
        period.status !== PeriodStatus.OPEN ||
        period.task.deletedAt !== null ||
        period.task.closedAt !== null ||
        period.task.completedAt !== null
      ) {
        return null;
      }

      const collaboratorIds = period.task.collaborators.map(
        ({ organizationId }) => organizationId,
      );
      // Lead lập báo cáo tổng hợp gửi cơ quan giao cho CẢ định kỳ lẫn đột xuất,
      // không chờ báo cáo phối hợp duyệt hết. Chỉ chốt owner phải là lead.
      if (
        (kind === ReportKind.PROGRESS &&
          !collaboratorIds.includes(ownerOrganizationId)) ||
        (kind === ReportKind.CONSOLIDATED &&
          period.task.leadOrganizationId !== ownerOrganizationId)
      ) {
        return null;
      }

      const row = await transaction.reportWorkspace.upsert({
        where: {
          reportingPeriodId_kind_ownerOrganizationId: {
            reportingPeriodId,
            kind,
            ownerOrganizationId,
          },
        },
        update: {},
        create: { reportingPeriodId, kind, ownerOrganizationId },
        include: workspaceInclude,
      });
      return this.toWorkspace(row);
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
        before.reportingPeriod.status !== PeriodStatus.OPEN ||
        before.reportingPeriod.task.deletedAt !== null ||
        before.reportingPeriod.task.completedAt !== null
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
          reportingPeriod: {
            select: {
              status: true,
              task: {
                select: {
                  deletedAt: true,
                  completedAt: true,
                  collaborators: { select: { organizationId: true } },
                },
              },
            },
          },
        },
      });
      if (
        !workspace ||
        (workspace.status !== ReportStatus.DRAFT &&
          workspace.status !== ReportStatus.REJECTED) ||
        workspace.reportingPeriod.status !== PeriodStatus.OPEN ||
        workspace.reportingPeriod.task.deletedAt !== null ||
        workspace.reportingPeriod.task.completedAt !== null
      ) {
        return null;
      }
      // Lead được gửi báo cáo tổng hợp bất kể báo cáo phối hợp đã duyệt hết
      // chưa — có thể duyệt phối hợp sau.
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

  async approveLatest(
    workspaceId: number,
    actorId: number,
    meta: RequestMeta = {},
  ) {
    return this.reviewLatest(
      workspaceId,
      actorId,
      ReportStatus.APPROVED,
      undefined,
      meta,
    );
  }

  async rejectLatest(
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

  // Trả lại báo cáo ĐÃ DUYỆT: thao tác trên bản APPROVED thay vì SUBMITTED,
  // đưa về REJECTED + khôi phục draft để đơn vị làm lại. Chỉ dùng cho PROGRESS
  // (consolidated approve đã complete kỳ, không hỗ trợ trả lại ở đây).
  async returnLatest(
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
    // Phạm vi lịch sử theo nhiệm vụ: mọi đơn vị tham gia (giao/chủ trì/phối hợp)
    // đều thấy; admin (globalScope) không giới hạn.
    const taskScope: Prisma.TaskWhereInput = filters.globalScope
      ? {}
      : {
        OR: [
          { assigningOrganizationId: filters.organizationId },
          { leadOrganizationId: filters.organizationId },
          { collaborators: { some: { organizationId: filters.organizationId } } },
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
        reportingPeriod: {
          ...(filters.reportingPeriod
            ? { frequency: filters.reportingPeriod }
            : {}),
          ...(filters.dueAt ? { dueAt: new Date(filters.dueAt) } : {}),
          task: {
            ...taskScope,
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
          reportingPeriod: {
            include: {
              task: {
                include: {
                  collaborators: { select: { organizationId: true } },
                },
              },
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
      // Trả lại tổng hợp đã duyệt: kỳ đang COMPLETED (do chính lần duyệt này
      // đóng), nên chấp nhận và mở lại kỳ bên dưới. Thao tác khác vẫn cần OPEN.
      const returningConsolidated =
        status === ReportStatus.REJECTED &&
        fromStatus === ReportStatus.APPROVED &&
        workspace?.kind === ReportKind.CONSOLIDATED;
      const periodOk =
        workspace?.reportingPeriod.status === PeriodStatus.OPEN ||
        (returningConsolidated &&
          workspace?.reportingPeriod.status === PeriodStatus.COMPLETED);
      if (
        !workspace ||
        workspace.status !== fromStatus ||
        !latest ||
        !periodOk ||
        workspace.reportingPeriod.task.deletedAt !== null ||
        workspace.reportingPeriod.task.completedAt !== null
      ) {
        return null;
      }
      const reviewedAt = new Date();
      if (
        returningConsolidated &&
        workspace.reportingPeriod.status === PeriodStatus.COMPLETED
      ) {
        const reopened = await transaction.reportingPeriod.updateMany({
          where: {
            id: workspace.reportingPeriodId,
            status: PeriodStatus.COMPLETED,
          },
          data: { status: PeriodStatus.OPEN, completedAt: null },
        });
        if (reopened.count !== 1) return null;
      }
      if (
        status === ReportStatus.APPROVED &&
        workspace.kind === ReportKind.CONSOLIDATED
      ) {
        const completed = await transaction.reportingPeriod.updateMany({
          where: {
            id: workspace.reportingPeriodId,
            status: PeriodStatus.OPEN,
          },
          data: { status: PeriodStatus.COMPLETED, completedAt: reviewedAt },
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
          beforeData: {
            status: latest.status,
            content: latest.content,
          },
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
        JOIN "reporting_periods" rp ON rp."id" = rw."reportingPeriodId"
        JOIN "tasks" task ON task."id" = rp."taskId"
        WHERE rw."id" = ${workspaceId}
        FOR UPDATE OF task, rp, rw
      `,
    );
  }

  private workspaceAudit(workspace: ReportWorkspaceView) {
    return {
      kind: workspace.kind,
      status: workspace.status,
      content: workspace.content,
      ownerOrganizationId: workspace.ownerOrganizationId,
      reportingPeriodId: workspace.reportingPeriod.id,
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

  private toWorkspace(row: WorkspacePayload): ReportWorkspaceView {
    const { task } = row.reportingPeriod;
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      content: row.content,
      ownerOrganizationId: row.ownerOrganizationId,
      ownerOrganization: row.ownerOrganization,
      reportingPeriod: {
        id: row.reportingPeriod.id,
        status: row.reportingPeriod.status,
        frequency: row.reportingPeriod.frequency,
        year: row.reportingPeriod.year,
        sequence: row.reportingPeriod.sequence,
        periodStartAt: row.reportingPeriod.periodStartAt,
        dueAt: row.reportingPeriod.dueAt,
        task: {
          id: task.id,
          code: task.code,
          name: task.name,
          type: task.type,
          programId: task.programId,
          assigningOrganizationId: task.assigningOrganizationId,
          leadOrganizationId: task.leadOrganizationId,
          completedAt: task.completedAt,
          deletedAt: task.deletedAt,
          collaboratorOrganizationIds: task.collaborators.map(
            ({ organizationId }) => organizationId,
          ),
          program: task.program,
        },
      },
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
        reportingPeriod: row.workspace.reportingPeriod,
      },
    };
  }
}
