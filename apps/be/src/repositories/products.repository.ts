import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import { lockEvaluationCategory } from '../utils/evaluation-result';
import {
  MAX_ATTACHMENTS_PER_PRODUCT,
} from '../constants/products';
import { recordProductStatusEvent } from '../utils/product-status';
import { assertCriteriaSetReady } from '../utils/category-availability';
import { writeAudit } from '../utils/audit-log';
import { buildRegistrationSnapshot } from '../utils/registration-snapshot';
import type { ProductMutationActor } from '../types/product-mutation';

const publicProductSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  finalScore: true,
  starRating: true,
  createdAt: true,
  category: {
    select: { id: true, name: true, groupCode: true, groupName: true },
  },
  attachments: {
    where: { type: 'IMAGE' as const },
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
      groupCode: true,
      groupName: true,
      classificationGroup: true,
      classificationSubgroup: true,
      isActive: true,
      group: { select: { isActive: true } },
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
          group: { isActive: true },
          criteriaSet: { is: { isActive: true } },
        },
        select: {
          id: true,
          groupCode: true,
          groupName: true,
          classificationGroup: true,
          classificationSubgroup: true,
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
        orderBy: [{ groupCode: 'asc' }, { name: 'asc' }],
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
  }) {
    const where: Prisma.ProductWhereInput = {
      status: { in: ['SUBMITTED', 'SCORING', 'COMPLETED'] },
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.query
        ? {
            OR: [
              { name: { contains: input.query, mode: 'insensitive' } },
              { id: { contains: input.query, mode: 'insensitive' } },
              {
                category: {
                  name: { contains: input.query, mode: 'insensitive' },
                },
              },
              {
                category: {
                  groupName: { contains: input.query, mode: 'insensitive' },
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
    return { data: rows, total };
  }

  findPublicById(id: string) {
    return this.prisma.product.findFirst({
      where: {
        id,
        status: { in: ['SUBMITTED', 'SCORING', 'COMPLETED'] },
      },
      select: publicProductSelect,
    });
  }

  listMine(registrantId: string) {
    return this.prisma.product.findMany({
      where: { registrantId },
      include: registrantProductInclude,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  findMine(id: string, registrantId: string) {
    return this.prisma.product.findFirst({
      where: { id, registrantId },
      include: registrantProductInclude,
    });
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
        actor.kind === 'OWNER' ? actor.id : input.registrantId;
      if (actor.kind === 'MANAGER') {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('users')} WHERE "id" = ${registrantId} FOR UPDATE`,
        );
        const registrant = await tx.user.findUnique({
          where: { id: registrantId },
          select: { role: true, verified: true, isActive: true },
        });
        if (
          !registrant ||
          registrant.role !== Role.REGISTRANT ||
          !registrant.verified ||
          !registrant.isActive
        ) {
          throw new NotFoundException('Active verified registrant not found');
        }
      }
      const product = await tx.product.create({
        data: {
          registrantId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          formData: input.formData,
          // Insert the product row before taking the locality lock to preserve
          // the group → category → owner → product → locality lock order.
          localityId: null,
          createdById: actor.id,
        },
        include: registrantProductInclude,
      });
      let created = product;
      if (input.localityId) {
        const localityId = input.localityId;
        await this.lockActiveLocality(tx, localityId);
        created = await tx.product.update({
          where: { id: product.id },
          data: { localityId },
          include: registrantProductInclude,
        });
      }
      await recordProductStatusEvent(
        tx,
        created.id,
        null,
        'DRAFT',
        actor.id,
        created.createdAt,
        actor.kind === 'MANAGER' ? actor.reason : undefined,
      );
      if (actor.kind === 'MANAGER') {
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
      return created;
    });
  }

  async updateDraft(
    id: string,
    actor: ProductMutationActor,
    input: ProductDraftChanges,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
        select: { categoryId: true },
      });
      if (!initial) return null;
      const categoryIds = [...new Set([initial.categoryId, input.categoryId].filter((value): value is string => Boolean(value)))].sort();
      await this.lockCategoryRows(tx, categoryIds);
      await this.lockProduct(tx, id);
      const current = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
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
      if (input.localityId && input.localityId !== current.localityId)
        await this.lockActiveLocality(tx, input.localityId);
      const hasChanges = Object.entries(input).some(
        ([key, value]) =>
          JSON.stringify(current[key as keyof typeof current]) !==
          JSON.stringify(value),
      );
      if (!hasChanges) {
        const product = await tx.product.findUniqueOrThrow({
          where: { id },
          include: registrantProductInclude,
        });
        if (actor.kind === 'MANAGER') {
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
        return product;
      }
      const updated = await tx.product.updateMany({
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
        data: input,
      });
      if (!updated.count) return null;
      const product = await tx.product.findUniqueOrThrow({
        where: { id },
        include: registrantProductInclude,
      });
      if (actor.kind === 'MANAGER') {
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
      return product;
    });
  }

  async deleteDraft(id: string, actor: ProductMutationActor) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
        select: { categoryId: true },
      });
      if (!initial) return null;
      await this.lockCategoryRows(tx, [initial.categoryId]);
      await this.lockProduct(tx, id);
      const product = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
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
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
      });
      if (!deleted.count) return null;
      if (actor.kind === 'MANAGER') {
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
      const initial = await tx.product.findUnique({
        where: { ...this.actorWhere(actor), id },
        select: { categoryId: true },
      });
      if (!initial) return null;
      await this.lockCategoryRows(tx, [initial.categoryId]);
      await this.lockProduct(tx, id);
      const product = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
        select: {
          id: true,
          registrantId: true,
          categoryId: true,
          localityId: true,
          name: true,
          description: true,
          formData: true,
          category: {
            select: {
              id: true,
              name: true,
              classificationGroup: true,
              classificationSubgroup: true,
              group: { select: { id: true, code: true, name: true } },
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
      if (!product.localityId) {
        throw new BadRequestException(
          'Select a current locality before submitting',
        );
      }
      const locality = await this.lockActiveLocality(tx, product.localityId);
      const submittedAt = new Date();
      const registrationSnapshot = buildRegistrationSnapshot({
        submittedAt,
        product,
        registrant: product.registrant,
        category: product.category,
        group: product.category.group,
        locality,
      });
      const updated = await tx.product.updateMany({
        where: { ...this.actorWhere(actor), id, status: 'DRAFT' },
        data: {
          status: 'SUBMITTED',
          submittedAt,
          registrationSnapshot: registrationSnapshot as unknown as Prisma.InputJsonValue,
          localityCodeAtSubmit: locality.code,
          localityNameAtSubmit: locality.name,
          localityTypeAtSubmit: locality.type,
          provinceNameAtSubmit: locality.provinceName,
        },
      });
      if (!updated.count) return null;
      await recordProductStatusEvent(
        tx,
        id,
        'DRAFT',
        'SUBMITTED',
        actor.id,
        submittedAt,
        actor.kind === 'MANAGER' ? actor.reason : undefined,
      );
      if (actor.kind === 'MANAGER') {
        await writeAudit(tx, {
          actorId: actor.id,
          action: 'product.submit_on_behalf',
          entityType: 'Product',
          entityId: id,
          beforeData: { id, registrantId: product.registrantId, status: 'DRAFT' },
          afterData: {
            id,
            registrantId: product.registrantId,
            categoryId: product.categoryId,
            localityId: locality.id,
            status: 'SUBMITTED',
          },
          reason: actor.reason,
          ...actor.meta,
        });
      }
      return tx.product.findUniqueOrThrow({
        where: { id },
        include: registrantProductInclude,
      });
    });
  }

  async addAttachment(
    productId: string,
    actor: ProductMutationActor,
    input: { type: 'IMAGE' | 'EVIDENCE'; fileName: string; filePath: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id: productId, status: 'DRAFT' },
        select: { id: true },
      });
      if (!initial) return null;
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
      );
      const product = await tx.product.findFirst({
        where: { ...this.actorWhere(actor), id: productId, status: 'DRAFT' },
        select: { id: true },
      });
      if (!product) return null;
      const count = await tx.attachment.count({ where: { productId } });
      if (count >= MAX_ATTACHMENTS_PER_PRODUCT) {
        throw new ConflictException(
          `Tối đa ${MAX_ATTACHMENTS_PER_PRODUCT} tệp đính kèm cho mỗi sản phẩm`,
        );
      }
      const attachment = await tx.attachment.create({
        data: { productId, ...input },
        select: { id: true, type: true, fileName: true, createdAt: true },
      });
      if (actor.kind === 'MANAGER') {
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
        where: { ...this.actorWhere(actor), id: productId, status: 'DRAFT' },
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
          product: { ...this.actorWhere(actor), status: 'DRAFT' },
        },
        select: { id: true, filePath: true, fileName: true, type: true, createdAt: true },
      });
      if (!attachment) return null;
      const deleted = await tx.attachment.deleteMany({
        where: {
          id: attachmentId,
          productId,
          product: { ...this.actorWhere(actor), status: 'DRAFT' },
        },
      });
      if (!deleted.count) return null;
      if (actor.kind === 'MANAGER') {
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

  findAdminAttachment(productId: string, attachmentId: string, canManage: boolean) {
    return this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        productId,
        ...(canManage ? {} : {
          type: 'EVIDENCE',
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
        group: { select: { isActive: true } },
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
    if (!category?.isActive || !category.group.isActive) {
      throw new ConflictException(
        'Product category or group is unavailable for new registration',
      );
    }
    assertCriteriaSetReady(category.criteriaSet);
  }

  private actorWhere(actor: ProductMutationActor): Prisma.ProductWhereInput {
    return actor.kind === 'OWNER' ? { registrantId: actor.id } : {};
  }

  private async lockCategoryRows(
    tx: Prisma.TransactionClient,
    categoryIds: string[],
  ) {
    const ids = [...new Set(categoryIds)].sort();
    if (!ids.length) return;
    const before = await tx.productCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, groupId: true },
    });
    if (before.length !== ids.length)
      throw new NotFoundException('Product category not found');
    const groups = [...new Set(before.map(({ groupId }) => groupId))].sort();
    await tx.$queryRaw(Prisma.sql`
      SELECT "id" FROM ${databaseObject('product_groups')}
      WHERE "id" IN (${Prisma.join(groups)}) ORDER BY "id" FOR UPDATE
    `);
    for (const id of ids) await lockEvaluationCategory(tx, id);
    const after = await tx.productCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, groupId: true },
    });
    if (
      after.length !== before.length ||
      before.some(
        (category) =>
          after.find(({ id }) => id === category.id)?.groupId !==
          category.groupId,
      )
    ) {
      throw new ConflictException('Product category changed while mutating');
    }
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
    const now = new Date();
    if (
      !locality ||
      !locality.isActive ||
      (locality.effectiveFrom && locality.effectiveFrom > now) ||
      (locality.effectiveTo && locality.effectiveTo <= now)
    ) {
      throw new ConflictException('Locality is not currently available');
    }
    return locality;
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

  private auditFormData(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const source = value as Record<string, unknown>;
    const allowed = [
      'entityName',
      'representativeName',
      'representativeTitle',
      'contactAddress',
      'provinceName',
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
        return field === null || ['string', 'number', 'boolean'].includes(typeof field)
          ? [[key, field]]
          : [];
      }),
    );
  }
}
