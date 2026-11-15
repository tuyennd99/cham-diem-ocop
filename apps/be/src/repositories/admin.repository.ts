import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentType,
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
  AdminEvaluationRecord,
  ManagingAgencySummary,
  ProductAgencyCoverageItem,
  ProductApplicationForm,
  ProductJudgeAssignmentRecord,
} from '@ocop/shared';
import {
  EVALUATION_HISTORY_ACTION,
  PRODUCT_RESULT_HISTORY_ACTION,
  PRODUCT_SORT_BY,
  SORT_DIRECTION,
  productRegistrationTypes,
} from '../constants/products';
import type {
  AddProductJudgeAssignmentDto,
  AdminProductQueryDto,
} from '../dtos/admin-products.dto';
import type {
  AdminCriteriaSetsQueryDto,
  AdminEvaluationsQueryDto,
} from '../dtos/admin-scoring.dto';
import type { UpdateStaffAccessDto } from '../dtos/admin.dto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import {
  lockEvaluationCategory,
  recomputeProductResult,
} from '../utils/evaluation-result';
import {
  buildBlankCriteriaPrintData,
  buildEvaluationPrintData,
  buildProductResultsPrintData,
  buildRegistrationPrintData,
} from '../utils/print-data';
import type { ReportingProductRecord } from '../utils/reporting';
import {
  findProductIdsMatchingCodeQuery,
  formatProductCode,
  withProductCode,
} from '../utils/product-code';
import { recordProductStatusEvent } from '../utils/product-status';
import {
  applyStaffAccess,
  createStaff,
  lockStaffMutation,
} from '../utils/staff-access';
import { writeAudit, type AuditInput } from '../utils/audit-log';

export type AdminRequestMeta = {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
};

const adminProductSelect = {
  id: true,
  codeNumber: true,
  name: true,
  description: true,
  status: true,
  publicationState: true,
  publishedFinalScore: true,
  publishedStarRating: true,
  publishedAt: true,
  returnReason: true,
  returnedAt: true,
  approvedAt: true,
  finalScore: true,
  starRating: true,
  createdAt: true,
  submittedAt: true,
  completedAt: true,
  localityId: true,
  formData: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  registrant: { select: { id: true, fullName: true, email: true } },
  locality: {
    select: { id: true, code: true, name: true, provinceName: true },
  },
  attachments: {
    where: { type: AttachmentType.IMAGE },
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.ProductSelect;

const adminProductDetailSelect = {
  ...adminProductSelect,
  registrationSnapshot: true,
  requiredAgencySnapshot: true,
  registrant: {
    select: { id: true, fullName: true, email: true, phone: true },
  },
  createdBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  returnedBy: { select: { id: true, fullName: true } },
  publishedBy: { select: { id: true, fullName: true } },
  category: {
    select: {
      id: true,
      name: true,
      agencyLinks: {
        orderBy: [
          { agency: { order: 'asc' as const } },
          { agency: { code: 'asc' as const } },
        ],
        select: {
          agency: {
            select: {
              id: true,
              code: true,
              name: true,
              order: true,
              isActive: true,
            },
          },
        },
      },
    },
  },
  attachments: {
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  statusEvents: {
    select: {
      fromStatus: true,
      toStatus: true,
      sequence: true,
      actorId: true,
      actor: { select: { id: true, fullName: true } },
      reason: true,
      createdAt: true,
    },
    orderBy: [{ sequence: 'asc' as const }],
  },
  judgeAssignments: {
    orderBy: [{ assignedAt: 'asc' as const }, { judgeId: 'asc' as const }],
    select: {
      id: true,
      productId: true,
      judgeId: true,
      managingAgencyId: true,
      organizationUnitId: true,
      isManual: true,
      isActive: true,
      mustSubmitToComplete: true,
      assignedAt: true,
      assignedBy: { select: { id: true, fullName: true } },
      removedAt: true,
      removedBy: { select: { id: true, fullName: true } },
      removeReason: true,
      judge: {
        select: {
          id: true,
          fullName: true,
          email: true,
          isActive: true,
          organizationUnit: {
            select: {
              id: true,
              code: true,
              name: true,
              managingAgencyId: true,
              managingAgency: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  order: true,
                  isActive: true,
                },
              },
            },
          },
        },
      },
      managingAgency: {
        select: {
          id: true,
          code: true,
          name: true,
          order: true,
          isActive: true,
        },
      },
    },
  },
  evaluations: {
    select: {
      id: true,
      judgeId: true,
      status: true,
      previousStatus: true,
      total: true,
      submittedAt: true,
      excludedAt: true,
      excludeReason: true,
      reopenedAt: true,
      reopenReason: true,
      scores: { select: { subCriterionId: true } },
    },
  },
  resultHistory: {
    orderBy: [{ createdAt: 'desc' as const }],
    select: {
      id: true,
      action: true,
      finalScore: true,
      starRating: true,
      isCurrent: true,
      actor: { select: { id: true, fullName: true } },
      reason: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProductSelect;

function safeFormData(
  value: Prisma.JsonValue,
): Partial<ProductApplicationForm> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return {};
  const source = value as Record<string, Prisma.JsonValue>;
  const result: Record<string, string | number | boolean> = {};
  for (const field of [
    'entityName',
    'representativeName',
    'representativeTitle',
    'contactAddress',
    'provinceName',
    'localityName',
    'localityCode',
    'phone',
    'email',
  ]) {
    if (typeof source[field] === 'string')
      result[field] = source[field] as string;
  }
  if (
    typeof source.registrationType === 'string' &&
    (productRegistrationTypes as readonly string[]).includes(
      source.registrationType,
    )
  ) {
    result.registrationType = source.registrationType;
  }
  if (
    typeof source.sampleQuantity === 'number' &&
    Number.isInteger(source.sampleQuantity) &&
    source.sampleQuantity >= 0 &&
    source.sampleQuantity <= 100000
  ) {
    result.sampleQuantity = source.sampleQuantity;
  }
  if (
    typeof source.assessmentYear === 'number' &&
    Number.isInteger(source.assessmentYear) &&
    source.assessmentYear >= 2020 &&
    source.assessmentYear <= 2100
  ) {
    result.assessmentYear = source.assessmentYear;
  }
  if (typeof source.declarationAccepted === 'boolean') {
    result.declarationAccepted = source.declarationAccepted;
  }
  return result as Partial<ProductApplicationForm>;
}

function parseSnapshotAgencies(raw: Prisma.JsonValue): ManagingAgencySummary[] {
  if (!Array.isArray(raw)) return [];
  const items: ManagingAgencySummary[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const rec = entry as Record<string, unknown>;
    if (
      typeof rec.id === 'string' &&
      typeof rec.code === 'string' &&
      typeof rec.name === 'string'
    ) {
      items.push({
        id: rec.id,
        code: rec.code,
        name: rec.name,
        order: typeof rec.order === 'number' ? rec.order : 0,
        isActive: typeof rec.isActive === 'boolean' ? rec.isActive : true,
      });
    }
  }
  return items;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  listJudges() {
    return this.prisma.user.findMany({
      where: {
        role: { not: Role.REGISTRANT },
        staffPermissions: { has: StaffPermission.SCORE },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        verified: true,
        isActive: true,
        createdAt: true,
        organizationUnit: {
          select: {
            id: true,
            code: true,
            name: true,
            managingAgencyId: true,
            managingAgency: {
              select: {
                id: true,
                code: true,
                name: true,
                order: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }

  async dashboardData(canManage = true, queuePage?: number, queueSearch = '') {
    const queueLimit = queuePage === undefined ? 10 : 5;
    const queueWhere: Prisma.ProductWhereInput = {
      status: { in: [ProductStatus.SUBMITTED, ProductStatus.APPROVED, ProductStatus.SCORING] },
      ...(queueSearch ? { OR: [
        { name: { contains: queueSearch, mode: 'insensitive' } },
        { category: { name: { contains: queueSearch, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [productStatuses, judgeProgress, nextProducts, nextProductsCount] = await Promise.all([
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
        SELECT u."id" AS "judgeId", u."fullName",
          COUNT(DISTINCT COALESCE(p1."id", p2."id"))::int AS "assigned",
          COUNT(DISTINCT COALESCE(p1."id", p2."id")) FILTER (WHERE e."status" = ${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')})::int AS "submitted"
        FROM ${databaseObject('users')} u
        LEFT JOIN ${databaseObject('product_judge_assignments')} pja ON pja."judgeId" = u."id" AND pja."isActive" = true
        LEFT JOIN ${databaseObject('products')} p1 ON p1."id" = pja."productId"
          AND p1."status" IN (${ProductStatus.APPROVED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')})
        LEFT JOIN ${databaseObject('judge_assignments')} ja ON ja."judgeId" = u."id"
        LEFT JOIN ${databaseObject('products')} p2 ON p2."categoryId" = ja."categoryId"
          AND p2."status" IN (${ProductStatus.SUBMITTED}::${databaseObject('ProductStatus')}, ${ProductStatus.APPROVED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')})
        LEFT JOIN ${databaseObject('evaluations')} e ON e."judgeId" = u."id" AND e."productId" = COALESCE(p1."id", p2."id")
        WHERE u."role" <> ${Role.REGISTRANT}::${databaseObject('Role')}
          AND ${StaffPermission.SCORE}::${databaseObject('StaffPermission')} = ANY(u."staffPermissions")
          AND u."isActive" = true AND u."verified" = true
        GROUP BY u."id", u."fullName"
        ORDER BY u."fullName" ASC, u."id" ASC
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

  createJudge(
    input: {
      email: string;
      fullName: string;
      phone: string | null;
      password: string;
      organizationUnitId: string;
      reason: string;
    },
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const judge = await createStaff(
        tx,
        { ...input, staffPermissions: [StaffPermission.SCORE] },
        actorId,
        meta,
        'judge.create',
      );
      return {
        id: judge.id,
        email: judge.email,
        fullName: judge.fullName,
        phone: judge.phone,
        verified: judge.verified,
        isActive: judge.isActive,
        createdAt: judge.createdAt,
      };
    });
  }

  async updateJudge(args: {
    id: string;
    input: { fullName?: string; phone?: string | null; reason: string };
    actorId: string;
    meta: AdminRequestMeta;
  }) {
    const { id, input, actorId, meta } = args;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.user.findFirst({
        where: {
          id,
          role: { not: Role.REGISTRANT },
          staffPermissions: { has: StaffPermission.SCORE },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          isActive: true,
        },
      });
      if (!before) return null;
      const { reason, ...changes } = input;
      const after = await tx.user.update({
        where: { id },
        data: changes,
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          verified: true,
          isActive: true,
          createdAt: true,
        },
      });
      await this.audit(tx, {
        actorId,
        action: 'judge.update',
        entityType: 'User',
        entityId: id,
        beforeData: before,
        afterData: after,
        reason,
        ...meta,
      });
      return after;
    });
  }

  async deactivateJudge(
    id: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await lockStaffMutation(tx);
      const before = await tx.user.findFirst({
        where: {
          id,
          role: { not: Role.REGISTRANT },
          staffPermissions: { has: StaffPermission.SCORE },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          verified: true,
          staffPermissions: true,
        },
      });
      if (!before) return null;
      const changed = await applyStaffAccess(
        tx,
        id,
        {
          staffPermissions: before.staffPermissions,
          organizationUnitId: (
            await tx.user.findUniqueOrThrow({
              where: { id },
              select: { organizationUnitId: true },
            })
          ).organizationUnitId,
          isActive: false,
          reason,
        },
        actorId,
        meta,
        'judge.deactivate',
      );
      if (!changed) return null;
      return tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, fullName: true, isActive: true },
      });
    });
  }

  async resetJudgePassword(
    id: string,
    password: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const judge = await tx.user.findFirst({
        where: {
          id,
          role: { not: Role.REGISTRANT },
          staffPermissions: { has: StaffPermission.SCORE },
        },
        select: { id: true, email: true },
      });
      if (!judge) return false;
      const after = await tx.user.update({
        where: { id },
        data: { password, tokenVersion: { increment: 1 } },
        select: { email: true, verified: true },
      });
      await this.audit(tx, {
        actorId,
        action: 'judge.password_reset',
        entityType: 'User',
        entityId: id,
        beforeData: { email: judge.email },
        afterData: {
          email: after.email,
          verified: after.verified,
          passwordReset: true,
        },
        reason,
        ...meta,
      });
      return true;
    });
  }

  listAssignments() {
    return this.prisma.judgeAssignment.findMany({
      include: {
        judge: {
          select: { id: true, email: true, fullName: true, isActive: true },
        },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ category: { name: 'asc' } }, { judge: { fullName: 'asc' } }],
    });
  }

  async replaceAssignments(
    assignments: Array<{
      judgeId: string;
      categoryId: string;
      criterionIds: string[];
    }>,
    actorId: string,
    reason: string | undefined,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM ${databaseObject('product_categories')}
        ORDER BY "id" FOR UPDATE
      `);
        const judgeIds = [
          ...new Set(assignments.map(({ judgeId }) => judgeId)),
        ];
        const categoryIds = [
          ...new Set(assignments.map(({ categoryId }) => categoryId)),
        ];
        const [judges, categories] = await Promise.all([
          tx.user.findMany({
            where: {
              id: { in: judgeIds },
              role: { not: Role.REGISTRANT },
              staffPermissions: { has: StaffPermission.SCORE },
              isActive: true,
              verified: true,
            },
            select: { id: true },
          }),
          tx.productCategory.findMany({
            select: {
              id: true,
              name: true,
              criteriaSet: {
                select: { criteria: { select: { id: true, code: true } } },
              },
            },
          }),
        ]);
        if (judges.length !== judgeIds.length)
          throw new BadRequestException(
            'Assignments must reference active judges',
          );
        if (
          categories.filter(({ id }) => categoryIds.includes(id)).length !==
          categoryIds.length
        ) {
          throw new BadRequestException('Assignment category not found');
        }
        const categoryById = new Map(
          categories.map((category) => [category.id, category]),
        );
        for (const assignment of assignments) {
          const criteria = new Set(
            categoryById
              .get(assignment.categoryId)
              ?.criteriaSet?.criteria.map(({ id }) => id) ?? [],
          );
          if (
            assignment.criterionIds.some(
              (criterionId) => !criteria.has(criterionId),
            )
          ) {
            throw new BadRequestException(
              'Assignment criterion must belong to its category',
            );
          }
        }

        const before = await tx.judgeAssignment.findMany({
          orderBy: [{ categoryId: 'asc' }, { judgeId: 'asc' }],
        });
        const openProducts = await tx.product.findMany({
          where: {
            status: {
              in: [
                ProductStatus.SUBMITTED,
                ProductStatus.APPROVED,
                ProductStatus.SCORING,
              ],
            },
          },
          select: { id: true, categoryId: true },
        });
        const byCategory = new Map<string, typeof assignments>();
        for (const assignment of assignments) {
          const current = byCategory.get(assignment.categoryId) ?? [];
          current.push(assignment);
          byCategory.set(assignment.categoryId, current);
        }
        const coverageIssues: string[] = [];
        const openCategoryIds = new Set(
          openProducts.map(({ categoryId }) => categoryId),
        );
        for (const category of categories.filter(({ id }) =>
          openCategoryIds.has(id),
        )) {
          const categoryAssignments = byCategory.get(category.id) ?? [];
          const criteria = category.criteriaSet?.criteria ?? [];
          const covered = new Set(
            categoryAssignments.flatMap(({ criterionIds }) =>
              criterionIds.length
                ? criterionIds
                : criteria.map(({ id }) => id),
            ),
          );
          const missing = criteria.filter(({ id }) => !covered.has(id));
          if (!categoryAssignments.length || missing.length) {
            coverageIssues.push(
              `${category.name}: ${!categoryAssignments.length ? 'chưa có giám khảo' : `thiếu ${missing.map(({ code }) => code).join(', ')}`}`,
            );
          }
        }
        if (coverageIssues.length) {
          throw new ConflictException(
            `Phân công chưa phủ đủ tiêu chí cho ${coverageIssues.join('; ')}`,
          );
        }

        const assignmentKey = (judgeId: string, categoryId: string) =>
          JSON.stringify([judgeId, categoryId]);
        const parseAssignmentKey = (key: string): [string, string] =>
          JSON.parse(key) as [string, string];
        const assignmentsByKey = new Map(
          assignments.map((assignment) => [
            assignmentKey(assignment.judgeId, assignment.categoryId),
            assignment,
          ]),
        );
        const previousByKey = new Map(
          before.map((assignment) => [
            assignmentKey(assignment.judgeId, assignment.categoryId),
            assignment,
          ]),
        );
        const allKeys = new Set([
          ...assignmentsByKey.keys(),
          ...previousByKey.keys(),
        ]);
        const changedKeys = new Set<string>();
        const sameScope = (judgeId: string, categoryId: string) => {
          const criteria =
            categoryById
              .get(categoryId)
              ?.criteriaSet?.criteria.map(({ id }) => id) ?? [];
          const resolve = (ids: string[] | undefined) =>
            ids?.length
              ? criteria.filter((id) => ids.includes(id)).sort()
              : ids
                ? [...criteria].sort()
                : [];
          const key = assignmentKey(judgeId, categoryId);
          const oldIds = resolve(previousByKey.get(key)?.criterionIds);
          const newIds = resolve(assignmentsByKey.get(key)?.criterionIds);
          return (
            oldIds.length === newIds.length &&
            oldIds.every((id, index) => id === newIds[index])
          );
        };
        for (const key of allKeys) {
          const [judgeId, categoryId] = parseAssignmentKey(key);
          if (!sameScope(judgeId, categoryId)) changedKeys.add(key);
        }

        if (changedKeys.size) {
          const openProductIds = openProducts.map(({ id }) => id);
          const submitted = openProductIds.length
            ? await tx.evaluation.findMany({
                where: {
                  productId: { in: openProductIds },
                  status: EvaluationStatus.SUBMITTED,
                },
                select: {
                  judgeId: true,
                  product: { select: { categoryId: true } },
                },
              })
            : [];
          if (
            submitted.some(({ judgeId, product }) =>
              changedKeys.has(assignmentKey(judgeId, product.categoryId)),
            )
          ) {
            throw new ConflictException(
              'Cannot change criteria for a submitted evaluation',
            );
          }
        }

        const hasChanges =
          changedKeys.size > 0 || before.length !== assignments.length;

        await tx.judgeAssignment.deleteMany();
        if (assignments.length)
          await tx.judgeAssignment.createMany({ data: assignments });

        const changedPairs = [...changedKeys].map((key) => {
          const [judgeId, categoryId] = parseAssignmentKey(key);
          return { judgeId, categoryId };
        });
        const changedCategoryIds = [
          ...new Set(changedPairs.map(({ categoryId }) => categoryId)),
        ];
        if (changedPairs.length) {
          const inProgress = await tx.evaluation.findMany({
            where: {
              status: EvaluationStatus.IN_PROGRESS,
              judgeId: { in: changedPairs.map(({ judgeId }) => judgeId) },
              product: {
                categoryId: { in: changedCategoryIds },
                status: {
                  in: [
                    ProductStatus.SUBMITTED,
                    ProductStatus.APPROVED,
                    ProductStatus.SCORING,
                  ],
                },
              },
            },
            select: {
              id: true,
              judgeId: true,
              product: { select: { categoryId: true } },
            },
          });
          const resetIds = inProgress
            .filter(({ judgeId, product }) =>
              changedKeys.has(assignmentKey(judgeId, product.categoryId)),
            )
            .map(({ id }) => id);
          if (resetIds.length) {
            await tx.score.deleteMany({
              where: { evaluationId: { in: resetIds } },
            });
            await tx.evaluation.updateMany({
              where: { id: { in: resetIds } },
              data: { total: null },
            });
          }
          for (const product of openProducts.filter(({ categoryId }) =>
            changedCategoryIds.includes(categoryId),
          )) {
            await recomputeProductResult(tx, product.id, actorId);
          }
        } else if (hasChanges) {
          for (const product of openProducts) {
            await recomputeProductResult(tx, product.id, actorId);
          }
        }

        const after = await tx.judgeAssignment.findMany({
          orderBy: [{ categoryId: 'asc' }, { judgeId: 'asc' }],
        });
        await this.audit(tx, {
          actorId,
          action: 'assignments.replace',
          entityType: 'JudgeAssignment',
          beforeData: before,
          afterData: after,
          reason,
          ...meta,
        });
        return after;
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  listProducts(query: AdminProductQueryDto, canManage = true) {
    const direction = query.sortDirection ?? SORT_DIRECTION.DESC;
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sortBy === PRODUCT_SORT_BY.NAME
        ? [{ name: direction }, { id: direction }]
        : query.sortBy === PRODUCT_SORT_BY.FINAL_SCORE
          ? [
              { finalScore: { sort: direction, nulls: 'last' } },
              { id: direction },
            ]
          : [
              { submittedAt: { sort: direction, nulls: 'last' } },
              { id: direction },
            ];

    return this.prisma.$transaction(
      async (tx) => {
        const codeMatchIds = query.q
          ? await findProductIdsMatchingCodeQuery(
              tx,
              query.q,
              canManage ? undefined : { status: { not: ProductStatus.DRAFT } },
            )
          : [];
        const where = this.adminProductWhere(query, canManage, codeMatchIds);
        const [rows, total] = await Promise.all([
          tx.product.findMany({
            where,
            select: adminProductSelect,
            orderBy,
            skip: (query.page - 1) * query.limit,
            take: query.limit,
          }),
          tx.product.count({ where }),
        ]);
        return {
          data: rows.map(({ formData, ...row }) =>
            withProductCode({
              ...row,
              formData: safeFormData(formData),
            }),
          ),
          total,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async findAdminProduct(id: string, canManage = true) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        ...(canManage ? {} : { status: { not: ProductStatus.DRAFT } }),
      },
      select: adminProductDetailSelect,
    });
    if (!product) return null;

    const categoryAgencies: ManagingAgencySummary[] =
      product.category.agencyLinks.map((l) => l.agency);
    const snapshotAgencies = parseSnapshotAgencies(
      product.requiredAgencySnapshot,
    );
    const requiredAgencies =
      snapshotAgencies.length > 0 ? snapshotAgencies : categoryAgencies;

    const evalByJudge = new Map(
      product.evaluations.map((e) => [e.judgeId, e]),
    );

    const judgeAssignments: ProductJudgeAssignmentRecord[] =
      product.judgeAssignments.map((pa) => {
        const ev = evalByJudge.get(pa.judgeId);
        return {
          id: pa.id,
          productId: pa.productId,
          judgeId: pa.judgeId,
          managingAgencyId: pa.managingAgencyId,
          managingAgency: pa.managingAgency,
          organizationUnitId: pa.organizationUnitId,
          organizationUnitName:
            pa.judge.organizationUnit?.name ?? null,
          isManual: pa.isManual,
          mustSubmitToComplete: pa.mustSubmitToComplete,
          isActive: pa.isActive,
          assignedAt: pa.assignedAt.toISOString(),
          assignedBy: pa.assignedBy,
          removedAt: pa.removedAt?.toISOString() ?? null,
          removedBy: pa.removedBy,
          removeReason: pa.removeReason,
          judge: pa.judge,
          evaluation: ev
            ? {
                id: ev.id,
                status: ev.status,
                previousStatus: ev.previousStatus,
                total: ev.total,
                submittedAt: ev.submittedAt?.toISOString() ?? null,
                reopenedAt: ev.reopenedAt?.toISOString() ?? null,
              }
            : null,
        };
      });

    const agencyCoverage: ProductAgencyCoverageItem[] = requiredAgencies.map(
      (agency) => {
        const matchingActive = judgeAssignments.filter(
          (a) =>
            a.isActive &&
            (a.managingAgencyId === agency.id ||
              a.judge.organizationUnit?.managingAgency?.id === agency.id),
        );
        const submittedCount = matchingActive.filter(
          (a) => a.evaluation?.status === EvaluationStatus.SUBMITTED,
        ).length;
        return {
          agency,
          activeJudgeCount: matchingActive.length,
          submittedCount,
          hasMissingJudges: matchingActive.length === 0,
        };
      },
    );

    const missingAgencyNames = agencyCoverage
      .filter((c) => c.hasMissingJudges)
      .map((c) => c.agency.name);

    const {
      judgeAssignments: _pa,
      evaluations: _ev,
      resultHistory,
      requiredAgencySnapshot: _snap,
      category,
      ...rest
    } = product;

    return withProductCode({
      ...rest,
      category: {
        id: category.id,
        name: category.name,
        managingAgencies: categoryAgencies,
      },
      formData: safeFormData(product.formData),
      judgeAssignments,
      agencyCoverage,
      missingAgencyNames,
      resultHistory: resultHistory.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  }

  findAdminAttachments(productId: string, canManage = true) {
    return this.prisma.product
      .findFirst({
        where: {
          id: productId,
          ...(canManage ? {} : { status: { not: ProductStatus.DRAFT } }),
        },
        select: {
          attachments: {
            select: { id: true, type: true, fileName: true, createdAt: true },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      })
      .then((product) => product?.attachments ?? null);
  }

  async approveProduct(
    productId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true, status: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );

        const product = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            name: true,
            status: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
                agencyLinks: {
                  orderBy: [
                    { agency: { order: 'asc' } },
                    { agency: { code: 'asc' } },
                  ],
                  select: {
                    agency: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        order: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.status !== ProductStatus.SUBMITTED) {
          throw new ConflictException(
            'Chỉ có thể duyệt hồ sơ đang ở trạng thái Đã nộp (chờ duyệt)',
          );
        }

        const requiredAgencies = product.category.agencyLinks
          .map((l) => l.agency)
          .filter((a) => a.isActive);
        const agencyIds = requiredAgencies.map((a) => a.id);

        const eligibleJudges = agencyIds.length
          ? await tx.user.findMany({
              where: {
                role: { not: Role.REGISTRANT },
                staffPermissions: { has: StaffPermission.SCORE },
                isActive: true,
                verified: true,
                organizationUnit: {
                  is: {
                    isActive: true,
                    managingAgencyId: { in: agencyIds },
                  },
                },
              },
              select: {
                id: true,
                fullName: true,
                organizationUnit: {
                  select: {
                    id: true,
                    name: true,
                    managingAgencyId: true,
                    managingAgency: {
                      select: { id: true, code: true, name: true },
                    },
                  },
                },
              },
              orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
            })
          : [];

        const approvedAt = new Date();
        await tx.product.update({
          where: { id: productId },
          data: {
            status: ProductStatus.APPROVED,
            approvedAt,
            approvedById: actorId,
            returnReason: null,
            returnedAt: null,
            returnedById: null,
            requiredAgencySnapshot:
              requiredAgencies as unknown as Prisma.InputJsonValue,
          },
        });

        for (const judge of eligibleJudges) {
          const unit = judge.organizationUnit;
          await tx.productJudgeAssignment.upsert({
            where: {
              productId_judgeId: { productId, judgeId: judge.id },
            },
            create: {
              productId,
              judgeId: judge.id,
              managingAgencyId: unit?.managingAgencyId ?? null,
              organizationUnitId: unit?.id ?? null,
              isManual: false,
              isActive: true,
              mustSubmitToComplete: false,
              assignedById: actorId,
              assignedAt: approvedAt,
            },
            update: {
              managingAgencyId: unit?.managingAgencyId ?? null,
              organizationUnitId: unit?.id ?? null,
              isActive: true,
              removedAt: null,
              removedById: null,
              removeReason: null,
            },
          });
        }

        await recordProductStatusEvent(
          tx,
          productId,
          ProductStatus.SUBMITTED,
          ProductStatus.APPROVED,
          actorId,
          approvedAt,
          reason,
        );

        await this.audit(tx, {
          actorId,
          action: 'product.approve',
          entityType: 'Product',
          entityId: productId,
          beforeData: { status: ProductStatus.SUBMITTED },
          afterData: {
            status: ProductStatus.APPROVED,
            assignedJudgeIds: eligibleJudges.map((j) => j.id),
            requiredAgencies: requiredAgencies.map((a) => a.code),
          },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.findAdminProduct(productId, canManage);
  }

  async returnProduct(
    productId: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, status: true },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.status !== ProductStatus.SUBMITTED) {
          throw new ConflictException(
            'Chỉ có thể trả lại hồ sơ đang ở trạng thái Đã nộp (chờ duyệt)',
          );
        }

        const returnedAt = new Date();
        await tx.product.update({
          where: { id: productId },
          data: {
            status: ProductStatus.RETURNED,
            returnReason: reason,
            returnedAt,
            returnedById: actorId,
          },
        });

        await recordProductStatusEvent(
          tx,
          productId,
          ProductStatus.SUBMITTED,
          ProductStatus.RETURNED,
          actorId,
          returnedAt,
          reason,
        );

        await this.audit(tx, {
          actorId,
          action: 'product.return',
          entityType: 'Product',
          entityId: productId,
          beforeData: { status: ProductStatus.SUBMITTED },
          afterData: { status: ProductStatus.RETURNED, returnReason: reason },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.findAdminProduct(productId, canManage);
  }

  async publishProductResults(
    productId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            status: true,
            finalScore: true,
            starRating: true,
            publicationState: true,
          },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (
          product.status !== ProductStatus.COMPLETED ||
          product.finalScore === null ||
          product.starRating === null
        ) {
          throw new ConflictException(
            'Chỉ có thể công bố kết quả cho hồ sơ đã hoàn tất chấm điểm và có kết quả hợp lệ',
          );
        }

        const submittedCount = await tx.evaluation.count({
          where: { productId, status: EvaluationStatus.SUBMITTED },
        });
        const publishedAt = new Date();
        await tx.product.update({
          where: { id: productId },
          data: {
            publicationState: ProductPublicationState.PUBLISHED,
            publishedFinalScore: product.finalScore,
            publishedStarRating: product.starRating,
            publishedAt,
            publishedById: actorId,
          },
        });

        await tx.productResultHistory.updateMany({
          where: { productId, isCurrent: true },
          data: { isCurrent: false },
        });
        await tx.productResultHistory.create({
          data: {
            productId,
            action:
              product.publicationState === ProductPublicationState.UPDATING
                ? PRODUCT_RESULT_HISTORY_ACTION.REPUBLISHED
                : PRODUCT_RESULT_HISTORY_ACTION.PUBLISHED,
            finalScore: product.finalScore,
            starRating: product.starRating,
            isCurrent: true,
            actorId,
            reason,
            snapshot: {
              evaluationCount: submittedCount,
              publicationState: ProductPublicationState.PUBLISHED,
            },
          },
        });

        await this.audit(tx, {
          actorId,
          action: 'product.publish_results',
          entityType: 'Product',
          entityId: productId,
          beforeData: { publicationState: product.publicationState },
          afterData: {
            publicationState: ProductPublicationState.PUBLISHED,
            finalScore: product.finalScore,
            starRating: product.starRating,
          },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.findAdminProduct(productId, canManage);
  }

  async reopenProduct(
    productId: string,
    reason: string,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );

        const product = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            status: true,
            finalScore: true,
            starRating: true,
            publicationState: true,
          },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.status !== ProductStatus.COMPLETED) {
          throw new ConflictException(
            'Chỉ có thể mở lại hồ sơ đang ở trạng thái Hoàn tất chấm điểm',
          );
        }

        const reopenedAt = new Date();
        const nextPubState =
          product.publicationState === ProductPublicationState.PUBLISHED
            ? ProductPublicationState.UPDATING
            : product.publicationState;

        await tx.product.update({
          where: { id: productId },
          data: {
            status: ProductStatus.SCORING,
            completedAt: null,
            finalScore: null,
            starRating: null,
            publicationState: nextPubState,
          },
        });

        await recordProductStatusEvent(
          tx,
          productId,
          ProductStatus.COMPLETED,
          ProductStatus.SCORING,
          actorId,
          reopenedAt,
          reason,
        );

        const evalCount = await tx.evaluation.count({
          where: { productId, status: EvaluationStatus.SUBMITTED },
        });
        await tx.productResultHistory.updateMany({
          where: { productId, isCurrent: true },
          data: { isCurrent: false },
        });
        await tx.productResultHistory.create({
          data: {
            productId,
            action: PRODUCT_RESULT_HISTORY_ACTION.PRODUCT_REOPENED,
            finalScore: null,
            starRating: null,
            isCurrent: true,
            actorId,
            reason,
            snapshot: {
              evaluationCount: evalCount,
              publicationState: nextPubState,
            },
          },
        });

        await this.audit(tx, {
          actorId,
          action: 'product.reopen',
          entityType: 'Product',
          entityId: productId,
          beforeData: {
            status: product.status,
            finalScore: product.finalScore,
            starRating: product.starRating,
            publicationState: product.publicationState,
          },
          afterData: {
            status: ProductStatus.SCORING,
            finalScore: null,
            starRating: null,
            publicationState: nextPubState,
          },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.findAdminProduct(productId, canManage);
  }

  async addProductJudgeAssignment(
    productId: string,
    input: AddProductJudgeAssignmentDto,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );

        const product = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            status: true,
            requiredAgencySnapshot: true,
            category: {
              select: {
                id: true,
                name: true,
                agencyLinks: {
                  select: {
                    agency: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        order: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!product) throw new NotFoundException('Product not found');

        if (product.status === ProductStatus.COMPLETED) {
          throw new ConflictException(
            'Hồ sơ đã hoàn tất chấm điểm. Vui lòng mở lại hồ sơ trước khi bổ sung giám khảo.',
          );
        }
        if (
          product.status !== ProductStatus.APPROVED &&
          product.status !== ProductStatus.SCORING
        ) {
          throw new ConflictException(
            'Chỉ có thể bổ sung giám khảo cho hồ sơ đã được duyệt hoặc đang chấm điểm.',
          );
        }

        const judge = await tx.user.findUnique({
          where: { id: input.judgeId },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            staffPermissions: true,
            isActive: true,
            verified: true,
            organizationUnit: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                managingAgencyId: true,
                managingAgency: {
                  select: { id: true, code: true, name: true },
                },
              },
            },
          },
        });
        if (
          !judge ||
          judge.role === Role.REGISTRANT ||
          !judge.staffPermissions.includes(StaffPermission.SCORE) ||
          !judge.isActive ||
          !judge.verified
        ) {
          throw new BadRequestException(
            'Giám khảo được chọn không hợp lệ hoặc đang bị vô hiệu hóa.',
          );
        }

        const snapshotAgencies = parseSnapshotAgencies(
          product.requiredAgencySnapshot,
        );
        const categoryAgencies = product.category.agencyLinks.map(
          (l) => l.agency,
        );
        const allowedAgencyIds = new Set(
          (snapshotAgencies.length > 0
            ? snapshotAgencies
            : categoryAgencies
          ).map((a) => a.id),
        );
        const judgeAgencyId =
          judge.organizationUnit?.managingAgencyId ?? null;
        if (
          allowedAgencyIds.size > 0 &&
          (!judgeAgencyId || !allowedAgencyIds.has(judgeAgencyId))
        ) {
          throw new BadRequestException(
            'Giám khảo không thuộc cơ quan quản lý của phân loại sản phẩm này.',
          );
        }

        const existingAssignment = await tx.productJudgeAssignment.findUnique({
          where: {
            productId_judgeId: { productId, judgeId: judge.id },
          },
        });
        if (existingAssignment?.isActive) {
          throw new ConflictException(
            'Giám khảo này đã được phân công cho hồ sơ.',
          );
        }

        const existingEvaluation = await tx.evaluation.findUnique({
          where: {
            judgeId_productId: { judgeId: judge.id, productId },
          },
          include: {
            scores: { select: { subCriterionId: true } },
          },
        });

        if (
          existingEvaluation &&
          existingEvaluation.status === EvaluationStatus.EXCLUDED &&
          !input.confirmRestore
        ) {
          return {
            requiresRestoreConfirmation: true as const,
            previousEvaluation: {
              id: existingEvaluation.id,
              previousStatus:
                existingEvaluation.previousStatus ??
                EvaluationStatus.IN_PROGRESS,
              total: existingEvaluation.total,
              submittedAt:
                existingEvaluation.submittedAt?.toISOString() ?? null,
              excludedAt: existingEvaluation.excludedAt?.toISOString() ?? null,
              excludeReason: existingEvaluation.excludeReason,
              scoreCount: existingEvaluation.scores.length,
            },
          };
        }

        const now = new Date();
        const unit = judge.organizationUnit;
        let restoredStatus: EvaluationStatus | null = null;

        if (
          existingEvaluation &&
          existingEvaluation.status === EvaluationStatus.EXCLUDED
        ) {
          restoredStatus =
            existingEvaluation.previousStatus === EvaluationStatus.SUBMITTED
              ? EvaluationStatus.SUBMITTED
              : EvaluationStatus.IN_PROGRESS;
          await tx.evaluation.update({
            where: { id: existingEvaluation.id },
            data: {
              status: restoredStatus,
              previousStatus: null,
              excludedAt: null,
              excludedById: null,
              excludeReason: null,
            },
          });
          await tx.evaluationHistoryEvent.create({
            data: {
              evaluationId: existingEvaluation.id,
              action: EVALUATION_HISTORY_ACTION.RESTORED,
              fromStatus: EvaluationStatus.EXCLUDED,
              toStatus: restoredStatus,
              actorId,
              reason: input.reason,
              previousTotal: existingEvaluation.total,
            },
          });
        }

        const mustSubmitToComplete =
          restoredStatus !== EvaluationStatus.SUBMITTED;

        await tx.productJudgeAssignment.upsert({
          where: {
            productId_judgeId: { productId, judgeId: judge.id },
          },
          create: {
            productId,
            judgeId: judge.id,
            managingAgencyId: unit?.managingAgencyId ?? null,
            organizationUnitId: unit?.id ?? null,
            isManual: true,
            isActive: true,
            mustSubmitToComplete,
            assignedById: actorId,
            assignedAt: now,
          },
          update: {
            managingAgencyId: unit?.managingAgencyId ?? null,
            organizationUnitId: unit?.id ?? null,
            isManual: true,
            isActive: true,
            mustSubmitToComplete,
            assignedById: actorId,
            assignedAt: now,
            removedAt: null,
            removedById: null,
            removeReason: null,
          },
        });

        await recomputeProductResult(
          tx,
          productId,
          actorId,
          restoredStatus
            ? PRODUCT_RESULT_HISTORY_ACTION.JUDGE_RESTORED
            : PRODUCT_RESULT_HISTORY_ACTION.JUDGE_ADDED,
        );

        await this.audit(tx, {
          actorId,
          action: restoredStatus
            ? 'product.judge_restore'
            : 'product.judge_add',
          entityType: 'Product',
          entityId: productId,
          afterData: {
            judgeId: judge.id,
            restoredStatus,
            mustSubmitToComplete,
          },
          reason: input.reason,
          ...meta,
        });

        return { requiresRestoreConfirmation: false as const };
      },
      { timeout: 15000, maxWait: 10000 },
    );

    if (result.requiresRestoreConfirmation) {
      return result;
    }
    return this.findAdminProduct(productId, canManage);
  }

  async removeProductJudgeAssignment(
    productId: string,
    judgeId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );

        const assignment = await tx.productJudgeAssignment.findUnique({
          where: { productId_judgeId: { productId, judgeId } },
        });
        if (!assignment || !assignment.isActive) {
          throw new NotFoundException('Phân công giám khảo không tồn tại');
        }

        const now = new Date();
        await tx.productJudgeAssignment.update({
          where: { id: assignment.id },
          data: {
            isActive: false,
            mustSubmitToComplete: false,
            removedAt: now,
            removedById: actorId,
            removeReason: reason ?? null,
          },
        });

        const existingEval = await tx.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
        });
        if (existingEval && existingEval.status !== EvaluationStatus.EXCLUDED) {
          await tx.evaluation.update({
            where: { id: existingEval.id },
            data: {
              previousStatus: existingEval.status,
              status: EvaluationStatus.EXCLUDED,
              excludedAt: now,
              excludedById: actorId,
              excludeReason: reason ?? null,
            },
          });
          await tx.evaluationHistoryEvent.create({
            data: {
              evaluationId: existingEval.id,
              action: EVALUATION_HISTORY_ACTION.EXCLUDED,
              fromStatus: existingEval.status,
              toStatus: EvaluationStatus.EXCLUDED,
              actorId,
              reason,
              previousTotal: existingEval.total,
            },
          });
        }

        await recomputeProductResult(
          tx,
          productId,
          actorId,
          PRODUCT_RESULT_HISTORY_ACTION.JUDGE_REMOVED,
        );

        await this.audit(tx, {
          actorId,
          action: 'product.judge_remove',
          entityType: 'Product',
          entityId: productId,
          beforeData: {
            judgeId,
            evaluationStatus: existingEval?.status ?? null,
          },
          afterData: {
            judgeId,
            isActive: false,
            evaluationExcluded: Boolean(existingEval),
          },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.findAdminProduct(productId, canManage);
  }

  async reopenEvaluation(
    productId: string,
    evaluationId: string,
    reason: string | undefined,
    actorId: string,
    meta: AdminRequestMeta,
    canManage: boolean,
  ) {
    await this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { id: true, categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );

        const evaluation = await tx.evaluation.findFirst({
          where: { id: evaluationId, productId },
        });
        if (!evaluation) throw new NotFoundException('Evaluation not found');
        if (evaluation.status !== EvaluationStatus.SUBMITTED) {
          throw new ConflictException(
            'Chỉ có thể mở lại phiếu chấm đã nộp để giám khảo chỉnh sửa',
          );
        }

        const now = new Date();
        await tx.evaluation.update({
          where: { id: evaluation.id },
          data: {
            status: EvaluationStatus.IN_PROGRESS,
            reopenedAt: now,
            reopenedById: actorId,
            reopenReason: reason ?? null,
          },
        });

        await tx.evaluationHistoryEvent.create({
          data: {
            evaluationId: evaluation.id,
            action: EVALUATION_HISTORY_ACTION.REOPENED,
            fromStatus: EvaluationStatus.SUBMITTED,
            toStatus: EvaluationStatus.IN_PROGRESS,
            actorId,
            reason,
            previousTotal: evaluation.total,
          },
        });

        await recomputeProductResult(
          tx,
          productId,
          actorId,
          PRODUCT_RESULT_HISTORY_ACTION.EVALUATION_REOPENED,
        );

        await this.audit(tx, {
          actorId,
          action: 'evaluation.reopen',
          entityType: 'Evaluation',
          entityId: evaluation.id,
          beforeData: {
            productId,
            judgeId: evaluation.judgeId,
            status: EvaluationStatus.SUBMITTED,
            total: evaluation.total,
          },
          afterData: {
            productId,
            judgeId: evaluation.judgeId,
            status: EvaluationStatus.IN_PROGRESS,
          },
          reason,
          ...meta,
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );

    return this.findAdminProduct(productId, canManage);
  }

  private adminProductWhere(
    query: AdminProductQueryDto,
    canManage: boolean,
    codeMatchIds: string[] = [],
  ): Prisma.ProductWhereInput {
    const conditions: Prisma.ProductWhereInput[] = [];
    if (!canManage) conditions.push({ status: { not: ProductStatus.DRAFT } });
    if (query.status) conditions.push({ status: query.status });
    if (query.categoryId) conditions.push({ categoryId: query.categoryId });
    if (query.registrantId)
      conditions.push({ registrantId: query.registrantId });
    if (query.registrantQ) {
      conditions.push({
        registrant: {
          is: {
            OR: [
              { fullName: { contains: query.registrantQ, mode: 'insensitive' } },
              { email: { contains: query.registrantQ, mode: 'insensitive' } },
            ],
          },
        },
      });
    }
    if (query.localityId) conditions.push({ localityId: query.localityId });
    else if (query.unmappedLocality) conditions.push({ localityId: null });
    if (query.registrationType)
      conditions.push({
        formData: {
          path: ['registrationType'],
          equals: query.registrationType,
        },
      });
    if (query.assessmentYear !== undefined)
      conditions.push({
        formData: {
          path: ['assessmentYear'],
          equals: query.assessmentYear,
        },
      });
    if (query.starRating)
      conditions.push({
        status: ProductStatus.COMPLETED,
        starRating: query.starRating,
      });
    if (query.from && query.toExclusive) {
      conditions.push({
        [query.dateBasis]: {
          gte: new Date(query.from),
          lt: new Date(query.toExclusive),
        },
      });
    }
    if (query.q)
      conditions.push({
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { id: { contains: query.q, mode: 'insensitive' } },
          ...(codeMatchIds.length ? [{ id: { in: codeMatchIds } }] : []),
          {
            formData: {
              path: ['entityName'],
              string_contains: query.q,
              mode: 'insensitive',
            },
          },
        ],
      });
    return { AND: conditions };
  }

  productResults(productId: string, canManage = true) {
    return this.prisma.product
      .findFirst({
        where: {
          id: productId,
          ...(canManage ? {} : { status: { not: ProductStatus.DRAFT } }),
        },
        select: {
          id: true,
          codeNumber: true,
          name: true,
          status: true,
          publicationState: true,
          publishedFinalScore: true,
          publishedStarRating: true,
          publishedAt: true,
          finalScore: true,
          starRating: true,
          category: { select: { id: true, name: true } },
          evaluations: {
            where: canManage
              ? {}
              : {
                  status: {
                    in: [
                      EvaluationStatus.SUBMITTED,
                      EvaluationStatus.EXCLUDED,
                    ],
                  },
                },
            orderBy: [{ createdAt: 'asc' }, { judgeId: 'asc' }],
            include: {
              judge: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  organizationUnit: { select: { id: true, name: true } },
                },
              },
              scores: {
                include: {
                  subCriterion: {
                    select: {
                      id: true,
                      code: true,
                      criterion: {
                        select: { id: true, code: true, name: true },
                      },
                    },
                  },
                  option: { select: { id: true, label: true, points: true } },
                },
                orderBy: { subCriterionId: 'asc' },
              },
            },
          },
        },
      })
      .then((product) => product && withProductCode(product));
  }

  async listCriteriaSets(
    query: AdminCriteriaSetsQueryDto,
    access: { canViewAll: boolean; scorerUserId?: string },
  ) {
    const { page, limit, q, categoryId, isActive } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }
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
          orderBy: [
            { category: { order: 'asc' } },
            { category: { id: 'asc' } },
            { id: 'asc' },
          ],
          skip,
          take: limit,
        }),
        this.prisma.criteriaSet.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const data: AdminCriteriaSetRecord[] = rows.map((row) => ({
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
    const { page, limit, q, productId, categoryId, judgeId, status } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }

    const conditions: Prisma.EvaluationWhereInput[] = [];
    if (!access.canManage) {
      if (access.canView) {
        conditions.push({
          status: {
            in: [EvaluationStatus.SUBMITTED, EvaluationStatus.EXCLUDED],
          },
          product: { is: { status: { not: ProductStatus.DRAFT } } },
        });
      } else {
        conditions.push({ judgeId: access.scorerUserId });
      }
    }
    if (status) conditions.push({ status });
    if (productId) {
      const codeProductIds = await findProductIdsMatchingCodeQuery(
        this.prisma,
        productId,
      );
      conditions.push({
        OR: [
          { productId },
          ...(codeProductIds.length
            ? [{ productId: { in: codeProductIds } }]
            : []),
        ],
      });
    }
    if (judgeId) conditions.push({ judgeId });
    if (categoryId) conditions.push({ product: { is: { categoryId } } });
    if (q) {
      const codeProductIds = await findProductIdsMatchingCodeQuery(
        this.prisma,
        q,
      );
      conditions.push({
        OR: [
          { id: { contains: q, mode: 'insensitive' } },
          { product: { is: { name: { contains: q, mode: 'insensitive' } } } },
          { product: { is: { id: { contains: q, mode: 'insensitive' } } } },
          ...(codeProductIds.length
            ? [{ productId: { in: codeProductIds } }]
            : []),
          { judge: { is: { fullName: { contains: q, mode: 'insensitive' } } } },
          { judge: { is: { email: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }
    const where: Prisma.EvaluationWhereInput = { AND: conditions };

    const [rows, total] = await this.prisma.$transaction(
      [
        this.prisma.evaluation.findMany({
          where,
          select: {
            id: true,
            status: true,
            total: true,
            submittedAt: true,
            updatedAt: true,
            submissionSnapshot: true,
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
            scores: {
              select: { option: { select: { points: true } } },
            },
          },
          orderBy: [
            { submittedAt: { sort: 'desc', nulls: 'last' } },
            { updatedAt: 'desc' },
            { id: 'desc' },
          ],
          skip,
          take: limit,
        }),
        this.prisma.evaluation.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );

    const data: AdminEvaluationRecord[] = rows.map((row) => {
      const criteria = row.product.category.criteriaSet?.criteria ?? [];
      const allIds = criteria.map((c) => c.id);
      const snap =
        (row.status === EvaluationStatus.SUBMITTED ||
          row.status === EvaluationStatus.EXCLUDED) &&
        row.submissionSnapshot &&
        typeof row.submissionSnapshot === 'object' &&
        !Array.isArray(row.submissionSnapshot)
          ? (row.submissionSnapshot as Record<string, unknown>)
          : null;
      const snapAssigned = Array.isArray(snap?.assignedCriterionIds)
        ? (snap.assignedCriterionIds as string[])
        : Array.isArray(
              (snap?.scope as { criterionIds?: unknown })?.criterionIds,
            )
          ? (snap?.scope as { criterionIds: string[] }).criterionIds
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

      const snapJudge =
        snap?.judge && typeof snap.judge === 'object'
          ? (snap.judge as {
              fullName?: string;
              organizationUnit?: { name?: string } | null;
            })
          : null;
      const computedDraftTotal = row.scores.reduce(
        (sum, s) => sum + s.option.points,
        0,
      );

      return {
        id: row.id,
        status: row.status,
        total:
          typeof row.total === 'number'
            ? row.total
            : row.scores.length > 0
              ? computedDraftTotal
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
          fullName: snapJudge?.fullName ?? row.judge.fullName,
          email: row.judge.email,
          organizationUnitName:
            snapJudge !== null
              ? (snapJudge.organizationUnit?.name ?? null)
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
      ? product.judgeAssignments.map((pa) => ({
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

  async reportingSnapshot() {
    return this.prisma.$transaction(
      async (tx) => {
        const [rawProducts, categories, localities, earliestEvent] =
          await Promise.all([
            tx.product.findMany({
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
            }),
            tx.productCategory.findMany({
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
            }),
            tx.locality.findMany({
              select: {
                id: true,
                code: true,
                name: true,
                provinceName: true,
              },
              orderBy: [
                { provinceName: 'asc' },
                { name: 'asc' },
                { id: 'asc' },
              ],
            }),
            tx.productStatusEvent.findFirst({
              orderBy: { createdAt: 'asc' },
              select: { createdAt: true },
            }),
          ]);

        const coveredCategoryIdsAtNow = new Set<string>();
        for (const cat of categories) {
          const allCriterionIds =
            cat.criteriaSet?.criteria.map((c) => c.id) ?? [];
          if (!allCriterionIds.length) continue;

          if (cat.agencyLinks.length > 0) {
            const allAgenciesHaveJudge = cat.agencyLinks.every((link) =>
              link.agency.organizationUnits.some((u) => u.users.length > 0),
            );
            if (allAgenciesHaveJudge) {
              coveredCategoryIdsAtNow.add(cat.id);
              continue;
            }
          }

          if (cat.assignments.length > 0) {
            const covered = new Set(
              cat.assignments.flatMap((a) =>
                a.criterionIds.length ? a.criterionIds : allCriterionIds,
              ),
            );
            if (allCriterionIds.every((id) => covered.has(id))) {
              coveredCategoryIdsAtNow.add(cat.id);
            }
          }
        }

        const products: ReportingProductRecord[] = rawProducts.map((p) => {
          const safeForm = safeFormData(p.formData);
          const locality =
            p.status !== ProductStatus.DRAFT && p.localityNameAtSubmit
              ? {
                  id:
                    p.localityId ??
                    p.localityCodeAtSubmit ??
                    'SUBMITTED_LOC',
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
          generatedAt: new Date(),
          products,
          categories: categories.map(
            ({ criteriaSet: _cs, assignments: _as, agencyLinks: _al, ...cat }) =>
              cat,
          ),
          localities,
          coveredCategoryIdsAtNow,
          historyAvailableFrom: earliestEvent?.createdAt ?? null,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async updateStaffAccess(
    id: string,
    input: UpdateStaffAccessDto,
    actorId: string,
    meta: AdminRequestMeta,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockStaffMutation(tx);
        return applyStaffAccess(tx, id, input, actorId, meta);
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  private audit(tx: Prisma.TransactionClient, input: AuditInput) {
    return writeAudit(tx, input);
  }
}
