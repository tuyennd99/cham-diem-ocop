import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import type {
  AdminCategoryDetail,
  AdminCategoryRecord,
  LocalityQuery,
  LocalityRecord,
} from '@ocop/shared';
import type {
  AdminCategoriesQueryDto,
  CreateLocalityDto,
  CreateAdminCategoryDto,
  UpdateLocalityDto,
  UpdateAdminCategoryDto,
} from '../dtos/admin-catalogs.dto';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import type { RequestMeta } from '../types/auth';
import { assertCriteriaSetReady } from '../utils/category-availability';
import { writeAudit } from '../utils/audit-log';

const categoryFields = {
  id: true,
  name: true,
  description: true,
  order: true,
  isActive: true,
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

const localitySelect = {
  id: true,
  code: true,
  name: true,
  type: true,
  provinceName: true,
  effectiveFrom: true,
  effectiveTo: true,
  isActive: true,
} satisfies Prisma.LocalitySelect;

type LocalityRow = Prisma.LocalityGetPayload<{
  select: typeof localitySelect;
}>;

function localityRecord(row: LocalityRow): LocalityRecord {
  return {
    ...row,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
  };
}

function effectiveDate(value: string | null | undefined) {
  return value == null ? null : new Date(value);
}

function assertEffectiveRange(
  effectiveFrom: Date | null,
  effectiveTo: Date | null,
) {
  if (effectiveFrom && effectiveTo && effectiveTo <= effectiveFrom) {
    throw new BadRequestException(
      'effectiveTo must be later than effectiveFrom',
    );
  }
}

@Injectable()
export class AdminCatalogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listLocalities(query: LocalityQuery, publicOnly = false) {
    const { page, limit, q, type, provinceName } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }
    const now = new Date();
    const where: Prisma.LocalityWhereInput = {
      ...(type ? { type } : {}),
      ...(provinceName
        ? { provinceName: { contains: provinceName, mode: 'insensitive' } }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { provinceName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(publicOnly
        ? {
            isActive: true,
            AND: [
              {
                OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
              },
              {
                OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
              },
            ],
          }
        : query.isActive === undefined
          ? {}
          : { isActive: query.isActive }),
    };
    const [rows, total] = await this.prisma.$transaction(
      [
        this.prisma.locality.findMany({
          where,
          select: localitySelect,
          orderBy: [{ provinceName: 'asc' }, { name: 'asc' }, { id: 'asc' }],
          skip,
          take: limit,
        }),
        this.prisma.locality.count({ where }),
      ],
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    return { data: rows.map(localityRecord), total };
  }

  createLocality(input: CreateLocalityDto, actorId: string, meta: RequestMeta) {
    const { reason, effectiveFrom, effectiveTo, ...fields } = input;
    const from = effectiveDate(effectiveFrom);
    const to = effectiveDate(effectiveTo);
    assertEffectiveRange(from, to);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.locality.create({
        data: { ...fields, effectiveFrom: from, effectiveTo: to },
        select: localitySelect,
      });
      const record = localityRecord(row);
      await writeAudit(tx, {
        actorId,
        action: 'locality.create',
        entityType: 'Locality',
        entityId: row.id,
        afterData: record,
        reason,
        ...meta,
      });
      return record;
    });
  }

  updateLocality(
    id: string,
    input: UpdateLocalityDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, ...requested } = input;
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('localities')} WHERE "id" = ${id} FOR UPDATE`,
      );
      const before = await tx.locality.findUnique({
        where: { id },
        select: localitySelect,
      });
      if (!before) return null;

      const effectiveFrom =
        requested.effectiveFrom === undefined
          ? before.effectiveFrom
          : effectiveDate(requested.effectiveFrom);
      const effectiveTo =
        requested.effectiveTo === undefined
          ? before.effectiveTo
          : effectiveDate(requested.effectiveTo);
      assertEffectiveRange(effectiveFrom, effectiveTo);

      const data: Prisma.LocalityUpdateInput = {
        ...(requested.name === undefined || requested.name === before.name
          ? {}
          : { name: requested.name }),
        ...(requested.type === undefined || requested.type === before.type
          ? {}
          : { type: requested.type }),
        ...(requested.provinceName === undefined ||
        requested.provinceName === before.provinceName
          ? {}
          : { provinceName: requested.provinceName }),
        ...(requested.isActive === undefined ||
        requested.isActive === before.isActive
          ? {}
          : { isActive: requested.isActive }),
        ...(effectiveFrom?.getTime() === before.effectiveFrom?.getTime()
          ? {}
          : { effectiveFrom }),
        ...(effectiveTo?.getTime() === before.effectiveTo?.getTime()
          ? {}
          : { effectiveTo }),
      };
      if (!Object.keys(data).length) return localityRecord(before);

      const identityChanged =
        (requested.type !== undefined && requested.type !== before.type) ||
        (requested.provinceName !== undefined &&
          requested.provinceName !== before.provinceName);
      if (
        identityChanged &&
        (await tx.product.count({
          where: { localityId: id, status: { in: submittedStatuses } },
        }))
      ) {
        throw new ConflictException(
          'A locality referenced by submitted products cannot change type or province',
        );
      }

      const after = localityRecord(
        await tx.locality.update({
          where: { id },
          data,
          select: localitySelect,
        }),
      );
      await writeAudit(tx, {
        actorId,
        action: 'locality.update',
        entityType: 'Locality',
        entityId: id,
        beforeData: localityRecord(before),
        afterData: after,
        reason,
        ...meta,
      });
      return after;
    });
  }

  async listCategories(query: AdminCategoriesQueryDto) {
    const { page, limit, q, isActive } = query;
    const skip = (page - 1) * limit;
    if (!Number.isSafeInteger(page) || !Number.isSafeInteger(skip)) {
      throw new BadRequestException(
        'Pagination exceeds the safe integer range',
      );
    }
    const where: Prisma.ProductCategoryWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
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
    const { reason, ...fields } = input;
    return this.prisma.$transaction(
      async (tx) => {
        const category = await tx.productCategory.create({
          data: {
            ...fields,
            isActive: false,
            order: input.order ?? 0,
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
        await this.lockCategories(tx, [id]);
        const before = await tx.productCategory.findUnique({
          where: { id },
          select: categoryMutationSelect,
        });
        if (!before) return null;
        if (requested.isActive === true) {
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
        const data: Prisma.ProductCategoryUncheckedUpdateInput = {
          ...(requested.name === undefined ? {} : { name: requested.name }),
          ...(requested.description === undefined
            ? {}
            : { description: requested.description }),
          ...(requested.order === undefined ? {} : { order: requested.order }),
          ...(requested.isActive === undefined
            ? {}
            : { isActive: requested.isActive }),
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

  private async lockCategories(tx: Prisma.TransactionClient, ids: string[]) {
    const ordered = [...new Set(ids)].sort();
    if (!ordered.length) return;
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM ${databaseObject('product_categories')}
      WHERE "id" IN (${Prisma.join(ordered)}) ORDER BY "id" FOR UPDATE
    `);
  }
}
