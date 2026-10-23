import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateOrganizationUnitDto,
  OrganizationUnitsQueryDto,
  UpdateOrganizationUnitDto,
} from '../dtos/admin-users.dto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import type { RequestMeta } from '../types/auth';
import { writeAudit } from '../utils/audit-log';

@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listOrganizationUnits(query: OrganizationUnitsQueryDto) {
    const { page, limit, q, isActive } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }
    const where: Prisma.OrganizationUnitWhereInput = {
      isActive,
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction(
      [
        this.prisma.organizationUnit.findMany({
          where,
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          skip,
          take: limit,
        }),
        this.prisma.organizationUnit.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data, total };
  }

  createOrganizationUnit(
    input: CreateOrganizationUnitDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const unit = await tx.organizationUnit.create({ data });
      await writeAudit(tx, {
        actorId,
        action: 'organization_unit.create',
        entityType: 'OrganizationUnit',
        entityId: unit.id,
        afterData: unit,
        reason,
        ...meta,
      });
      return unit;
    });
  }

  updateOrganizationUnit(
    id: string,
    input: UpdateOrganizationUnitDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...changes } = input;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('organization_units')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.organizationUnit.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Organization unit not found');
      const after = await tx.organizationUnit.update({
        where: { id },
        data: changes,
      });
      await writeAudit(tx, {
        actorId,
        action: 'organization_unit.update',
        entityType: 'OrganizationUnit',
        entityId: id,
        beforeData: before,
        afterData: after,
        reason,
        ...meta,
      });
      return after;
    });
  }
}
