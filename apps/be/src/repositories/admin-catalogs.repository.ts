import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import type {
  AdminCategoryDetail,
  AdminCategoryRecord,
  AdminCategorySortBy,
  LocalityQuery,
  LocalityRecord,
  LocalitySortBy,
} from '@ocop/shared';
import {
  ADMIN_CATEGORY_SORT_BY,
  LOCALITY_SORT_BY,
  SORT_DIRECTION,
} from '../constants/products';
import type {
  AdminCategoriesQueryDto,
  CreateLocalityDto,
  CreateAdminCategoryDto,
  UpdateLocalityDto,
  UpdateAdminCategoryDto,
} from '../dtos/admin-catalogs.dto';
import { computePaginationSkip } from '../dtos/common.dto';
import { type OrderByBuilder, resolveOrderBy } from '../prisma/order-by';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import type { RequestMeta } from '../types/auth';
import { assertCriteriaSetReady } from '../utils/category-availability';
import { writeAudit } from '../utils/audit-log';
import { generateNextLocalityCode } from '../utils/locality-code';

const LOCALITY_ORDER_BY: Record<
  LocalitySortBy,
  OrderByBuilder<Prisma.LocalityOrderByWithRelationInput>
> = {
  [LOCALITY_SORT_BY.CODE]: (dir = SORT_DIRECTION.ASC) => [
    { code: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [LOCALITY_SORT_BY.EVENT_NAME]: (dir = SORT_DIRECTION.ASC) => [
    { eventName: dir },
    { name: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [LOCALITY_SORT_BY.NAME]: (dir = SORT_DIRECTION.ASC) => [
    { name: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [LOCALITY_SORT_BY.PROVINCE_NAME]: (dir = SORT_DIRECTION.ASC) => [
    { provinceName: dir },
    { name: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
  [LOCALITY_SORT_BY.EFFECTIVE_RANGE]: (dir = SORT_DIRECTION.ASC) => [
    { effectiveFrom: { sort: dir, nulls: 'last' } },
    { effectiveTo: { sort: dir, nulls: 'last' } },
    { id: SORT_DIRECTION.ASC },
  ],
  [LOCALITY_SORT_BY.REGISTRATION_RANGE]: (dir = SORT_DIRECTION.ASC) => [
    { registrationFrom: { sort: dir, nulls: 'last' } },
    { registrationTo: { sort: dir, nulls: 'last' } },
    { id: SORT_DIRECTION.ASC },
  ],
  [LOCALITY_SORT_BY.IS_ACTIVE]: (dir = SORT_DIRECTION.ASC) => [
    { isActive: dir },
    { provinceName: SORT_DIRECTION.ASC },
    { name: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
};

const DEFAULT_LOCALITY_ORDER_BY: Prisma.LocalityOrderByWithRelationInput[] = [
  { provinceName: SORT_DIRECTION.ASC },
  { name: SORT_DIRECTION.ASC },
  { id: SORT_DIRECTION.ASC },
];

const ADMIN_CATEGORY_ORDER_BY: Record<
  AdminCategorySortBy,
  OrderByBuilder<Prisma.ProductCategoryOrderByWithRelationInput>
> = {
  [ADMIN_CATEGORY_SORT_BY.NAME]: (dir = SORT_DIRECTION.ASC) => [
    { name: dir },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_CATEGORY_SORT_BY.IS_ACTIVE]: (dir = SORT_DIRECTION.ASC) => [
    { isActive: dir },
    { order: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_CATEGORY_SORT_BY.REFERENCE_COUNT]: (dir = SORT_DIRECTION.ASC) => [
    { products: { _count: dir } },
    { order: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_CATEGORY_SORT_BY.CRITERIA_SET]: (dir = SORT_DIRECTION.ASC) => [
    { criteriaSet: { criteria: { _count: dir } } },
    { order: SORT_DIRECTION.ASC },
    { id: SORT_DIRECTION.ASC },
  ],
  [ADMIN_CATEGORY_SORT_BY.ORDER]: (dir = SORT_DIRECTION.ASC) => [
    { order: dir },
    { id: SORT_DIRECTION.ASC },
  ],
};

const DEFAULT_ADMIN_CATEGORY_ORDER_BY: Prisma.ProductCategoryOrderByWithRelationInput[] =
  [{ order: SORT_DIRECTION.ASC }, { id: SORT_DIRECTION.ASC }];

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

const agencyLinkSelect = {
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
} satisfies Prisma.ProductCategory$agencyLinksArgs;

const adminCategorySelect = {
  ...categoryFields,
  agencyLinks: agencyLinkSelect,
  criteriaSet: { select: criteriaSetSummary },
  _count: { select: { products: true } },
} satisfies Prisma.ProductCategorySelect;

const adminCategoryDetailSelect = {
  ...categoryFields,
  agencyLinks: agencyLinkSelect,
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
  agencyLinks: agencyLinkSelect,
} satisfies Prisma.ProductCategorySelect;

const submittedStatuses: ProductStatus[] = [
  ProductStatus.SUBMITTED,
  ProductStatus.RETURNED,
  ProductStatus.APPROVED,
  ProductStatus.SCORING,
  ProductStatus.COMPLETED,
];

const localitySelect = {
  id: true,
  code: true,
  eventName: true,
  name: true,
  provinceName: true,
  effectiveFrom: true,
  effectiveTo: true,
  registrationFrom: true,
  registrationTo: true,
  isActive: true,
} satisfies Prisma.LocalitySelect;

type LocalityRow = Prisma.LocalityGetPayload<{
  select: typeof localitySelect;
}>;

function localityRecord(row: LocalityRow): LocalityRecord {
  return {
    ...row,
    eventName: row.eventName || row.name,
    effectiveFrom: row.effectiveFrom?.toISOString() ?? null,
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    registrationFrom: row.registrationFrom?.toISOString() ?? null,
    registrationTo: row.registrationTo?.toISOString() ?? null,
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

function assertRegistrationRange(
  effectiveFrom: Date | null,
  effectiveTo: Date | null,
  registrationFrom: Date | null,
  registrationTo: Date | null,
) {
  if (
    registrationFrom &&
    registrationTo &&
    registrationTo <= registrationFrom
  ) {
    throw new BadRequestException(
      'registrationTo must be later than registrationFrom',
    );
  }
  if (registrationFrom && effectiveFrom && registrationFrom < effectiveFrom) {
    throw new BadRequestException(
      'Thời gian mở đăng ký không được trước thời gian bắt đầu sự kiện.',
    );
  }
  if (registrationTo && effectiveTo && registrationTo > effectiveTo) {
    throw new BadRequestException(
      'Thời gian mở đăng ký không được vượt quá thời gian kết thúc sự kiện.',
    );
  }
  if (registrationFrom && effectiveTo && registrationFrom >= effectiveTo) {
    throw new BadRequestException(
      'Thời gian mở đăng ký phải nằm trong thời gian sự kiện.',
    );
  }
  if (registrationTo && effectiveFrom && registrationTo <= effectiveFrom) {
    throw new BadRequestException(
      'Thời gian mở đăng ký phải nằm trong thời gian sự kiện.',
    );
  }
}

async function assertNoOverlappingEvent(
  tx: Prisma.TransactionClient,
  input: {
    excludeId?: string;
    provinceName: string;
    name: string;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  },
) {
  const siblings = await tx.locality.findMany({
    where: {
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      provinceName: { equals: input.provinceName, mode: 'insensitive' },
      name: { equals: input.name, mode: 'insensitive' },
    },
    select: {
      id: true,
      code: true,
      eventName: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
  });

  if (!input.effectiveFrom && !input.effectiveTo) {
    const duplicateDateless = siblings.find(
      (sibling) => !sibling.effectiveFrom && !sibling.effectiveTo,
    );
    if (duplicateDateless) {
      throw new ConflictException(
        `Đã tồn tại bản ghi địa bàn nền cho ${input.name} (${input.provinceName}).`,
      );
    }
    return;
  }

  const newStart = input.effectiveFrom
    ? input.effectiveFrom.getTime()
    : Number.NEGATIVE_INFINITY;
  const newEnd = input.effectiveTo
    ? input.effectiveTo.getTime()
    : Number.POSITIVE_INFINITY;

  for (const sibling of siblings) {
    if (!sibling.effectiveFrom && !sibling.effectiveTo) {
      continue;
    }
    const existStart = sibling.effectiveFrom
      ? sibling.effectiveFrom.getTime()
      : Number.NEGATIVE_INFINITY;
    const existEnd = sibling.effectiveTo
      ? sibling.effectiveTo.getTime()
      : Number.POSITIVE_INFINITY;

    if (existStart < newEnd && newStart < existEnd) {
      throw new ConflictException(
        `Thời gian sự kiện của ${input.name} (${input.provinceName}) bị trùng với sự kiện ${sibling.code}${sibling.eventName ? ` - ${sibling.eventName}` : ''}.`,
      );
    }
  }
}

@Injectable()
export class AdminCatalogsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listManagingAgencies() {
    return this.prisma.managingAgency.findMany({
      where: { isActive: true },
      orderBy: [{ order: 'asc' }, { code: 'asc' }],
    });
  }

  async listLocalities(query: LocalityQuery, publicOnly = false) {
    const {
      page = 1,
      limit = 20,
      q,
      provinceName,
      sortBy,
      sortDirection,
    } = query;
    const skip = computePaginationSkip(page, limit);
    const where: Prisma.LocalityWhereInput = {
      ...(provinceName
        ? { provinceName: { contains: provinceName, mode: 'insensitive' } }
        : {}),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { eventName: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { provinceName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(publicOnly
        ? {
            isActive: true,
          }
        : query.isActive === undefined
          ? {}
          : { isActive: query.isActive }),
    };
    const orderBy = resolveOrderBy(
      sortBy,
      sortDirection,
      LOCALITY_ORDER_BY,
      DEFAULT_LOCALITY_ORDER_BY,
    );
    const [rows, total] = await this.prisma.$transaction(
      [
        this.prisma.locality.findMany({
          where,
          select: localitySelect,
          orderBy,
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
    const {
      reason,
      code: requestedCode,
      eventName: requestedEventName,
      effectiveFrom,
      effectiveTo,
      registrationFrom,
      registrationTo,
      ...fields
    } = input;
    const from = effectiveDate(effectiveFrom);
    const to = effectiveDate(effectiveTo);
    const regFrom = effectiveDate(registrationFrom);
    const regTo = effectiveDate(registrationTo);
    assertEffectiveRange(from, to);
    assertRegistrationRange(from, to, regFrom, regTo);
    const resolvedEventName = requestedEventName?.trim() || fields.name;
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('locality_create_and_schedule_lock'))`;
      await assertNoOverlappingEvent(tx, {
        provinceName: fields.provinceName,
        name: fields.name,
        effectiveFrom: from,
        effectiveTo: to,
      });
      const code =
        requestedCode?.trim() || (await generateNextLocalityCode(tx));
      const row = await tx.locality.create({
        data: {
          ...fields,
          code,
          eventName: resolvedEventName,
          effectiveFrom: from,
          effectiveTo: to,
          registrationFrom: regFrom,
          registrationTo: regTo,
        },
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
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('locality_create_and_schedule_lock'))`;
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
      if (
        (before.effectiveFrom !== null && effectiveFrom === null) ||
        (before.effectiveTo !== null && effectiveTo === null)
      ) {
        throw new BadRequestException(
          'Thời gian sự kiện là bắt buộc và không thể xóa trống.',
        );
      }
      const registrationFrom =
        requested.registrationFrom === undefined
          ? before.registrationFrom
          : effectiveDate(requested.registrationFrom);
      const registrationTo =
        requested.registrationTo === undefined
          ? before.registrationTo
          : effectiveDate(requested.registrationTo);
      assertEffectiveRange(effectiveFrom, effectiveTo);
      assertRegistrationRange(
        effectiveFrom,
        effectiveTo,
        registrationFrom,
        registrationTo,
      );

      const nextName = requested.name ?? before.name;
      const nextProvinceName = requested.provinceName ?? before.provinceName;
      const scheduleOrPlaceChanged =
        nextName !== before.name ||
        nextProvinceName !== before.provinceName ||
        effectiveFrom?.getTime() !== before.effectiveFrom?.getTime() ||
        effectiveTo?.getTime() !== before.effectiveTo?.getTime();
      if (scheduleOrPlaceChanged) {
        await assertNoOverlappingEvent(tx, {
          excludeId: id,
          provinceName: nextProvinceName,
          name: nextName,
          effectiveFrom,
          effectiveTo,
        });
      }

      const data: Prisma.LocalityUpdateInput = {
        ...(requested.eventName === undefined ||
        requested.eventName === before.eventName
          ? {}
          : { eventName: requested.eventName }),
        ...(requested.name === undefined || requested.name === before.name
          ? {}
          : { name: requested.name }),
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
        ...(registrationFrom?.getTime() === before.registrationFrom?.getTime()
          ? {}
          : { registrationFrom }),
        ...(registrationTo?.getTime() === before.registrationTo?.getTime()
          ? {}
          : { registrationTo }),
      };
      if (!Object.keys(data).length) return localityRecord(before);

      const identityChanged =
        requested.provinceName !== undefined &&
        requested.provinceName !== before.provinceName;
      if (
        identityChanged &&
        (await tx.product.count({
          where: { localityId: id, status: { in: submittedStatuses } },
        }))
      ) {
        throw new ConflictException(
          'A locality referenced by submitted products cannot change province',
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
    const {
      page,
      limit,
      q,
      isActive,
      managingAgencyId,
      sortBy,
      sortDirection,
    } = query;
    const skip = computePaginationSkip(page, limit);
    const where: Prisma.ProductCategoryWhereInput = {
      ...(isActive === undefined ? {} : { isActive }),
      ...(managingAgencyId
        ? { agencyLinks: { some: { agencyId: managingAgencyId } } }
        : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const orderBy = resolveOrderBy(
      sortBy,
      sortDirection,
      ADMIN_CATEGORY_ORDER_BY,
      DEFAULT_ADMIN_CATEGORY_ORDER_BY,
    );
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.productCategory.findMany({
          where,
          select: adminCategorySelect,
          orderBy,
          skip,
          take: limit,
        });
        const total = await tx.productCategory.count({ where });
        const submitted = rows.length
          ? await tx.product.groupBy({
              by: ['categoryId'],
              where: {
                categoryId: { in: rows.map(({ id }) => id) },
                status: { in: submittedStatuses },
              },
              _count: { _all: true },
            })
          : [];
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

  private async validateAgencyIds(
    tx: Prisma.TransactionClient,
    managingAgencyIds: string[] | undefined,
  ) {
    if (!managingAgencyIds || !managingAgencyIds.length) return [];
    const unique = [...new Set(managingAgencyIds)];
    const found = await tx.managingAgency.findMany({
      where: { id: { in: unique }, isActive: true },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw new BadRequestException('Invalid managing agency ID');
    }
    return unique;
  }

  createCategory(
    input: CreateAdminCategoryDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, managingAgencyIds, ...fields } = input;
    return this.prisma.$transaction(
      async (tx) => {
        const validAgencyIds = await this.validateAgencyIds(
          tx,
          managingAgencyIds,
        );
        const category = await tx.productCategory.create({
          data: {
            ...fields,
            isActive: false,
            order: input.order ?? 0,
            description: input.description ?? null,
            ...(validAgencyIds.length
              ? {
                  agencyLinks: {
                    create: validAgencyIds.map((agencyId) => ({ agencyId })),
                  },
                }
              : {}),
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

  private async assertCategoryReadyForActivation(
    tx: Prisma.TransactionClient,
    categoryId: string,
  ) {
    const currentSet = await tx.criteriaSet.findUnique({
      where: { categoryId },
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

  private async resolveCategoryAgencySync(
    tx: Prisma.TransactionClient,
    beforeAgencyIds: string[],
    managingAgencyIds: string[] | undefined,
  ): Promise<{ validAgencyIds?: string[]; agenciesChanged: boolean }> {
    if (managingAgencyIds === undefined) {
      return { agenciesChanged: false };
    }
    const validAgencyIds = await this.validateAgencyIds(tx, managingAgencyIds);
    const prevSorted = [...beforeAgencyIds].sort();
    const nextSorted = [...validAgencyIds].sort();
    const agenciesChanged =
      prevSorted.length !== nextSorted.length ||
      prevSorted.some((agencyId, idx) => agencyId !== nextSorted[idx]);
    return { validAgencyIds, agenciesChanged };
  }

  private async replaceCategoryAgencies(
    tx: Prisma.TransactionClient,
    categoryId: string,
    validAgencyIds: string[],
  ) {
    await tx.productCategoryAgency.deleteMany({
      where: { categoryId },
    });
    if (!validAgencyIds.length) return;
    await tx.productCategoryAgency.createMany({
      data: validAgencyIds.map((agencyId) => ({
        categoryId,
        agencyId,
      })),
    });
  }

  updateCategory(
    id: string,
    input: UpdateAdminCategoryDto,
    actorId: string,
    meta: RequestMeta,
  ) {
    const { reason, managingAgencyIds, ...requested } = input;
    return this.prisma.$transaction(
      async (tx) => {
        await this.lockCategories(tx, [id]);
        const before = await tx.productCategory.findUnique({
          where: { id },
          select: categoryMutationSelect,
        });
        if (!before) return null;
        if (requested.isActive === true) {
          await this.assertCategoryReadyForActivation(tx, id);
        }

        const { validAgencyIds, agenciesChanged } =
          await this.resolveCategoryAgencySync(
            tx,
            before.agencyLinks.map((l) => l.agency.id),
            managingAgencyIds,
          );

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
        if (!Object.keys(data).length && !agenciesChanged) {
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

        if (agenciesChanged && validAgencyIds !== undefined) {
          await this.replaceCategoryAgencies(tx, id, validAgencyIds);
        }

        const row = Object.keys(data).length
          ? await tx.productCategory.update({
              where: { id },
              data,
              select: adminCategorySelect,
            })
          : await tx.productCategory.findUniqueOrThrow({
              where: { id },
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
          beforeData: {
            ...before,
            managingAgencies: before.agencyLinks.map((l) => l.agency),
          },
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
    const { _count, criteriaSet, agencyLinks, ...category } = row;
    return {
      ...category,
      referenceCount: _count.products,
      submittedReferenceCount,
      managingAgencies: agencyLinks.map((l) => l.agency),
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
