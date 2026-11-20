import { Injectable } from '@nestjs/common';
import {
  EvaluationStatus,
  Prisma,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import type { AdminReportFilterQuery } from '@ocop/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { databaseObject } from '../../prisma/sql';
import { extractSafeApplicationForm } from '../../utils/registration-snapshot';
import {
  formatVnBoundaryIso,
  resolveVietnamPeriod,
  type ReportingProductRecord,
} from '../../utils/reporting';

@Injectable()
export class AdminAnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async dashboardData(canManage = true, queuePage?: number, queueSearch = '') {
    const queueLimit = queuePage === undefined ? 10 : 5;
    const queueWhere: Prisma.ProductWhereInput = {
      status: {
        in: [
          ProductStatus.SUBMITTED,
          ProductStatus.APPROVED,
          ProductStatus.SCORING,
        ],
      },
      ...(queueSearch
        ? {
            OR: [
              { name: { contains: queueSearch, mode: 'insensitive' } },
              {
                category: {
                  name: { contains: queueSearch, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [productStatuses, judgeProgress, nextProducts, nextProductsCount] =
      await Promise.all([
        this.prisma.product.groupBy({
          by: ['status'],
          where: canManage ? {} : { status: { not: ProductStatus.DRAFT } },
          _count: { _all: true },
        }),
        this.prisma.$queryRaw<
          Array<{
            judgeId: string;
            fullName: string;
            assigned: number;
            submitted: number;
          }>
        >(Prisma.sql`
        WITH active_judges AS (
          SELECT u."id", u."fullName"
          FROM ${databaseObject('users')} u
          WHERE u."role" <> ${Role.REGISTRANT}::${databaseObject('Role')}
            AND ${StaffPermission.SCORE}::${databaseObject('StaffPermission')} = ANY(u."staffPermissions")
            AND u."isActive" = true AND u."verified" = true
        ),
        assigned_products AS (
          SELECT pja."judgeId", p."id" AS "productId"
          FROM ${databaseObject('product_judge_assignments')} pja
          JOIN ${databaseObject('products')} p ON p."id" = pja."productId"
          WHERE pja."isActive" = true
            AND p."status" IN (${ProductStatus.APPROVED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')})
          UNION
          SELECT ja."judgeId", p."id" AS "productId"
          FROM ${databaseObject('judge_assignments')} ja
          JOIN ${databaseObject('products')} p ON p."categoryId" = ja."categoryId"
          WHERE p."status" IN (${ProductStatus.SUBMITTED}::${databaseObject('ProductStatus')}, ${ProductStatus.APPROVED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')})
            AND NOT EXISTS (
              SELECT 1
              FROM ${databaseObject('product_judge_assignments')} pja2
              WHERE pja2."productId" = p."id"
            )
        )
        SELECT j."id" AS "judgeId", j."fullName",
          COUNT(ap."productId")::int AS "assigned",
          COUNT(ap."productId") FILTER (WHERE e."status" = ${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')})::int AS "submitted"
        FROM active_judges j
        LEFT JOIN assigned_products ap ON ap."judgeId" = j."id"
        LEFT JOIN ${databaseObject('evaluations')} e ON e."judgeId" = j."id" AND e."productId" = ap."productId"
        GROUP BY j."id", j."fullName"
        ORDER BY j."fullName" ASC, j."id" ASC
      `),
        this.prisma.product.findMany({
          where: queueWhere,
          select: {
            id: true,
            codeNumber: true,
            name: true,
            status: true,
            submittedAt: true,
            category: {
              select: {
                id: true,
                name: true,
                assignments: {
                  where: {
                    judge: {
                      is: {
                        role: { not: Role.REGISTRANT },
                        staffPermissions: { has: StaffPermission.SCORE },
                        isActive: true,
                        verified: true,
                      },
                    },
                  },
                  select: { judgeId: true },
                },
              },
            },
            judgeAssignments: {
              where: { isActive: true },
              select: { judgeId: true },
            },
            evaluations: { select: { judgeId: true, status: true } },
          },
          orderBy: [
            { submittedAt: { sort: 'asc', nulls: 'last' } },
            { id: 'asc' },
          ],
          skip: ((queuePage ?? 1) - 1) * queueLimit,
          take: queueLimit,
        }),
        this.prisma.product.count({ where: queueWhere }),
      ]);
    return { productStatuses, judgeProgress, nextProducts, nextProductsCount };
  }

  private buildReportingProductWhere(
    filters: AdminReportFilterQuery | undefined,
    generatedAt: Date,
    earliestEventAt: Date | null,
  ): Prisma.ProductWhereInput {
    const productConditions: Prisma.ProductWhereInput[] = [
      { status: { not: ProductStatus.DRAFT } },
    ];
    if (filters?.categoryId) {
      productConditions.push({ categoryId: filters.categoryId });
    }
    if (filters?.localityId) {
      productConditions.push({
        OR: [
          { localityId: filters.localityId },
          { localityId: null, localityCodeAtSubmit: filters.localityId },
        ],
      });
    }
    if (filters?.registrationType) {
      productConditions.push({
        formData: {
          path: ['registrationType'],
          equals: filters.registrationType,
        },
      });
    }
    if (filters?.assessmentYear !== undefined) {
      productConditions.push({
        OR: [
          {
            formData: {
              path: ['assessmentYear'],
              equals: filters.assessmentYear,
            },
          },
          {
            formData: {
              path: ['assessmentYear'],
              equals: String(filters.assessmentYear),
            },
          },
        ],
      });
    }
    if (filters?.year !== undefined) {
      const period = resolveVietnamPeriod(
        { year: filters.year, month: filters.month },
        generatedAt,
        earliestEventAt,
      );
      const yearStart = new Date(formatVnBoundaryIso(period.year, 1, 1));
      const minStart =
        period.prevFromDate.getTime() < yearStart.getTime()
          ? period.prevFromDate
          : yearStart;
      const asOfDate = period.asOfDate;
      productConditions.push({
        OR: [
          { submittedAt: null },
          { status: ProductStatus.COMPLETED, completedAt: null },
          { submittedAt: { lt: asOfDate }, completedAt: null },
          {
            submittedAt: { lt: asOfDate },
            completedAt: { gte: minStart },
          },
          { completedAt: { gte: minStart, lt: asOfDate } },
        ],
      });
    }
    return { AND: productConditions };
  }

  private isCategoryCoveredNow(cat: {
    criteriaSet: { criteria: Array<{ id: string }> } | null;
    agencyLinks: Array<{
      agency: { organizationUnits: Array<{ users: Array<{ id: string }> }> };
    }>;
    assignments: Array<{ criterionIds: string[] }>;
  }): boolean {
    const allCriterionIds = cat.criteriaSet?.criteria.map((c) => c.id) ?? [];
    if (!allCriterionIds.length) return false;
    if (
      cat.agencyLinks.length > 0 &&
      cat.agencyLinks.every((link) =>
        link.agency.organizationUnits.some((u) => u.users.length > 0),
      )
    ) {
      return true;
    }
    if (!cat.assignments.length) return false;
    const covered = new Set(
      cat.assignments.flatMap((a) =>
        a.criterionIds.length ? a.criterionIds : allCriterionIds,
      ),
    );
    return allCriterionIds.every((id) => covered.has(id));
  }

  async reportingSnapshot(filters?: AdminReportFilterQuery) {
    return this.prisma.$transaction(
      async (tx) => {
        const earliestEvent = await tx.productStatusEvent.findFirst({
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        });
        const generatedAt = new Date();
        const where = this.buildReportingProductWhere(
          filters,
          generatedAt,
          earliestEvent?.createdAt ?? null,
        );

        const rawProducts = await tx.product.findMany({
          where,
          select: {
            id: true,
            name: true,
            registrantId: true,
            status: true,
            submittedAt: true,
            completedAt: true,
            finalScore: true,
            starRating: true,
            formData: true,
            localityId: true,
            localityCodeAtSubmit: true,
            localityNameAtSubmit: true,
            provinceNameAtSubmit: true,
            locality: {
              select: {
                id: true,
                code: true,
                name: true,
                provinceName: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            statusEvents: {
              select: {
                sequence: true,
                toStatus: true,
                createdAt: true,
              },
              orderBy: { sequence: 'asc' },
            },
          },
          orderBy: { id: 'asc' },
        });
        const categories = await tx.productCategory.findMany({
          select: {
            id: true,
            name: true,
            criteriaSet: {
              select: {
                criteria: { select: { id: true } },
              },
            },
            agencyLinks: {
              select: {
                agency: {
                  select: {
                    id: true,
                    organizationUnits: {
                      where: { isActive: true },
                      select: {
                        users: {
                          where: {
                            role: { not: Role.REGISTRANT },
                            staffPermissions: { has: StaffPermission.SCORE },
                            isActive: true,
                            verified: true,
                          },
                          select: { id: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            assignments: {
              where: {
                judge: {
                  is: {
                    role: { not: Role.REGISTRANT },
                    staffPermissions: { has: StaffPermission.SCORE },
                    isActive: true,
                    verified: true,
                  },
                },
              },
              select: { judgeId: true, criterionIds: true },
            },
          },
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
        });
        const localities = await tx.locality.findMany({
          select: {
            id: true,
            code: true,
            name: true,
            provinceName: true,
          },
          orderBy: [{ provinceName: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        });

        const coveredCategoryIdsAtNow = new Set<string>();
        for (const cat of categories) {
          if (this.isCategoryCoveredNow(cat)) {
            coveredCategoryIdsAtNow.add(cat.id);
          }
        }

        const products: ReportingProductRecord[] = rawProducts.map((p) => {
          const safeForm = extractSafeApplicationForm(p.formData);
          const locality =
            p.status !== ProductStatus.DRAFT && p.localityNameAtSubmit
              ? {
                  id: p.localityId ?? p.localityCodeAtSubmit ?? 'SUBMITTED_LOC',
                  code: p.localityCodeAtSubmit ?? p.locality?.code ?? '',
                  name: p.localityNameAtSubmit,
                  provinceName:
                    p.provinceNameAtSubmit ?? p.locality?.provinceName ?? '',
                }
              : p.locality;
          return {
            id: p.id,
            name: p.name,
            registrantId: p.registrantId,
            status: p.status,
            submittedAt: p.submittedAt,
            completedAt: p.completedAt,
            finalScore: p.finalScore,
            starRating: p.starRating,
            registrationType: safeForm.registrationType ?? null,
            assessmentYear: safeForm.assessmentYear ?? null,
            category: p.category,
            locality,
            statusEvents: p.statusEvents,
          };
        });

        return {
          generatedAt,
          products,
          categories: categories.map(
            ({
              criteriaSet: _cs,
              assignments: _as,
              agencyLinks: _al,
              ...cat
            }) => cat,
          ),
          localities,
          coveredCategoryIdsAtNow,
          historyAvailableFrom: earliestEvent?.createdAt ?? null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
