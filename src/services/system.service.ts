import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { uniq } from 'lodash';
import { hashPassword } from '../../prisma/seed/password';
import {
  CreateOrganizationDto,
  CreatePermissionGroupDto,
  CreateProgramDto,
  CreateUserDto,
  CreateUserGroupDto,
  UpdateOrganizationDto,
  UpdatePermissionGroupDto,
  UpdateProgramDto,
  UpdateUserDto,
  UpdateUserGroupDto,
} from '../dtos/system.dto';
import { SystemRepository } from '../repositories/system.repository';
import { RequestMeta } from '../types/auth';

@Injectable()
export class SystemService {
  constructor(private readonly repository: SystemRepository) {}

  async listUsers() {
    return (await this.repository.listUsers()).map((user) =>
      this.publicUser(user),
    );
  }

  async getUser(id: number) {
    const user = await this.repository.findUserById(id);
    if (!user) throw this.notFound('User');
    return this.publicUser(user);
  }

  async createUser(input: CreateUserDto, actorId: number, meta: RequestMeta) {
    if (await this.repository.findUserByUsername(input.username.trim())) {
      throw this.conflict('Username already exists');
    }
    await this.requireOrganization(input.organizationId);
    await this.requirePermissionGroups(input.permissionGroupIds);

    return this.translate(async () =>
      this.publicUser(
        await this.repository.createUser(
          {
            username: input.username.trim(),
            fullName: input.fullName.trim(),
            position: input.position?.trim() || undefined,
            rank: input.rank?.trim() || undefined,
            phone: input.phone?.trim() || undefined,
            passwordHash: await hashPassword(input.password),
            organizationId: input.organizationId,
            permissionGroupIds: input.permissionGroupIds,
          },
          actorId,
          meta,
        ),
      ),
    );
  }

  async updateUser(
    id: number,
    input: UpdateUserDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    await this.getUser(id);
    if (input.username !== undefined) {
      const duplicate = await this.repository.findUserByUsername(
        input.username.trim(),
      );
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

    return this.translate(async () =>
      this.publicUser(
        await this.repository.updateUser(
          id,
          {
            ...input,
            ...(input.username === undefined
              ? {}
              : { username: input.username.trim() }),
            ...(input.fullName === undefined
              ? {}
              : { fullName: input.fullName.trim() }),
          },
          actorId,
          meta,
        ),
      ),
    );
  }

  async deleteUser(id: number, actorId: number, meta: RequestMeta) {
    await this.getUser(id);
    await this.repository.deleteUser(id, actorId, new Date(), meta);
    return { success: true };
  }

  async lockUser(
    id: number,
    reason: string,
    actorId: number,
    meta: RequestMeta,
  ) {
    await this.getUser(id);
    return this.publicUser(
      await this.repository.lockUser(
        id,
        actorId,
        reason.trim(),
        new Date(),
        meta,
      ),
    );
  }

  async unlockUser(id: number, actorId: number, meta: RequestMeta) {
    await this.getUser(id);
    return this.publicUser(
      await this.repository.unlockUser(id, actorId, new Date(), meta),
    );
  }

  async resetUserPassword(
    id: number,
    password: string,
    actorId: number,
    meta: RequestMeta,
  ) {
    await this.getUser(id);
    await this.repository.resetUserPassword(
      id,
      actorId,
      await hashPassword(password),
      new Date(),
      meta,
    );
    return { success: true };
  }

  listUserGroups() {
    return this.repository.listUserGroups();
  }

  async getUserGroup(id: number) {
    const item = await this.repository.findUserGroupById(id);
    if (!item) throw this.notFound('User group');
    return item;
  }

  async createUserGroup(
    input: CreateUserGroupDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    const name = input.name.trim();
    if (await this.repository.findUserGroupByName(name)) {
      throw this.conflict('User group name already exists');
    }
    await this.requireUsers(input.userIds);
    return this.translate(() =>
      this.repository.createUserGroup(
        {
          name,
          description: input.description?.trim(),
          userIds: input.userIds,
        },
        actorId,
        meta,
      ),
    );
  }

  async updateUserGroup(
    id: number,
    input: UpdateUserGroupDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    await this.getUserGroup(id);
    if (input.name !== undefined) {
      const duplicate = await this.repository.findUserGroupByName(
        input.name.trim(),
      );
      if (duplicate && duplicate.id !== id) {
        throw this.conflict('User group name already exists');
      }
    }
    if (input.userIds !== undefined) await this.requireUsers(input.userIds);

    return this.translate(() =>
      this.repository.updateUserGroup(
        id,
        {
          ...input,
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
          ...(input.description === undefined
            ? {}
            : { description: input.description.trim() }),
        },
        actorId,
        meta,
      ),
    );
  }

  async deleteUserGroup(id: number, actorId: number, meta: RequestMeta) {
    await this.getUserGroup(id);
    await this.translate(() =>
      this.repository.deleteUserGroup(id, actorId, meta),
    );
    return { success: true };
  }

  listOrganizations() {
    return this.repository.listOrganizations();
  }

  async getOrganization(id: number) {
    return this.requireOrganization(id);
  }

  async createOrganization(
    input: CreateOrganizationDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    if (await this.repository.findOrganizationByCode(input.code.trim())) {
      throw this.conflict('Organization code already exists');
    }
    return this.translate(() =>
      this.repository.createOrganization(
        { ...input, code: input.code.trim(), name: input.name.trim() },
        actorId,
        meta,
      ),
    );
  }

  async updateOrganization(
    id: number,
    input: UpdateOrganizationDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    await this.requireOrganization(id);
    if (input.code !== undefined) {
      const duplicate = await this.repository.findOrganizationByCode(
        input.code.trim(),
      );
      if (duplicate && duplicate.id !== id) {
        throw this.conflict('Organization code already exists');
      }
    }
    return this.translate(() =>
      this.repository.updateOrganization(
        id,
        {
          ...input,
          ...(input.code === undefined ? {} : { code: input.code.trim() }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
        },
        actorId,
        meta,
      ),
    );
  }

  async deleteOrganization(id: number, actorId: number, meta: RequestMeta) {
    await this.requireOrganization(id);
    await this.translate(() =>
      this.repository.deleteOrganization(id, actorId, meta),
    );
    return { success: true };
  }

  listPrograms() {
    return this.repository.listPrograms();
  }

  async getProgram(id: number) {
    const item = await this.repository.findProgramById(id);
    if (!item) throw this.notFound('Program');
    return item;
  }

  async createProgram(
    input: CreateProgramDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    if (await this.repository.findProgramByCode(input.code.trim())) {
      throw this.conflict('Program code already exists');
    }
    return this.translate(() =>
      this.repository.createProgram(
        { ...input, code: input.code.trim(), name: input.name.trim() },
        actorId,
        meta,
      ),
    );
  }

  async updateProgram(
    id: number,
    input: UpdateProgramDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    await this.getProgram(id);
    if (input.code !== undefined) {
      const duplicate = await this.repository.findProgramByCode(
        input.code.trim(),
      );
      if (duplicate && duplicate.id !== id) {
        throw this.conflict('Program code already exists');
      }
    }
    return this.translate(() =>
      this.repository.updateProgram(
        id,
        {
          ...input,
          ...(input.code === undefined ? {} : { code: input.code.trim() }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
        },
        actorId,
        meta,
      ),
    );
  }

  async deleteProgram(id: number, actorId: number, meta: RequestMeta) {
    await this.getProgram(id);
    await this.translate(() =>
      this.repository.deleteProgram(id, actorId, meta),
    );
    return { success: true };
  }

  listPermissionGroups() {
    return this.repository.listPermissionGroups();
  }

  async getPermissionGroup(id: number) {
    const item = await this.repository.findPermissionGroupById(id);
    if (!item) throw this.notFound('Permission group');
    return item;
  }

  async createPermissionGroup(
    input: CreatePermissionGroupDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    if (await this.repository.findPermissionGroupByCode(input.code.trim())) {
      throw this.conflict('Permission group code already exists');
    }
    await this.requirePermissions(input.permissionIds);
    return this.translate(() =>
      this.repository.createPermissionGroup(
        { ...input, code: input.code.trim(), name: input.name.trim() },
        actorId,
        meta,
      ),
    );
  }

  async updatePermissionGroup(
    id: number,
    input: UpdatePermissionGroupDto,
    actorId: number,
    meta: RequestMeta,
  ) {
    await this.getPermissionGroup(id);
    if (input.code !== undefined) {
      const duplicate = await this.repository.findPermissionGroupByCode(
        input.code.trim(),
      );
      if (duplicate && duplicate.id !== id) {
        throw this.conflict('Permission group code already exists');
      }
    }
    if (input.permissionIds !== undefined) {
      await this.requirePermissions(input.permissionIds);
    }
    return this.translate(() =>
      this.repository.updatePermissionGroup(
        id,
        {
          ...input,
          ...(input.code === undefined ? {} : { code: input.code.trim() }),
          ...(input.name === undefined ? {} : { name: input.name.trim() }),
        },
        actorId,
        meta,
      ),
    );
  }

  async deletePermissionGroup(id: number, actorId: number, meta: RequestMeta) {
    await this.getPermissionGroup(id);
    await this.repository.deletePermissionGroup(id, actorId, meta);
    return { success: true };
  }

  listPermissions() {
    return this.repository.listPermissions();
  }

  private async requireOrganization(id: number) {
    const item = await this.repository.findOrganizationById(id);
    if (!item) throw this.notFound('Organization');
    return item;
  }

  private async requirePermissionGroups(ids: number[]) {
    const items = await this.repository.findPermissionGroupsByIds(ids);
    if (items.length !== uniq(ids).length) {
      throw this.notFound('Permission group');
    }
  }

  private async requirePermissions(ids: number[]) {
    const items = await this.repository.findPermissionsByIds(ids);
    if (items.length !== uniq(ids).length) {
      throw this.notFound('Permission');
    }
  }

  private async requireUsers(ids: number[]) {
    const items = await this.repository.findUsersByIds(ids);
    if (items.length !== ids.length) throw this.notFound('User');
  }

  private publicUser<T extends Record<string, unknown>>(user: T) {
    const {
      passwordHash: _passwordHash,
      failedLoginCount: _failedLoginCount,
      failedLoginWindowStartedAt: _failedLoginWindowStartedAt,
      lockedAt: _lockedAt,
      lockedUntil: _lockedUntil,
      lockReason: _lockReason,
      refreshSessions: _refreshSessions,
      deletedAt: _deletedAt,
      ...safe
    } = user;
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

  private async translate<T>(operation: () => Promise<T>) {
    try {
      return await operation();
    } catch (error) {
      const code = (error as { code?: unknown })?.code;
      if (code === 'P2002') throw this.conflict('Value already exists');
      if (code === 'P2003') throw this.conflict('Resource is in use');
      throw error;
    }
  }

  private conflict(message: string) {
    return new ConflictException({ errorCode: 'CONFLICT', message });
  }

  private notFound(entity: string) {
    return new NotFoundException({
      errorCode: 'NOT_FOUND',
      message: `${entity} not found`,
    });
  }
}
