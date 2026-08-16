import { ConflictException, Injectable } from '@nestjs/common';
import {
  Prisma,
  ReportStatus,
  TaskDeadlineStatus,
  TaskType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { ACTIONS_TASK } from '../constants/actions';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';
import { ErrorCode } from '../types/error-code';
import { ProgramResponsibility, TaskView, TaskWrite } from '../types/task';
import { calculateTaskDeadlineStatus } from '../utils/task-deadline-status';

const organizationSelect = { id: true, code: true, name: true } as const;

const programResponsibilityInclude = {
  assigningOrganization: { select: organizationSelect },
  leadOrganization: { select: organizationSelect },
  collaborators: {
    include: { organization: { select: organizationSelect } },
  },
} satisfies Prisma.ProgramInclude;

const taskInclude = {
  program: { include: programResponsibilityInclude },
  workspaces: {
    orderBy: { id: 'asc' as const },
    include: { versions: { select: { status: true } } },
  },
} satisfies Prisma.TaskInclude;

type TaskPayload = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type ProgramPayload = Prisma.ProgramGetPayload<{
  include: typeof programResponsibilityInclude;
}>;

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(input: {
    page: number;
    limit: number;
    search?: string;
    organizationId: number;
    userId: number;
    globalScope: boolean;
  }) {
    const where: Prisma.TaskWhereInput = {
      ...this.taskScope(input.organizationId, input.globalScope),
      ...(input.search
        ? {
            AND: [
              {
                OR: [
                  { name: { contains: input.search, mode: 'insensitive' } },
                  { code: { contains: input.search, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.task.count({ where }),
    ]);
    return {
      data: rows.map((row) =>
        this.toTask(row, input.organizationId, input.userId, input.globalScope),
      ),
      total,
    };
  }

  async findById(
    id: number,
    organizationId: number,
    userId: number,
    globalScope: boolean,
  ): Promise<TaskView | null> {
    const row = await this.prisma.task.findFirst({
      where: { id, ...this.taskScope(organizationId, globalScope) },
      include: taskInclude,
    });
    return row ? this.toTask(row, organizationId, userId, globalScope) : null;
  }

  async codeExists(code: string, excludeId?: number) {
    return (
      (await this.prisma.task.count({
        where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      })) > 0
    );
  }

  async findActiveProgram(id: number): Promise<ProgramResponsibility | null> {
    const row = await this.prisma.program.findFirst({
      where: { id, status: 'ACTIVE' },
      include: programResponsibilityInclude,
    });
    return row ? this.toProgram(row) : null;
  }

  async listActivePrograms() {
    const rows = await this.prisma.program.findMany({
      where: { status: 'ACTIVE' },
      include: programResponsibilityInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map((row) => this.toProgram(row));
  }

  listOrganizationLookups() {
    return this.prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      // Form nhiệm vụ lọc theo vai trò nên lookup phải trả cả hai cờ.
      select: {
        ...organizationSelect,
        isAssigningAuthority: true,
        isExecutingUnit: true,
        status: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async create(
    input: TaskWrite,
    actorId: number,
    now: Date,
    meta: RequestMeta = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const row = await transaction.task.create({
        data: {
          ...input,
          deadlineStatus:
            input.type === TaskType.DOT_XUAT && input.dueAt
              ? calculateTaskDeadlineStatus(
                  { dueAt: input.dueAt, completedAt: null },
                  now,
                )
              : null,
          createdById: actorId,
          updatedById: actorId,
        },
        include: taskInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: ACTIONS_TASK.TASK_CREATED,
          entityType: 'Task',
          entityId: row.id,
          afterData: this.taskAudit(this.toTask(row)),
          ...this.auditMeta(meta),
        },
      });
      return this.toTask(row);
    });
  }

  async update(
    id: number,
    input: Partial<TaskWrite>,
    actorId: number,
    meta: RequestMeta = {},
  ): Promise<TaskView> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await transaction.task.findUniqueOrThrow({
        where: { id },
        include: taskInclude,
      });
      if (
        input.programId !== undefined &&
        input.programId !== before.programId &&
        (before.closedAt !== null ||
          before.completedAt !== null ||
          before.workspaces.length > 0)
      ) {
        throw new ConflictException(
          ErrorCode.TASK_ASSIGNMENT_CANNOT_BE_CHANGED,
        );
      }
      const deadlineStatus =
        (input.type ?? before.type) === TaskType.DOT_XUAT &&
        (input.dueAt ?? before.dueAt)
          ? calculateTaskDeadlineStatus(
              {
                dueAt: input.dueAt ?? before.dueAt,
                completedAt: before.completedAt,
              },
              new Date(),
            )
          : null;
      const row = await transaction.task.update({
        where: { id },
        data: { ...input, deadlineStatus, updatedById: actorId },
        include: taskInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: ACTIONS_TASK.TASK_UPDATED,
          entityType: 'Task',
          entityId: id,
          beforeData: this.taskAudit(this.toTask(before)),
          afterData: this.taskAudit(this.toTask(row)),
          ...this.auditMeta(meta),
        },
      });
      return this.toTask(row);
    });
  }

  async softDelete(
    id: number,
    deletedAt: Date,
    actorId: number,
    meta: RequestMeta = {},
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`,
      );
      const reported = await transaction.reportVersion.count({
        where: {
          workspace: { taskId: id },
          status: { not: ReportStatus.DRAFT },
        },
      });
      if (reported > 0) return null;
      const before = await transaction.task.findUniqueOrThrow({
        where: { id },
        include: taskInclude,
      });
      const row = await transaction.task.update({
        where: { id },
        data: { deletedAt, updatedById: actorId },
        include: taskInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: ACTIONS_TASK.TASK_SOFT_DELETED,
          entityType: 'Task',
          entityId: id,
          beforeData: this.taskAudit(this.toTask(before)),
          afterData: this.taskAudit(this.toTask(row)),
          ...this.auditMeta(meta),
        },
      });
      return this.toTask(row);
    });
  }

  async close(
    id: number,
    reason: string,
    closedAt: Date,
    actorId: number,
    meta: RequestMeta = {},
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await transaction.task.findUniqueOrThrow({
        where: { id },
        include: taskInclude,
      });
      const updated = await transaction.task.updateMany({
        where: { id, deletedAt: null, closedAt: null, type: TaskType.DINH_KY },
        data: {
          closedAt,
          closedById: actorId,
          closeReason: reason,
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) return null;
      const row = await transaction.task.findUniqueOrThrow({
        where: { id },
        include: taskInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: ACTIONS_TASK.TASK_CLOSED,
          entityType: 'Task',
          entityId: id,
          reason,
          beforeData: this.taskAudit(this.toTask(before)),
          afterData: this.taskAudit(this.toTask(row)),
          ...this.auditMeta(meta),
        },
      });
      return this.toTask(row);
    });
  }

  async complete(
    id: number,
    completedAt: Date,
    deadlineStatus: TaskDeadlineStatus,
    actorId: number,
    meta: RequestMeta = {},
  ): Promise<TaskView | null> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await transaction.task.findUniqueOrThrow({
        where: { id },
        include: taskInclude,
      });
      const updated = await transaction.task.updateMany({
        where: {
          id,
          type: TaskType.DOT_XUAT,
          deletedAt: null,
          completedAt: null,
        },
        data: {
          completedAt,
          completedById: actorId,
          deadlineStatus,
          updatedById: actorId,
        },
      });
      if (updated.count !== 1) return null;
      const row = await transaction.task.findUniqueOrThrow({
        where: { id },
        include: taskInclude,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: ACTIONS_TASK.TASK_COMPLETED,
          entityType: 'Task',
          entityId: id,
          beforeData: this.taskAudit(this.toTask(before)),
          afterData: this.taskAudit(this.toTask(row)),
          ...this.auditMeta(meta),
        },
      });
      return this.toTask(row);
    });
  }

  private taskScope(
    organizationId: number,
    globalScope: boolean,
  ): Prisma.TaskWhereInput {
    return {
      deletedAt: null,
      ...(globalScope
        ? {}
        : {
            program: {
              OR: [
                { assigningOrganizationId: organizationId },
                { leadOrganizationId: organizationId },
                { collaborators: { some: { organizationId } } },
              ],
            },
          }),
    };
  }

  private toProgram(row: ProgramPayload): ProgramResponsibility {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      status: row.status,
      assigningOrganizationId: row.assigningOrganizationId,
      leadOrganizationId: row.leadOrganizationId,
      collaboratorOrganizationIds: row.collaborators.map(
        ({ organizationId }) => organizationId,
      ),
      assigningOrganization: row.assigningOrganization,
      leadOrganization: row.leadOrganization,
      collaboratorOrganizations: row.collaborators.map(
        ({ organization }) => organization,
      ),
    };
  }

  private toTask(
    row: TaskPayload,
    organizationId?: number,
    userId?: number,
    globalScope = true,
  ): TaskView {
    const canSeeAllReports =
      globalScope ||
      row.program.assigningOrganizationId === organizationId ||
      row.program.leadOrganizationId === organizationId;
    const visibleWorkspaces = row.workspaces.filter(
      (workspace) => canSeeAllReports || workspace.ownerUserId === userId,
    );
    const hasReports = visibleWorkspaces.some((workspace) =>
      workspace.versions.some(
        (version) => version.status !== ReportStatus.DRAFT,
      ),
    );
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      expectedOutput: row.expectedOutput,
      type: row.type,
      programId: row.programId,
      hasReports,
      dueAt: row.dueAt,
      deadlineStatus: row.deadlineStatus,
      startAt: row.startAt,
      closedAt: row.closedAt,
      closeReason: row.closeReason,
      completedAt: row.completedAt,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      program: this.toProgram(row.program),
      workspaces: visibleWorkspaces.map((workspace) => ({
        id: workspace.id,
        kind: workspace.kind,
        ownerOrganizationId: workspace.ownerOrganizationId,
        ownerUserId: workspace.ownerUserId,
        status: workspace.status,
      })),
    };
  }

  private taskAudit(task: TaskView) {
    return {
      code: task.code,
      name: task.name,
      type: task.type,
      programId: task.programId,
      dueAt: task.dueAt?.toISOString() ?? null,
      deadlineStatus: task.deadlineStatus,
      startAt: task.startAt?.toISOString() ?? null,
      closedAt: task.closedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      deletedAt: task.deletedAt?.toISOString() ?? null,
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
}
