import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { EvaluationStatus, Prisma, ProductStatus, Role, StaffPermission } from '@prisma/client';
import type { ProductApplicationForm } from '@ocop/shared';
import { productRegistrationTypes } from '../constants/products';
import type { AdminProductQueryDto } from '../dtos/admin-products.dto';
import type { UpdateStaffAccessDto } from '../dtos/admin.dto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import { recomputeProductResult } from '../utils/evaluation-result';
import { applyStaffAccess, createStaff, lockStaffMutation } from '../utils/staff-access';
import { writeAudit, type AuditInput } from '../utils/audit-log';

export type AdminRequestMeta = { ipAddress?: string; userAgent?: string; requestId?: string };

const adminProductSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
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
      groupId: true,
      groupCode: true,
      groupName: true,
      classificationGroup: true,
      classificationSubgroup: true,
      group: { select: { id: true, code: true, name: true } },
    },
  },
  registrant: { select: { id: true, fullName: true, email: true } },
  locality: {
    select: { id: true, code: true, name: true, type: true, provinceName: true },
  },
  attachments: {
    where: { type: 'IMAGE' as const },
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
} satisfies Prisma.ProductSelect;

const adminProductDetailSelect = {
  ...adminProductSelect,
  registrationSnapshot: true,
  registrant: { select: { id: true, fullName: true, email: true, phone: true } },
  createdBy: { select: { id: true, fullName: true } },
  attachments: {
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  statusEvents: {
    select: { fromStatus: true, toStatus: true, sequence: true, actorId: true, reason: true, createdAt: true },
    orderBy: [{ sequence: 'asc' as const }],
  },
} satisfies Prisma.ProductSelect;

function safeFormData(value: Prisma.JsonValue): Partial<ProductApplicationForm> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const source = value as Record<string, Prisma.JsonValue>;
  const result: Record<string, string | number | boolean> = {};
  for (const field of [
    'entityName', 'representativeName', 'representativeTitle', 'contactAddress',
    'provinceName', 'phone', 'email',
  ]) {
    if (typeof source[field] === 'string') result[field] = source[field] as string;
  }
  if (typeof source.registrationType === 'string' &&
      (productRegistrationTypes as readonly string[]).includes(source.registrationType)) {
    result.registrationType = source.registrationType;
  }
  if (typeof source.sampleQuantity === 'number' && Number.isInteger(source.sampleQuantity) &&
      source.sampleQuantity >= 0 && source.sampleQuantity <= 100000) {
    result.sampleQuantity = source.sampleQuantity;
  }
  if (typeof source.assessmentYear === 'number' && Number.isInteger(source.assessmentYear) &&
      source.assessmentYear >= 2020 && source.assessmentYear <= 2100) {
    result.assessmentYear = source.assessmentYear;
  }
  if (typeof source.declarationAccepted === 'boolean') {
    result.declarationAccepted = source.declarationAccepted;
  }
  return result as Partial<ProductApplicationForm>;
}

@Injectable()
export class AdminRepository {
  constructor(private readonly prisma: PrismaService) {}

  listJudges() {
    return this.prisma.user.findMany({
      where: { role: { not: Role.REGISTRANT }, staffPermissions: { has: StaffPermission.SCORE } },
      select: { id: true, email: true, fullName: true, phone: true, verified: true, isActive: true, createdAt: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    });
  }

  async dashboardData(canManage = true) {
    const [productStatuses, judgeProgress, nextProducts] = await Promise.all([
      this.prisma.product.groupBy({ by: ['status'], where: canManage ? {} : { status: { not: ProductStatus.DRAFT } }, _count: { _all: true } }),
      this.prisma.$queryRaw<Array<{ judgeId: string; fullName: string; assigned: number; submitted: number }>>(Prisma.sql`
        SELECT u."id" AS "judgeId", u."fullName",
          COUNT(DISTINCT p."id")::int AS "assigned",
          COUNT(DISTINCT p."id") FILTER (WHERE e."status" = ${EvaluationStatus.SUBMITTED}::${databaseObject('EvaluationStatus')})::int AS "submitted"
        FROM ${databaseObject('users')} u
        LEFT JOIN ${databaseObject('judge_assignments')} ja ON ja."judgeId" = u."id"
        LEFT JOIN ${databaseObject('products')} p ON p."categoryId" = ja."categoryId"
          AND p."status" IN (${ProductStatus.SUBMITTED}::${databaseObject('ProductStatus')}, ${ProductStatus.SCORING}::${databaseObject('ProductStatus')})
        LEFT JOIN ${databaseObject('evaluations')} e ON e."judgeId" = u."id" AND e."productId" = p."id"
        WHERE u."role" <> ${Role.REGISTRANT}::${databaseObject('Role')}
          AND ${StaffPermission.SCORE}::${databaseObject('StaffPermission')} = ANY(u."staffPermissions")
          AND u."isActive" = true AND u."verified" = true
        GROUP BY u."id", u."fullName"
        ORDER BY u."fullName" ASC, u."id" ASC
      `),
      this.prisma.product.findMany({
        where: { status: { in: [ProductStatus.SUBMITTED, ProductStatus.SCORING] } },
        select: {
          id: true,
          name: true,
          status: true,
          submittedAt: true,
          category: {
            select: {
              id: true,
              name: true,
              groupName: true,
              assignments: {
                where: { judge: { is: { role: { not: Role.REGISTRANT }, staffPermissions: { has: StaffPermission.SCORE }, isActive: true, verified: true } } },
                select: { judgeId: true },
              },
            },
          },
          evaluations: { select: { judgeId: true, status: true } },
        },
        orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
        take: 10,
      }),
    ]);
    return { productStatuses, judgeProgress, nextProducts };
  }

  createJudge(input: { email: string; fullName: string; phone: string | null; password: string; organizationUnitId: string; reason: string }, actorId: string, meta: AdminRequestMeta) {
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
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`);
      const before = await tx.user.findFirst({ where: { id, role: { not: Role.REGISTRANT }, staffPermissions: { has: StaffPermission.SCORE } }, select: { id: true, email: true, fullName: true, phone: true, isActive: true } });
      if (!before) return null;
      const { reason, ...changes } = input;
      const after = await tx.user.update({
        where: { id },
        data: changes,
        select: { id: true, email: true, fullName: true, phone: true, verified: true, isActive: true, createdAt: true },
      });
      await this.audit(tx, { actorId, action: 'judge.update', entityType: 'User', entityId: id, beforeData: before, afterData: after, reason, ...meta });
      return after;
    });
  }

  async deactivateJudge(id: string, reason: string, actorId: string, meta: AdminRequestMeta) {
    return this.prisma.$transaction(async (tx) => {
      await lockStaffMutation(tx);
      const before = await tx.user.findFirst({
        where: { id, role: { not: Role.REGISTRANT }, staffPermissions: { has: StaffPermission.SCORE } },
        select: { id: true, email: true, fullName: true, isActive: true, verified: true, staffPermissions: true },
      });
      if (!before) return null;
      const changed = await applyStaffAccess(
        tx,
        id,
        {
          staffPermissions: before.staffPermissions,
          organizationUnitId: (await tx.user.findUniqueOrThrow({ where: { id }, select: { organizationUnitId: true } })).organizationUnitId,
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

  async resetJudgePassword(id: string, password: string, reason: string, actorId: string, meta: AdminRequestMeta) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${id} FOR UPDATE`);
      const judge = await tx.user.findFirst({ where: { id, role: { not: Role.REGISTRANT }, staffPermissions: { has: StaffPermission.SCORE } }, select: { id: true, email: true } });
      if (!judge) return false;
      const after = await tx.user.update({ where: { id }, data: { password, tokenVersion: { increment: 1 } }, select: { email: true, verified: true } });
      await this.audit(tx, { actorId, action: 'judge.password_reset', entityType: 'User', entityId: id, beforeData: { email: judge.email }, afterData: { email: after.email, verified: after.verified, passwordReset: true }, reason, ...meta });
      return true;
    });
  }

  listAssignments() {
    return this.prisma.judgeAssignment.findMany({
      include: {
        judge: { select: { id: true, email: true, fullName: true, isActive: true } },
        category: { select: { id: true, name: true, groupCode: true, groupName: true } },
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
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM ${databaseObject('product_categories')}
        ORDER BY "id" FOR UPDATE
      `);
      const judgeIds = [...new Set(assignments.map(({ judgeId }) => judgeId))];
      const categoryIds = [
        ...new Set(assignments.map(({ categoryId }) => categoryId)),
      ];
      const [judges, categories] = await Promise.all([
        tx.user.findMany({
          where: { id: { in: judgeIds }, role: { not: Role.REGISTRANT }, staffPermissions: { has: StaffPermission.SCORE }, isActive: true, verified: true },
          select: { id: true },
        }),
        tx.productCategory.findMany({
          select: {
            id: true,
            name: true,
            groupName: true,
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
          status: { in: [ProductStatus.SUBMITTED, ProductStatus.SCORING] },
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
            criterionIds.length ? criterionIds : criteria.map(({ id }) => id),
          ),
        );
        const missing = criteria.filter(({ id }) => !covered.has(id));
        if (!categoryAssignments.length || missing.length) {
          coverageIssues.push(
            `${category.groupName} · ${category.name}: ${!categoryAssignments.length ? 'chưa có giám khảo' : `thiếu ${missing.map(({ code }) => code).join(', ')}`}`,
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
              status: { in: [ProductStatus.SUBMITTED, ProductStatus.SCORING] },
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
    }, { timeout: 15000, maxWait: 10000 });
  }

  listProducts(query: AdminProductQueryDto, canManage = true) {
    const where = this.adminProductWhere(query, canManage);
    const direction = query.sortDirection ?? 'desc';
    const orderBy: Prisma.ProductOrderByWithRelationInput[] =
      query.sortBy === 'name'
        ? [{ name: direction }, { id: direction }]
        : query.sortBy === 'finalScore'
          ? [{ finalScore: { sort: direction, nulls: 'last' } }, { id: direction }]
          : [{ submittedAt: { sort: direction, nulls: 'last' } }, { id: direction }];

    return this.prisma.$transaction(async (tx) => {
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
        data: rows.map(({ formData, ...row }) => ({
          ...row,
          formData: safeFormData(formData),
        })),
        total,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  findAdminProduct(id: string, canManage = true) {
    return this.prisma.product.findFirst({
      where: { id, ...(canManage ? {} : { status: { not: ProductStatus.DRAFT } }) },
      select: adminProductDetailSelect,
    }).then((product) => product && {
      ...product,
      formData: safeFormData(product.formData),
    });
  }

  findAdminAttachments(productId: string, canManage = true) {
    return this.prisma.product.findFirst({
      where: { id: productId, ...(canManage ? {} : { status: { not: ProductStatus.DRAFT } }) },
      select: {
        attachments: {
          select: { id: true, type: true, fileName: true, createdAt: true },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    }).then((product) => product?.attachments ?? null);
  }

  private adminProductWhere(query: AdminProductQueryDto, canManage: boolean): Prisma.ProductWhereInput {
    const conditions: Prisma.ProductWhereInput[] = [];
    if (!canManage) conditions.push({ status: { not: ProductStatus.DRAFT } });
    if (query.status) conditions.push({ status: query.status });
    if (query.groupId) conditions.push({ category: { is: { groupId: query.groupId } } });
    if (query.categoryId) conditions.push({ categoryId: query.categoryId });
    if (query.registrantId) conditions.push({ registrantId: query.registrantId });
    if (query.registrantQ) {
      conditions.push({ registrant: { is: { OR: [
        { fullName: { contains: query.registrantQ, mode: 'insensitive' } },
        { email: { contains: query.registrantQ, mode: 'insensitive' } },
      ] } } });
    }
    if (query.localityId) conditions.push({ localityId: query.localityId });
    else if (query.unmappedLocality) conditions.push({ localityId: null });
    if (query.registrationType) conditions.push({ formData: {
      path: ['registrationType'], equals: query.registrationType,
    } });
    if (query.assessmentYear !== undefined) conditions.push({ formData: {
      path: ['assessmentYear'], equals: query.assessmentYear,
    } });
    if (query.starRating) conditions.push({ status: ProductStatus.COMPLETED, starRating: query.starRating });
    if (query.from && query.toExclusive) {
      conditions.push({ [query.dateBasis]: {
        gte: new Date(query.from), lt: new Date(query.toExclusive),
      } });
    }
    if (query.q) conditions.push({ OR: [
      { name: { contains: query.q, mode: 'insensitive' } },
      { id: { contains: query.q, mode: 'insensitive' } },
      { formData: { path: ['entityName'], string_contains: query.q, mode: 'insensitive' } },
    ] });
    return { AND: conditions };
  }

  productResults(productId: string, canManage = true) {
    return this.prisma.product.findFirst({
      where: { id: productId, ...(canManage ? {} : { status: { not: ProductStatus.DRAFT } }) },
      select: {
        id: true, name: true, status: true, finalScore: true, starRating: true,
        category: { select: { id: true, name: true, groupName: true } },
        evaluations: {
          where: canManage ? {} : { status: EvaluationStatus.SUBMITTED },
          orderBy: [{ createdAt: 'asc' }, { judgeId: 'asc' }],
          include: {
            judge: { select: { id: true, fullName: true, email: true } },
            scores: {
              include: {
                subCriterion: { select: { id: true, code: true, criterion: { select: { id: true, code: true, name: true } } } },
                option: { select: { id: true, label: true, points: true } },
              },
              orderBy: { subCriterionId: 'asc' },
            },
          },
        },
      },
    });
  }

  async updateStaffAccess(id: string, input: UpdateStaffAccessDto, actorId: string, meta: AdminRequestMeta) {
    return this.prisma.$transaction(async (tx) => {
      await lockStaffMutation(tx);
      return applyStaffAccess(tx, id, input, actorId, meta);
    }, { timeout: 15000, maxWait: 10000 });
  }

  private audit(tx: Prisma.TransactionClient, input: AuditInput) {
    return writeAudit(tx, input);
  }
}
