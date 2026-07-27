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
exports.ReportHistoryController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../decorators/current-user.decorator");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const reports_dto_1 = require("../dtos/reports.dto");
const files_service_1 = require("../services/files.service");
const reports_service_1 = require("../services/reports.service");
const private_storage_1 = require("../utils/private-storage");
const request_meta_1 = require("../utils/request-meta");
let ReportHistoryController = class ReportHistoryController {
    reports;
    files;
    constructor(reports, files) {
        this.reports = reports;
        this.files = files;
    }
    list(query, principal) {
        return this.reports.history(query, principal);
    }
    async download(versionId, fileId, principal, request) {
        return (0, private_storage_1.asDownload)(await this.files.downloadVersionFile(versionId, fileId, principal, (0, request_meta_1.requestMeta)(request)));
    }
};
exports.ReportHistoryController = ReportHistoryController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reports_dto_1.ReportHistoryQueryDto, Object]),
    __metadata("design:returntype", void 0)
], ReportHistoryController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('versions/:versionId/files/:fileId/download'),
    __param(0, (0, common_1.Param)('versionId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('fileId', common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], ReportHistoryController.prototype, "download", null);
exports.ReportHistoryController = ReportHistoryController = __decorate([
    (0, swagger_1.ApiTags)('Report history'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, permissions_decorator_1.Permissions)('report_history.read'),
    (0, common_1.Controller)('report-history'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService,
        files_service_1.FilesService])
], ReportHistoryController);
//# sourceMappingURL=report-history.controller.js.map