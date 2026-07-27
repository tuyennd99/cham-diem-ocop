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
exports.AuditRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
const auditSelect = client_1.Prisma.validator()({
    id: true,
    actorId: true,
    organizationId: true,
    action: true,
    entityType: true,
    entityId: true,
    beforeData: true,
    afterData: true,
    reason: true,
    ipAddress: true,
    userAgent: true,
    requestId: true,
    createdAt: true,
    actor: { select: { id: true, username: true, fullName: true } },
    organization: { select: { id: true, code: true, name: true } },
});
let AuditRepository = class AuditRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    append(input) {
        return this.prisma.auditLog.create({
            data: {
                actorId: input.actorId,
                organizationId: input.organizationId,
                action: input.action,
                entityType: input.entityType,
                entityId: input.entityId,
                ...(input.beforeData === undefined
                    ? {}
                    : {
                        beforeData: input.beforeData === null ? client_1.Prisma.DbNull : input.beforeData,
                    }),
                ...(input.afterData === undefined
                    ? {}
                    : {
                        afterData: input.afterData === null ? client_1.Prisma.DbNull : input.afterData,
                    }),
                reason: input.reason,
                ipAddress: input.ipAddress,
                userAgent: input.userAgent,
                requestId: input.requestId,
            },
            select: { id: true },
        });
    }
    async list(filters) {
        const where = {
            ...(filters.action ? { action: filters.action } : {}),
            ...(filters.entityType ? { entityType: filters.entityType } : {}),
            ...(filters.entityId ? { entityId: filters.entityId } : {}),
            ...(filters.actorId ? { actorId: filters.actorId } : {}),
            ...(filters.organizationId
                ? { organizationId: filters.organizationId }
                : {}),
            ...(filters.createdFrom || filters.createdTo
                ? {
                    createdAt: {
                        ...(filters.createdFrom
                            ? { gte: new Date(filters.createdFrom) }
                            : {}),
                        ...(filters.createdTo
                            ? { lte: new Date(filters.createdTo) }
                            : {}),
                    },
                }
                : {}),
        };
        const [data, total] = await this.prisma.$transaction([
            this.prisma.auditLog.findMany({
                where,
                select: auditSelect,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip: (filters.page - 1) * filters.limit,
                take: filters.limit,
            }),
            this.prisma.auditLog.count({ where }),
        ]);
        return { data, total };
    }
};
exports.AuditRepository = AuditRepository;
exports.AuditRepository = AuditRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditRepository);
//# sourceMappingURL=audit.repository.js.map