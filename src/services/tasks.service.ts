import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TaskType } from '@prisma/client';
import { CreateTaskDto, TaskQueryDto, UpdateTaskDto } from '../dtos/tasks.dto';
import { TasksRepository } from '../repositories/tasks.repository';
import { AccessTokenPayload, RequestMeta } from '../types/auth';
import { ErrorCode } from '../types/error-code';
import { ProgramResponsibility, TaskView, TaskWrite } from '../types/task';
import { assertOrganizationRoles } from '../utils/organization-roles';
import { calculateTaskDeadlineStatus } from '../utils/task-deadline-status';
import { NotificationsService } from './notifications.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly repository: TasksRepository,
    private readonly notificationsService?: NotificationsService,
  ) {}

  async list(query: TaskQueryDto, principal: AccessTokenPayload) {
    const { data, total } = await this.repository.list({
      page: query.page,
      limit: query.limit,
      search: query.search,
      organizationId: principal.organizationId,
      userId: principal.sub,
      globalScope: principal.isAdmin === true,
    });
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async get(id: number, principal: AccessTokenPayload) {
    return this.requireTask(id, principal);
  }

  listProgramLookups() {
    return this.repository.listActivePrograms();
  }

  listOrganizationLookups() {
    return this.repository.listOrganizationLookups();
  }

  async create(
    input: CreateTaskDto,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    try {
      const normalized = this.normalize(input);
      await this.validate(normalized);
      this.assertAssigningOrganization(
        normalized.assigningOrganizationId,
        principal,
      );
      const task = await this.repository.create(
        normalized,
        principal.sub,
        new Date(),
        { ...meta, organizationId: principal.organizationId },
      );
      await this.notifyAssignment(task);
      return task;
    } catch (error) {
      this.rethrowUniqueCode(error);
    }
  }

  async update(
    id: number,
    input: UpdateTaskDto,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const current = await this.requireTask(id, principal);
    this.assertAssigningOrganization(
      current.assigningOrganizationId,
      principal,
    );
    if (input.type && input.type !== current.type) {
      throw new ConflictException('Task type cannot be changed');
    }

    const merged = this.normalize({
      code: input.code ?? current.code,
      name: input.name ?? current.name,
      description:
        input.description === undefined
          ? (current.description ?? undefined)
          : input.description,
      expectedOutput:
        input.expectedOutput === undefined
          ? (current.expectedOutput ?? undefined)
          : input.expectedOutput,
      type: current.type,
      programId: input.programId ?? current.programId,
      assigningOrganizationId:
        input.assigningOrganizationId ?? current.assigningOrganizationId,
      leadOrganizationId:
        input.leadOrganizationId ?? current.leadOrganizationId,
      collaboratorOrganizationIds:
        input.collaboratorOrganizationIds ??
        current.collaboratorOrganizationIds,
      dueAt:
        input.dueAt === undefined ? current.dueAt?.toISOString() : input.dueAt,
      startAt:
        input.startAt === undefined
          ? current.startAt?.toISOString()
          : input.startAt,
    });
    await this.validate(merged, id);

    const changed: Partial<TaskWrite> = {};
    for (const key of Object.keys(input) as (keyof UpdateTaskDto)[]) {
      if (key in merged) {
        (changed as Record<string, unknown>)[key] = merged[key];
      }
    }
    try {
      const task = await this.repository.update(id, changed, principal.sub, {
        ...meta,
        organizationId: principal.organizationId,
      });
      if (input.programId !== undefined) await this.notifyAssignment(task);
      return task;
    } catch (error) {
      this.rethrowUniqueCode(error);
    }
  }

  async remove(
    id: number,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const task = await this.requireTask(id, principal);
    this.assertAssigningOrganization(
      task.assigningOrganizationId,
      principal,
    );
    if (task.hasReports) {
      throw new ConflictException(
        'Task with submitted reports cannot be deleted',
      );
    }
    const removed = await this.repository.softDelete(
      id,
      new Date(),
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!removed) {
      throw new ConflictException(
        'Task with submitted reports cannot be deleted',
      );
    }
    return removed;
  }

  async close(
    id: number,
    reason: string,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
  ) {
    const task = await this.requireTask(id, principal);
    this.assertAssigningOrganization(
      task.assigningOrganizationId,
      principal,
    );
    if (task.type !== TaskType.DINH_KY) {
      throw new BadRequestException('Only periodic tasks can be closed');
    }
    if (task.closedAt) throw new ConflictException('Task is already closed');
    const closed = await this.repository.close(
      id,
      this.requiredText(reason, 'Close reason'),
      new Date(),
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!closed) throw new ConflictException('Task could not be closed');
    await this.safeNotify({
      organizationIds: [
        closed.assigningOrganizationId,
        closed.leadOrganizationId,
        ...closed.collaboratorOrganizationIds,
      ],
      eventKey: `TASK_CLOSED:${closed.id}`,
      type: 'DONG_NHIEM_VU',
      title: 'Nhiệm vụ định kỳ đã đóng',
      body: `${closed.code} - ${closed.name}`,
      entityType: 'Task',
      entityId: closed.id,
    });
    return closed;
  }

  async complete(
    id: number,
    principal: AccessTokenPayload,
    meta: RequestMeta = {},
    completedAt = new Date(),
  ) {
    const task = await this.requireTask(id, principal);
    this.assertAssigningOrganization(
      task.assigningOrganizationId,
      principal,
    );
    if (task.type !== TaskType.DOT_XUAT || !task.dueAt) {
      throw new BadRequestException(
        'Only ad-hoc tasks with a due date can be completed',
      );
    }
    if (task.completedAt)
      throw new ConflictException('Task is already completed');
    const completed = await this.repository.complete(
      id,
      completedAt,
      calculateTaskDeadlineStatus(
        { dueAt: task.dueAt, completedAt },
        completedAt,
      ),
      principal.sub,
      { ...meta, organizationId: principal.organizationId },
    );
    if (!completed) throw new ConflictException('Task could not be completed');
    return completed;
  }

  private async requireTask(
    id: number,
    principal: AccessTokenPayload,
  ): Promise<TaskView> {
    const task = await this.repository.findById(
      id,
      principal.organizationId,
      principal.sub,
      principal.isAdmin === true,
    );
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private async validate(
    input: TaskWrite,
    excludeId?: number,
  ): Promise<ProgramResponsibility> {
    const [duplicate, program] = await Promise.all([
      this.repository.codeExists(input.code, excludeId),
      this.repository.findActiveProgram(input.programId),
    ]);
    if (duplicate) throw new ConflictException('Task code already exists');
    if (!program) throw new BadRequestException('Program is not active');
    const ids = [
      ...new Set([
        input.assigningOrganizationId,
        input.leadOrganizationId,
        ...input.collaboratorOrganizationIds,
      ]),
    ];
    const organizations = await this.repository.findOrganizationsByIds(ids);
    assertOrganizationRoles(organizations, input, 'Task');
    if (input.startAt && input.dueAt && input.startAt > input.dueAt) {
      throw new BadRequestException('startAt must not be after dueAt');
    }
    return program;
  }

  private normalize(input: CreateTaskDto): TaskWrite {
    return {
      code: this.requiredText(input.code, 'Task code'),
      name: this.requiredText(input.name, 'Task name'),
      description: input.description?.trim() || null,
      expectedOutput: input.expectedOutput?.trim() || null,
      type: input.type,
      programId: input.programId,
      assigningOrganizationId: input.assigningOrganizationId,
      leadOrganizationId: input.leadOrganizationId,
      collaboratorOrganizationIds: input.collaboratorOrganizationIds,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      startAt: input.startAt ? new Date(input.startAt) : null,
    };
  }

  private requiredText(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(`${label} is required`);
    return trimmed;
  }

  private assertAssigningOrganization(
    assigningOrganizationId: number,
    principal: AccessTokenPayload,
  ) {
    if (
      !principal.isAdmin &&
      assigningOrganizationId !== principal.organizationId
    ) {
      throw new ForbiddenException(
        ErrorCode.TASK_CAN_ONLY_BE_ASSIGNED_BY_THE_CURRENT_ORGANIZATION,
      );
    }
  }

  private rethrowUniqueCode(error: unknown): never {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(ErrorCode.TASK_CODE_ALREADY_EXISTS);
    }
    throw error;
  }

  private async notifyAssignment(task: TaskView) {
    await this.safeNotify({
      organizationIds: [
        task.leadOrganizationId,
        ...task.collaboratorOrganizationIds,
      ],
      eventKey: `TASK_ASSIGNED:${task.id}`,
      type: 'GIAO_NHIEM_VU',
      title: 'Nhiệm vụ mới được giao',
      body: `${task.code} - ${task.name}`,
      entityType: 'Task',
      entityId: task.id,
    });
  }

  private async safeNotify(
    input: Parameters<NotificationsService['createForOrganizations']>[0],
  ) {
    try {
      await this.notificationsService?.createForOrganizations(input);
    } catch (error) {
      this.logger.error(
        `Notification delivery failed for ${input.eventKey}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
