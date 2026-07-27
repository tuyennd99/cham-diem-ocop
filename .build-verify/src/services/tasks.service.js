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
var TasksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const dayjs_1 = require("../utils/dayjs");
const tasks_repository_1 = require("../repositories/tasks.repository");
const notifications_service_1 = require("./notifications.service");
let TasksService = TasksService_1 = class TasksService {
    repository;
    notificationsService;
    logger = new common_1.Logger(TasksService_1.name);
    constructor(repository, notificationsService) {
        this.repository = repository;
        this.notificationsService = notificationsService;
    }
    async list(query, principal) {
        this.assertPermission(principal, 'tasks.read');
        const { data, total } = await this.repository.list({
            page: query.page,
            limit: query.limit,
            organizationId: principal.organizationId,
            globalScope: this.hasGlobalScope(principal),
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
    async get(id, principal) {
        this.assertPermission(principal, 'tasks.read');
        return this.requireTask(id, principal);
    }
    listOrganizationLookups(principal) {
        this.assertPermission(principal, 'tasks.read');
        return this.repository.listActiveOrganizations();
    }
    listProgramLookups(principal) {
        this.assertPermission(principal, 'tasks.read');
        return this.repository.listActivePrograms();
    }
    async create(input, principal, meta = {}) {
        this.assertPermission(principal, 'tasks.create');
        this.assertPermission(principal, 'tasks.assign');
        this.assertStaffAssignment(principal);
        this.assertAssigningOrganization(input.assigningOrganizationId, principal);
        const normalized = this.normalize(input);
        await this.validate(normalized);
        try {
            const task = await this.repository.create(normalized, principal.sub, new Date(), { ...meta, organizationId: principal.organizationId });
            await this.notifyAssignment(task);
            return task;
        }
        catch (error) {
            this.rethrowUniqueCode(error);
        }
    }
    async update(id, input, principal, meta = {}) {
        this.assertPermission(principal, 'tasks.update');
        this.assertStaffAssignment(principal);
        const current = await this.requireTask(id, principal);
        const changesAssignment = input.assigningOrganizationId !== undefined ||
            input.leadOrganizationId !== undefined ||
            input.collaboratorOrganizationIds !== undefined;
        if (changesAssignment) {
            this.assertPermission(principal, 'tasks.assign');
            if (input.assigningOrganizationId !== undefined) {
                this.assertAssigningOrganization(input.assigningOrganizationId, principal);
            }
        }
        if (input.type && input.type !== current.type) {
            throw new common_1.ConflictException('Task type cannot be changed');
        }
        const merged = this.normalize({
            code: input.code ?? current.code,
            name: input.name ?? current.name,
            description: input.description === undefined
                ? (current.description ?? undefined)
                : input.description,
            expectedOutput: input.expectedOutput === undefined
                ? (current.expectedOutput ?? undefined)
                : input.expectedOutput,
            type: current.type,
            programId: input.programId ?? current.programId,
            assigningOrganizationId: input.assigningOrganizationId ?? current.assigningOrganizationId,
            leadOrganizationId: input.leadOrganizationId ?? current.leadOrganizationId,
            collaboratorOrganizationIds: input.collaboratorOrganizationIds ??
                current.collaboratorOrganizationIds,
            dueAt: input.dueAt === undefined ? current.dueAt?.toISOString() : input.dueAt,
            frequency: input.frequency ?? current.frequency ?? undefined,
            periodicStartAt: input.periodicStartAt === undefined
                ? current.periodicStartAt?.toISOString()
                : input.periodicStartAt,
        });
        await this.validate(merged, id);
        const changed = {};
        for (const key of Object.keys(input)) {
            if (key in merged) {
                changed[key] = merged[key];
            }
        }
        try {
            const task = await this.repository.update(id, changed, principal.sub, {
                ...meta,
                organizationId: principal.organizationId,
            });
            if (changesAssignment)
                await this.notifyAssignment(task);
            return task;
        }
        catch (error) {
            this.rethrowUniqueCode(error);
        }
    }
    async remove(id, principal, meta = {}) {
        this.assertPermission(principal, 'tasks.delete');
        this.assertStaffAssignment(principal);
        await this.requireTask(id, principal);
        return this.repository.softDelete(id, new Date(), principal.sub, {
            ...meta,
            organizationId: principal.organizationId,
        });
    }
    async close(id, reason, principal, meta = {}) {
        this.assertPermission(principal, 'tasks.close');
        this.assertStaffAssignment(principal);
        const task = await this.requireTask(id, principal);
        if (task.type !== client_1.TaskType.DINH_KY) {
            throw new common_1.BadRequestException('Only periodic tasks can be closed');
        }
        if (task.closedAt)
            throw new common_1.ConflictException('Task is already closed');
        if ((await this.repository.countOpenPeriods(id)) > 0) {
            throw new common_1.ConflictException('Open reporting periods must be resolved');
        }
        const closed = await this.repository.close(id, this.requiredText(reason, 'Close reason'), new Date(), principal.sub, { ...meta, organizationId: principal.organizationId });
        if (!closed)
            throw new common_1.ConflictException('Task could not be closed');
        await this.safeNotify({
            organizationIds: [
                closed.assigningOrganizationId,
                closed.leadOrganizationId,
                ...closed.collaboratorOrganizationIds,
            ],
            eventKey: `TASK_CLOSED:${closed.id}`,
            type: 'NHIEM_VU_DONG',
            title: 'Nhiệm vụ định kỳ đã đóng',
            body: `${closed.code} - ${closed.name}`,
            entityType: 'Task',
            entityId: closed.id,
        });
        return closed;
    }
    async requireTask(id, principal) {
        const task = await this.repository.findById(id, principal.organizationId, this.hasGlobalScope(principal));
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        return task;
    }
    async validate(input, excludeId) {
        if (await this.repository.codeExists(input.code, excludeId)) {
            throw new common_1.ConflictException('Task code already exists');
        }
        if (input.collaboratorOrganizationIds.length === 0) {
            throw new common_1.BadRequestException('At least one collaborator is required');
        }
        if (new Set(input.collaboratorOrganizationIds).size !==
            input.collaboratorOrganizationIds.length) {
            throw new common_1.BadRequestException('Collaborators must be unique');
        }
        if (input.collaboratorOrganizationIds.includes(input.leadOrganizationId)) {
            throw new common_1.BadRequestException('Lead cannot also be a collaborator');
        }
        this.validateTypeFields(input);
        const organizationIds = [
            input.assigningOrganizationId,
            input.leadOrganizationId,
            ...input.collaboratorOrganizationIds,
        ];
        const [program, organizations] = await Promise.all([
            this.repository.findActiveProgram(input.programId),
            this.repository.findActiveOrganizations([...new Set(organizationIds)]),
        ]);
        if (!program)
            throw new common_1.BadRequestException('Program is not active');
        const byId = new Map(organizations.map((organization) => [organization.id, organization]));
        if (byId.size !== new Set(organizationIds).size ||
            !byId.get(input.assigningOrganizationId)?.isAssigningAuthority ||
            !byId.get(input.leadOrganizationId)?.isExecutingUnit ||
            input.collaboratorOrganizationIds.some((id) => !byId.get(id)?.isExecutingUnit)) {
            throw new common_1.BadRequestException('Task organizations must exist, be active, and have the required role');
        }
    }
    validateTypeFields(input) {
        if (input.type === client_1.TaskType.DOT_XUAT) {
            if (!input.dueAt) {
                throw new common_1.BadRequestException('dueAt is required for ad-hoc tasks');
            }
            if (input.frequency || input.periodicStartAt) {
                throw new common_1.BadRequestException('Ad-hoc tasks cannot have periodic fields');
            }
            return;
        }
        if (!input.frequency || !input.periodicStartAt) {
            throw new common_1.BadRequestException('frequency and periodicStartAt are required for periodic tasks');
        }
        if ((0, dayjs_1.dayjs)(input.periodicStartAt).date() !== 15) {
            throw new common_1.BadRequestException('periodicStartAt must be on day 15');
        }
        if (input.dueAt) {
            throw new common_1.BadRequestException('Periodic tasks cannot have dueAt');
        }
    }
    normalize(input) {
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
            frequency: input.frequency ?? null,
            periodicStartAt: input.periodicStartAt
                ? (0, dayjs_1.dayjs)(input.periodicStartAt).startOf('day').toDate()
                : null,
        };
    }
    requiredText(value, label) {
        const trimmed = value.trim();
        if (!trimmed)
            throw new common_1.BadRequestException(`${label} is required`);
        return trimmed;
    }
    hasGlobalScope(principal) {
        return Boolean(principal.isAdmin || principal.isStaff);
    }
    assertPermission(principal, permission) {
        if (!principal.isAdmin && !principal.permissions.includes(permission)) {
            throw new common_1.ForbiddenException(`${permission} is required`);
        }
    }
    assertAssigningOrganization(assigningOrganizationId, principal) {
        if (!principal.isAdmin &&
            assigningOrganizationId !== principal.organizationId) {
            throw new common_1.ForbiddenException('Tasks can only be assigned by the current organization');
        }
    }
    assertStaffAssignment(principal) {
        if (!principal.isAdmin && !principal.isStaff) {
            throw new common_1.ForbiddenException('Only Admin or Thường trực may assign task organizations');
        }
    }
    rethrowUniqueCode(error) {
        if (typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            error.code === 'P2002') {
            throw new common_1.ConflictException('Task code already exists');
        }
        throw error;
    }
    async notifyAssignment(task) {
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
    async safeNotify(input) {
        try {
            await this.notificationsService?.createForOrganizations(input);
        }
        catch (error) {
            this.logger.error(`Notification delivery failed for ${input.eventKey}`, error instanceof Error ? error.stack : String(error));
        }
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = TasksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tasks_repository_1.TasksRepository,
        notifications_service_1.NotificationsService])
], TasksService);
//# sourceMappingURL=tasks.service.js.map