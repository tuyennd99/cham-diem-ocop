import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  EvaluationStatus,
  Prisma,
  ProductPublicationState,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import type {
  AdminCriteriaSetDetail,
  AdminCriteriaSetRecord,
  AdminCriteriaSetSortBy,
  AdminEvaluationRecord,
  AdminEvaluationSortBy,
  SortDirection,
} from '@ocop/shared';
import {
  ADMIN_CRITERIA_SET_SORT_BY,
  ADMIN_EVALUATION_SORT_BY,
  SORT_DIRECTION,
} from '../../constants/products';
import { computePaginationSkip } from '../../dtos/common.dto';
import type {
  AdminCriteriaSetsQueryDto,
  AdminEvaluationsQueryDto,
} from '../../dtos/admin-scoring.dto';
import { type OrderByBuilder, resolveOrderBy } from '../../prisma/order-by';
import { PrismaService } from '../../prisma/prisma.service';
import { databaseObject } from '../../prisma/sql';
import {
  buildBlankCriteriaPrintData,
  buildEvaluationPrintData,
  buildProductResultsPrintData,
  buildRegistrationPrintData,
} from '../../utils/print-data';
import {
  findProductIdsMatchingCodeQuery,
  formatProductCode,
} from '../../utils/product-code';
import { escapeSqlLike } from './admin-shared';

const DEFAULT_CRITERIA_SET_ORDER_BY: Prisma.CriteriaSetOrderByWithRelationInput[] =
  [
    { category: { order: SORT_DIRECTION.ASC } },
    { category: { id: SORT_DIRECTION.ASC } },
    { id: SORT_DIRECTION.ASC },
  ];

const CRITERIA_SET_ORDER_BY: Record<
  AdminCriteriaSetSortBy,
  OrderByBuilder<Prisma.CriteriaSetOrderByWithRelationInput>
> = {
  [ADMIN_CRITERIA_SET_SORT_BY.CATEGORY_NAME]: (dir = SORT_DIRECTION.ASC) => [
    { category: { name: dir } },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_CRITERIA_SET_SORT_BY.SOURCE]: (dir = SORT_DIRECTION.ASC) => [
    { source: { sort: dir, nulls: 'last' } },
    { category: { order: SORT_DIRECTION.ASC } },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_CRITERIA_SET_SORT_BY.CRITERION_COUNT]: (dir = SORT_DIRECTION.ASC) => [
    { criteria: { _count: dir } },
    { category: { order: SORT_DIRECTION.ASC } },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_CRITERIA_SET_SORT_BY.MAX_SCORE]: () => DEFAULT_CRITERIA_SET_ORDER_BY,
};

const DEFAULT_ADMIN_EVALUATION_ORDER_BY: Prisma.EvaluationOrderByWithRelationInput[] =
  [
    { submittedAt: { sort: SORT_DIRECTION.DESC, nulls: 'last' } },
    { updatedAt: SORT_DIRECTION.DESC },
    { id: SORT_DIRECTION.DESC },
  ];

const ADMIN_EVALUATION_ORDER_BY: Record<
  AdminEvaluationSortBy,
  OrderByBuilder<Prisma.EvaluationOrderByWithRelationInput>
> = {
  [ADMIN_EVALUATION_SORT_BY.PRODUCT]: (dir = SORT_DIRECTION.ASC) => [
    { product: { name: dir } },
    { id: SORT_DIRECTION.DESC },
  ],
  [ADMIN_EVALUATION_SORT_BY.JUDGE]: (dir = SORT_DIRECTION.ASC) => [
    { judge: { fullName: dir } },
    { id: SORT_DIRECTION.DESC },
  ],
  [ADMIN_EVALUATION_SORT_BY.STATUS]: (dir = SORT_DIRECTION.ASC) => [
    { status: dir },
    { submittedAt: { sort: SORT_DIRECTION.DESC, nulls: 'last' } },
    { id: SORT_DIRECTION.DESC },
  ],
  [ADMIN_EVALUATION_SORT_BY.TOTAL]: (dir = SORT_DIRECTION.DESC) => [
    { total: { sort: dir, nulls: 'last' } },
    { submittedAt: { sort: SORT_DIRECTION.DESC, nulls: 'last' } },
    { id: SORT_DIRECTION.DESC },
  ],
  [ADMIN_EVALUATION_SORT_BY.SUBMITTED_AT]: (dir = SORT_DIRECTION.DESC) => [
    { submittedAt: { sort: dir, nulls: 'last' } },
    { updatedAt: dir },
    { id: SORT_DIRECTION.DESC },
  ],
  [ADMIN_EVALUATION_SORT_BY.SCOPE]: () => DEFAULT_ADMIN_EVALUATION_ORDER_BY,
};

function buildEvaluationScopeOrderSql(
  scopeCountSql: Prisma.Sql,
  direction: SortDirection,
): Prisma.Sql {
  if (direction === SORT_DIRECTION.DESC) {
    return Prisma.sql`(${scopeCountSql})::double precision / GREATEST(COALESCE(cc."cnt", 0), 1) DESC, (${scopeCountSql}) DESC, e."id" DESC`;
  }
  return Prisma.sql`(${scopeCountSql})::double precision / GREATEST(COALESCE(cc."cnt", 0), 1) ASC, (${scopeCountSql}) ASC, e."id" DESC`;
}

@Injectable()
export class AdminScoringRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listCriteriaSets(
    query: AdminCriteriaSetsQueryDto,
    access: { canViewAll: boolean; scorerUserId?: string },
  ) {
    const { page, limit, q, categoryId, isActive, sortBy, sortDirection } =
      query;
    const skip = computePaginationSkip(page, limit);
    const where: Prisma.CriteriaSetWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
      category: {
        is: {
          ...(categoryId ? { id: categoryId } : {}),
          ...(!access.canViewAll && access.scorerUserId
            ? {
                OR: [
                  {
                    assignments: {
                      some: {
                        judgeId: access.scorerUserId,
                        judge: {
                          is: {
                            role: { not: Role.REGISTRANT },
                            staffPermissions: { has: StaffPermission.SCORE },
                            isActive: true,
                            verified: true,
                          },
                        },
                      },
                    },
                  },
                  {
                    products: {
                      some: {
                        judgeAssignments: {
                          some: {
                            judgeId: access.scorerUserId,
                            isActive: true,
                          },
                        },
                      },
                    },
                  },
                  {
                    agencyLinks: {
                      some: {
                        agency: {
                          organizationUnits: {
                            some: {
                              users: {
                                some: {
                                  id: access.scorerUserId,
                                  isActive: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
      },
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { source: { contains: q, mode: 'insensitive' } },
              {
                category: {
                  is: {
                    OR: [
                      { id: { contains: q, mode: 'insensitive' } },
                      { name: { contains: q, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const dir: SortDirection = sortDirection ?? SORT_DIRECTION.ASC;
    const isMaxScoreSort = sortBy === ADMIN_CRITERIA_SET_SORT_BY.MAX_SCORE;
    const orderBy = resolveOrderBy(
      sortBy,
      dir,
      CRITERIA_SET_ORDER_BY,
      DEFAULT_CRITERIA_SET_ORDER_BY,
    );

    const [rows, total] = await this.prisma.$transaction(
      [
        this.prisma.criteriaSet.findMany({
          where,
          select: {
            id: true,
            name: true,
            source: true,
            version: true,
            sourceHash: true,
            isActive: true,
            category: {
              select: {
                id: true,
                name: true,
                order: true,
              },
            },
            criteria: { select: { maxScore: true } },
            _count: { select: { criteria: true } },
          },
          orderBy,
          ...(isMaxScoreSort ? {} : { skip, take: limit }),
        }),
        this.prisma.criteriaSet.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const mapped: AdminCriteriaSetRecord[] = rows.map((row) => ({
      id: row.id,
      categoryId: row.category.id,
      categoryName: row.category.name,
      name: row.name,
      source: row.source,
      version: row.version,
      sourceHash: row.sourceHash,
      isActive: row.isActive,
      criterionCount: row._count.criteria,
      maxScore: row.criteria.reduce((sum, item) => sum + item.maxScore, 0),
    }));

    const data = isMaxScoreSort
      ? [...mapped]
          .sort(
            (a, b) =>
              (a.maxScore - b.maxScore) *
                (dir === SORT_DIRECTION.DESC ? -1 : 1) ||
              a.categoryName.localeCompare(b.categoryName),
          )
          .slice(skip, skip + limit)
      : mapped;

    return { data, total };
  }

  async findCriteriaSetDetail(
    id: string,
    access: { canViewAll: boolean; scorerUserId?: string },
  ): Promise<AdminCriteriaSetDetail | null> {
    const row = await this.prisma.criteriaSet.findFirst({
      where: {
        OR: [{ id }, { categoryId: id }],
        ...(!access.canViewAll && access.scorerUserId
          ? {
              category: {
                is: {
                  OR: [
                    {
                      assignments: {
                        some: {
                          judgeId: access.scorerUserId,
                          judge: {
                            is: {
                              role: { not: Role.REGISTRANT },
                              staffPermissions: { has: StaffPermission.SCORE },
                              isActive: true,
                              verified: true,
                            },
                          },
                        },
                      },
                    },
                    {
                      products: {
                        some: {
                          judgeAssignments: {
                            some: {
                              judgeId: access.scorerUserId,
                              isActive: true,
                            },
                          },
                        },
                      },
                    },
                    {
                      agencyLinks: {
                        some: {
                          agency: {
                            organizationUnits: {
                              some: {
                                users: {
                                  some: {
                                    id: access.scorerUserId,
                                    isActive: true,
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  ],
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        source: true,
        version: true,
        sourceHash: true,
        isActive: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        criteria: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            maxScore: true,
            order: true,
            sectionCode: true,
            sectionName: true,
            subCriteria: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                code: true,
                content: true,
                order: true,
                options: {
                  orderBy: { order: 'asc' },
                  select: { id: true, label: true, points: true },
                },
              },
            },
          },
        },
        _count: { select: { criteria: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      categoryId: row.category.id,
      categoryName: row.category.name,
      name: row.name,
      source: row.source,
      version: row.version,
      sourceHash: row.sourceHash,
      isActive: row.isActive,
      criterionCount: row._count.criteria,
      maxScore: row.criteria.reduce((sum, item) => sum + item.maxScore, 0),
      criteria: row.criteria,
    };
  }

  async findCriteriaSetPrintData(
    id: string,
    access: { canViewAll: boolean; scorerUserId?: string },
  ) {
    const detail = await this.findCriteriaSetDetail(id, access);
    if (!detail) return null;
    return buildBlankCriteriaPrintData(detail);
  }

  async listEvaluations(
    query: AdminEvaluationsQueryDto,
    access: { canManage: boolean; canView: boolean; scorerUserId: string },
  ) {
    const {
      page,
      limit,
      q,
      productId,
      categoryId,
      judgeId,
      status,
      sortBy,
      sortDirection,
    } = query;
    const skip = computePaginationSkip(page, limit);

    const scopeFilter: Prisma.ProductWhereInput | undefined =
      !access.canManage && access.canView
        ? { status: { not: ProductStatus.DRAFT } }
        : undefined;
    const conditions: Prisma.ProductWhereInput[] = [];
    const evalConditions: Prisma.EvaluationWhereInput[] = [];
    if (!access.canManage) {
      if (access.canView) {
        evalConditions.push({
          status: {
            in: [EvaluationStatus.SUBMITTED, EvaluationStatus.EXCLUDED],
          },
          product: { is: { status: { not: ProductStatus.DRAFT } } },
        });
      } else {
        evalConditions.push({ judgeId: access.scorerUserId });
      }
    }
    if (status) evalConditions.push({ status });
    let productCodeIds: string[] = [];
    if (productId) {
      productCodeIds = await findProductIdsMatchingCodeQuery(
        this.prisma,
        productId,
        scopeFilter,
      );
      evalConditions.push({
        OR: [
          { productId },
          ...(productCodeIds.length
            ? [{ productId: { in: productCodeIds } }]
            : []),
        ],
      });
    }
    if (judgeId) evalConditions.push({ judgeId });
    if (categoryId) evalConditions.push({ product: { is: { categoryId } } });
    let qCodeIds: string[] = [];
    if (q) {
      qCodeIds =
        q === productId
          ? productCodeIds
          : await findProductIdsMatchingCodeQuery(this.prisma, q, scopeFilter);
      evalConditions.push({
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { product: { is: { name: { contains: q, mode: 'insensitive' } } } },
          { product: { is: { id: { contains: q, mode: 'insensitive' } } } },
          ...(qCodeIds.length ? [{ productId: { in: qCodeIds } }] : []),
          { judge: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
          { judge: { is: { email: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }
    void conditions;
    const where: Prisma.EvaluationWhereInput = { AND: evalConditions };
    const dir: SortDirection = sortDirection ?? SORT_DIRECTION.ASC;
    const orderBy = resolveOrderBy(
      sortBy,
      sortDirection,
      ADMIN_EVALUATION_ORDER_BY,
      DEFAULT_ADMIN_EVALUATION_ORDER_BY,
    );

    const evaluationListSelect = {
      id: true,
      status: true,
      total: true,
      submittedAt: true,
      updatedAt: true,
      judgeId: true,
      judge: {
        select: {
          id: true,
          fullName: true,
          email: true,
          organizationUnit: { select: { name: true } },
        },
      },
      product: {
        select: {
          id: true,
          codeNumber: true,
          name: true,
          status: true,
          categoryId: true,
          judgeAssignments: {
            select: { judgeId: true },
          },
          category: {
            select: {
              id: true,
              name: true,
              assignments: {
                select: { judgeId: true, criterionIds: true },
              },
              criteriaSet: {
                select: {
                  criteria: { select: { id: true, maxScore: true } },
                },
              },
            },
          },
        },
      },
    } satisfies Prisma.EvaluationSelect;

    const { rows, total, draftPointsByEvalId, snapByEvalId } =
      await this.prisma.$transaction(
        async (tx) => {
          let txRows: Prisma.EvaluationGetPayload<{
            select: typeof evaluationListSelect;
          }>[];
          let txTotal: number;

          if (sortBy === ADMIN_EVALUATION_SORT_BY.SCOPE) {
            const sqlWhere: Prisma.Sql[] = [Prisma.sql`TRUE`];
            if (!access.canManage) {
              if (access.canView) {
                sqlWhere.push(
                  Prisma.sql`e."status" IN (${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')}, ${EvaluationStatus.EXCLUDED}::${databaseObject('EvaluationStatus')})`,
                );
                sqlWhere.push(
                  Prisma.sql`p."status" <> ${ProductStatus.DRAFT}::${databaseObject('ProductStatus')}`,
                );
              } else {
                sqlWhere.push(Prisma.sql`e."judgeId" = ${access.scorerUserId}`);
              }
            }
            if (status) {
              sqlWhere.push(
                Prisma.sql`e."status" = ${status}::${databaseObject('EvaluationStatus')}`,
              );
            }
            if (productId) {
              sqlWhere.push(
                productCodeIds.length > 0
                  ? Prisma.sql`(e."productId" = ${productId} OR e."productId" IN (${Prisma.join(productCodeIds)}))`
                  : Prisma.sql`e."productId" = ${productId}`,
              );
            }
            if (judgeId) {
              sqlWhere.push(Prisma.sql`e."judgeId" = ${judgeId}`);
            }
            if (categoryId) {
              sqlWhere.push(Prisma.sql`p."categoryId" = ${categoryId}`);
            }
            if (q) {
              const like = `%${escapeSqlLike(q)}%`;
              sqlWhere.push(
                qCodeIds.length > 0
                  ? Prisma.sql`(e."id" ILIKE ${like} ESCAPE '\\' OR p."name" ILIKE ${like} ESCAPE '\\' OR p."id" ILIKE ${like} ESCAPE '\\' OR e."productId" IN (${Prisma.join(qCodeIds)}) OR ju."fullName" ILIKE ${like} ESCAPE '\\' OR ju."email" ILIKE ${like} ESCAPE '\\')`
                  : Prisma.sql`(e."id" ILIKE ${like} ESCAPE '\\' OR p."name" ILIKE ${like} ESCAPE '\\' OR p."id" ILIKE ${like} ESCAPE '\\' OR ju."fullName" ILIKE ${like} ESCAPE '\\' OR ju."email" ILIKE ${like} ESCAPE '\\')`,
              );
            }
            const scopeCountSql = Prisma.sql`
              COALESCE(
                NULLIF(CASE
                  WHEN e."status" IN (${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')}, ${EvaluationStatus.EXCLUDED}::${databaseObject('EvaluationStatus')})
                    AND jsonb_typeof(e."submissionSnapshot"->'assignedCriterionIds') = 'array'
                    THEN jsonb_array_length(e."submissionSnapshot"->'assignedCriterionIds')
                  WHEN e."status" IN (${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')}, ${EvaluationStatus.EXCLUDED}::${databaseObject('EvaluationStatus')})
                    AND jsonb_typeof(e."submissionSnapshot"->'scope'->'criterionIds') = 'array'
                    THEN jsonb_array_length(e."submissionSnapshot"->'scope'->'criterionIds')
                  ELSE NULL
                END, 0),
                CASE
                  WHEN EXISTS (
                    SELECT 1 FROM ${databaseObject('product_judge_assignments')} pja
                    WHERE pja."productId" = p."id"
                  ) THEN COALESCE(cc."cnt", 0)
                  ELSE COALESCE(NULLIF(cardinality(ja."criterionIds"), 0), COALESCE(cc."cnt", 0))
                END
              )
            `;
            const scopeOrderSql = buildEvaluationScopeOrderSql(
              scopeCountSql,
              dir,
            );
            const idRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
              SELECT e."id"
              FROM ${databaseObject('evaluations')} e
              JOIN ${databaseObject('products')} p ON p."id" = e."productId"
              JOIN ${databaseObject('users')} ju ON ju."id" = e."judgeId"
              JOIN ${databaseObject('product_categories')} pc ON pc."id" = p."categoryId"
              LEFT JOIN ${databaseObject('criteria_sets')} cs ON cs."categoryId" = pc."id"
              LEFT JOIN (
                SELECT c."setId", COUNT(*)::int AS "cnt"
                FROM ${databaseObject('criteria')} c
                GROUP BY c."setId"
              ) cc ON cc."setId" = cs."id"
              LEFT JOIN ${databaseObject('judge_assignments')} ja
                ON ja."categoryId" = p."categoryId" AND ja."judgeId" = e."judgeId"
              WHERE ${Prisma.join(sqlWhere, ' AND ')}
              ORDER BY ${scopeOrderSql}
              LIMIT ${limit} OFFSET ${skip}
            `);
            txTotal = await tx.evaluation.count({ where });
            const orderedIds = idRows.map((item) => item.id);
            if (!orderedIds.length) {
              txRows = [];
            } else {
              const found = await tx.evaluation.findMany({
                where: { id: { in: orderedIds } },
                select: evaluationListSelect,
              });
              const byId = new Map(found.map((item) => [item.id, item]));
              txRows = orderedIds
                .map((id) => byId.get(id))
                .filter(
                  (
                    item,
                  ): item is Prisma.EvaluationGetPayload<{
                    select: typeof evaluationListSelect;
                  }> => Boolean(item),
                );
            }
          } else {
            txRows = await tx.evaluation.findMany({
              where,
              select: evaluationListSelect,
              orderBy,
              skip,
              take: limit,
            });
            txTotal = await tx.evaluation.count({ where });
          }

          const needScoreIds = txRows
            .filter((row) => typeof row.total !== 'number')
            .map((row) => row.id);
          const draftPointsMap = new Map<
            string,
            { total: number; hasScores: boolean }
          >();
          if (needScoreIds.length > 0) {
            const scores = await tx.score.findMany({
              where: { evaluationId: { in: needScoreIds } },
              select: {
                evaluationId: true,
                option: { select: { points: true } },
              },
            });
            for (const score of scores) {
              const acc = draftPointsMap.get(score.evaluationId) ?? {
                total: 0,
                hasScores: false,
              };
              acc.total += score.option.points;
              acc.hasScores = true;
              draftPointsMap.set(score.evaluationId, acc);
            }
          }

          const snapEvalIds = txRows
            .filter(
              (row) =>
                row.status === EvaluationStatus.SUBMITTED ||
                row.status === EvaluationStatus.EXCLUDED,
            )
            .map((row) => row.id);
          const snapMetaMap = new Map<
            string,
            {
              assignedCriterionIds: unknown;
              scopeCriterionIds: unknown;
              judgeFullName: string | null;
              orgUnitName: string | null;
            }
          >();
          if (snapEvalIds.length > 0) {
            const snapRows = await tx.$queryRaw<
              Array<{
                id: string;
                assignedCriterionIds: unknown;
                scopeCriterionIds: unknown;
                judgeFullName: string | null;
                orgUnitName: string | null;
              }>
            >(Prisma.sql`
              SELECT
                e."id",
                e."submissionSnapshot"->'assignedCriterionIds' AS "assignedCriterionIds",
                e."submissionSnapshot"->'scope'->'criterionIds' AS "scopeCriterionIds",
                e."submissionSnapshot"->'judge'->>'fullName' AS "judgeFullName",
                e."submissionSnapshot"->'judge'->'organizationUnit'->>'name' AS "orgUnitName"
              FROM ${databaseObject('evaluations')} e
              WHERE e."id" IN (${Prisma.join(snapEvalIds)})
                AND e."submissionSnapshot" IS NOT NULL
            `);
            for (const snapRow of snapRows) {
              snapMetaMap.set(snapRow.id, snapRow);
            }
          }

          return {
            rows: txRows,
            total: txTotal,
            draftPointsByEvalId: draftPointsMap,
            snapByEvalId: snapMetaMap,
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );

    const data: AdminEvaluationRecord[] = rows.map((row) => {
      const criteria = row.product.category.criteriaSet?.criteria ?? [];
      const allIds = criteria.map((c) => c.id);
      const snapMeta = snapByEvalId.get(row.id) ?? null;
      const snapAssigned = Array.isArray(snapMeta?.assignedCriterionIds)
        ? (snapMeta.assignedCriterionIds as string[])
        : Array.isArray(snapMeta?.scopeCriterionIds)
          ? (snapMeta.scopeCriterionIds as string[])
          : null;
      const hasPerProduct = row.product.judgeAssignments.length > 0;
      const assignment = row.product.category.assignments.find(
        (a) => a.judgeId === row.judgeId,
      );
      const assignedIds = snapAssigned
        ? snapAssigned.length > 0
          ? snapAssigned
          : allIds
        : hasPerProduct
          ? allIds
          : assignment?.criterionIds.length
            ? assignment.criterionIds
            : allIds;
      const assignedSet = new Set(assignedIds);
      const inScopeCriteria = criteria.filter(
        (c) => assignedSet.size === 0 || assignedSet.has(c.id),
      );
      const scopeMaxScore = inScopeCriteria.reduce(
        (sum, c) => sum + c.maxScore,
        0,
      );
      const isPartialScope =
        criteria.length > 0 && inScopeCriteria.length < criteria.length;
      const draftPoints = draftPointsByEvalId.get(row.id);

      return {
        id: row.id,
        status: row.status,
        total:
          typeof row.total === 'number'
            ? row.total
            : draftPoints?.hasScores
              ? draftPoints.total
              : null,
        scopeMaxScore,
        assignedCriterionCount: inScopeCriteria.length,
        totalCriterionCount: criteria.length,
        isPartialScope,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        updatedAt: row.updatedAt.toISOString(),
        product: {
          id: row.product.id,
          codeNumber: row.product.codeNumber,
          code: formatProductCode(row.product.codeNumber),
          name: row.product.name,
          status: row.product.status,
          categoryId: row.product.category.id,
          categoryName: row.product.category.name,
        },
        judge: {
          id: row.judge.id,
          fullName: snapMeta?.judgeFullName ?? row.judge.fullName,
          email: row.judge.email,
          organizationUnitName:
            snapMeta !== null
              ? (snapMeta.orgUnitName ?? null)
              : (row.judge.organizationUnit?.name ?? null),
        },
      };
    });

    return { data, total };
  }

  async findEvaluationPrintData(
    evaluationId: string,
    access: { canManage: boolean; canView: boolean; scorerUserId: string },
  ) {
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { id: evaluationId },
      include: {
        judge: {
          select: {
            id: true,
            fullName: true,
            organizationUnit: { select: { name: true } },
          },
        },
        product: {
          select: {
            id: true,
            codeNumber: true,
            name: true,
            status: true,
            formData: true,
            categoryId: true,
            judgeAssignments: {
              select: { judgeId: true },
            },
            category: {
              select: {
                id: true,
                name: true,
                criteriaSet: {
                  select: {
                    id: true,
                    name: true,
                    source: true,
                    version: true,
                    sourceHash: true,
                    criteria: {
                      orderBy: { order: 'asc' },
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        maxScore: true,
                        order: true,
                        sectionCode: true,
                        sectionName: true,
                        subCriteria: {
                          orderBy: { order: 'asc' },
                          select: {
                            id: true,
                            code: true,
                            content: true,
                            order: true,
                            options: {
                              orderBy: { order: 'asc' },
                              select: { id: true, label: true, points: true },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        scores: {
          select: {
            subCriterionId: true,
            optionId: true,
            note: true,
            option: { select: { id: true, label: true, points: true } },
          },
        },
      },
    });
    if (!evaluation) return null;
    const isAuthor = evaluation.judgeId === access.scorerUserId;
    if (!access.canManage) {
      if (isAuthor) {
        // Author can print own evaluation (draft, submitted, or excluded)
      } else if (access.canView) {
        if (
          (evaluation.status !== EvaluationStatus.SUBMITTED &&
            evaluation.status !== EvaluationStatus.EXCLUDED) ||
          evaluation.product.status === ProductStatus.DRAFT
        ) {
          return null;
        }
      } else {
        return null;
      }
    }

    const hasPerProduct = evaluation.product.judgeAssignments.length > 0;
    const assignment = hasPerProduct
      ? null
      : await this.prisma.judgeAssignment.findUnique({
          where: {
            judgeId_categoryId: {
              judgeId: evaluation.judgeId,
              categoryId: evaluation.product.categoryId,
            },
          },
          select: { criterionIds: true },
        });

    return buildEvaluationPrintData({
      evaluationId: evaluation.id,
      status: evaluation.status,
      submittedAt: evaluation.submittedAt,
      total: evaluation.total,
      assignedCriterionIds: assignment?.criterionIds ?? [],
      submissionSnapshot: evaluation.submissionSnapshot,
      currentProduct: evaluation.product,
      currentJudge: evaluation.judge,
      liveScores: evaluation.scores,
    });
  }

  async findProductRegistrationPrintData(
    productId: string,
    access: { canManage: boolean; canView: boolean; registrantId?: string },
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        ...(access.registrantId
          ? { registrantId: access.registrantId }
          : access.canManage
            ? {}
            : { status: { not: ProductStatus.DRAFT } }),
      },
      select: {
        id: true,
        codeNumber: true,
        name: true,
        description: true,
        status: true,
        submittedAt: true,
        createdAt: true,
        localityCodeAtSubmit: true,
        localityNameAtSubmit: true,
        provinceNameAtSubmit: true,
        formData: true,
        registrationSnapshot: true,
        registrant: {
          select: { id: true, fullName: true, email: true, phone: true },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        locality: {
          select: {
            id: true,
            code: true,
            name: true,
            provinceName: true,
          },
        },
        attachments: {
          select: { id: true, type: true, fileName: true, createdAt: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!product) return null;
    return buildRegistrationPrintData({ product });
  }

  async findProductResultsPrintData(
    productId: string,
    access: { canManage: boolean; canView: boolean; registrantId?: string },
  ) {
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        ...(access.registrantId
          ? { registrantId: access.registrantId }
          : access.canManage
            ? {}
            : { status: { not: ProductStatus.DRAFT } }),
      },
      select: {
        id: true,
        codeNumber: true,
        name: true,
        status: true,
        publicationState: true,
        submittedAt: true,
        completedAt: true,
        finalScore: true,
        starRating: true,
        localityNameAtSubmit: true,
        provinceNameAtSubmit: true,
        formData: true,
        registrationSnapshot: true,
        locality: { select: { name: true, provinceName: true } },
        judgeAssignments: {
          select: { judgeId: true, isActive: true },
        },
        category: {
          select: {
            id: true,
            name: true,
            assignments: {
              select: { judgeId: true, criterionIds: true },
            },
            criteriaSet: {
              select: {
                id: true,
                name: true,
                source: true,
                version: true,
                criteria: {
                  orderBy: { order: 'asc' },
                  select: { id: true, code: true, name: true, maxScore: true },
                },
              },
            },
          },
        },
        evaluations: {
          where:
            access.canManage && !access.registrantId
              ? { status: { not: EvaluationStatus.EXCLUDED } }
              : { status: EvaluationStatus.SUBMITTED },
          orderBy: [{ createdAt: 'asc' }, { judgeId: 'asc' }],
          select: {
            id: true,
            judgeId: true,
            status: true,
            total: true,
            submittedAt: true,
            submissionSnapshot: true,
            judge: {
              select: {
                id: true,
                fullName: true,
                organizationUnit: { select: { name: true } },
              },
            },
            scores: {
              select: {
                subCriterion: { select: { criterionId: true } },
                option: { select: { points: true } },
              },
            },
          },
        },
      },
    });
    if (!product) return null;
    if (
      access.registrantId &&
      product.publicationState !== ProductPublicationState.PUBLISHED
    ) {
      throw new ForbiddenException(
        'Kết quả chấm điểm đang chờ công bố hoặc đang cập nhật',
      );
    }

    const hasPerProduct = product.judgeAssignments.length > 0;
    const effectiveAssignments = hasPerProduct
      ? product.judgeAssignments
          .filter((pa) => pa.isActive)
          .map((pa) => ({
            judgeId: pa.judgeId,
            criterionIds: [] as string[],
          }))
      : product.category.assignments;

    return buildProductResultsPrintData({
      product: {
        ...product,
        assignments: effectiveAssignments,
      },
    });
  }
}
