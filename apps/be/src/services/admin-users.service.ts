import { Injectable } from '@nestjs/common';
import {
  CreateOrganizationUnitDto,
  OrganizationUnitsQueryDto,
  UpdateOrganizationUnitDto,
} from '../dtos/admin-users.dto';
import { AdminUsersRepository } from '../repositories/admin-users.repository';
import type { RequestMeta } from '../types/auth';

@Injectable()
export class AdminUsersService {
  constructor(private readonly repository: AdminUsersRepository) {}

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
}
