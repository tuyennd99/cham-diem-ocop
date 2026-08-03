import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditAppendInput {
  actorId?: number | null;
  organizationId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  beforeData?: Prisma.InputJsonValue | null;
  afterData?: Prisma.InputJsonValue | null;
  reason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

export interface AuditListFilters {
  page: number;
  limit: number;
  action?: string;
  entityType?: string;
  entityId?: number;
  actorId?: number;
  organizationId?: number;
  createdFrom?: string;
  createdTo?: string;
}

const auditSelect = {
  id: true,
  actorId: true,
  organizationId: true,
  action: true,
  entityType: true,
  entityId: true,
  beforeData: true,
  afterData: true,
  reason: true,
  ipAddress: true,
  userAgent: true,
  requestId: true,
  createdAt: true,
  actor: { select: { id: true, username: true, fullName: true } },
  organization: { select: { id: true, code: true, name: true } },
} satisfies Prisma.AuditLogSelect;

export type AuditListRow = Prisma.AuditLogGetPayload<{
  select: typeof auditSelect;
}>;

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) { }

  append(input: AuditAppendInput) {
    return this.prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        organizationId: input.organizationId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ...(input.beforeData === undefined
          ? {}
          : {
            beforeData:
              input.beforeData === null ? Prisma.DbNull : input.beforeData,
          }),
        ...(input.afterData === undefined
          ? {}
          : {
            afterData:
              input.afterData === null ? Prisma.DbNull : input.afterData,
          }),
        reason: input.reason,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        requestId: input.requestId,
      },
      select: { id: true },
    });
  }

  async list(filters: AuditListFilters) {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.organizationId
        ? { organizationId: filters.organizationId }
        : {}),
      ...(filters.createdFrom || filters.createdTo
        ? {
          createdAt: {
            ...(filters.createdFrom
              ? { gte: new Date(filters.createdFrom) }
              : {}),
            ...(filters.createdTo
              ? { lte: new Date(filters.createdTo) }
              : {}),
          },
        }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        select: auditSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total };
  }
}
