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
var ReportingPeriodsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingPeriodsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const tasks_repository_1 = require("../repositories/tasks.repository");
const periods_1 = require("../utils/periods");
const notifications_service_1 = require("./notifications.service");
let ReportingPeriodsService = ReportingPeriodsService_1 = class ReportingPeriodsService {
    repository;
    notificationsService;
    logger = new common_1.Logger(ReportingPeriodsService_1.name);
    timer;
    constructor(repository, notificationsService) {
        this.repository = repository;
        this.notificationsService = notificationsService;
    }
    async onApplicationBootstrap() {
        if (process.env.DISABLE_SCHEDULER === 'true')
            return;
        await this.handleDailyGeneration(new Date());
        this.scheduleNextRun();
    }
    onApplicationShutdown() {
        if (this.timer)
            clearTimeout(this.timer);
    }
    async ensurePeriods(now = new Date()) {
        const tasks = await this.repository.listPeriodicTasksForGeneration();
        let created = 0;
        for (const task of tasks) {
            if (!task.frequency || !task.periodicStartAt)
                continue;
            const periods = this.periodsThrough(task.frequency, task.periodicStartAt, now);
            const createdForTask = await this.repository.createReportingPeriods(task.id, periods);
            created += createdForTask;
            if (createdForTask === 0)
                continue;
            for (const period of periods) {
                await this.safeNotify({
                    organizationIds: [
                        task.leadOrganizationId,
                        ...task.collaborators.map(({ organizationId }) => organizationId),
                    ],
                    eventKey: `REPORTING_PERIOD_OPENED:${task.id}:${period.year}:${period.sequence}`,
                    type: 'KY_BAO_CAO_MOI',
                    title: 'Kỳ báo cáo mới được mở',
                    body: `${task.code} - ${task.name}`,
                    entityType: 'Task',
                    entityId: task.id,
                }, 'reporting-period generation');
            }
        }
        return created;
    }
    async list(taskId, principal) {
        this.assertPermission(principal, 'tasks.read');
        const task = await this.repository.findById(taskId, principal.organizationId, this.hasGlobalScope(principal));
        if (!task)
            throw new common_1.NotFoundException('Task not found');
        return this.repository.listReportingPeriods(taskId);
    }
    async cancel(periodId, reason, principal, meta = {}) {
        this.assertPermission(principal, 'tasks.close');
        if (!principal.isAdmin && !principal.isStaff) {
            throw new common_1.ForbiddenException('Only Admin or Thường trực may cancel reporting periods');
        }
        const period = await this.repository.findReportingPeriod(periodId);
        if (!period)
            throw new common_1.NotFoundException('Reporting period not found');
        const task = await this.repository.findById(period.taskId, principal.organizationId, this.hasGlobalScope(principal));
        if (!task)
            throw new common_1.NotFoundException('Reporting period not found');
        if (period.status !== client_1.PeriodStatus.OPEN) {
            throw new common_1.ConflictException('Only open reporting periods can be canceled');
        }
        const trimmedReason = reason.trim();
        if (!trimmedReason) {
            throw new common_1.ConflictException('Cancellation reason is required');
        }
        const canceled = await this.repository.cancelReportingPeriod(periodId, trimmedReason, new Date(), principal.sub, { ...meta, organizationId: principal.organizationId });
        if (!canceled) {
            throw new common_1.ConflictException('Reporting period could not be canceled');
        }
        return canceled;
    }
    async handleDailyGeneration(now = new Date()) {
        const created = await this.ensurePeriods(now);
        try {
            await this.notificationsService.generateDailyDeadlineNotifications(now);
        }
        catch (error) {
            this.logger.error('Deadline notification generation failed', error);
        }
        return created;
    }
    scheduleNextRun() {
        const now = new Date();
        const next = new Date(now);
        next.setHours(0, 5, 0, 0);
        if (next <= now)
            next.setDate(next.getDate() + 1);
        this.timer = setTimeout(() => void this.runScheduled(), next.getTime() - now.getTime());
        this.timer.unref();
    }
    async runScheduled() {
        try {
            await this.handleDailyGeneration();
        }
        catch (error) {
            this.logger.error('Reporting period generation failed', error);
        }
        finally {
            this.scheduleNextRun();
        }
    }
    periodsThrough(frequency, startAt, now) {
        const periods = [];
        let anchor = startAt;
        for (;;) {
            const period = (0, periods_1.buildPeriod)(frequency, anchor);
            if (period.periodStartAt > now)
                break;
            periods.push({ frequency, ...period });
            anchor = new Date(period.dueAt.getTime() + 1);
        }
        return periods;
    }
    hasGlobalScope(principal) {
        return Boolean(principal.isAdmin || principal.isStaff);
    }
    assertPermission(principal, permission) {
        if (!principal.isAdmin && !principal.permissions.includes(permission)) {
            throw new common_1.ForbiddenException(`${permission} is required`);
        }
    }
    async safeNotify(input, context) {
        try {
            await this.notificationsService.createForOrganizations(input);
        }
        catch (error) {
            this.logger.error(`Notification failed during ${context}`, error);
        }
    }
};
exports.ReportingPeriodsService = ReportingPeriodsService;
exports.ReportingPeriodsService = ReportingPeriodsService = ReportingPeriodsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tasks_repository_1.TasksRepository,
        notifications_service_1.NotificationsService])
], ReportingPeriodsService);
//# sourceMappingURL=reporting-periods.service.js.map