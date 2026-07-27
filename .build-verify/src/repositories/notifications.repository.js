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
exports.NotificationsRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let NotificationsRepository = class NotificationsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async list(input) {
        const where = {
            recipientId: input.recipientId,
            ...(input.unreadOnly ? { readAt: null } : {}),
        };
        const [data, total] = await this.prisma.$transaction([
            this.prisma.notification.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: (input.page - 1) * input.limit,
                take: input.limit,
            }),
            this.prisma.notification.count({ where }),
        ]);
        return { data, total };
    }
    async markRead(id, recipientId, readAt) {
        const result = await this.prisma.notification.updateMany({
            where: { id, recipientId, readAt: null },
            data: { readAt },
        });
        if (result.count === 1)
            return true;
        return ((await this.prisma.notification.count({
            where: { id, recipientId },
        })) === 1);
    }
    async markAllRead(recipientId, readAt) {
        const result = await this.prisma.notification.updateMany({
            where: { recipientId, readAt: null },
            data: { readAt },
        });
        return result.count;
    }
    async createForActiveUsers(input) {
        const organizationIds = [...new Set(input.organizationIds)];
        if (organizationIds.length === 0)
            return 0;
        const recipients = await this.prisma.user.findMany({
            where: {
                organizationId: { in: organizationIds },
                status: client_1.UserStatus.ACTIVE,
                deletedAt: null,
            },
            select: { id: true },
        });
        if (recipients.length === 0)
            return 0;
        const result = await this.prisma.notification.createMany({
            data: recipients.map(({ id }) => ({
                recipientId: id,
                eventKey: input.eventKey,
                type: input.type,
                title: input.title,
                body: input.body,
                entityType: input.entityType,
                entityId: input.entityId,
            })),
            skipDuplicates: true,
        });
        return result.count;
    }
    async findDeadlineTargets(now, dueSoonThrough) {
        const periods = await this.prisma.reportingPeriod.findMany({
            where: {
                status: client_1.PeriodStatus.OPEN,
                dueAt: { lte: dueSoonThrough },
                task: { deletedAt: null, closedAt: null },
            },
            select: {
                id: true,
                dueAt: true,
                task: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        leadOrganizationId: true,
                        collaborators: { select: { organizationId: true } },
                    },
                },
            },
            orderBy: { id: 'asc' },
        });
        void now;
        return periods.map(({ id, dueAt, task }) => ({
            periodId: id,
            taskId: task.id,
            taskCode: task.code,
            taskName: task.name,
            dueAt,
            organizationIds: [
                task.leadOrganizationId,
                ...task.collaborators.map(({ organizationId }) => organizationId),
            ],
        }));
    }
};
exports.NotificationsRepository = NotificationsRepository;
exports.NotificationsRepository = NotificationsRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], NotificationsRepository);
//# sourceMappingURL=notifications.repository.js.map