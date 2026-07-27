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
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const dashboard_repository_1 = require("../repositories/dashboard.repository");
let DashboardService = class DashboardService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async summary(filters, principal, now = new Date()) {
        this.assertPermission(principal);
        const tasks = await this.repository.loadSummaryRows({
            filters,
            organizationId: principal.organizationId,
            globalScope: principal.isAdmin === true || principal.isStaff === true,
        });
        const taskStatusCounts = this.emptyStatusCounts();
        const periodStatusCounts = this.emptyStatusCounts();
        const typeCounts = { DINH_KY: 0, DOT_XUAT: 0 };
        let periodicPeriods = 0;
        let periodTotal = 0;
        for (const task of tasks) {
            typeCounts[task.type] += 1;
            taskStatusCounts[this.taskStatus(task, now)] += 1;
            for (const period of task.periods) {
                periodTotal += 1;
                if (period.frequency)
                    periodicPeriods += 1;
                periodStatusCounts[this.periodStatus(period, now)] += 1;
            }
        }
        return {
            totalTasks: tasks.length,
            taskCounts: {
                total: tasks.length,
                typeCounts,
                statusCounts: taskStatusCounts,
            },
            periodCounts: {
                total: periodTotal,
                periodic: periodicPeriods,
                statusCounts: periodStatusCounts,
            },
        };
    }
    statistics(filters, principal, now = new Date()) {
        return this.summary(filters, principal, now);
    }
    taskStatus(task, now) {
        if (task.completedAt || task.closedAt)
            return 'HOAN_THANH';
        const statuses = task.periods.map((period) => this.periodStatus(period, now));
        if (statuses.includes('DANG_CAP_NHAT'))
            return 'DANG_CAP_NHAT';
        if (statuses.includes('QUA_HAN'))
            return 'QUA_HAN';
        if (statuses.includes('SAP_DEN_HAN'))
            return 'SAP_DEN_HAN';
        return 'CHUA_HOAN_THANH';
    }
    periodStatus(period, now) {
        if (period.status === client_1.PeriodStatus.COMPLETED)
            return 'HOAN_THANH';
        if (period.workspaceStatuses.includes(client_1.ReportStatus.SUBMITTED)) {
            return 'DANG_CAP_NHAT';
        }
        if (period.dueAt.getTime() < now.getTime())
            return 'QUA_HAN';
        if (period.dueAt.getTime() <= now.getTime() + 5 * 86_400_000) {
            return 'SAP_DEN_HAN';
        }
        return 'CHUA_HOAN_THANH';
    }
    emptyStatusCounts() {
        return {
            HOAN_THANH: 0,
            DANG_CAP_NHAT: 0,
            QUA_HAN: 0,
            SAP_DEN_HAN: 0,
            CHUA_HOAN_THANH: 0,
        };
    }
    assertPermission(principal) {
        if (!principal.isAdmin &&
            !principal.permissions.includes('dashboard.read')) {
            throw new common_1.ForbiddenException('dashboard.read is required');
        }
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [dashboard_repository_1.DashboardRepository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map