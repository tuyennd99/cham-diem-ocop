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
exports.ConsolidatedReportsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const client_1 = require("@prisma/client");
const current_user_decorator_1 = require("../decorators/current-user.decorator");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const reports_dto_1 = require("../dtos/reports.dto");
const files_service_1 = require("../services/files.service");
const reports_service_1 = require("../services/reports.service");
const private_storage_1 = require("../utils/private-storage");
const request_meta_1 = require("../utils/request-meta");
let ConsolidatedReportsController = class ConsolidatedReportsController {
    reports;
    files;
    constructor(reports, files) {
        this.reports = reports;
        this.files = files;
    }
    open(periodId, principal) {
        return this.reports.openConsolidated(periodId, principal);
    }
    get(id, principal) {
        return this.reports.get(id, client_1.ReportKind.CONSOLIDATED, principal);
    }
    save(id, body, principal, request) {
        return this.reports.saveDraft(id, client_1.ReportKind.CONSOLIDATED, body.content, principal, (0, request_meta_1.requestMeta)(request));
    }
    submit(id, principal, request) {
        return this.reports.submit(id, client_1.ReportKind.CONSOLIDATED, principal, (0, request_meta_1.requestMeta)(request));
    }
    approve(id, principal, request) {
        return this.reports.approve(id, client_1.ReportKind.CONSOLIDATED, principal, (0, request_meta_1.requestMeta)(request));
    }
    reject(id, body, principal, request) {
        return this.reports.reject(id, client_1.ReportKind.CONSOLIDATED, body.reason, principal, (0, request_meta_1.requestMeta)(request));
    }
    upload(id, file, principal, request) {
        return this.files.uploadDraftFile(id, file, principal, (0, request_meta_1.requestMeta)(request));
    }
    removeFile(id, fileId, principal, request) {
        return this.files.removeDraftFile(id, fileId, principal, (0, request_meta_1.requestMeta)(request));
    }
    async download(id, fileId, principal, request) {
        return (0, private_storage_1.asDownload)(await this.files.downloadWorkspaceFile(id, fileId, principal, (0, request_meta_1.requestMeta)(request)));
    }
};
exports.ConsolidatedReportsController = ConsolidatedReportsController;
__decorate([
    (0, common_1.Get)('periods/:periodId'),
    (0, permissions_decorator_1.Permissions)('consolidated.edit'),
    __param(0, (0, common_1.Param)('periodId', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "open", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, permissions_decorator_1.Permissions)('tasks.read'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, permissions_decorator_1.Permissions)('consolidated.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, reports_dto_1.SaveReportDraftDto, Object, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "save", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, permissions_decorator_1.Permissions)('consolidated.submit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, permissions_decorator_1.Permissions)('consolidated.review'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, permissions_decorator_1.Permissions)('consolidated.review'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, reports_dto_1.RejectReportDto, Object, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/files'),
    (0, permissions_decorator_1.Permissions)('consolidated.edit'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, private_storage_1.privateUploadOptions)())),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "upload", null);
__decorate([
    (0, common_1.Delete)(':id/files/:fileId'),
    (0, permissions_decorator_1.Permissions)('consolidated.edit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('fileId', common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", void 0)
], ConsolidatedReportsController.prototype, "removeFile", null);
__decorate([
    (0, common_1.Get)(':id/files/:fileId/download'),
    (0, permissions_decorator_1.Permissions)('tasks.read'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('fileId', common_1.ParseIntPipe)),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object, Object]),
    __metadata("design:returntype", Promise)
], ConsolidatedReportsController.prototype, "download", null);
exports.ConsolidatedReportsController = ConsolidatedReportsController = __decorate([
    (0, swagger_1.ApiTags)('Consolidated reports'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('consolidated-reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService,
        files_service_1.FilesService])
], ConsolidatedReportsController);
//# sourceMappingURL=consolidated-reports.controller.js.map