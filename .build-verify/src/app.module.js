"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const jwt_1 = require("@nestjs/jwt");
const throttler_1 = require("@nestjs/throttler");
const auth_controller_1 = require("./controllers/auth.controller");
const audit_logs_controller_1 = require("./controllers/audit-logs.controller");
const consolidated_reports_controller_1 = require("./controllers/consolidated-reports.controller");
const dashboard_controller_1 = require("./controllers/dashboard.controller");
const health_controller_1 = require("./controllers/health.controller");
const notifications_controller_1 = require("./controllers/notifications.controller");
const progress_reports_controller_1 = require("./controllers/progress-reports.controller");
const report_history_controller_1 = require("./controllers/report-history.controller");
const system_controller_1 = require("./controllers/system.controller");
const tasks_controller_1 = require("./controllers/tasks.controller");
const csrf_guard_1 = require("./guards/csrf.guard");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const permission_guard_1 = require("./guards/permission.guard");
const user_throttler_guard_1 = require("./guards/user-throttler.guard");
const prisma_service_1 = require("./prisma/prisma.service");
const auth_repository_1 = require("./repositories/auth.repository");
const audit_repository_1 = require("./repositories/audit.repository");
const dashboard_repository_1 = require("./repositories/dashboard.repository");
const files_repository_1 = require("./repositories/files.repository");
const notifications_repository_1 = require("./repositories/notifications.repository");
const reports_repository_1 = require("./repositories/reports.repository");
const system_repository_1 = require("./repositories/system.repository");
const tasks_repository_1 = require("./repositories/tasks.repository");
const auth_service_1 = require("./services/auth.service");
const audit_service_1 = require("./services/audit.service");
const dashboard_service_1 = require("./services/dashboard.service");
const files_service_1 = require("./services/files.service");
const health_service_1 = require("./services/health.service");
const notifications_service_1 = require("./services/notifications.service");
const reports_service_1 = require("./services/reports.service");
const reporting_periods_service_1 = require("./services/reporting-periods.service");
const system_service_1 = require("./services/system.service");
const tasks_service_1 = require("./services/tasks.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            jwt_1.JwtModule.register({}),
            throttler_1.ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
        ],
        controllers: [
            health_controller_1.HealthController,
            auth_controller_1.AuthController,
            system_controller_1.SystemController,
            tasks_controller_1.TasksController,
            tasks_controller_1.ReportingPeriodsController,
            audit_logs_controller_1.AuditLogsController,
            dashboard_controller_1.DashboardController,
            notifications_controller_1.NotificationsController,
            progress_reports_controller_1.ProgressReportsController,
            consolidated_reports_controller_1.ConsolidatedReportsController,
            report_history_controller_1.ReportHistoryController,
        ],
        providers: [
            health_service_1.HealthService,
            auth_service_1.AuthService,
            auth_repository_1.AuthRepository,
            system_service_1.SystemService,
            system_repository_1.SystemRepository,
            tasks_service_1.TasksService,
            tasks_repository_1.TasksRepository,
            reporting_periods_service_1.ReportingPeriodsService,
            audit_service_1.AuditService,
            dashboard_service_1.DashboardService,
            notifications_service_1.NotificationsService,
            audit_repository_1.AuditRepository,
            dashboard_repository_1.DashboardRepository,
            notifications_repository_1.NotificationsRepository,
            reports_service_1.ReportsService,
            files_service_1.FilesService,
            reports_repository_1.ReportsRepository,
            files_repository_1.FilesRepository,
            prisma_service_1.PrismaService,
            csrf_guard_1.CsrfGuard,
            { provide: core_1.APP_GUARD, useClass: jwt_auth_guard_1.JwtAuthGuard },
            { provide: core_1.APP_GUARD, useClass: permission_guard_1.PermissionGuard },
            { provide: core_1.APP_GUARD, useClass: user_throttler_guard_1.UserThrottlerGuard },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map