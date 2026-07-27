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
exports.SystemService = void 0;
const common_1 = require("@nestjs/common");
const password_1 = require("../../prisma/password");
const system_repository_1 = require("../repositories/system.repository");
let SystemService = class SystemService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async listUsers() {
        return (await this.repository.listUsers()).map((user) => this.publicUser(user));
    }
    async getUser(id) {
        const user = await this.repository.findUserById(id);
        if (!user)
            throw this.notFound('User');
        return this.publicUser(user);
    }
    async createUser(input, actorId, meta) {
        if (await this.repository.findUserByUsername(input.username.trim())) {
            throw this.conflict('Username already exists');
        }
        await this.requireOrganization(input.organizationId);
        await this.requirePermissionGroups(input.permissionGroupIds);
        return this.translate(async () => this.publicUser(await this.repository.createUser({
            username: input.username.trim(),
            fullName: input.fullName.trim(),
            position: input.position?.trim() || undefined,
            rank: input.rank?.trim() || undefined,
            phone: input.phone?.trim() || undefined,
            passwordHash: await (0, password_1.hashPassword)(input.password),
            organizationId: input.organizationId,
            permissionGroupIds: input.permissionGroupIds,
        }, actorId, meta)));
    }
    async updateUser(id, input, actorId, meta) {
        await this.getUser(id);
        if (input.username !== undefined) {
            const duplicate = await this.repository.findUserByUsername(input.username.trim());
            if (duplicate && duplicate.id !== id) {
                throw this.conflict('Username already exists');
            }
        }
        if (input.organizationId !== undefined) {
            await this.requireOrganization(input.organizationId);
        }
        if (input.permissionGroupIds !== undefined) {
            await this.requirePermissionGroups(input.permissionGroupIds);
        }
        return this.translate(async () => this.publicUser(await this.repository.updateUser(id, {
            ...input,
            ...(input.username === undefined
                ? {}
                : { username: input.username.trim() }),
            ...(input.fullName === undefined
                ? {}
                : { fullName: input.fullName.trim() }),
        }, actorId, meta)));
    }
    async deleteUser(id, actorId, meta) {
        await this.getUser(id);
        await this.repository.deleteUser(id, actorId, new Date(), meta);
        return { success: true };
    }
    async lockUser(id, reason, actorId, meta) {
        await this.getUser(id);
        return this.publicUser(await this.repository.lockUser(id, actorId, reason.trim(), new Date(), meta));
    }
    async unlockUser(id, actorId, meta) {
        await this.getUser(id);
        return this.publicUser(await this.repository.unlockUser(id, actorId, new Date(), meta));
    }
    async resetUserPassword(id, password, actorId, meta) {
        await this.getUser(id);
        await this.repository.resetUserPassword(id, actorId, await (0, password_1.hashPassword)(password), new Date(), meta);
        return { success: true };
    }
    listOrganizations() {
        return this.repository.listOrganizations();
    }
    async getOrganization(id) {
        return this.requireOrganization(id);
    }
    async createOrganization(input, actorId, meta) {
        if (await this.repository.findOrganizationByCode(input.code.trim())) {
            throw this.conflict('Organization code already exists');
        }
        return this.translate(() => this.repository.createOrganization({ ...input, code: input.code.trim(), name: input.name.trim() }, actorId, meta));
    }
    async updateOrganization(id, input, actorId, meta) {
        await this.requireOrganization(id);
        if (input.code !== undefined) {
            const duplicate = await this.repository.findOrganizationByCode(input.code.trim());
            if (duplicate && duplicate.id !== id) {
                throw this.conflict('Organization code already exists');
            }
        }
        return this.translate(() => this.repository.updateOrganization(id, {
            ...input,
            ...(input.code === undefined ? {} : { code: input.code.trim() }),
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
        }, actorId, meta));
    }
    async deleteOrganization(id, actorId, meta) {
        await this.requireOrganization(id);
        await this.translate(() => this.repository.deleteOrganization(id, actorId, meta));
        return { success: true };
    }
    listPrograms() {
        return this.repository.listPrograms();
    }
    async getProgram(id) {
        const item = await this.repository.findProgramById(id);
        if (!item)
            throw this.notFound('Program');
        return item;
    }
    async createProgram(input, actorId, meta) {
        if (await this.repository.findProgramByCode(input.code.trim())) {
            throw this.conflict('Program code already exists');
        }
        return this.translate(() => this.repository.createProgram({ ...input, code: input.code.trim(), name: input.name.trim() }, actorId, meta));
    }
    async updateProgram(id, input, actorId, meta) {
        await this.getProgram(id);
        if (input.code !== undefined) {
            const duplicate = await this.repository.findProgramByCode(input.code.trim());
            if (duplicate && duplicate.id !== id) {
                throw this.conflict('Program code already exists');
            }
        }
        return this.translate(() => this.repository.updateProgram(id, {
            ...input,
            ...(input.code === undefined ? {} : { code: input.code.trim() }),
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
        }, actorId, meta));
    }
    async deleteProgram(id, actorId, meta) {
        await this.getProgram(id);
        await this.translate(() => this.repository.deleteProgram(id, actorId, meta));
        return { success: true };
    }
    listPermissionGroups() {
        return this.repository.listPermissionGroups();
    }
    async getPermissionGroup(id) {
        const item = await this.repository.findPermissionGroupById(id);
        if (!item)
            throw this.notFound('Permission group');
        return item;
    }
    async createPermissionGroup(input, actorId, meta) {
        if (await this.repository.findPermissionGroupByCode(input.code.trim())) {
            throw this.conflict('Permission group code already exists');
        }
        await this.requirePermissions(input.permissionIds);
        return this.translate(() => this.repository.createPermissionGroup({ ...input, code: input.code.trim(), name: input.name.trim() }, actorId, meta));
    }
    async updatePermissionGroup(id, input, actorId, meta) {
        await this.getPermissionGroup(id);
        if (input.code !== undefined) {
            const duplicate = await this.repository.findPermissionGroupByCode(input.code.trim());
            if (duplicate && duplicate.id !== id) {
                throw this.conflict('Permission group code already exists');
            }
        }
        if (input.permissionIds !== undefined) {
            await this.requirePermissions(input.permissionIds);
        }
        return this.translate(() => this.repository.updatePermissionGroup(id, {
            ...input,
            ...(input.code === undefined ? {} : { code: input.code.trim() }),
            ...(input.name === undefined ? {} : { name: input.name.trim() }),
        }, actorId, meta));
    }
    async deletePermissionGroup(id, actorId, meta) {
        await this.getPermissionGroup(id);
        await this.repository.deletePermissionGroup(id, actorId, meta);
        return { success: true };
    }
    listPermissions() {
        return this.repository.listPermissions();
    }
    async requireOrganization(id) {
        const item = await this.repository.findOrganizationById(id);
        if (!item)
            throw this.notFound('Organization');
        return item;
    }
    async requirePermissionGroups(ids) {
        const items = await this.repository.findPermissionGroupsByIds(ids);
        if (items.length !== new Set(ids).size) {
            throw this.notFound('Permission group');
        }
    }
    async requirePermissions(ids) {
        const items = await this.repository.findPermissionsByIds(ids);
        if (items.length !== new Set(ids).size) {
            throw this.notFound('Permission');
        }
    }
    publicUser(user) {
        const { passwordHash: _passwordHash, failedLoginCount: _failedLoginCount, failedLoginWindowStartedAt: _failedLoginWindowStartedAt, lockedAt: _lockedAt, lockedUntil: _lockedUntil, lockReason: _lockReason, refreshSessions: _refreshSessions, deletedAt: _deletedAt, ...safe } = user;
        void [
            _passwordHash,
            _failedLoginCount,
            _failedLoginWindowStartedAt,
            _lockedAt,
            _lockedUntil,
            _lockReason,
            _refreshSessions,
            _deletedAt,
        ];
        return safe;
    }
    async translate(operation) {
        try {
            return await operation();
        }
        catch (error) {
            const code = error?.code;
            if (code === 'P2002')
                throw this.conflict('Value already exists');
            if (code === 'P2003')
                throw this.conflict('Resource is in use');
            throw error;
        }
    }
    conflict(message) {
        return new common_1.ConflictException({ errorCode: 'CONFLICT', message });
    }
    notFound(entity) {
        return new common_1.NotFoundException({
            errorCode: 'NOT_FOUND',
            message: `${entity} not found`,
        });
    }
};
exports.SystemService = SystemService;
exports.SystemService = SystemService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [system_repository_1.SystemRepository])
], SystemService);
//# sourceMappingURL=system.service.js.map