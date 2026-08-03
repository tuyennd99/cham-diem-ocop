import { Injectable } from '@nestjs/common';
import {
  Frequency,
  PeriodStatus,
  Prisma,
  ReportStatus,
  TaskType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface DashboardFilters {
  taskCode?: string;
  taskName?: string;
  frequency?: Frequency;
  year?: number;
  sequence?: number;
  programId?: number;
  dueFrom?: string;
  dueTo?: string;
}

export interface DashboardTaskRow {
  id: number;
  type: TaskType;
  completedAt: Date | null;
  closedAt: Date | null;
  periods: {
    id: number;
    frequency: Frequency | null;
    status: PeriodStatus;
    dueAt: Date;
    workspaceStatuses: ReportStatus[];
  }[];
}

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) { }

  async loadSummaryRows(input: {
    filters: DashboardFilters;
    organizationId: number;
    globalScope: boolean;
  }): Promise<DashboardTaskRow[]> {
    const periodWhere = this.periodWhere(input.filters);
    const hasPeriodFilter = [
      input.filters.frequency,
      input.filters.year,
      input.filters.sequence,
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
        ...(hasPeriodFilter ? { reportingPeriods: { some: periodWhere } } : {}),
      },
      select: {
        id: true,
        type: true,
        completedAt: true,
        closedAt: true,
        leadOrganizationId: true,
        reportingPeriods: {
          where: periodWhere,
          select: {
            id: true,
            frequency: true,
            status: true,
            dueAt: true,
            workspaces: {
              select: { status: true, ownerOrganizationId: true },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    return rows.map(({ reportingPeriods, leadOrganizationId, ...task }) => ({
      ...task,
      periods: reportingPeriods.map(({ workspaces, ...period }) => ({
        ...period,
        workspaceStatuses: workspaces
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

  private periodWhere(
    filters: DashboardFilters,
  ): Prisma.ReportingPeriodWhereInput {
    return {
      status: { not: PeriodStatus.CANCELED },
      ...(filters.frequency ? { frequency: filters.frequency } : {}),
      ...(filters.year ? { year: filters.year } : {}),
      ...(filters.sequence ? { sequence: filters.sequence } : {}),
      ...(filters.dueFrom || filters.dueTo
        ? {
          dueAt: {
            ...(filters.dueFrom ? { gte: new Date(filters.dueFrom) } : {}),
            ...(filters.dueTo ? { lte: new Date(filters.dueTo) } : {}),
          },
        }
        : {}),
    };
  }
}
