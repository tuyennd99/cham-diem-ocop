import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentType,
  Prisma,
  ProductPublicationState,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import {
  formatProductCode,
  isSeoEligibleProduct,
  SEO_ELIGIBLE_PRODUCT_STATUSES,
} from '@ocop/shared';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import { lockEvaluationCategory } from '../utils/evaluation-result';
import {
  MAX_ATTACHMENTS_PER_PRODUCT,
  MAX_FILES_PER_PRODUCT,
  MAX_VIDEOS_PER_PRODUCT,
  PRODUCT_MUTATION_ACTOR_KIND,
} from '../constants/products';
import { isVideoAttachmentName } from '../utils/product-files';
import {
  findProductIdsMatchingCodeQuery,
  withProductCode,
} from '../utils/product-code';
import { recordProductStatusEvent } from '../utils/product-status';
import { assertCriteriaSetReady } from '../utils/category-availability';
import { writeAudit } from '../utils/audit-log';
import {
  buildRegistrationSnapshot,
  mergeProductApplicationFormData,
  validateProductDraftWrite,
} from '../utils/registration-snapshot';
import type { ProductMutationActor } from '../types/product-mutation';

const editableStatuses: ProductStatus[] = [
  ProductStatus.DRAFT,
  ProductStatus.RETURNED,
];

export { isSeoEligibleProduct, SEO_ELIGIBLE_PRODUCT_STATUSES };

const publicProductSelect = {
  id: true,
  codeNumber: true,
  name: true,
  description: true,
  status: true,
  approvedAt: true,
  publicationState: true,
  publishedAt: true,
  finalScore: true,
  starRating: true,
  createdAt: true,
  category: {
    select: { id: true, name: true },
  },
  attachments: {
    where: { type: AttachmentType.IMAGE },
    select: { id: true, fileName: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProductSelect;

const registrantProductInclude = {
  locality: true,
  category: {
    select: {
      id: true,
      name: true,
      isActive: true,
      criteriaSet: { select: { isActive: true } },
    },
  },
  attachments: {
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

type ProductDraftCreate = {
  registrantId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  formData: Prisma.InputJsonValue;
  localityId?: string | null;
};

type ProductDraftChanges = {
  categoryId?: string;
  name?: string;
  description?: string | null;
  formData?: Prisma.InputJsonValue;
  localityId?: string | null;
};

function sanitizePublicProductResult<
  T extends {
    codeNumber?: number | null;
    code?: string;
    publicationState?: ProductPublicationState;
    finalScore?: number | null;
    starRating?: number | null;
  },
>(product: T): T {
  const isPublished =
    product.publicationState === ProductPublicationState.PUBLISHED;
  const next = withProductCode({ ...product });
  if ('finalScore' in product) {
    next.finalScore = isPublished ? (product.finalScore ?? null) : null;
  }
  if ('starRating' in product) {
    next.starRating = isPublished ? (product.starRating ?? null) : null;
  }
  return next;
}

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  categoryExists(id: string) {
    return this.prisma.productCategory
      .count({ where: { id } })
      .then((count) => count > 0);
  }

  listCategories() {
    return this.prisma.productCategory
      .findMany({
        where: {
          isActive: true,
          criteriaSet: { is: { isActive: true } },
        },
        select: {
          id: true,
          name: true,
          description: true,
          criteriaSet: {
            select: {
              isActive: true,
              name: true,
              source: true,
              criteria: {
                orderBy: { order: 'asc' },
                select: {
                  id: true,
                  code: true,
                  name: true,
                  maxScore: true,
                  order: true,
                  subCriteria: {
                    orderBy: { order: 'asc' },
                    select: {
                      id: true,
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
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      })
      .then((categories) =>
        categories.flatMap(({ criteriaSet, ...category }) => {
          if (!criteriaSet) return [];
          try {
            assertCriteriaSetReady(criteriaSet);
          } catch {
            return [];
          }
          return [
            {
              ...category,
              criteriaSet: {
                name: criteriaSet.name,
                source: criteriaSet.source,
                criteria: criteriaSet.criteria,
              },
            },
          ];
        }),
      );
  }

  async listPublic(input: {
    page: number;
    limit: number;
    categoryId?: string;
    query?: string;
    approvedOnly?: boolean;
  }) {
    const baseWhere: Prisma.ProductWhereInput = {
      ...(input.approvedOnly
        ? {
            approvedAt: { not: null },
            status: { in: [...SEO_ELIGIBLE_PRODUCT_STATUSES] },
          }
        : {
            status: {
              in: [
                ProductStatus.SUBMITTED,
                ProductStatus.APPROVED,
                ProductStatus.SCORING,
                ProductStatus.COMPLETED,
              ],
            },
          }),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    };
    const codeMatchIds = input.query
      ? await findProductIdsMatchingCodeQuery(
          this.prisma,
          input.query,
          baseWhere,
        )
      : [];
    const where: Prisma.ProductWhereInput = {
      ...baseWhere,
      ...(input.query
        ? {
            OR: [
              { name: { contains: input.query, mode: 'insensitive' } },
              { id: { contains: input.query, mode: 'insensitive' } },
              ...(codeMatchIds.length ? [{ id: { in: codeMatchIds } }] : []),
              {
                category: {
                  name: { contains: input.query, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: publicProductSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.product.count({ where }),
    ]);
    return {
      data: rows.map(sanitizePublicProductResult),
      total,
    };
  }

  findPublicById(id: string) {
    return this.prisma.product
      .findFirst({
        where: {
          id,
          status: {
            in: [
              ProductStatus.SUBMITTED,
              ProductStatus.APPROVED,
              ProductStatus.SCORING,
              ProductStatus.COMPLETED,
            ],
          },
        },
        select: publicProductSelect,
      })
      .then((product) => product && sanitizePublicProductResult(product));
  }

  listMine(registrantId: string) {
    return this.prisma.product
      .findMany({
        where: { registrantId },
        include: registrantProductInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      })
      .then((rows) => rows.map(sanitizePublicProductResult));
  }

  findMine(id: string, registrantId: string) {
    return this.prisma.product
      .findFirst({
        where: { id, registrantId },
        include: registrantProductInclude,
      })
      .then((product) => product && sanitizePublicProductResult(product));
  }

  findForMutation(id: string, actor: ProductMutationActor) {
    return this.prisma.product.findFirst({
      where: { ...this.actorWhere(actor), id },
      include: registrantProductInclude,
    });
  }

  create(input: ProductDraftCreate, actor: ProductMutationActor) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockCategoryRows(tx, [input.categoryId]);
      await this.assertActiveCategory(tx, input.categoryId);
      const registrantId =
        actor.kind === PRODUCT_MUTATION_ACTOR_KIND.OWNER
          ? actor.id
          : input.registrantId;
      if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${registrantId} FOR UPDATE`,
        );
        const registrant = await tx.user.findUnique({
          where: { id: registrantId },
          select: {
            role: true,
            roles: true,
            staffPermissions: true,
            verified: true,
            isActive: true,
          },
        });
        const hasRegistrantRole =
          registrant &&
          registrant.role !== Role.JUDGE &&
          !registrant.staffPermissions?.includes(StaffPermission.SCORE) &&
          (registrant.role === Role.REGISTRANT ||
            Boolean(registrant.roles?.includes(Role.REGISTRANT)));
        if (
          !registrant ||
          !hasRegistrantRole ||
          !registrant.verified ||
          !registrant.isActive
        ) {
          throw new NotFoundException('Active verified registrant not found');
        }
      }
      const validated = validateProductDraftWrite({
        name: input.name,
        categoryId: input.categoryId,
        localityId: input.localityId,
        formData: input.formData,
      });
      const resolvedLocality = await this.resolveOrCreateLocality(
        tx,
        input.localityId,
        validated.formData,
      );
      if (!resolvedLocality) {
        throw new BadRequestException(
          'Không thể lưu hồ sơ: thiếu địa bàn hành chính (xã/phường).',
        );
      }
      const created = await tx.product.create({
        data: {
          registrantId,
          categoryId: validated.categoryId,
          name: validated.name,
          description: input.description,
          formData: validated.formData as unknown as Prisma.InputJsonValue,
          localityId: resolvedLocality.id,
          createdById: actor.id,
        },
        include: registrantProductInclude,
      });
      await recordProductStatusEvent(
        tx,
        created.id,
        null,
        ProductStatus.DRAFT,
        actor.id,
        created.createdAt,
        actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER
          ? actor.reason
          : undefined,
      );
      if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: 'product.create_on_behalf',
          entityType: 'Product',
          entityId: created.id,
          afterData: this.auditProduct(created),
          reason: actor.reason,
          ...actor.meta,
        });
      }
      return sanitizePublicProductResult(created);
    }, { timeout: 15000, maxWait: 10000 });
  }

  async updateDraft(
    id: string,
    actor: ProductMutationActor,
    input: ProductDraftChanges,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({
        where: {
          ...this.actorWhere(actor),
          id,
          status: { in: editableStatuses },
        },
        select: { categoryId: true },
      });
      if (!initial) return null;
      const categoryIds = [
        ...new Set(
          [initial.categoryId, input.categoryId].filter(
            (value): value is string => Boolean(value),
          ),
        ),
      ].sort();
      await this.lockCategoryRows(tx, categoryIds);
      await this.lockProduct(tx, id);
      const current = await tx.product.findFirst({
        where: {
          ...this.actorWhere(actor),
          id,
          status: { in: editableStatuses },
        },
        select: {
          id: true,
          createdById: true,
          registrantId: true,
          categoryId: true,
          localityId: true,
          name: true,
          description: true,
          status: true,
          formData: true,
        },
      });
      if (!current) return null;
      if (current.categoryId !== initial.categoryId)
        throw new ConflictException(
          'Product category changed while updating draft',
        );
      if (
        input.categoryId !== undefined &&
        input.categoryId !== current.categoryId
      )
        await this.assertActiveCategory(tx, input.categoryId);

      const mergedLocalityId =
        input.localityId !== undefined ? input.localityId : current.localityId;
      const mergedFormData = mergeProductApplicationFormData(
        current.formData,
        input.formData,
      );
      const validated = validateProductDraftWrite({
        name: input.name !== undefined ? input.name : current.name,
        categoryId:
          input.categoryId !== undefined
            ? input.categoryId
            : current.categoryId,
        localityId: mergedLocalityId,
        formData: mergedFormData,
      });

      const nextData: ProductDraftChanges = { ...input };
      if (input.name !== undefined) nextData.name = validated.name;
      if (input.categoryId !== undefined)
        nextData.categoryId = validated.categoryId;
      if (input.formData !== undefined) {
        nextData.formData =
          validated.formData as unknown as Prisma.InputJsonValue;
      }
      if (input.localityId !== undefined || input.formData !== undefined) {
        const resolvedLocality = await this.resolveOrCreateLocality(
          tx,
          mergedLocalityId,
          validated.formData,
        );
        if (!resolvedLocality) {
          throw new BadRequestException(
            'Không thể lưu hồ sơ: thiếu địa bàn hành chính (xã/phường).',
          );
        }
        nextData.localityId = resolvedLocality.id;
      }

      const hasChanges = Object.entries(nextData).some(
        ([key, value]) =>
          JSON.stringify(current[key as keyof typeof current]) !==
          JSON.stringify(value),
      );
      if (!hasChanges) {
        const product = await tx.product.findUniqueOrThrow({
          where: { id },
          include: registrantProductInclude,
        });
        if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
          await writeAudit(tx, {
            actorId: actor.id,
            action: 'product.update_on_behalf',
            entityType: 'Product',
            entityId: id,
            beforeData: this.auditProduct(current),
            afterData: this.auditProduct(product),
            reason: actor.reason,
            ...actor.meta,
          });
        }
        return sanitizePublicProductResult(product);
      }
      const updated = await tx.product.updateMany({
        where: {
          ...this.actorWhere(actor),
          id,
          status: { in: editableStatuses },
        },
        data: nextData,
      });
      if (!updated.count) return null;
      const product = await tx.product.findUniqueOrThrow({
        where: { id },
        include: registrantProductInclude,
      });
      if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: 'product.update_on_behalf',
          entityType: 'Product',
          entityId: id,
          beforeData: this.auditProduct(current),
          afterData: this.auditProduct(product),
          reason: actor.reason,
          ...actor.meta,
        });
      }
      return sanitizePublicProductResult(product);
    });
  }

  async deleteDraft(id: string, actor: ProductMutationActor) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id, status: ProductStatus.DRAFT },
        select: { categoryId: true },
      });
      if (!initial) return null;
      await this.lockCategoryRows(tx, [initial.categoryId]);
      await this.lockProduct(tx, id);
      const product = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id, status: ProductStatus.DRAFT },
        select: {
          id: true,
          createdById: true,
          registrantId: true,
          categoryId: true,
          localityId: true,
          name: true,
          description: true,
          status: true,
          formData: true,
          attachments: { select: { filePath: true } },
        },
      });
      if (!product) return null;
      const deleted = await tx.product.deleteMany({
        where: { ...this.actorWhere(actor), id, status: ProductStatus.DRAFT },
      });
      if (!deleted.count) return null;
      if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: 'product.delete_on_behalf',
          entityType: 'Product',
          entityId: id,
          beforeData: this.auditProduct(product),
          afterData: { id, deleted: true },
          reason: actor.reason,
          ...actor.meta,
        });
      }
      return product.attachments.map(({ filePath }) => filePath);
    });
  }

  async submitDraft(id: string, actor: ProductMutationActor) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await (
        typeof tx.product.findUnique === 'function'
          ? tx.product.findUnique({
              where: { id, ...this.actorWhere(actor) },
              select: { categoryId: true },
            })
          : tx.product.findFirst({
              where: { ...this.actorWhere(actor), id },
              select: { categoryId: true },
            })
      );
      if (!initial) return null;
      await this.lockCategoryRows(tx, [initial.categoryId]);
      await this.lockProduct(tx, id);
      const product = await tx.product.findFirst({
        where: {
          ...this.actorWhere(actor),
          id,
          status: { in: editableStatuses },
        },
        select: {
          id: true,
          codeNumber: true,
          registrantId: true,
          categoryId: true,
          localityId: true,
          name: true,
          description: true,
          status: true,
          formData: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          registrant: {
            select: { id: true, fullName: true, email: true, phone: true },
          },
        },
      });
      if (!product) return null;
      if (product.categoryId !== initial.categoryId) {
        throw new ConflictException(
          'Product category changed while submitting',
        );
      }
      await this.assertActiveCategory(tx, product.categoryId);
      const locality = await this.resolveOrCreateLocality(
        tx,
        product.localityId,
        product.formData,
      );
      if (!locality) {
        throw new BadRequestException(
          'Select a current locality before submitting',
        );
      }
      const submittedAt = new Date();
      const registrationSnapshot = buildRegistrationSnapshot({
        submittedAt,
        product,
        registrant: product.registrant,
        category: product.category,
        locality,
      });
      const updated = await tx.product.updateMany({
        where: {
          ...this.actorWhere(actor),
          id,
          status: { in: editableStatuses },
        },
        data: {
          status: ProductStatus.SUBMITTED,
          submittedAt,
          localityId: locality.id,
          returnReason: null,
          returnedAt: null,
          returnedById: null,
          registrationSnapshot:
            registrationSnapshot as unknown as Prisma.InputJsonValue,
          localityCodeAtSubmit: locality.code,
          localityNameAtSubmit: locality.name,
          provinceNameAtSubmit: locality.provinceName,
        },
      });
      if (!updated.count) return null;
      await recordProductStatusEvent(
        tx,
        id,
        product.status,
        ProductStatus.SUBMITTED,
        actor.id,
        submittedAt,
        actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER
          ? actor.reason
          : undefined,
      );
      if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: 'product.submit_on_behalf',
          entityType: 'Product',
          entityId: id,
          beforeData: {
            id,
            registrantId: product.registrantId,
            status: product.status,
          },
          afterData: {
            id,
            registrantId: product.registrantId,
            categoryId: product.categoryId,
            localityId: locality.id,
            status: ProductStatus.SUBMITTED,
          },
          reason: actor.reason,
          ...actor.meta,
        });
      }
      const result = await tx.product.findUniqueOrThrow({
        where: { id },
        include: registrantProductInclude,
      });
      return sanitizePublicProductResult(result);
    });
  }

  async addAttachment(
    productId: string,
    actor: ProductMutationActor,
    input: { type: AttachmentType; fileName: string; filePath: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({
        where: {
          ...this.actorWhere(actor),
          id: productId,
          status: { in: editableStatuses },
        },
        select: { id: true },
      });
      if (!initial) return null;
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
      );
      const product = await tx.product.findFirst({
        where: {
          ...this.actorWhere(actor),
          id: productId,
          status: { in: editableStatuses },
        },
        select: { id: true },
      });
      if (!product) return null;
      const existingAttachments =
        typeof tx.attachment.findMany === 'function'
          ? await tx.attachment.findMany({
              where: { productId },
              select: { fileName: true },
            })
          : Array.from(
              { length: await tx.attachment.count({ where: { productId } }) },
              (_, i) => ({ fileName: `file-${i}.png` }),
            );
      const videoCount = existingAttachments.filter((att) =>
        isVideoAttachmentName(att.fileName),
      ).length;
      const regularFileCount = existingAttachments.length - videoCount;
      const isUploadingVideo = isVideoAttachmentName(input.fileName);

      if (isUploadingVideo && videoCount >= MAX_VIDEOS_PER_PRODUCT) {
        throw new ConflictException(
          `Tối đa ${MAX_VIDEOS_PER_PRODUCT} video đính kèm cho mỗi sản phẩm`,
        );
      }
      if (!isUploadingVideo && regularFileCount >= MAX_FILES_PER_PRODUCT) {
        throw new ConflictException(
          `Tối đa ${MAX_FILES_PER_PRODUCT} tệp đính kèm cho mỗi sản phẩm`,
        );
      }
      if (existingAttachments.length >= MAX_ATTACHMENTS_PER_PRODUCT) {
        throw new ConflictException(
          `Tối đa ${MAX_ATTACHMENTS_PER_PRODUCT} tệp đính kèm cho mỗi sản phẩm`,
        );
      }
      const attachment = await tx.attachment.create({
        data: { productId, ...input },
        select: { id: true, type: true, fileName: true, createdAt: true },
      });
      if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: 'product.attachment_add_on_behalf',
          entityType: 'Product',
          entityId: productId,
          afterData: attachment,
          reason: actor.reason,
          ...actor.meta,
        });
      }
      return attachment;
    });
  }

  async removeAttachment(
    productId: string,
    attachmentId: string,
    actor: ProductMutationActor,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({
        where: {
          ...this.actorWhere(actor),
          id: productId,
          status: { in: editableStatuses },
        },
        select: { id: true },
      });
      if (!initial) return null;
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
      );
      const attachment = await tx.attachment.findFirst({
        where: {
          id: attachmentId,
          productId,
          product: {
            ...this.actorWhere(actor),
            status: { in: editableStatuses },
          },
        },
        select: {
          id: true,
          filePath: true,
          fileName: true,
          type: true,
          createdAt: true,
        },
      });
      if (!attachment) return null;
      const deleted = await tx.attachment.deleteMany({
        where: {
          id: attachmentId,
          productId,
          product: {
            ...this.actorWhere(actor),
            status: { in: editableStatuses },
          },
        },
      });
      if (!deleted.count) return null;
      if (actor.kind === PRODUCT_MUTATION_ACTOR_KIND.MANAGER) {
        await writeAudit(tx, {
          actorId: actor.id,
          action: 'product.attachment_delete_on_behalf',
          entityType: 'Product',
          entityId: productId,
          beforeData: {
            id: attachment.id,
            type: attachment.type,
            fileName: attachment.fileName,
            createdAt: attachment.createdAt,
          },
          reason: actor.reason,
          ...actor.meta,
        });
      }
      return attachment.filePath;
    });
  }

  findAttachment(productId: string, attachmentId: string) {
    return this.prisma.attachment.findFirst({
      where: { id: attachmentId, productId },
      select: {
        id: true,
        type: true,
        fileName: true,
        filePath: true,
        product: { select: { registrantId: true, status: true } },
      },
    });
  }

  findAdminAttachment(
    productId: string,
    attachmentId: string,
    canManage: boolean,
  ) {
    return this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        productId,
        ...(canManage
          ? {}
          : {
              type: AttachmentType.EVIDENCE,
              product: { is: { status: { not: ProductStatus.DRAFT } } },
            }),
      },
      select: { filePath: true, fileName: true },
    });
  }

  private async assertActiveCategory(tx: Prisma.TransactionClient, id: string) {
    const category = await tx.productCategory.findUnique({
      where: { id },
      select: {
        isActive: true,
        criteriaSet: {
          select: {
            isActive: true,
            criteria: {
              select: {
                maxScore: true,
                subCriteria: { select: { options: { select: { id: true } } } },
              },
            },
          },
        },
      },
    });
    if (!category?.isActive) {
      throw new ConflictException(
        'Product category is unavailable for new registration',
      );
    }
    assertCriteriaSetReady(category.criteriaSet);
  }

  private actorWhere(actor: ProductMutationActor): { registrantId?: string } {
    return actor.kind === PRODUCT_MUTATION_ACTOR_KIND.OWNER
      ? { registrantId: actor.id }
      : {};
  }

  private async lockCategoryRows(
    tx: Prisma.TransactionClient,
    categoryIds: string[],
  ) {
    const ids = [...new Set(categoryIds)].sort();
    if (!ids.length) return;
    for (const id of ids) await lockEvaluationCategory(tx, id);
    const categories = await tx.productCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (categories.length !== ids.length)
      throw new NotFoundException('Product category not found');
  }

  private lockProduct(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${id} FOR UPDATE`,
    );
  }

  private async lockActiveLocality(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM ${databaseObject('localities')} WHERE "id" = ${id} FOR UPDATE`,
    );
    const locality = await tx.locality.findUnique({ where: { id } });
    if (!locality || !locality.isActive) {
      throw new ConflictException('Locality is not currently available');
    }
    return locality;
  }

  private async resolveOrCreateLocality(
    tx: Prisma.TransactionClient,
    localityId: string | null | undefined,
    formData: unknown,
  ) {
    if (localityId) {
      return this.lockActiveLocality(tx, localityId);
    }
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) {
      return null;
    }
    const form = formData as Record<string, unknown>;
    const provinceName =
      typeof form.provinceName === 'string' ? form.provinceName.trim() : '';
    const localityName =
      typeof form.localityName === 'string' ? form.localityName.trim() : '';
    const localityCode =
      typeof form.localityCode === 'string' ? form.localityCode.trim() : '';
    if (!provinceName || !localityName) {
      return null;
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('locality_create_and_schedule_lock'))`;
    const existing = await tx.locality.findFirst({
      where: {
        provinceName: { equals: provinceName, mode: 'insensitive' },
        name: { equals: localityName, mode: 'insensitive' },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    if (existing) {
      if (!existing.isActive) {
        return tx.locality.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
      return existing;
    }

    const allCodes = await tx.locality.findMany({ select: { code: true } });
    const usedCodes = new Set(allCodes.map((r) => r.code.toUpperCase()));
    let code = localityCode ? localityCode.toUpperCase() : '';
    if (!code || usedCodes.has(code)) {
      let seq = allCodes.length + 1;
      while (usedCodes.has(`XP${seq}`)) {
        seq += 1;
      }
      code = `XP${seq}`;
    }

    return tx.locality.create({
      data: {
        code,
        eventName: localityName,
        name: localityName,
        provinceName,
        isActive: true,
      },
    });
  }

  private auditProduct(product: {
    id: string;
    createdById?: string | null;
    registrantId: string;
    categoryId: string;
    localityId: string | null;
    name: string;
    description?: string | null;
    status: ProductStatus;
    formData?: unknown;
  }) {
    return {
      id: product.id,
      ...(product.createdById === undefined
        ? {}
        : { createdById: product.createdById }),
      registrantId: product.registrantId,
      categoryId: product.categoryId,
      localityId: product.localityId,
      name: product.name,
      ...(product.description === undefined
        ? {}
        : { description: product.description }),
      status: product.status,
      ...(product.formData === undefined
        ? {}
        : { formData: this.auditFormData(product.formData) }),
    };
  }

  async listRegistrationUnits(registrantId: string) {
    return this.prisma.registrationUnit.findMany({
      where: { registrantId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        entityName: true,
        representativeName: true,
        representativeTitle: true,
        contactAddress: true,
        provinceName: true,
        localityName: true,
        localityCode: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createRegistrationUnit(
    registrantId: string,
    input: {
      entityName: string;
      representativeName: string;
      representativeTitle: string;
      contactAddress: string;
      provinceName: string;
      localityName: string;
      localityCode: string | null;
      phone: string | null;
    },
  ) {
    return this.prisma.registrationUnit.create({
      data: {
        registrantId,
        entityName: input.entityName,
        representativeName: input.representativeName,
        representativeTitle: input.representativeTitle,
        contactAddress: input.contactAddress,
        provinceName: input.provinceName,
        localityName: input.localityName,
        localityCode: input.localityCode,
        phone: input.phone,
      },
      select: {
        id: true,
        entityName: true,
        representativeName: true,
        representativeTitle: true,
        contactAddress: true,
        provinceName: true,
        localityName: true,
        localityCode: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateRegistrationUnit(
    id: string,
    registrantId: string,
    input: {
      entityName: string;
      representativeName: string;
      representativeTitle: string;
      contactAddress: string;
      provinceName: string;
      localityName: string;
      localityCode: string | null;
      phone: string | null;
    },
  ) {
    const existing = await this.prisma.registrationUnit.findFirst({
      where: { id, registrantId },
      select: { id: true },
    });
    if (!existing) return null;
    return this.prisma.registrationUnit.update({
      where: { id: existing.id },
      data: {
        entityName: input.entityName,
        representativeName: input.representativeName,
        representativeTitle: input.representativeTitle,
        contactAddress: input.contactAddress,
        provinceName: input.provinceName,
        localityName: input.localityName,
        localityCode: input.localityCode,
        phone: input.phone,
      },
      select: {
        id: true,
        entityName: true,
        representativeName: true,
        representativeTitle: true,
        contactAddress: true,
        provinceName: true,
        localityName: true,
        localityCode: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async removeRegistrationUnit(id: string, registrantId: string) {
    const deleted = await this.prisma.registrationUnit.deleteMany({
      where: { id, registrantId },
    });
    return deleted.count > 0;
  }

  private auditFormData(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    const allowed = [
      'entityName',
      'representativeName',
      'representativeTitle',
      'contactAddress',
      'provinceName',
      'localityName',
      'localityCode',
      'phone',
      'email',
      'registrationType',
      'sampleQuantity',
      'assessmentYear',
      'declarationAccepted',
    ];
    return Object.fromEntries(
      allowed.flatMap((key) => {
        const field = source[key];
        return field === null ||
          ['string', 'number', 'boolean'].includes(typeof field)
          ? [[key, field]]
          : [];
      }),
    );
  }
}
