import { Injectable } from '@nestjs/common';
import {
  Prisma,
  SubtaskStatus
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardFilters, DashboardTaskRow } from '../types/dashboard';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) { }

  async loadSummaryRows(input: {
    filters: DashboardFilters;
    organizationId: number;
    globalScope: boolean;
  }): Promise<DashboardTaskRow[]> {
    const subtaskWhere = this.subtaskWhere(input.filters);
    const hasSubtaskFilter = [
      input.filters.year,
      input.filters.dueFrom,
      input.filters.dueTo,
    ].some((value) => value !== undefined);
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
        ...(hasSubtaskFilter ? { subtasks: { some: subtaskWhere } } : {}),
      },
      select: {
        id: true,
        type: true,
        completedAt: true,
        closedAt: true,
        leadOrganizationId: true,
        subtasks: {
          where: subtaskWhere,
          select: {
            id: true,
            status: true,
            startAt: true,
            dueAt: true,
            workspaces: {
              select: { status: true, ownerOrganizationId: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return rows.map(({ subtasks, leadOrganizationId, ...task }) => ({
      ...task,
      subtasks: subtasks.map(({ workspaces, ...subtask }) => ({
        ...subtask,
        reportStatus: workspaces
          .filter(
            ({ ownerOrganizationId }) =>
              input.globalScope ||
              leadOrganizationId === input.organizationId ||
              ownerOrganizationId === input.organizationId,
          )
          .map(({ status }) => status),
      })),
    }));
  }

  private subtaskWhere(
    filters: DashboardFilters,
  ): Prisma.SubtaskWhereInput {
    // Subtask không còn cột `year`; lọc theo năm quy về khoảng dueAt.
    const dueAt: Prisma.DateTimeFilter = {};
    if (filters.year) {
      dueAt.gte = new Date(Date.UTC(filters.year, 0, 1));
      dueAt.lt = new Date(Date.UTC(filters.year + 1, 0, 1));
    }
    if (filters.dueFrom) dueAt.gte = new Date(filters.dueFrom);
    if (filters.dueTo) dueAt.lte = new Date(filters.dueTo);
    return {
      status: { not: SubtaskStatus.CANCELED },
      ...(Object.keys(dueAt).length ? { dueAt } : {}),
    };
  }
}
