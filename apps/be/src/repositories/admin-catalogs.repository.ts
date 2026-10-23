import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import type { AdminCategoryDetail, AdminCategoryRecord } from '@ocop/shared';
import type {
  AdminCategoriesQueryDto,
  CreateAdminCategoryDto,
  CreateProductGroupDto,
  ProductGroupsQueryDto,
  UpdateAdminCategoryDto,
  UpdateProductGroupDto,
} from '../dtos/admin-catalogs.dto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import type { RequestMeta } from '../types/auth';
import { assertCriteriaSetReady } from '../utils/category-availability';
import { writeAudit } from '../utils/audit-log';

const productGroupSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  order: true,
  isActive: true,
} satisfies Prisma.ProductGroupSelect;

const categoryFields = {
  id: true,
  groupId: true,
  groupCode: true,
  groupName: true,
  name: true,
  description: true,
  order: true,
  isActive: true,
  classificationGroup: true,
  classificationSubgroup: true,
} as const;

const criteriaSetSummary = {
  id: true,
  name: true,
  source: true,
  version: true,
  sourceHash: true,
  isActive: true,
  criteria: { select: { maxScore: true } },
  _count: { select: { criteria: true } },
} as const;

const adminCategorySelect = {
  ...categoryFields,
  criteriaSet: { select: criteriaSetSummary },
  _count: { select: { products: true } },
} satisfies Prisma.ProductCategorySelect;

const adminCategoryDetailSelect = {
  ...categoryFields,
  criteriaSet: {
    select: {
      ...criteriaSetSummary,
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
  _count: { select: { products: true } },
} satisfies Prisma.ProductCategorySelect;

const categoryMutationSelect = {
  ...categoryFields,
} satisfies Prisma.ProductCategorySelect;

const submittedStatuses: ProductStatus[] = [
  ProductStatus.SUBMITTED,
  ProductStatus.SCORING,
  ProductStatus.COMPLETED,
];

@Injectable()
export class AdminCatalogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listProductGroups(query: ProductGroupsQueryDto) {
    const { page, limit, q, isActive } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }
    const where: Prisma.ProductGroupWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
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
        this.prisma.productGroup.findMany({
          where,
          select: productGroupSelect,
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          skip,
          take: limit,
        }),
        this.prisma.productGroup.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data, total };
  }

  createProductGroup(
    input: CreateProductGroupDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...data } = input;
    return this.prisma.$transaction(async (tx) => {
      const group = await tx.productGroup.create({
        data,
        select: productGroupSelect,
      });
      await writeAudit(tx, {
        actorId,
        action: 'product_group.create',
        entityType: 'ProductGroup',
        entityId: group.id,
        afterData: group,
        reason,
        ...meta,
      });
      return group;
    });
  }

  updateProductGroup(
    id: string,
    input: UpdateProductGroupDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...changes } = input;
    return this.prisma.$transaction(
      async (tx) => {
        await this.lockGroups(tx, [id]);
        const before = await tx.productGroup.findUnique({
          where: { id },
          select: productGroupSelect,
        });
        if (!before) return null;
        const categoryIds = await tx.productCategory.findMany({
          where: { groupId: id },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        await this.lockCategories(
          tx,
          categoryIds.map(({ id: categoryId }) => categoryId),
        );
        const categories = await tx.productCategory.findMany({
          where: { groupId: id },
          select: { id: true },
          orderBy: { id: 'asc' },
        });
        const after = Object.keys(changes).length
          ? await tx.productGroup.update({
              where: { id },
              data: changes,
              select: productGroupSelect,
            })
          : before;
        if (after.name !== before.name && categories.length) {
          await tx.productCategory.updateMany({
            where: { groupId: id },
            data: { groupName: after.name },
          });
        }
        if (Object.keys(changes).length) {
          await writeAudit(tx, {
            actorId,
            action: 'product_group.update',
            entityType: 'ProductGroup',
            entityId: id,
            beforeData: before,
            afterData: after,
            reason,
            ...meta,
          });
        }
        return after;
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  async listCategories(query: AdminCategoriesQueryDto) {
    const { page, limit, q, groupId, isActive } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }
    const where: Prisma.ProductCategoryWhereInput = {
      ...(groupId ? { groupId } : {}),
      ...(isActive === undefined ? {} : { isActive }),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { groupCode: { contains: q, mode: 'insensitive' } },
              { groupName: { contains: q, mode: 'insensitive' } },
              { classificationGroup: { contains: q, mode: 'insensitive' } },
              { classificationSubgroup: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.productCategory.findMany({
          where,
          select: adminCategorySelect,
          orderBy: [{ order: 'asc' }, { id: 'asc' }],
          skip,
          take: limit,
        });
        const [total, submitted] = await Promise.all([
          tx.productCategory.count({ where }),
          tx.product.groupBy({
            by: ['categoryId'],
            where: {
              categoryId: { in: rows.map(({ id }) => id) },
              status: { in: submittedStatuses },
            },
            _count: { _all: true },
          }),
        ]);
        const submittedByCategory = new Map(
          submitted.map(({ categoryId, _count }) => [categoryId, _count._all]),
        );
        return {
          data: rows.map((row) =>
            this.categoryRecord(row, submittedByCategory.get(row.id) ?? 0),
          ),
          total,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async findCategory(id: string): Promise<AdminCategoryDetail | null> {
    const row = await this.prisma.productCategory.findUnique({
      where: { id },
      select: adminCategoryDetailSelect,
    });
    if (!row) return null;
    const submittedReferenceCount = await this.prisma.product.count({
      where: { categoryId: id, status: { in: submittedStatuses } },
    });
    const record = this.categoryRecord(row, submittedReferenceCount);
    const criteriaSet = row.criteriaSet;
    return {
      ...record,
      criteriaSet: criteriaSet
        ? {
            id: criteriaSet.id,
            name: criteriaSet.name,
            source: criteriaSet.source,
            version: criteriaSet.version,
            sourceHash: criteriaSet.sourceHash,
            isActive: criteriaSet.isActive,
            maxScore: criteriaSet.criteria.reduce<number>(
              (sum, criterion) => sum + criterion.maxScore,
              0,
            ),
            criterionCount: criteriaSet._count.criteria,
            criteria: criteriaSet.criteria,
          }
        : null,
    };
  }

  createCategory(
    input: CreateAdminCategoryDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, groupId, ...fields } = input;
    return this.prisma.$transaction(
      async (tx) => {
        await this.lockGroups(tx, [groupId]);
        const group = await tx.productGroup.findUnique({
          where: { id: groupId },
        });
        if (!group) return null;
        const category = await tx.productCategory.create({
          data: {
            ...fields,
            groupId,
            groupCode: group.code,
            groupName: group.name,
            isActive: false,
            order: input.order ?? 0,
            classificationSubgroup: input.classificationSubgroup ?? null,
            description: input.description ?? null,
          },
          select: adminCategorySelect,
        });
        const record = this.categoryRecord(category, 0);
        await writeAudit(tx, {
          actorId,
          action: 'product_category.create',
          entityType: 'ProductCategory',
          entityId: category.id,
          afterData: record,
          reason,
          ...meta,
        });
        return record;
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  updateCategory(
    id: string,
    input: UpdateAdminCategoryDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...requested } = input;
    return this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.productCategory.findUnique({
          where: { id },
          select: { groupId: true },
        });
        if (!initial) return null;
        const targetGroupId = requested.groupId ?? initial.groupId;
        const lockedGroupIds = [
          ...new Set([initial.groupId, targetGroupId]),
        ].sort();
        await this.lockGroups(tx, lockedGroupIds);
        await this.lockCategories(tx, [id]);
        const before = await tx.productCategory.findUnique({
          where: { id },
          select: categoryMutationSelect,
        });
        if (!before) return null;
        if (!lockedGroupIds.includes(before.groupId)) {
          throw new ConflictException(
            'Product category group changed while updating',
          );
        }
        const targetGroup = await tx.productGroup.findUnique({
          where: { id: targetGroupId },
        });
        if (!targetGroup) return null;
        if (requested.isActive === true) {
          if (!targetGroup.isActive) {
            throw new ConflictException('An active product group is required');
          }
          const currentSet = await tx.criteriaSet.findUnique({
            where: { categoryId: id },
            select: {
              isActive: true,
              criteria: {
                select: {
                  maxScore: true,
                  subCriteria: {
                    select: { options: { select: { id: true } } },
                  },
                },
              },
            },
          });
          assertCriteriaSetReady(currentSet);
        }
        if (targetGroupId !== before.groupId) {
          const submittedCount = await tx.product.count({
            where: { categoryId: id, status: { in: submittedStatuses } },
          });
          if (submittedCount) {
            throw new ConflictException(
              'A category with submitted products cannot move to another group',
            );
          }
        }
        const data: Prisma.ProductCategoryUncheckedUpdateInput = {
          ...(requested.name === undefined ? {} : { name: requested.name }),
          ...(requested.classificationGroup === undefined
            ? {}
            : { classificationGroup: requested.classificationGroup }),
          ...(requested.classificationSubgroup === undefined
            ? {}
            : { classificationSubgroup: requested.classificationSubgroup }),
          ...(requested.description === undefined
            ? {}
            : { description: requested.description }),
          ...(requested.order === undefined ? {} : { order: requested.order }),
          ...(requested.isActive === undefined
            ? {}
            : { isActive: requested.isActive }),
          ...(requested.groupId === undefined
            ? {}
            : {
                groupId: targetGroup.id,
                groupCode: targetGroup.code,
                groupName: targetGroup.name,
              }),
        };
        if (!Object.keys(data).length) {
          const row = await tx.productCategory.findUnique({
            where: { id },
            select: adminCategorySelect,
          });
          if (!row) return null;
          const submittedReferenceCount = await tx.product.count({
            where: { categoryId: id, status: { in: submittedStatuses } },
          });
          return this.categoryRecord(row, submittedReferenceCount);
        }
        const row = await tx.productCategory.update({
          where: { id },
          data,
          select: adminCategorySelect,
        });
        const submittedReferenceCount = await tx.product.count({
          where: { categoryId: id, status: { in: submittedStatuses } },
        });
        const after = this.categoryRecord(row, submittedReferenceCount);
        await writeAudit(tx, {
          actorId,
          action: 'product_category.update',
          entityType: 'ProductCategory',
          entityId: id,
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

  private categoryRecord<
    T extends Prisma.ProductCategoryGetPayload<{
      select: typeof adminCategorySelect;
    }>,
  >(row: T, submittedReferenceCount: number): AdminCategoryRecord {
    const { _count, criteriaSet, ...category } = row;
    return {
      ...category,
      referenceCount: _count.products,
      submittedReferenceCount,
      criteriaSet: criteriaSet
        ? {
            id: criteriaSet.id,
            name: criteriaSet.name,
            source: criteriaSet.source,
            version: criteriaSet.version,
            sourceHash: criteriaSet.sourceHash,
            isActive: criteriaSet.isActive,
            maxScore: criteriaSet.criteria.reduce(
              (sum, criterion) => sum + criterion.maxScore,
              0,
            ),
            criterionCount: criteriaSet._count.criteria,
          }
        : null,
    };
  }

  private async lockGroups(tx: Prisma.TransactionClient, ids: string[]) {
    const ordered = [...new Set(ids)].sort();
    if (!ordered.length) return;
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM ${databaseObject('product_groups')}
      WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE
    `);
  }

  private async lockCategories(tx: Prisma.TransactionClient, ids: string[]) {
    const ordered = [...new Set(ids)].sort();
    if (!ordered.length) return;
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM ${databaseObject('product_categories')}
      WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE
    `);
  }
}
