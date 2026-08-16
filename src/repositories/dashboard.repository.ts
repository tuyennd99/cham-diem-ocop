import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardFilters, DashboardTaskRow } from '../types/dashboard';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async loadSummaryRows(input: {
    filters: DashboardFilters;
    organizationId: number;
    userId: number;
    globalScope: boolean;
  }): Promise<DashboardTaskRow[]> {
    const dueAt = this.dueAtFilter(input.filters);
    const rows = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        ...(input.filters.taskCode
          ? {
              code: {
                contains: input.filters.taskCode,
                mode: Prisma.QueryMode.insensitive,
              },
            }
          : {}),
        ...(input.filters.taskName
          ? {
              name: {
                contains: input.filters.taskName,
                mode: Prisma.QueryMode.insensitive,
              },
            }
          : {}),
        ...(input.filters.programId
          ? { programId: input.filters.programId }
          : {}),
        ...(input.globalScope
          ? {}
          : {
              OR: [
                { assigningOrganizationId: input.organizationId },
                { leadOrganizationId: input.organizationId },
                {
                  collaborators: {
                    some: { organizationId: input.organizationId },
                  },
                },
              ],
            }),
        ...(Object.keys(dueAt).length ? { dueAt } : {}),
      },
      select: {
        id: true,
        type: true,
        startAt: true,
        dueAt: true,
        completedAt: true,
        closedAt: true,
        assigningOrganizationId: true,
        leadOrganizationId: true,
        workspaces: {
          select: { status: true, ownerUserId: true },
        },
      },
      orderBy: { id: 'asc' },
    });

    return rows.map(
      ({ workspaces, assigningOrganizationId, leadOrganizationId, ...task }) => ({
        ...task,
        reportStatus: workspaces
          .filter(
            ({ ownerUserId }) =>
              input.globalScope ||
              assigningOrganizationId === input.organizationId ||
              leadOrganizationId === input.organizationId ||
              ownerUserId === input.userId,
          )
          .map(({ status }) => status),
      }),
    );
  }

  private dueAtFilter(
    filters: DashboardFilters,
  ): Prisma.DateTimeNullableFilter {
    const dueAt: Prisma.DateTimeNullableFilter = {};
    if (filters.year) {
      dueAt.gte = new Date(Date.UTC(filters.year, 0, 1));
      dueAt.lt = new Date(Date.UTC(filters.year + 1, 0, 1));
    }
    if (filters.dueFrom) dueAt.gte = new Date(filters.dueFrom);
    if (filters.dueTo) dueAt.lte = new Date(filters.dueTo);
    return dueAt;
  }
}
