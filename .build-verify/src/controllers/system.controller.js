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
exports.SystemController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../decorators/current-user.decorator");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const system_dto_1 = require("../dtos/system.dto");
const system_service_1 = require("../services/system.service");
let SystemController = class SystemController {
    service;
    constructor(service) {
        this.service = service;
    }
    listUsers() {
        return this.service.listUsers();
    }
    getUser(id) {
        return this.service.getUser(id);
    }
    createUser(body, actor, request) {
        return this.service.createUser(body, actor.sub, this.requestMeta(request));
    }
    updateUser(id, body, actor, request) {
        return this.service.updateUser(id, body, actor.sub, this.requestMeta(request));
    }
    deleteUser(id, actor, request) {
        return this.service.deleteUser(id, actor.sub, this.requestMeta(request));
    }
    lockUser(id, body, actor, request) {
        return this.service.lockUser(id, body.reason, actor.sub, this.requestMeta(request));
    }
    unlockUser(id, actor, request) {
        return this.service.unlockUser(id, actor.sub, this.requestMeta(request));
    }
    resetUserPassword(id, body, actor, request) {
        return this.service.resetUserPassword(id, body.password, actor.sub, this.requestMeta(request));
    }
    listOrganizations() {
        return this.service.listOrganizations();
    }
    getOrganization(id) {
        return this.service.getOrganization(id);
    }
    createOrganization(body, actor, request) {
        return this.service.createOrganization(body, actor.sub, this.requestMeta(request));
    }
    updateOrganization(id, body, actor, request) {
        return this.service.updateOrganization(id, body, actor.sub, this.requestMeta(request));
    }
    deleteOrganization(id, actor, request) {
        return this.service.deleteOrganization(id, actor.sub, this.requestMeta(request));
    }
    listPrograms() {
        return this.service.listPrograms();
    }
    getProgram(id) {
        return this.service.getProgram(id);
    }
    createProgram(body, actor, request) {
        return this.service.createProgram(body, actor.sub, this.requestMeta(request));
    }
    updateProgram(id, body, actor, request) {
        return this.service.updateProgram(id, body, actor.sub, this.requestMeta(request));
    }
    deleteProgram(id, actor, request) {
        return this.service.deleteProgram(id, actor.sub, this.requestMeta(request));
    }
    listPermissionGroups() {
        return this.service.listPermissionGroups();
    }
    getPermissionGroup(id) {
        return this.service.getPermissionGroup(id);
    }
    createPermissionGroup(body, actor, request) {
        return this.service.createPermissionGroup(body, actor.sub, this.requestMeta(request));
    }
    updatePermissionGroup(id, body, actor, request) {
        return this.service.updatePermissionGroup(id, body, actor.sub, this.requestMeta(request));
    }
    deletePermissionGroup(id, actor, request) {
        return this.service.deletePermissionGroup(id, actor.sub, this.requestMeta(request));
    }
    listPermissions() {
        return this.service.listPermissions();
    }
    requestMeta(request) {
        const requestId = request.headers['x-request-id'];
        return {
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
            requestId: typeof requestId === 'string' &&
                /^[A-Za-z0-9._-]{1,100}$/.test(requestId)
                ? requestId
                : undefined,
        };
    }
};
exports.SystemController = SystemController;
__decorate([
    (0, common_1.Get)('users'),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getUser", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_dto_1.CreateUserDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:id'),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, system_dto_1.UpdateUserDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Delete)('users/:id'),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "deleteUser", null);
__decorate([
    (0, common_1.Post)('users/:id/lock'),
    (0, common_1.HttpCode)(200),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, system_dto_1.LockUserDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "lockUser", null);
__decorate([
    (0, common_1.Post)('users/:id/unlock'),
    (0, common_1.HttpCode)(200),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "unlockUser", null);
__decorate([
    (0, common_1.Post)('users/:id/reset-password'),
    (0, common_1.HttpCode)(200),
    (0, permissions_decorator_1.Permissions)('users.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, system_dto_1.ResetPasswordDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "resetUserPassword", null);
__decorate([
    (0, common_1.Get)('organizations'),
    (0, permissions_decorator_1.Permissions)('organizations.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listOrganizations", null);
__decorate([
    (0, common_1.Get)('organizations/:id'),
    (0, permissions_decorator_1.Permissions)('organizations.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getOrganization", null);
__decorate([
    (0, common_1.Post)('organizations'),
    (0, permissions_decorator_1.Permissions)('organizations.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_dto_1.CreateOrganizationDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "createOrganization", null);
__decorate([
    (0, common_1.Patch)('organizations/:id'),
    (0, permissions_decorator_1.Permissions)('organizations.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, system_dto_1.UpdateOrganizationDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updateOrganization", null);
__decorate([
    (0, common_1.Delete)('organizations/:id'),
    (0, permissions_decorator_1.Permissions)('organizations.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "deleteOrganization", null);
__decorate([
    (0, common_1.Get)('programs'),
    (0, permissions_decorator_1.Permissions)('programs.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listPrograms", null);
__decorate([
    (0, common_1.Get)('programs/:id'),
    (0, permissions_decorator_1.Permissions)('programs.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getProgram", null);
__decorate([
    (0, common_1.Post)('programs'),
    (0, permissions_decorator_1.Permissions)('programs.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_dto_1.CreateProgramDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "createProgram", null);
__decorate([
    (0, common_1.Patch)('programs/:id'),
    (0, permissions_decorator_1.Permissions)('programs.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, system_dto_1.UpdateProgramDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updateProgram", null);
__decorate([
    (0, common_1.Delete)('programs/:id'),
    (0, permissions_decorator_1.Permissions)('programs.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "deleteProgram", null);
__decorate([
    (0, common_1.Get)('permission-groups'),
    (0, permissions_decorator_1.Permissions)('permission_groups.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listPermissionGroups", null);
__decorate([
    (0, common_1.Get)('permission-groups/:id'),
    (0, permissions_decorator_1.Permissions)('permission_groups.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "getPermissionGroup", null);
__decorate([
    (0, common_1.Post)('permission-groups'),
    (0, permissions_decorator_1.Permissions)('permission_groups.manage'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [system_dto_1.CreatePermissionGroupDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "createPermissionGroup", null);
__decorate([
    (0, common_1.Patch)('permission-groups/:id'),
    (0, permissions_decorator_1.Permissions)('permission_groups.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, system_dto_1.UpdatePermissionGroupDto, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "updatePermissionGroup", null);
__decorate([
    (0, common_1.Delete)('permission-groups/:id'),
    (0, permissions_decorator_1.Permissions)('permission_groups.manage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "deletePermissionGroup", null);
__decorate([
    (0, common_1.Get)('permissions'),
    (0, permissions_decorator_1.Permissions)('permission_groups.manage'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], SystemController.prototype, "listPermissions", null);
exports.SystemController = SystemController = __decorate([
    (0, swagger_1.ApiTags)('System administration'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('system'),
    __metadata("design:paramtypes", [system_service_1.SystemService])
], SystemController);
//# sourceMappingURL=system.controller.js.map