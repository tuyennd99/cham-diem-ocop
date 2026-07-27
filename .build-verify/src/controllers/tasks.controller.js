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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingPeriodsController = exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../decorators/current-user.decorator");
const tasks_dto_1 = require("../dtos/tasks.dto");
const reporting_periods_service_1 = require("../services/reporting-periods.service");
const reports_service_1 = require("../services/reports.service");
const tasks_service_1 = require("../services/tasks.service");
const request_meta_1 = require("../utils/request-meta");
let TasksController = class TasksController {
    tasksService;
    reportingPeriodsService;
    constructor(tasksService, reportingPeriodsService) {
        this.tasksService = tasksService;
        this.reportingPeriodsService = reportingPeriodsService;
    }
    list(query, principal) {
        return this.tasksService.list(query, principal);
    }
    create(body, principal, request) {
        return this.tasksService.create(body, principal, (0, request_meta_1.requestMeta)(request));
    }
    organizationLookups(principal) {
        return this.tasksService.listOrganizationLookups(principal);
    }
    programLookups(principal) {
        return this.tasksService.listProgramLookups(principal);
    }
    get(id, principal) {
        return this.tasksService.get(id, principal);
    }
    update(id, body, principal, request) {
        return this.tasksService.update(id, body, principal, (0, request_meta_1.requestMeta)(request));
    }
    remove(id, principal, request) {
        return this.tasksService.remove(id, principal, (0, request_meta_1.requestMeta)(request));
    }
    close(id, body, principal, request) {
        return this.tasksService.close(id, body.reason, principal, (0, request_meta_1.requestMeta)(request));
    }
    periods(id, principal) {
        return this.reportingPeriodsService.list(id, principal);
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tasks_dto_1.TaskQueryDto, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [tasks_dto_1.CreateTaskDto, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('lookups/organizations'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "organizationLookups", null);
__decorate([
    (0, common_1.Get)('lookups/programs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "programLookups", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, tasks_dto_1.UpdateTaskDto, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, tasks_dto_1.CloseTaskDto, Object, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "close", null);
__decorate([
    (0, common_1.Get)(':id/reporting-periods'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "periods", null);
exports.TasksController = TasksController = __decorate([
    (0, swagger_1.ApiTags)('Tasks'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('tasks'),
    __metadata("design:paramtypes", [tasks_service_1.TasksService,
        reporting_periods_service_1.ReportingPeriodsService])
], TasksController);
let ReportingPeriodsController = class ReportingPeriodsController {
    reportingPeriodsService;
    reportsService;
    constructor(reportingPeriodsService, reportsService) {
        this.reportingPeriodsService = reportingPeriodsService;
        this.reportsService = reportsService;
    }
    listReportWorkspaces(id, principal) {
        return this.reportsService.listPeriodWorkspaces(id, principal);
    }
    cancel(id, body, principal, request) {
        return this.reportingPeriodsService.cancel(id, body.reason, principal, (0, request_meta_1.requestMeta)(request));
    }
};
exports.ReportingPeriodsController = ReportingPeriodsController;
__decorate([
    (0, common_1.Get)(':id/report-workspaces'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ReportingPeriodsController.prototype, "listReportWorkspaces", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, tasks_dto_1.CancelReportingPeriodDto, Object, Object]),
    __metadata("design:returntype", void 0)
], ReportingPeriodsController.prototype, "cancel", null);
exports.ReportingPeriodsController = ReportingPeriodsController = __decorate([
    (0, swagger_1.ApiTags)('Reporting periods'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('reporting-periods'),
    __metadata("design:paramtypes", [reporting_periods_service_1.ReportingPeriodsService,
        reports_service_1.ReportsService])
], ReportingPeriodsController);
//# sourceMappingURL=tasks.controller.js.map