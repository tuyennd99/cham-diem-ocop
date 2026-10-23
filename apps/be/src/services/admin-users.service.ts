import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import {
  AdminUsersQueryDto,
  CreateAdminUserDto,
  CreateOrganizationUnitDto,
  OrganizationUnitsQueryDto,
  ResetAdminUserPasswordDto,
  UpdateAdminUserProfileDto,
  UpdateOrganizationUnitDto,
  UpdateAdminUserStatusDto,
} from '../dtos/admin-users.dto';
import { AdminUsersRepository } from '../repositories/admin-users.repository';
import type { RequestMeta } from '../types/auth';
import { PASSWORD_MAX_BYTES, PASSWORD_ROUNDS } from '../constants/auth';

@Injectable()
export class AdminUsersService {
  constructor(private readonly repository: AdminUsersRepository) {}

  async listUsers(query: AdminUsersQueryDto) {
    const { data, total } = await this.repository.listUsers(query);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getUser(id: string) {
    const user = await this.repository.findUser(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async createUser(input: CreateAdminUserDto, actorId: string, meta: RequestMeta) {
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    const reason = input.reason.trim();
    if (!fullName) throw new BadRequestException('Full name is required');
    if (!reason) throw new BadRequestException('Reason is required');
    const password = await this.hashPassword(input.password);
    try {
      return await this.repository.createUser({
        ...input,
        email,
        fullName,
        phone: input.phone?.trim() || null,
        password,
        reason,
      }, actorId, meta);
    } catch (error) {
      if (this.isUniqueConstraint(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async updateUserProfile(
    id: string,
    input: UpdateAdminUserProfileDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...changes } = input;
    if (!reason.trim()) throw new BadRequestException('Reason is required');
    const user = await this.repository.updateUserProfile(id, {
      ...changes,
      ...(changes.fullName === undefined
        ? {}
        : { fullName: changes.fullName.trim() }),
      ...(changes.phone === undefined
        ? {}
        : { phone: changes.phone?.trim() || null }),
      reason: reason.trim(),
    }, actorId, meta);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateUserStatus(
    id: string,
    input: UpdateAdminUserStatusDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const user = await this.repository.updateUserStatus(
      id,
      { ...input, reason: input.reason.trim() },
      actorId,
      meta,
    );
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async resetUserPassword(
    id: string,
    input: ResetAdminUserPasswordDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const current = await this.repository.findUserRole(id);
    if (!current) throw new NotFoundException('User not found');
    const minimum = current.role === Role.REGISTRANT ? 8 : 12;
    if (input.password.length < minimum) {
      throw new BadRequestException(`Password must be at least ${minimum} characters`);
    }
    if (!input.reason.trim()) throw new BadRequestException('Reason is required');
    const password = await this.hashPassword(input.password);
    const user = await this.repository.resetUserPassword(
      id,
      password,
      input.reason.trim(),
      actorId,
      meta,
    );
    if (!user) throw new NotFoundException('User not found');
    return { id: user.id };
  }

  async listOrganizationUnits(query: OrganizationUnitsQueryDto) {
    const { data, total } = await this.repository.listOrganizationUnits(query);
    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  createOrganizationUnit(
    input: CreateOrganizationUnitDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    return this.repository.createOrganizationUnit(input, actorId, meta);
  }

  updateOrganizationUnit(
    id: string,
    input: UpdateOrganizationUnitDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    return this.repository.updateOrganizationUnit(id, input, actorId, meta);
  }

  private async hashPassword(password: string) {
    if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
      throw new BadRequestException(
        `Password must be at most ${PASSWORD_MAX_BYTES} UTF-8 bytes`,
      );
    }
    return bcrypt.hash(password, PASSWORD_ROUNDS);
  }

  private isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }
}
