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
exports.DashboardRepository = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../prisma/prisma.service");
let DashboardRepository = class DashboardRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async loadSummaryRows(input) {
        const periodWhere = this.periodWhere(input.filters);
        const hasPeriodFilter = [
            input.filters.frequency,
            input.filters.year,
            input.filters.sequence,
            input.filters.dueFrom,
            input.filters.dueTo,
        ].some((value) => value !== undefined);
        const rows = await this.prisma.task.findMany({
            where: {
                deletedAt: null,
                ...(input.filters.taskCode
                    ? {
                        code: {
                            contains: input.filters.taskCode,
                            mode: client_1.Prisma.QueryMode.insensitive,
                        },
                    }
                    : {}),
                ...(input.filters.taskName
                    ? {
                        name: {
                            contains: input.filters.taskName,
                            mode: client_1.Prisma.QueryMode.insensitive,
                        },
                    }
                    : {}),
                ...(input.filters.programId
                    ? { programId: input.filters.programId }
                    : {}),
                ...(input.globalScope
                    ? {}
                    : {
                        OR: [
                            { leadOrganizationId: input.organizationId },
                            {
                                collaborators: {
                                    some: { organizationId: input.organizationId },
                                },
                            },
                        ],
                    }),
                ...(hasPeriodFilter ? { reportingPeriods: { some: periodWhere } } : {}),
            },
            select: {
                id: true,
                type: true,
                completedAt: true,
                closedAt: true,
                leadOrganizationId: true,
                reportingPeriods: {
                    where: periodWhere,
                    select: {
                        id: true,
                        frequency: true,
                        status: true,
                        dueAt: true,
                        workspaces: {
                            select: { status: true, ownerOrganizationId: true },
                        },
                    },
                },
            },
            orderBy: { id: 'asc' },
        });
        return rows.map(({ reportingPeriods, leadOrganizationId, ...task }) => ({
            ...task,
            periods: reportingPeriods.map(({ workspaces, ...period }) => ({
                ...period,
                workspaceStatuses: workspaces
                    .filter(({ ownerOrganizationId }) => input.globalScope ||
                    leadOrganizationId === input.organizationId ||
                    ownerOrganizationId === input.organizationId)
                    .map(({ status }) => status),
            })),
        }));
    }
    periodWhere(filters) {
        return {
            status: { not: client_1.PeriodStatus.CANCELED },
            ...(filters.frequency ? { frequency: filters.frequency } : {}),
            ...(filters.year ? { year: filters.year } : {}),
            ...(filters.sequence ? { sequence: filters.sequence } : {}),
            ...(filters.dueFrom || filters.dueTo
                ? {
                    dueAt: {
                        ...(filters.dueFrom ? { gte: new Date(filters.dueFrom) } : {}),
                        ...(filters.dueTo ? { lte: new Date(filters.dueTo) } : {}),
                    },
                }
                : {}),
        };
    }
};
exports.DashboardRepository = DashboardRepository;
exports.DashboardRepository = DashboardRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardRepository);
//# sourceMappingURL=dashboard.repository.js.map