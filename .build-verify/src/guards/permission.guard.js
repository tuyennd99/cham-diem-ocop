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
exports.PermissionGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const permissions_decorator_1 = require("../decorators/permissions.decorator");
const system_repository_1 = require("../repositories/system.repository");
let PermissionGuard = class PermissionGuard {
    reflector;
    repository;
    constructor(reflector, repository) {
        this.reflector = reflector;
        this.repository = repository;
    }
    async canActivate(context) {
        const request = context
            .switchToHttp()
            .getRequest();
        if (!request.user)
            return true;
        const required = this.reflector.getAllAndOverride(permissions_decorator_1.PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) ?? [];
        const effective = await this.repository.listEffectivePermissions(request.user.sub);
        this.assertPermissions(effective, required);
        request.user.permissions = effective.permissions;
        request.user.organizationId = effective.organizationId;
        request.user.isAdmin = effective.isAdmin;
        request.user.isStaff = effective.isStaff;
        return true;
    }
    assertPermissions(principal, required) {
        if (!principal ||
            principal.status !== 'ACTIVE' ||
            (!principal.isAdmin &&
                required.some((code) => !principal.permissions.includes(code)))) {
            throw new common_1.ForbiddenException('Insufficient permissions');
        }
    }
};
exports.PermissionGuard = PermissionGuard;
exports.PermissionGuard = PermissionGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        system_repository_1.SystemRepository])
], PermissionGuard);
//# sourceMappingURL=permission.guard.js.map