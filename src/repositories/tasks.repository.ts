import { ConflictException, Injectable } from '@nestjs/common';
import {
  Frequency,
  SubtaskStatus,
  Prisma,
  ReportStatus,
  TaskDeadlineStatus,
  TaskType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RequestMeta } from '../types/auth';
import { calculateTaskDeadlineStatus } from '../utils/task-deadline-status';
import { ACTIONS_TASK } from '../constants/actions';
import { ErrorCode } from '../types/error-code';
import { TaskView, TaskWrite } from '../types/task';

const taskInclude = {
  program: { select: { id: true, code: true, name: true } },
  assigningOrganization: { select: { id: true, code: true, name: true } },
  leadOrganization: { select: { id: true, code: true, name: true } },
  collaborators: {
    include: {
      organization: { select: { id: true, code: true, name: true } },
    },
  },
  subtasks: {
    orderBy: [{ startAt: 'desc' as const }, { id: 'desc' as const }],
    include: {
      workspaces: {
        select: {
          status: true,
          ownerOrganizationId: true,
        },
      },
    },
  },
} satisfies Prisma.TaskInclude;

type TaskPayload = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) { }

  async list(input: {
    page: number;
    limit: number;
    organizationId: number;
    globalScope: boolean;
  }) {
    const where = this.taskScope(input.organizationId, input.globalScope);
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
        this.toTask(row, input.organizationId, input.globalScope),
      ),
      total,
    };
  }

  async findById(
    id: number,
    organizationId: number,
    globalScope: boolean,
  ): Promise<TaskView | null> {
    const row = await this.prisma.task.findFirst({
      where: {
        id,
        ...this.taskScope(organizationId, globalScope),
      },
      include: taskInclude,
    });
    return row ? this.toTask(row, organizationId, globalScope) : null;
  }

  async codeExists(code: string, excludeId?: number) {
    return (
      (await this.prisma.task.count({
        where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
      })) > 0
    );
  }

  findActiveProgram(id: number) {
    return this.prisma.program.findFirst({
      where: { id, status: 'ACTIVE' },
      select: { id: true },
    });
  }

  findActiveOrganizations(ids: number[]) {
    return this.prisma.organization.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      select: {
        id: true,
        isAssigningAuthority: true,
        isExecutingUnit: true,
      },
    });
  }

  listActiveOrganizations() {
    return this.prisma.organization.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        isAssigningAuthority: true,
        isExecutingUnit: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  listActivePrograms() {
    return this.prisma.program.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        status: true,
      },
      orderBy: { name: 'asc' },
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
          code: input.code,
          name: input.name,
          description: input.description,
          expectedOutput: input.expectedOutput,
          type: input.type,
          programId: input.programId,
          assigningOrganizationId: input.assigningOrganizationId,
          leadOrganizationId: input.leadOrganizationId,
          dueAt: input.dueAt,
          deadlineStatus:
            input.type === TaskType.DOT_XUAT
              ? calculateTaskDeadlineStatus(
                { dueAt: input.dueAt, completedAt: null },
                now,
              )
              : null,
          startAt: input.startAt,
          createdById: actorId,
          updatedById: actorId,
          collaborators: {
            create: input.collaboratorOrganizationIds.map((organizationId) => ({
              organizationId,
            })),
          },
          ...(input.type === TaskType.DOT_XUAT
            ? {
              subtasks: {
                create: {
                  title: input.name,
                  startAt: now,
                  dueAt: input.dueAt,
                  createdById: actorId,
                  createdByOrganizationId: input.assigningOrganizationId,
                },
              },
            }
            : {}),
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
      const changesAssignment = this.changesAssignment(before, input);
      if (
        changesAssignment &&
        (before.completedAt !== null ||
          before.closedAt !== null ||
          (await transaction.reportWorkspace.count({
            where: { subtask: { taskId: id } },
          })) > 0)
      ) {
        throw new ConflictException(
          ErrorCode.TASK_ASSIGNMENT_CANNOT_BE_CHANGED,
        );
      }
      if (input.collaboratorOrganizationIds) {
        await transaction.taskCollaborator.deleteMany({
          where: { taskId: id },
        });
        await transaction.taskCollaborator.createMany({
          data: input.collaboratorOrganizationIds.map((organizationId) => ({
            taskId: id,
            organizationId,
          })),
        });
      }
      const taskData = { ...input };
      delete taskData.collaboratorOrganizationIds;
      const row = await transaction.task.update({
        where: { id },
        data: { ...taskData, updatedById: actorId },
        include: taskInclude,
      });
      if (row.type === TaskType.DOT_XUAT && input.dueAt) {
        await transaction.subtask.updateMany({
          where: { taskId: id },
          data: { dueAt: input.dueAt },
        });
      }
      await transaction.auditLog.create({
        data: {
          actorId,
          action: changesAssignment
            ? ACTIONS_TASK.TASK_ASSIGNMENT_UPDATED
            : ACTIONS_TASK.TASK_UPDATED,
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

  private changesAssignment(
    before: TaskPayload,
    input: Partial<TaskWrite>,
  ): boolean {
    if (
      (input.assigningOrganizationId !== undefined &&
        input.assigningOrganizationId !== before.assigningOrganizationId) ||
      (input.leadOrganizationId !== undefined &&
        input.leadOrganizationId !== before.leadOrganizationId)
    ) {
      return true;
    }
    if (input.collaboratorOrganizationIds === undefined) return false;

    const current = before.collaborators
      .map(({ organizationId }) => organizationId)
      .sort((left, right) => left - right);
    const next = [...input.collaboratorOrganizationIds].sort(
      (left, right) => left - right,
    );
    return (
      current.length !== next.length ||
      current.some((organizationId, index) => organizationId !== next[index])
    );
  }

  async softDelete(
    id: number,
    deletedAt: Date,
    actorId: number,
    meta: RequestMeta = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`,
      );
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

  countOpenSubtasks(taskId: number) {
    return this.prisma.subtask.count({
      where: { taskId, status: SubtaskStatus.OPEN },
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
      if (
        (await transaction.subtask.count({
          where: { taskId: id, status: SubtaskStatus.OPEN },
        })) > 0
      ) {
        return null;
      }
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
          action: 'TASK_COMPLETED',
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

  listSubTasks(taskId: number) {
    return this.prisma.subtask.findMany({
      where: { taskId },
      orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
    });
  }

  async createSubTask(
    taskId: number,
    data: {
      title: string;
      description?: string;
      startAt: Date;
      dueAt: Date;
      createdById: number;
      createdByOrganizationId: number;
    },
  ) {
    return this.prisma.$transaction(async (transaction) => {
      const rows = await transaction.$queryRaw<
        { closedAt: Date | null; deletedAt: Date | null }[]
      >(
        Prisma.sql`
          SELECT "closedAt", "deletedAt"
          FROM "tasks"
          WHERE "id" = ${taskId}
          FOR UPDATE
        `,
      );
      if (!rows[0] || rows[0].closedAt || rows[0].deletedAt) {
        throw new ConflictException(
          'Không thể tạo kỳ báo cáo cho nhiệm vụ đã đóng hoặc đã xóa',
        );
      }
      try {
        return await transaction.subtask.create({
          data: { taskId, ...data, },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException('Nhiệm vụ con trùng tên đã tồn tại');
        }
        throw error;
      }
    });
  }

  findSubTask(id: number) {
    return this.prisma.subtask.findUnique({
      where: { id },
      select: { id: true, taskId: true, status: true },
    });
  }

  async cancelSubTask(
    id: number,
    reason: string,
    canceledAt: Date,
    actorId: number,
    meta: RequestMeta = {},
  ) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT "id" FROM "subtasks" WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await transaction.subtask.findUnique({
        where: { id },
      });
      const updated = await transaction.subtask.updateMany({
        where: { id, status: SubtaskStatus.OPEN },
        data: {
          status: SubtaskStatus.CANCELED,
          canceledAt,
          cancelReason: reason,
        },
      });
      if (updated.count !== 1) return null;
      const after = await transaction.subtask.findUniqueOrThrow({
        where: { id },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: ACTIONS_TASK.REPORTING_SUBTASK_CANCELED,
          entityType: 'Subtask',
          entityId: id,
          reason,
          beforeData: before ? this.subtaskAudit(before) : undefined,
          afterData: this.subtaskAudit(after),
          ...this.auditMeta(meta),
        },
      });
      return transaction.subtask.findUnique({ where: { id } });
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
          OR: [
            { assigningOrganizationId: organizationId },
            { leadOrganizationId: organizationId },
            { collaborators: { some: { organizationId } } },
          ],
        }),
    };
  }

  private toTask(
    row: TaskPayload,
    organizationId?: number,
    globalScope = true,
  ): TaskView {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      expectedOutput: row.expectedOutput,
      type: row.type,
      programId: row.programId,
      assigningOrganizationId: row.assigningOrganizationId,
      leadOrganizationId: row.leadOrganizationId,
      collaboratorOrganizationIds: row.collaborators.map(
        ({ organizationId }) => organizationId,
      ),
      hasSubmittedReport: row.subtasks.some((subtask) =>
        subtask.workspaces.some(
          (workspace) =>
            workspace.status === ReportStatus.SUBMITTED &&
            (globalScope ||
              row.leadOrganizationId === organizationId ||
              workspace.ownerOrganizationId === organizationId),
        ),
      ),
      dueAt: row.dueAt,
      deadlineStatus: row.deadlineStatus,
      startAt: row.startAt,
      closedAt: row.closedAt,
      closeReason: row.closeReason,
      completedAt: row.completedAt,
      deletedAt: row.deletedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      program: row.program,
      assigningOrganization: row.assigningOrganization,
      leadOrganization: row.leadOrganization,
      collaboratorOrganizations: row.collaborators.map(
        ({ organization }) => organization,
      ),
      subtasks: row.subtasks.map((subtask) => ({
        id: subtask.id,
        taskId: subtask.taskId,
        startAt: subtask.startAt,
        dueAt: subtask.dueAt,
        status: subtask.status,
        completedAt: subtask.completedAt,
        canceledAt: subtask.canceledAt,
        cancelReason: subtask.cancelReason,
        createdAt: subtask.createdAt,

      })),
    };
  }

  private taskAudit(task: TaskView) {
    return {
      code: task.code,
      name: task.name,
      type: task.type,
      programId: task.programId,
      assigningOrganizationId: task.assigningOrganizationId,
      leadOrganizationId: task.leadOrganizationId,
      collaboratorOrganizationIds: task.collaboratorOrganizationIds,
      dueAt: task.dueAt?.toISOString() ?? null,
      deadlineStatus: task.deadlineStatus,
      startAt: task.startAt?.toISOString() ?? null,
      closedAt: task.closedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      deletedAt: task.deletedAt?.toISOString() ?? null,
    };
  }

  private subtaskAudit(subtask: {
    taskId: number;
    status: SubtaskStatus;
    dueAt: Date;
    canceledAt: Date | null;
    cancelReason: string | null;
  }) {
    return {
      taskId: subtask.taskId,
      status: subtask.status,
      dueAt: subtask.dueAt.toISOString(),
      canceledAt: subtask.canceledAt?.toISOString() ?? null,
      cancelReason: subtask.cancelReason,
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
