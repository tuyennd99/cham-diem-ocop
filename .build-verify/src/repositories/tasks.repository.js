"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const taskInclude = client_1.Prisma.validator()({
    program: { select: { id: true, code: true, name: true } },
    assigningOrganization: { select: { id: true, code: true, name: true } },
    leadOrganization: { select: { id: true, code: true, name: true } },
    collaborators: {
        include: {
            organization: { select: { id: true, code: true, name: true } },
        },
    },
    reportingPeriods: {
        orderBy: [{ periodStartAt: 'desc' }, { id: 'desc' }],
        include: {
            workspaces: {
                select: {
                    status: true,
                    ownerOrganizationId: true,
                },
            },
        },
    },
});
let TasksRepository = class TasksRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(input) {
        const where = this.taskScope(input.organizationId, input.globalScope);
        const [rows, total] = await this.prisma.$transaction([
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
            data: rows.map((row) => this.toTask(row, input.organizationId, input.globalScope)),
            total,
        };
    }
    async findById(id, organizationId, globalScope) {
        const row = await this.prisma.task.findFirst({
            where: {
                id,
                ...this.taskScope(organizationId, globalScope),
            },
            include: taskInclude,
        });
        return row ? this.toTask(row, organizationId, globalScope) : null;
    }
    async codeExists(code, excludeId) {
        return ((await this.prisma.task.count({
            where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
        })) > 0);
    }
    findActiveProgram(id) {
        return this.prisma.program.findFirst({
            where: { id, status: 'ACTIVE' },
            select: { id: true },
        });
    }
    findActiveOrganizations(ids) {
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
    async create(input, actorId, now, meta = {}) {
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
                    frequency: input.frequency,
                    periodicStartAt: input.periodicStartAt,
                    createdById: actorId,
                    updatedById: actorId,
                    collaborators: {
                        create: input.collaboratorOrganizationIds.map((organizationId) => ({
                            organizationId,
                        })),
                    },
                    ...(input.type === client_1.TaskType.DOT_XUAT
                        ? {
                            reportingPeriods: {
                                create: {
                                    frequency: null,
                                    year: input.dueAt.getFullYear(),
                                    sequence: 1,
                                    periodStartAt: now,
                                    dueAt: input.dueAt,
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
                    action: 'TASK_CREATED',
                    entityType: 'Task',
                    entityId: row.id,
                    afterData: this.taskAudit(this.toTask(row)),
                    ...this.auditMeta(meta),
                },
            });
            return this.toTask(row);
        });
    }
    async update(id, input, actorId, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw(client_1.Prisma.sql `SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`);
            const before = await transaction.task.findUniqueOrThrow({
                where: { id },
                include: taskInclude,
            });
            const changesAssignment = this.changesAssignment(before, input);
            if (changesAssignment &&
                (before.completedAt !== null ||
                    before.closedAt !== null ||
                    (await transaction.reportWorkspace.count({
                        where: { reportingPeriod: { taskId: id } },
                    })) > 0)) {
                throw new common_1.ConflictException('Task assignment cannot be changed after reporting has started');
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
            if (row.type === client_1.TaskType.DOT_XUAT && input.dueAt) {
                await transaction.reportingPeriod.updateMany({
                    where: { taskId: id },
                    data: { dueAt: input.dueAt },
                });
            }
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: changesAssignment
                        ? 'TASK_ASSIGNMENT_UPDATED'
                        : 'TASK_UPDATED',
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
    changesAssignment(before, input) {
        if ((input.assigningOrganizationId !== undefined &&
            input.assigningOrganizationId !== before.assigningOrganizationId) ||
            (input.leadOrganizationId !== undefined &&
                input.leadOrganizationId !== before.leadOrganizationId)) {
            return true;
        }
        if (input.collaboratorOrganizationIds === undefined)
            return false;
        const current = before.collaborators
            .map(({ organizationId }) => organizationId)
            .sort((left, right) => left - right);
        const next = [...input.collaboratorOrganizationIds].sort((left, right) => left - right);
        return (current.length !== next.length ||
            current.some((organizationId, index) => organizationId !== next[index]));
    }
    async softDelete(id, deletedAt, actorId, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw(client_1.Prisma.sql `SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`);
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
                    action: 'TASK_SOFT_DELETED',
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
    countOpenPeriods(taskId) {
        return this.prisma.reportingPeriod.count({
            where: { taskId, status: client_1.PeriodStatus.OPEN },
        });
    }
    async close(id, reason, closedAt, actorId, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw(client_1.Prisma.sql `SELECT "id" FROM "tasks" WHERE "id" = ${id} FOR UPDATE`);
            if ((await transaction.reportingPeriod.count({
                where: { taskId: id, status: client_1.PeriodStatus.OPEN },
            })) > 0) {
                return null;
            }
            const before = await transaction.task.findUniqueOrThrow({
                where: { id },
                include: taskInclude,
            });
            const updated = await transaction.task.updateMany({
                where: { id, deletedAt: null, closedAt: null, type: client_1.TaskType.DINH_KY },
                data: {
                    closedAt,
                    closedById: actorId,
                    closeReason: reason,
                    updatedById: actorId,
                },
            });
            if (updated.count !== 1)
                return null;
            const row = await transaction.task.findUniqueOrThrow({
                where: { id },
                include: taskInclude,
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'TASK_CLOSED',
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
    listPeriodicTasksForGeneration() {
        return this.prisma.task.findMany({
            where: {
                type: client_1.TaskType.DINH_KY,
                deletedAt: null,
                closedAt: null,
                frequency: { not: null },
                periodicStartAt: { not: null },
            },
            select: {
                id: true,
                code: true,
                name: true,
                frequency: true,
                periodicStartAt: true,
                leadOrganizationId: true,
                collaborators: { select: { organizationId: true } },
            },
        });
    }
    async createReportingPeriods(taskId, periods) {
        if (periods.length === 0)
            return 0;
        return this.prisma.$transaction(async (transaction) => {
            const rows = await transaction.$queryRaw(client_1.Prisma.sql `
          SELECT "closedAt", "deletedAt"
          FROM "tasks"
          WHERE "id" = ${taskId}
          FOR UPDATE
        `);
            if (!rows[0] || rows[0].closedAt || rows[0].deletedAt)
                return 0;
            const result = await transaction.reportingPeriod.createMany({
                data: periods.map((period) => ({ taskId, ...period })),
                skipDuplicates: true,
            });
            return result.count;
        });
    }
    listReportingPeriods(taskId) {
        return this.prisma.reportingPeriod.findMany({
            where: { taskId },
            orderBy: [{ periodStartAt: 'desc' }, { id: 'desc' }],
        });
    }
    findReportingPeriod(id) {
        return this.prisma.reportingPeriod.findUnique({
            where: { id },
            select: { id: true, taskId: true, status: true },
        });
    }
    async cancelReportingPeriod(id, reason, canceledAt, actorId, meta = {}) {
        return this.prisma.$transaction(async (transaction) => {
            await transaction.$queryRaw(client_1.Prisma.sql `SELECT "id" FROM "reporting_periods" WHERE "id" = ${id} FOR UPDATE`);
            const before = await transaction.reportingPeriod.findUnique({
                where: { id },
            });
            const updated = await transaction.reportingPeriod.updateMany({
                where: { id, status: client_1.PeriodStatus.OPEN },
                data: {
                    status: client_1.PeriodStatus.CANCELED,
                    canceledAt,
                    cancelReason: reason,
                },
            });
            if (updated.count !== 1)
                return null;
            const after = await transaction.reportingPeriod.findUniqueOrThrow({
                where: { id },
            });
            await transaction.auditLog.create({
                data: {
                    actorId,
                    action: 'REPORTING_PERIOD_CANCELED',
                    entityType: 'ReportingPeriod',
                    entityId: id,
                    reason,
                    beforeData: before ? this.periodAudit(before) : undefined,
                    afterData: this.periodAudit(after),
                    ...this.auditMeta(meta),
                },
            });
            return transaction.reportingPeriod.findUnique({ where: { id } });
        });
    }
    taskScope(organizationId, globalScope) {
        return {
            deletedAt: null,
            ...(globalScope
                ? {}
                : {
                    OR: [
                        { leadOrganizationId: organizationId },
                        { collaborators: { some: { organizationId } } },
                    ],
                }),
        };
    }
    toTask(row, organizationId, globalScope = true) {
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
            collaboratorOrganizationIds: row.collaborators.map(({ organizationId }) => organizationId),
            hasSubmittedReport: row.reportingPeriods.some((period) => period.workspaces.some((workspace) => workspace.status === 'SUBMITTED' &&
                (globalScope ||
                    row.leadOrganizationId === organizationId ||
                    workspace.ownerOrganizationId === organizationId))),
            dueAt: row.dueAt,
            frequency: row.frequency,
            periodicStartAt: row.periodicStartAt,
            closedAt: row.closedAt,
            closeReason: row.closeReason,
            completedAt: row.completedAt,
            deletedAt: row.deletedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            program: row.program,
            assigningOrganization: row.assigningOrganization,
            leadOrganization: row.leadOrganization,
            collaboratorOrganizations: row.collaborators.map(({ organization }) => organization),
            reportingPeriods: row.reportingPeriods.map((period) => ({
                id: period.id,
                taskId: period.taskId,
                frequency: period.frequency,
                year: period.year,
                sequence: period.sequence,
                periodStartAt: period.periodStartAt,
                dueAt: period.dueAt,
                status: period.status,
                completedAt: period.completedAt,
                canceledAt: period.canceledAt,
                cancelReason: period.cancelReason,
                createdAt: period.createdAt,
            })),
        };
    }
    taskAudit(task) {
        return {
            code: task.code,
            name: task.name,
            type: task.type,
            programId: task.programId,
            assigningOrganizationId: task.assigningOrganizationId,
            leadOrganizationId: task.leadOrganizationId,
            collaboratorOrganizationIds: task.collaboratorOrganizationIds,
            dueAt: task.dueAt?.toISOString() ?? null,
            frequency: task.frequency,
            periodicStartAt: task.periodicStartAt?.toISOString() ?? null,
            closedAt: task.closedAt?.toISOString() ?? null,
            completedAt: task.completedAt?.toISOString() ?? null,
            deletedAt: task.deletedAt?.toISOString() ?? null,
        };
    }
    periodAudit(period) {
        return {
            taskId: period.taskId,
            status: period.status,
            dueAt: period.dueAt.toISOString(),
            canceledAt: period.canceledAt?.toISOString() ?? null,
            cancelReason: period.cancelReason,
        };
    }
    auditMeta(meta) {
        return {
            organizationId: meta.organizationId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            requestId: meta.requestId && /^[A-Za-z0-9._-]{1,100}$/.test(meta.requestId)
                ? meta.requestId
                : (0, node_crypto_1.randomUUID)(),
        };
    }
};
exports.TasksRepository = TasksRepository;
exports.TasksRepository = TasksRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TasksRepository);
//# sourceMappingURL=tasks.repository.js.map