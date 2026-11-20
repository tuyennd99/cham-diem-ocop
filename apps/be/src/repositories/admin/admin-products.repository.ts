import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  EvaluationStatus,
  Prisma,
  ProductPublicationState,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import type {
  ManagingAgencySummary,
  ProductAgencyCoverageItem,
  ProductJudgeAssignmentRecord,
  ProductSortBy,
} from '@ocop/shared';
import {
  PRODUCT_RESULT_HISTORY_ACTION,
  PRODUCT_SORT_BY,
  SORT_DIRECTION,
} from '../../constants/products';
import type { AdminProductQueryDto } from '../../dtos/admin-products.dto';
import { type OrderByBuilder, resolveOrderBy } from '../../prisma/order-by';
import { PrismaService } from '../../prisma/prisma.service';
import { databaseObject } from '../../prisma/sql';
import { lockEvaluationCategory } from '../../utils/evaluation-result';
import {
  findProductIdsMatchingCodeQuery,
  withProductCode,
} from '../../utils/product-code';
import { extractSafeApplicationForm } from '../../utils/registration-snapshot';
import { writeAudit, type AuditInput } from '../../utils/audit-log';
import { recordProductStatusEvent } from '../../utils/product-status';
import {
  adminProductDetailSelect,
  adminProductSelect,
  parseSnapshotAgencies,
  type AdminRequestMeta,
} from './admin-shared';

const ADMIN_PRODUCT_ORDER_BY: Record<
  ProductSortBy,
  OrderByBuilder<Prisma.ProductOrderByWithRelationInput>
> = {
  [PRODUCT_SORT_BY.NAME]: (dir = SORT_DIRECTION.DESC) => [
    { name: dir },
    { id: dir },
  ],
  [PRODUCT_SORT_BY.FINAL_SCORE]: (dir = SORT_DIRECTION.DESC) => [
    { finalScore: { sort: dir, nulls: 'last' } },
    { id: dir },
  ],
  [PRODUCT_SORT_BY.SUBMITTED_AT]: (dir = SORT_DIRECTION.DESC) => [
    { submittedAt: { sort: dir, nulls: 'last' } },
    { id: dir },
  ],
};

@Injectable()
export class AdminProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  listProducts(query: AdminProductQueryDto, canManage = true) {
    const orderBy = resolveOrderBy(
      query.sortBy,
      query.sortDirection ?? SORT_DIRECTION.DESC,
      ADMIN_PRODUCT_ORDER_BY,
      ADMIN_PRODUCT_ORDER_BY[PRODUCT_SORT_BY.SUBMITTED_AT],
    );

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
        const rows = await tx.product.findMany({
          where,
          select: adminProductSelect,
          orderBy,
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        const total = await tx.product.count({ where });
        return {
          data: rows.map(({ formData, ...row }) =>
            withProductCode({
              ...row,
              formData: extractSafeApplicationForm(formData),
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

    const evalByJudge = new Map(product.evaluations.map((e) => [e.judgeId, e]));

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
          organizationUnitName: pa.judge.organizationUnit?.name ?? null,
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
      formData: extractSafeApplicationForm(product.formData),
      judgeAssignments,
      agencyCoverage,
      missingAgencyNames,
      resultHistory: resultHistory.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  }

  async findAdminAttachments(productId: string, canManage = true) {
    const product = await this.prisma.product.findFirst({
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
    });
    return product?.attachments ?? null;
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
        if (product.categoryId !== initial.categoryId) {
          throw new ConflictException(
            'Product category changed while approving',
          );
        }
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
            requiredAgencySnapshot: requiredAgencies,
          },
        });

        if (eligibleJudges.length > 0) {
          const existingAssignments = await tx.productJudgeAssignment.findMany({
            where: {
              productId,
              judgeId: { in: eligibleJudges.map((judge) => judge.id) },
            },
            select: { judgeId: true },
          });
          const existingJudgeIds = new Set(
            existingAssignments.map((item) => item.judgeId),
          );
          const toCreate: Prisma.ProductJudgeAssignmentCreateManyInput[] = [];
          const reactivateByUnit = new Map<
            string,
            {
              managingAgencyId: string | null;
              organizationUnitId: string | null;
              judgeIds: string[];
            }
          >();
          for (const judge of eligibleJudges) {
            const unit = judge.organizationUnit;
            const managingAgencyId = unit?.managingAgencyId ?? null;
            const organizationUnitId = unit?.id ?? null;
            if (!existingJudgeIds.has(judge.id)) {
              toCreate.push({
                productId,
                judgeId: judge.id,
                managingAgencyId,
                organizationUnitId,
                isManual: false,
                isActive: true,
                mustSubmitToComplete: false,
                assignedById: actorId,
                assignedAt: approvedAt,
              });
            } else {
              const key = `${managingAgencyId ?? ''}|${organizationUnitId ?? ''}`;
              const group = reactivateByUnit.get(key) ?? {
                managingAgencyId,
                organizationUnitId,
                judgeIds: [],
              };
              group.judgeIds.push(judge.id);
              reactivateByUnit.set(key, group);
            }
          }
          if (toCreate.length > 0) {
            await tx.productJudgeAssignment.createMany({ data: toCreate });
          }
          for (const group of reactivateByUnit.values()) {
            await tx.productJudgeAssignment.updateMany({
              where: {
                productId,
                judgeId: { in: group.judgeIds },
              },
              data: {
                managingAgencyId: group.managingAgencyId,
                organizationUnitId: group.organizationUnitId,
                isActive: true,
                removedAt: null,
                removedById: null,
                removeReason: null,
              },
            });
          }
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

        const product = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            categoryId: true,
            status: true,
            finalScore: true,
            starRating: true,
            publicationState: true,
          },
        });
        if (!product) throw new NotFoundException('Product not found');
        if (product.categoryId !== initial.categoryId) {
          throw new ConflictException(
            'Product category changed while reopening',
          );
        }
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

  async productResults(productId: string, canManage = true) {
    const product = await this.prisma.product.findFirst({
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
                  in: [EvaluationStatus.SUBMITTED, EvaluationStatus.EXCLUDED],
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
    });
    return product && withProductCode(product);
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
              {
                fullName: { contains: query.registrantQ, mode: 'insensitive' },
              },
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

  private audit(tx: Prisma.TransactionClient, input: AuditInput) {
    return writeAudit(tx, input);
  }
}
