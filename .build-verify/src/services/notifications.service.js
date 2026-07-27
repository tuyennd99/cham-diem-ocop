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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const notifications_repository_1 = require("../repositories/notifications.repository");
let NotificationsService = class NotificationsService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async list(recipientId, query) {
        const { data, total } = await this.repository.list({
            recipientId,
            ...query,
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
    async markRead(id, recipientId) {
        if (!(await this.repository.markRead(id, recipientId, new Date()))) {
            throw new common_1.NotFoundException('Notification not found');
        }
        return { success: true };
    }
    async markAllRead(recipientId) {
        return {
            updated: await this.repository.markAllRead(recipientId, new Date()),
        };
    }
    createForOrganization(input) {
        const { organizationId, ...notification } = input;
        return this.repository.createForActiveUsers({
            organizationIds: [organizationId],
            ...notification,
        });
    }
    createForOrganizations(input) {
        return this.repository.createForActiveUsers({
            ...input,
            organizationIds: [...new Set(input.organizationIds)],
        });
    }
    async generateDailyDeadlineNotifications(now = new Date()) {
        const dueSoonThrough = new Date(now.getTime() + 5 * 86_400_000);
        const targets = await this.repository.findDeadlineTargets(now, dueSoonThrough);
        let created = 0;
        for (const target of targets) {
            const overdue = target.dueAt.getTime() < now.getTime();
            created += await this.createForOrganizations({
                organizationIds: target.organizationIds,
                eventKey: overdue
                    ? `REPORTING_PERIOD_OVERDUE:${target.periodId}`
                    : `REPORTING_PERIOD_DUE_SOON:${target.periodId}`,
                type: overdue ? 'QUA_HAN' : 'SAP_DEN_HAN',
                title: overdue ? 'Nhiệm vụ đã quá hạn' : 'Nhiệm vụ sắp đến hạn',
                body: `${target.taskCode} - ${target.taskName}`,
                entityType: 'ReportingPeriod',
                entityId: target.periodId,
            });
        }
        return { targets: targets.length, created };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notifications_repository_1.NotificationsRepository])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map