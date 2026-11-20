import { createHash } from 'node:crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentType,
  EvaluationStatus,
  Prisma,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import type { JudgeQueueSortBy, SortDirection } from '@ocop/shared';
import {
  EVALUATION_HISTORY_ACTION,
  JUDGE_QUEUE_SORT_BY,
  PRODUCT_RESULT_HISTORY_ACTION,
  SORT_DIRECTION,
} from '../constants/products';
import { type OrderByBuilder, resolveOrderBy } from '../prisma/order-by';
import { PrismaService } from '../prisma/prisma.service';
import { computePaginationSkip } from '../dtos/common.dto';
import {
  EvaluationScoreDto,
  type JudgeQueueQueryDto,
} from '../dtos/evaluations.dto';
import { databaseObject } from '../prisma/sql';
import {
  lockEvaluationCategory,
  recomputeProductResult,
} from '../utils/evaluation-result';
import { buildEvaluationPrintData } from '../utils/print-data';
import {
  findProductIdsMatchingCodeQuery,
  formatProductCode,
  withProductCode,
} from '../utils/product-code';
import { recordProductStatusEvent } from '../utils/product-status';

function escapeSqlLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

function computeEvaluationVersionToken(
  status: EvaluationStatus,
  scores: Array<{
    subCriterionId: string;
    optionId: string;
    note?: string | null;
  }>,
  assignedCriterionIds: string[],
): string {
  const payload = {
    status,
    assignedCriterionIds: [...assignedCriterionIds].sort(),
    scores: [...scores]
      .sort((a, b) => a.subCriterionId.localeCompare(b.subCriterionId))
      .map((score) => [
        score.subCriterionId,
        score.optionId,
        score.note?.trim() ?? '',
      ]),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

type JudgeQueueSqlSortBy =
  | typeof JUDGE_QUEUE_SORT_BY.EVAL_STATUS
  | typeof JUDGE_QUEUE_SORT_BY.TOTAL_SCORE;

const JUDGE_QUEUE_SQL_ORDER_BY: Record<
  JudgeQueueSqlSortBy,
  Record<SortDirection, Prisma.Sql>
> = {
  [JUDGE_QUEUE_SORT_BY.EVAL_STATUS]: {
    [SORT_DIRECTION.ASC]: Prisma.sql`CASE COALESCE(e."status"::text, 'IN_PROGRESS') WHEN 'IN_PROGRESS' THEN 0 WHEN 'SUBMITTED' THEN 1 ELSE 2 END ASC, p."updatedAt" DESC, p."id" DESC`,
    [SORT_DIRECTION.DESC]: Prisma.sql`CASE COALESCE(e."status"::text, 'IN_PROGRESS') WHEN 'IN_PROGRESS' THEN 0 WHEN 'SUBMITTED' THEN 1 ELSE 2 END DESC, p."updatedAt" DESC, p."id" DESC`,
  },
  [JUDGE_QUEUE_SORT_BY.TOTAL_SCORE]: {
    [SORT_DIRECTION.ASC]: Prisma.sql`COALESCE(e."total", -1) ASC, p."updatedAt" DESC, p."id" DESC`,
    [SORT_DIRECTION.DESC]: Prisma.sql`COALESCE(e."total", -1) DESC, p."updatedAt" DESC, p."id" DESC`,
  },
};

const JUDGE_QUEUE_PRISMA_ORDER_BY: Record<
  Exclude<JudgeQueueSortBy, JudgeQueueSqlSortBy>,
  OrderByBuilder<Prisma.ProductOrderByWithRelationInput>
> = {
  [JUDGE_QUEUE_SORT_BY.NAME]: (dir = SORT_DIRECTION.ASC) => [
    { name: dir },
    { updatedAt: SORT_DIRECTION.DESC },
    { id: SORT_DIRECTION.DESC },
  ],
  [JUDGE_QUEUE_SORT_BY.CATEGORY]: (dir = SORT_DIRECTION.ASC) => [
    { category: { name: dir } },
    { updatedAt: SORT_DIRECTION.DESC },
    { id: SORT_DIRECTION.DESC },
  ],
  [JUDGE_QUEUE_SORT_BY.STATUS]: (dir = SORT_DIRECTION.ASC) => [
    { status: dir },
    { updatedAt: SORT_DIRECTION.DESC },
    { id: SORT_DIRECTION.DESC },
  ],
  [JUDGE_QUEUE_SORT_BY.ATTACHMENTS]: (dir = SORT_DIRECTION.ASC) => [
    { attachments: { _count: dir } },
    { updatedAt: SORT_DIRECTION.DESC },
    { id: SORT_DIRECTION.DESC },
  ],
  [JUDGE_QUEUE_SORT_BY.UPDATED_AT]: (dir = SORT_DIRECTION.DESC) => [
    { updatedAt: dir },
    { id: SORT_DIRECTION.DESC },
  ],
};

function resolveAllowedSortDirection(
  requested: SortDirection | undefined,
  fallback: SortDirection,
): SortDirection {
  if (requested === SORT_DIRECTION.ASC || requested === SORT_DIRECTION.DESC) {
    return requested;
  }
  return fallback;
}

@Injectable()
export class EvaluationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(judgeId: string, query?: JudgeQueueQueryDto) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const skip = computePaginationSkip(page, limit);

    const baseWhere: Prisma.ProductWhereInput = {
      OR: [
        {
          judgeAssignments: {
            some: {
              judgeId,
              isActive: true,
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
          status: {
            in: [
              ProductStatus.APPROVED,
              ProductStatus.SCORING,
              ProductStatus.COMPLETED,
            ],
          },
        },
        {
          evaluations: {
            some: {
              judgeId,
              status: EvaluationStatus.EXCLUDED,
            },
          },
          status: {
            in: [
              ProductStatus.APPROVED,
              ProductStatus.SCORING,
              ProductStatus.COMPLETED,
            ],
          },
        },
        {
          judgeAssignments: { none: {} },
          category: {
            assignments: {
              some: {
                judgeId,
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
          status: {
            in: [
              ProductStatus.SUBMITTED,
              ProductStatus.APPROVED,
              ProductStatus.SCORING,
            ],
          },
        },
      ],
    };

    const searchConditions: Prisma.ProductWhereInput[] = [baseWhere];
    if (query?.categoryId) {
      searchConditions.push({ categoryId: query.categoryId });
    }
    let codeProductIds: string[] = [];
    if (query?.q) {
      codeProductIds = await findProductIdsMatchingCodeQuery(
        this.prisma,
        query.q,
      );
      searchConditions.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { id: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          ...(codeProductIds.length ? [{ id: { in: codeProductIds } }] : []),
        ],
      });
    }
    const scopedWhere: Prisma.ProductWhereInput =
      searchConditions.length === 1 ? baseWhere : { AND: searchConditions };

    const statusConditions: Prisma.ProductWhereInput[] = [scopedWhere];
    if (query?.evaluationStatus === EvaluationStatus.SUBMITTED) {
      statusConditions.push({
        evaluations: {
          some: { judgeId, status: EvaluationStatus.SUBMITTED },
        },
      });
    } else if (query?.evaluationStatus === EvaluationStatus.EXCLUDED) {
      statusConditions.push({
        evaluations: {
          some: { judgeId, status: EvaluationStatus.EXCLUDED },
        },
      });
    } else if (query?.evaluationStatus === EvaluationStatus.IN_PROGRESS) {
      statusConditions.push({
        evaluations: {
          none: {
            judgeId,
            status: {
              in: [EvaluationStatus.SUBMITTED, EvaluationStatus.EXCLUDED],
            },
          },
        },
      });
    }
    const filteredWhere: Prisma.ProductWhereInput =
      statusConditions.length === 1 ? scopedWhere : { AND: statusConditions };

    const queueSelect = {
      id: true,
      codeNumber: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { id: true, name: true } },
      attachments: {
        where: { type: AttachmentType.IMAGE },
        orderBy: { createdAt: 'asc' as const },
        take: 1,
        select: { id: true, fileName: true },
      },
      _count: {
        select: { attachments: true },
      },
      evaluations: {
        where: { judgeId },
        select: { status: true, total: true },
      },
    } satisfies Prisma.ProductSelect;

    const sortBy = query?.sortBy ?? JUDGE_QUEUE_SORT_BY.UPDATED_AT;
    const dir = resolveAllowedSortDirection(
      query?.sortDirection,
      sortBy === JUDGE_QUEUE_SORT_BY.UPDATED_AT
        ? SORT_DIRECTION.DESC
        : SORT_DIRECTION.ASC,
    );

    const mapRow = (
      row: Prisma.ProductGetPayload<{ select: typeof queueSelect }>,
    ) => {
      const { _count, ...rest } = row;
      return withProductCode({
        ...rest,
        attachmentCount: _count.attachments,
      });
    };

    return this.prisma.$transaction(
      async (tx) => {
        const scopedTotal = await tx.product.count({ where: scopedWhere });
        const submittedCount = await tx.product.count({
          where: {
            AND: [
              scopedWhere,
              {
                evaluations: {
                  some: { judgeId, status: EvaluationStatus.SUBMITTED },
                },
              },
            ],
          },
        });
        const excludedCount = await tx.product.count({
          where: {
            AND: [
              scopedWhere,
              {
                evaluations: {
                  some: { judgeId, status: EvaluationStatus.EXCLUDED },
                },
              },
            ],
          },
        });
        const counts = {
          total: scopedTotal,
          open: Math.max(0, scopedTotal - submittedCount - excludedCount),
          submitted: submittedCount,
          excluded: excludedCount,
        };
        const total =
          query?.evaluationStatus === EvaluationStatus.SUBMITTED
            ? counts.submitted
            : query?.evaluationStatus === EvaluationStatus.EXCLUDED
              ? counts.excluded
              : query?.evaluationStatus === EvaluationStatus.IN_PROGRESS
                ? counts.open
                : counts.total;

        if (
          sortBy === JUDGE_QUEUE_SORT_BY.EVAL_STATUS ||
          sortBy === JUDGE_QUEUE_SORT_BY.TOTAL_SCORE
        ) {
          const whereParts: Prisma.Sql[] = [
            Prisma.sql`(
              (
                p."status" IN (${ProductStatus.APPROVED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')}, ${ProductStatus.COMPLETED}::${databaseObject('ProductStatus')})
                AND EXISTS (
                  SELECT 1 FROM ${databaseObject('product_judge_assignments')} pja
                  JOIN ${databaseObject('users')} ju ON ju."id" = pja."judgeId"
                  WHERE pja."productId" = p."id"
                    AND pja."judgeId" = ${judgeId}
                    AND pja."isActive" = true
                    AND ju."role" <> ${Role.REGISTRANT}::${databaseObject('Role')}
                    AND ${StaffPermission.SCORE}::${databaseObject('StaffPermission')} = ANY(ju."staffPermissions")
                    AND ju."isActive" = true
                    AND ju."verified" = true
                )
              )
              OR (
                p."status" IN (${ProductStatus.APPROVED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')}, ${ProductStatus.COMPLETED}::${databaseObject('ProductStatus')})
                AND EXISTS (
                  SELECT 1 FROM ${databaseObject('evaluations')} ev
                  WHERE ev."productId" = p."id"
                    AND ev."judgeId" = ${judgeId}
                    AND ev."status" = ${EvaluationStatus.EXCLUDED}::${databaseObject('EvaluationStatus')}
                )
              )
              OR (
                p."status" IN (${ProductStatus.SUBMITTED}::${databaseObject('ProductStatus')}, ${ProductStatus.APPROVED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')})
                AND NOT EXISTS (
                  SELECT 1 FROM ${databaseObject('product_judge_assignments')} pja2
                  WHERE pja2."productId" = p."id"
                )
                AND EXISTS (
                  SELECT 1 FROM ${databaseObject('judge_assignments')} ja
                  JOIN ${databaseObject('users')} ju ON ju."id" = ja."judgeId"
                  WHERE ja."categoryId" = p."categoryId"
                    AND ja."judgeId" = ${judgeId}
                    AND ju."role" <> ${Role.REGISTRANT}::${databaseObject('Role')}
                    AND ${StaffPermission.SCORE}::${databaseObject('StaffPermission')} = ANY(ju."staffPermissions")
                    AND ju."isActive" = true
                    AND ju."verified" = true
                )
              )
            )`,
          ];
          if (query?.categoryId) {
            whereParts.push(Prisma.sql`p."categoryId" = ${query.categoryId}`);
          }
          if (query?.q) {
            const like = `%${escapeSqlLike(query.q)}%`;
            whereParts.push(
              codeProductIds.length > 0
                ? Prisma.sql`(p."name" ILIKE ${like} ESCAPE '\\' OR p."id" ILIKE ${like} ESCAPE '\\' OR p."description" ILIKE ${like} ESCAPE '\\' OR p."id" IN (${Prisma.join(codeProductIds)}))`
                : Prisma.sql`(p."name" ILIKE ${like} ESCAPE '\\' OR p."id" ILIKE ${like} ESCAPE '\\' OR p."description" ILIKE ${like} ESCAPE '\\')`,
            );
          }
          if (query?.evaluationStatus === EvaluationStatus.SUBMITTED) {
            whereParts.push(
              Prisma.sql`e."status" = ${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')}`,
            );
          } else if (query?.evaluationStatus === EvaluationStatus.EXCLUDED) {
            whereParts.push(
              Prisma.sql`e."status" = ${EvaluationStatus.EXCLUDED}::${databaseObject('EvaluationStatus')}`,
            );
          } else if (query?.evaluationStatus === EvaluationStatus.IN_PROGRESS) {
            whereParts.push(
              Prisma.sql`(e."status" IS NULL OR e."status" NOT IN (${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')}, ${EvaluationStatus.EXCLUDED}::${databaseObject('EvaluationStatus')}))`,
            );
          }

          const orderSql = JUDGE_QUEUE_SQL_ORDER_BY[sortBy][dir];

          const sortedIdRows = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`
              SELECT p."id"
              FROM ${databaseObject('products')} p
              LEFT JOIN ${databaseObject('evaluations')} e
                ON e."productId" = p."id" AND e."judgeId" = ${judgeId}
              WHERE ${Prisma.join(whereParts, ' AND ')}
              ORDER BY ${orderSql}
              LIMIT ${limit} OFFSET ${skip}
            `,
          );
          const orderedIds = sortedIdRows.map((row) => row.id);

          if (!orderedIds.length) {
            return { data: [], total, counts };
          }
          const pageRows = await tx.product.findMany({
            where: { id: { in: orderedIds } },
            select: queueSelect,
          });
          const byId = new Map(pageRows.map((r) => [r.id, r]));
          const data = orderedIds
            .map((id) => byId.get(id))
            .filter(
              (
                item,
              ): item is Prisma.ProductGetPayload<{
                select: typeof queueSelect;
              }> => Boolean(item),
            )
            .map(mapRow);
          return { data, total, counts };
        }

        const orderBy = resolveOrderBy(
          sortBy,
          dir,
          JUDGE_QUEUE_PRISMA_ORDER_BY,
          JUDGE_QUEUE_PRISMA_ORDER_BY[JUDGE_QUEUE_SORT_BY.UPDATED_AT],
        );

        const rows = await tx.product.findMany({
          where: filteredWhere,
          select: queueSelect,
          orderBy,
          skip,
          take: limit,
        });
        return {
          data: rows.map(mapRow),
          total,
          counts,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getEvaluation(judgeId: string, productId: string) {
    const context = await this.getAssignedProduct(
      this.prisma,
      judgeId,
      productId,
      true,
    );
    const assignment = context.assignment;
    const criteria = context.product.category.criteriaSet?.criteria ?? [];
    const selectedCriteria = assignment.criterionIds.length
      ? criteria.filter((criterion) =>
          assignment.criterionIds.includes(criterion.id),
        )
      : criteria;
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { judgeId_productId: { judgeId, productId } },
      include: { scores: true },
    });
    if (
      context.product.status === ProductStatus.COMPLETED &&
      !context.isPerProductAssignment &&
      evaluation?.status !== EvaluationStatus.SUBMITTED &&
      evaluation?.status !== EvaluationStatus.EXCLUDED
    ) {
      throw new NotFoundException('Evaluation not found');
    }
    const assignedCriterionIds = this.allowedCriteria(
      assignment.criterionIds,
      criteria,
    );
    const versionToken = computeEvaluationVersionToken(
      evaluation?.status ?? EvaluationStatus.IN_PROGRESS,
      evaluation?.scores ?? [],
      assignedCriterionIds,
    );
    return {
      product: withProductCode({
        id: context.product.id,
        codeNumber: context.product.codeNumber,
        name: context.product.name,
        description: context.product.description,
        formData: context.product.formData,
        category: {
          id: context.product.category.id,
          name: context.product.category.name,
        },
        attachments: context.product.attachments,
      }),
      criteria: selectedCriteria,
      evaluation: evaluation
        ? {
            id: evaluation.id,
            status: evaluation.status,
            total: evaluation.total,
            scores: evaluation.scores,
            versionToken,
          }
        : {
            id: null,
            status: EvaluationStatus.IN_PROGRESS,
            total: null,
            scores: [],
            versionToken,
          },
    };
  }

  async getEvaluationPrintData(judgeId: string, productId: string) {
    const context = await this.getAssignedProduct(
      this.prisma,
      judgeId,
      productId,
      true,
    );
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { judgeId_productId: { judgeId, productId } },
      include: {
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
    if (
      context.product.status === ProductStatus.COMPLETED &&
      !context.isPerProductAssignment &&
      evaluation?.status !== EvaluationStatus.SUBMITTED &&
      evaluation?.status !== EvaluationStatus.EXCLUDED
    ) {
      throw new NotFoundException('Evaluation not found');
    }
    return buildEvaluationPrintData({
      evaluationId: evaluation?.id ?? null,
      status: evaluation?.status ?? EvaluationStatus.IN_PROGRESS,
      submittedAt: evaluation?.submittedAt ?? null,
      total: evaluation?.total ?? null,
      assignedCriterionIds: context.assignment.criterionIds,
      submissionSnapshot: evaluation?.submissionSnapshot ?? null,
      currentProduct: {
        id: context.product.id,
        codeNumber: context.product.codeNumber,
        name: context.product.name,
        formData: context.product.formData,
        category: {
          id: context.product.category.id,
          name: context.product.category.name,
          criteriaSet: context.product.category.criteriaSet
            ? {
                id: context.product.category.criteriaSet.id,
                name: context.product.category.criteriaSet.name,
                source: context.product.category.criteriaSet.source,
                version: context.product.category.criteriaSet.version,
                sourceHash: context.product.category.criteriaSet.sourceHash,
                criteria: context.product.category.criteriaSet.criteria.map(
                  (c) => ({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    maxScore: c.maxScore,
                    order: c.order,
                    sectionCode: c.sectionCode,
                    sectionName: c.sectionName,
                    subCriteria: c.subCriteria.map((sub) => ({
                      id: sub.id,
                      code: sub.code,
                      content: sub.content,
                      order: sub.order,
                      options: sub.options.map((opt) => ({
                        id: opt.id,
                        label: opt.label,
                        points: opt.points,
                      })),
                    })),
                  }),
                ),
              }
            : null,
        },
      },
      currentJudge: {
        id: context.assignment.judge.id,
        fullName: context.assignment.judge.fullName,
        organizationUnit: context.assignment.judge.organizationUnit
          ? { name: context.assignment.judge.organizationUnit.name }
          : null,
      },
      liveScores: evaluation?.scores ?? [],
    });
  }

  async findAttachment(
    judgeId: string,
    productId: string,
    attachmentId: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        categoryId: true,
        status: true,
        judgeAssignments: {
          where: { judgeId },
          select: {
            isActive: true,
            judge: {
              select: {
                role: true,
                staffPermissions: true,
                isActive: true,
                verified: true,
              },
            },
          },
        },
        _count: { select: { judgeAssignments: true } },
        evaluations: {
          where: { judgeId },
          select: { status: true },
        },
        attachments: {
          where: { id: attachmentId },
          select: { fileName: true, filePath: true, type: true },
        },
      },
    });
    if (!product) return null;

    const perProduct = product.judgeAssignments[0];
    const existingEval = product.evaluations[0];
    const totalPerProductCount = product._count.judgeAssignments;
    const perProductJudgeValid = Boolean(
      perProduct?.isActive &&
      perProduct.judge.role !== Role.REGISTRANT &&
      perProduct.judge.staffPermissions.includes(StaffPermission.SCORE) &&
      perProduct.judge.isActive &&
      perProduct.judge.verified,
    );
    const hasExcludedEval = existingEval?.status === EvaluationStatus.EXCLUDED;
    const hasLegacyAssignment =
      totalPerProductCount === 0 && !perProductJudgeValid && !hasExcludedEval
        ? await this.prisma.judgeAssignment.findUnique({
            where: {
              judgeId_categoryId: { judgeId, categoryId: product.categoryId },
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
          })
        : null;

    if (!perProductJudgeValid && !hasExcludedEval && !hasLegacyAssignment) {
      throw new ForbiddenException('Product is outside the judge assignment');
    }

    const canAccessLegacyCompleted =
      existingEval?.status === EvaluationStatus.SUBMITTED ||
      existingEval?.status === EvaluationStatus.EXCLUDED;
    const statusAllowed =
      (totalPerProductCount === 0 &&
        product.status === ProductStatus.SUBMITTED) ||
      product.status === ProductStatus.APPROVED ||
      product.status === ProductStatus.SCORING ||
      ((totalPerProductCount > 0 || canAccessLegacyCompleted) &&
        product.status === ProductStatus.COMPLETED);

    if (!statusAllowed) return null;
    return product.attachments[0] ?? null;
  }

  private async lockAndLoadAssignedEvaluationContext(
    tx: Prisma.TransactionClient,
    judgeId: string,
    productId: string,
    categoryChangedMessage: string,
  ) {
    const initial = await tx.product.findUnique({
      where: { id: productId },
      select: { categoryId: true },
    });
    if (!initial) throw new NotFoundException('Product not found');
    // Always lock category before product row to avoid deadlocks with assignment changes.
    await lockEvaluationCategory(tx, initial.categoryId);
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
    );
    const context = await this.getAssignedProduct(
      tx,
      judgeId,
      productId,
      false,
      { omitAttachments: true },
    );
    if (context.product.categoryId !== initial.categoryId) {
      throw new ConflictException(categoryChangedMessage);
    }
    const criteria = context.product.category.criteriaSet?.criteria ?? [];
    const assignedCriteria = this.allowedCriteria(
      context.assignment.criterionIds,
      criteria,
    );
    if (!assignedCriteria.length) {
      throw new ConflictException(
        'No scoring criteria are configured for this product',
      );
    }
    return { context, criteria, assignedCriteria };
  }

  private assertEditableEvaluationVersion(
    existing: {
      status: EvaluationStatus;
      scores: Array<{
        subCriterionId: string;
        optionId: string;
        note?: string | null;
      }>;
    } | null,
    expectedVersionToken: string | undefined,
    assignedCriteria: string[],
    messages: { submitted: string; versionMismatch: string },
  ) {
    if (existing?.status === EvaluationStatus.SUBMITTED) {
      throw new ConflictException(messages.submitted);
    }
    if (existing?.status === EvaluationStatus.EXCLUDED) {
      throw new ConflictException('Excluded evaluations are read-only');
    }
    if (expectedVersionToken === undefined) return;
    const currentVersionToken = computeEvaluationVersionToken(
      existing?.status ?? EvaluationStatus.IN_PROGRESS,
      existing?.scores ?? [],
      assignedCriteria,
    );
    if (expectedVersionToken !== currentVersionToken) {
      throw new ConflictException(messages.versionMismatch);
    }
  }

  private assertDraftScoresInScope(
    scores: EvaluationScoreDto[],
    criteria: Array<{
      id: string;
      subCriteria: Array<{ id: string; options: Array<{ id: string }> }>;
    }>,
    allowedIds: string[],
  ) {
    const allowedCriterionSet = new Set(allowedIds);
    const optionIdsBySubcriterion = new Map<string, Set<string>>();
    for (const criterion of criteria) {
      if (!allowedCriterionSet.has(criterion.id)) continue;
      for (const sub of criterion.subCriteria) {
        optionIdsBySubcriterion.set(
          sub.id,
          new Set(sub.options.map((option) => option.id)),
        );
      }
    }
    const seenSubIds = new Set<string>();
    const hasInvalidScore = scores.some((score) => {
      if (seenSubIds.has(score.subCriterionId)) return true;
      seenSubIds.add(score.subCriterionId);
      return !optionIdsBySubcriterion
        .get(score.subCriterionId)
        ?.has(score.optionId);
    });
    if (hasInvalidScore) {
      throw new ForbiddenException(
        'Scores must use options in assigned criteria',
      );
    }
  }

  async saveDraft(
    judgeId: string,
    productId: string,
    scores: EvaluationScoreDto[],
    expectedVersionToken?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const {
          context,
          criteria,
          assignedCriteria: allowedIds,
        } = await this.lockAndLoadAssignedEvaluationContext(
          tx,
          judgeId,
          productId,
          'Product category changed while saving evaluation',
        );
        const existing = await tx.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
          select: {
            id: true,
            status: true,
            scores: {
              select: { subCriterionId: true, optionId: true, note: true },
            },
          },
        });
        this.assertEditableEvaluationVersion(
          existing,
          expectedVersionToken,
          allowedIds,
          {
            submitted: 'Submitted evaluations are immutable',
            versionMismatch:
              'Phiếu chấm đã thay đổi ở phiên khác. Vui lòng tải lại dữ liệu mới nhất trước khi lưu.',
          },
        );
        this.assertDraftScoresInScope(scores, criteria, allowedIds);

        const evaluation = await tx.evaluation.upsert({
          where: { judgeId_productId: { judgeId, productId } },
          create: {
            judgeId,
            productId,
            status: EvaluationStatus.IN_PROGRESS,
          },
          update: { status: EvaluationStatus.IN_PROGRESS },
          select: { id: true },
        });
        await tx.score.deleteMany({ where: { evaluationId: evaluation.id } });
        if (scores.length) {
          await tx.score.createMany({
            data: scores.map((score) => ({
              evaluationId: evaluation.id,
              subCriterionId: score.subCriterionId,
              optionId: score.optionId,
              note: score.note?.trim() || null,
            })),
          });
        }
        if (
          context.product.status === ProductStatus.APPROVED ||
          context.product.status === ProductStatus.SUBMITTED
        ) {
          const scoringAt = new Date();
          await tx.product.update({
            where: { id: productId },
            data: { status: ProductStatus.SCORING },
          });
          await recordProductStatusEvent(
            tx,
            productId,
            context.product.status,
            ProductStatus.SCORING,
            judgeId,
            scoringAt,
          );
        }
        return {
          id: evaluation.id,
          status: EvaluationStatus.IN_PROGRESS,
          scores,
          versionToken: computeEvaluationVersionToken(
            EvaluationStatus.IN_PROGRESS,
            scores,
            allowedIds,
          ),
        };
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  async submit(
    judgeId: string,
    productId: string,
    expectedVersionToken?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const { context, criteria, assignedCriteria } =
          await this.lockAndLoadAssignedEvaluationContext(
            tx,
            judgeId,
            productId,
            'Product category changed while submitting evaluation',
          );
        const expected = criteria
          .filter((criterion) => assignedCriteria.includes(criterion.id))
          .flatMap((criterion) => criterion.subCriteria.map((sub) => sub.id));
        const evaluation = await tx.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
          include: {
            scores: {
              include: {
                subCriterion: {
                  include: {
                    criterion: { select: { id: true, code: true, name: true } },
                  },
                },
                option: { select: { id: true, label: true, points: true } },
              },
            },
          },
        });
        this.assertEditableEvaluationVersion(
          evaluation,
          expectedVersionToken,
          assignedCriteria,
          {
            submitted: 'Evaluation was already submitted',
            versionMismatch:
              'Phiếu chấm đã thay đổi ở phiên khác. Vui lòng tải lại dữ liệu mới nhất trước khi nộp.',
          },
        );
        const evaluationScores = evaluation?.scores ?? [];
        if (!evaluationScores.length) {
          throw new ConflictException(
            'Score at least one assigned subcriterion before submitting',
          );
        }
        const expectedSet = new Set(expected);
        if (
          evaluationScores.some(
            (score) => !expectedSet.has(score.subCriterionId),
          )
        ) {
          throw new ConflictException(
            'Submitted evaluation does not match its assigned criteria',
          );
        }
        const total = evaluationScores.reduce(
          (sum, score) => sum + score.option.points,
          0,
        );
        const submittedAt = new Date();
        const criteriaSet = context.product.category.criteriaSet;
        if (!criteriaSet)
          throw new ConflictException(
            'No scoring criteria are configured for this product',
          );
        const scoreBySubCriterion = new Map(
          evaluationScores.map((score) => [score.subCriterionId, score]),
        );
        const submissionSnapshot = {
          version: 2,
          submittedAt: submittedAt.toISOString(),
          product: {
            id: context.product.id,
            ...(typeof context.product.codeNumber === 'number'
              ? {
                  codeNumber: context.product.codeNumber,
                  code: formatProductCode(context.product.codeNumber),
                }
              : {}),
            name: context.product.name,
            description: context.product.description,
            formData: context.product.formData,
            category: {
              id: context.product.category.id,
              name: context.product.category.name,
            },
          },
          criteriaSet: {
            id: criteriaSet.id,
            name: criteriaSet.name,
            source: criteriaSet.source,
            version: criteriaSet.version,
            sourceHash: criteriaSet.sourceHash,
          },
          judge: {
            id: context.assignment.judge.id,
            fullName: context.assignment.judge.fullName,
            organizationUnit: context.assignment.judge.organizationUnit,
          },
          assignedCriterionIds: assignedCriteria,
          scores: expected
            .map((subCriterionId) => scoreBySubCriterion.get(subCriterionId))
            .filter((score): score is NonNullable<typeof score> =>
              Boolean(score),
            )
            .map((score) => ({
              criterion: score.subCriterion.criterion,
              subCriterion: {
                id: score.subCriterion.id,
                code: score.subCriterion.code,
                content: score.subCriterion.content,
              },
              option: score.option,
              note: score.note,
            })),
          total,
        } as Prisma.InputJsonValue;
        const submitted = evaluation
          ? await tx.evaluation.update({
              where: { id: evaluation.id },
              data: {
                status: EvaluationStatus.SUBMITTED,
                total,
                submittedAt,
                submissionSnapshot,
              },
              select: { id: true, total: true, status: true },
            })
          : await tx.evaluation.create({
              data: {
                judgeId,
                productId,
                status: EvaluationStatus.SUBMITTED,
                total,
                submittedAt,
                submissionSnapshot,
              },
              select: { id: true, total: true, status: true },
            });

        await tx.evaluationHistoryEvent.create({
          data: {
            evaluationId: submitted.id,
            action: EVALUATION_HISTORY_ACTION.SUBMITTED,
            fromStatus: EvaluationStatus.IN_PROGRESS,
            toStatus: EvaluationStatus.SUBMITTED,
            actorId: judgeId,
            previousTotal: evaluation?.total ?? 0,
            snapshot: submissionSnapshot,
          },
        });

        await recomputeProductResult(
          tx,
          productId,
          judgeId,
          PRODUCT_RESULT_HISTORY_ACTION.EVALUATION_SUBMITTED,
        );
        return {
          ...submitted,
          versionToken: computeEvaluationVersionToken(
            EvaluationStatus.SUBMITTED,
            evaluationScores,
            assignedCriteria,
          ),
        };
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  private async getAssignedProduct(
    db: Prisma.TransactionClient | PrismaService,
    judgeId: string,
    productId: string,
    allowReadCompletedOrExcluded = false,
    options?: { omitAttachments?: boolean },
  ) {
    const product = await db.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          include: {
            criteriaSet: {
              include: {
                criteria: {
                  orderBy: { order: 'asc' },
                  include: {
                    subCriteria: {
                      orderBy: { order: 'asc' },
                      include: { options: { orderBy: { order: 'asc' } } },
                    },
                  },
                },
              },
            },
          },
        },
        ...(options?.omitAttachments
          ? {}
          : {
              attachments: {
                select: { id: true, type: true, fileName: true },
              },
            }),
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const perProductAssignment = await db.productJudgeAssignment.findUnique({
      where: {
        productId_judgeId: { productId, judgeId },
      },
      include: {
        judge: {
          select: {
            id: true,
            fullName: true,
            role: true,
            staffPermissions: true,
            isActive: true,
            verified: true,
            organizationUnit: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });

    if (perProductAssignment) {
      const judgeOk =
        perProductAssignment.judge.role !== Role.REGISTRANT &&
        perProductAssignment.judge.staffPermissions.includes(
          StaffPermission.SCORE,
        ) &&
        perProductAssignment.judge.isActive &&
        perProductAssignment.judge.verified;

      if (!perProductAssignment.isActive) {
        if (!allowReadCompletedOrExcluded) {
          throw new ForbiddenException(
            'Product is outside the judge assignment',
          );
        }
        const evalRow = await db.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
          select: { status: true },
        });
        if (evalRow?.status !== EvaluationStatus.EXCLUDED) {
          throw new ForbiddenException(
            'Product is outside the judge assignment',
          );
        }
      } else if (!judgeOk) {
        throw new ForbiddenException('Product is outside the judge assignment');
      }

      if (
        product.status !== ProductStatus.APPROVED &&
        product.status !== ProductStatus.SCORING &&
        product.status !== ProductStatus.COMPLETED
      ) {
        throw new ConflictException('Product is not open for evaluation');
      }

      return {
        isPerProductAssignment: true,
        assignment: {
          judgeId,
          categoryId: product.categoryId,
          criterionIds: [] as string[],
          judge: perProductAssignment.judge,
        },
        product,
      };
    }

    const totalPerProductCount = await db.productJudgeAssignment.count({
      where: { productId },
    });
    if (totalPerProductCount > 0) {
      throw new ForbiddenException('Product is outside the judge assignment');
    }

    const assignment = await db.judgeAssignment.findUnique({
      where: {
        judgeId_categoryId: { judgeId, categoryId: product.categoryId },
        judge: {
          is: {
            role: { not: Role.REGISTRANT },
            staffPermissions: { has: StaffPermission.SCORE },
            isActive: true,
            verified: true,
          },
        },
      },
      include: {
        judge: {
          select: {
            id: true,
            fullName: true,
            organizationUnit: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });
    if (!assignment)
      throw new ForbiddenException('Product is outside the judge assignment');
    if (
      product.status !== ProductStatus.SUBMITTED &&
      product.status !== ProductStatus.APPROVED &&
      product.status !== ProductStatus.SCORING &&
      !(
        allowReadCompletedOrExcluded &&
        product.status === ProductStatus.COMPLETED
      )
    ) {
      throw new ConflictException('Product is not open for evaluation');
    }
    return { isPerProductAssignment: false, assignment, product };
  }

  private allowedCriteria(
    criterionIds: string[],
    criteria: Array<{ id: string }>,
  ): string[] {
    return criterionIds.length
      ? criteria
          .filter((criterion) => criterionIds.includes(criterion.id))
          .map((criterion) => criterion.id)
      : criteria.map((criterion) => criterion.id);
  }
}
