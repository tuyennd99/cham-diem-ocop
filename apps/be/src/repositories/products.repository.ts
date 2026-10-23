import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { databaseObject } from '../prisma/sql';
import { lockEvaluationCategory } from '../utils/evaluation-result';
import { productRegistrationTypes, MAX_ATTACHMENTS_PER_PRODUCT } from '../constants/products';
import { recordProductStatusEvent } from '../utils/product-status';

const publicProductSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  finalScore: true,
  starRating: true,
  createdAt: true,
  category: { select: { id: true, name: true, groupCode: true, groupName: true } },
  attachments: {
    where: { type: 'IMAGE' as const },
    select: { id: true, fileName: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProductSelect;

const registrantProductInclude = {
  category: { select: { id: true, name: true, groupCode: true, groupName: true,
    classificationGroup: true, classificationSubgroup: true, isActive: true,
    group: { select: { isActive: true } }, criteriaSet: { select: { isActive: true } } } },
  attachments: {
    select: { id: true, type: true, fileName: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  categoryExists(id: string) {
    return this.prisma.productCategory.count({ where: { id } }).then((count) => count > 0);
  }

  listCategories() {
    return this.prisma.productCategory.findMany({
      where: { isActive: true, group: { isActive: true }, criteriaSet: { is: { isActive: true } } },
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
    });
  }

  async listPublic(input: { page: number; limit: number; categoryId?: string; query?: string }) {
    const where: Prisma.ProductWhereInput = {
      status: { in: ['SUBMITTED', 'SCORING', 'COMPLETED'] },
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.query ? {
        OR: [
          { name: { contains: input.query, mode: 'insensitive' } },
          { id: { contains: input.query, mode: 'insensitive' } },
          { category: { name: { contains: input.query, mode: 'insensitive' } } },
          { category: { groupName: { contains: input.query, mode: 'insensitive' } } },
        ],
      } : {}),
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

  create(input: {
    registrantId: string;
    categoryId: string;
    name: string;
    description?: string | null;
    formData: Prisma.InputJsonValue;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await lockEvaluationCategory(tx, input.categoryId);
      await this.assertActiveCategory(tx, input.categoryId);
      const product = await tx.product.create({
        data: { ...input, createdById: input.registrantId },
        include: registrantProductInclude,
      });
      await recordProductStatusEvent(tx, product.id, null, 'DRAFT', input.registrantId, product.createdAt);
      return product;
    });
  }

  async updateDraft(
    id: string,
    registrantId: string,
    input: {
      categoryId?: string;
      name?: string;
      description?: string | null;
      formData?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findFirst({ where: { id, registrantId, status: 'DRAFT' }, select: { categoryId: true } });
      if (!initial) return null;
      for (const categoryId of [...new Set([initial.categoryId, input.categoryId].filter((value): value is string => Boolean(value)))].sort()) {
        await lockEvaluationCategory(tx, categoryId);
      }
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${id} FOR UPDATE`);
      const current = await tx.product.findFirst({ where: { id, registrantId, status: 'DRAFT' }, select: { categoryId: true } });
      if (!current) return null;
      if (current.categoryId !== initial.categoryId) throw new ConflictException('Product category changed while updating draft');
      if (input.categoryId !== undefined && input.categoryId !== current.categoryId) await this.assertActiveCategory(tx, input.categoryId);
      const updated = await tx.product.updateMany({
        where: { id, registrantId, status: 'DRAFT' },
        data: input,
      });
      if (!updated.count) return null;
      return tx.product.findUniqueOrThrow({
        where: { id },
        include: registrantProductInclude,
      });
    });
  }

  async deleteDraft(id: string, registrantId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${id} FOR UPDATE`);
      const product = await tx.product.findFirst({
        where: { id, registrantId, status: 'DRAFT' },
        select: { attachments: { select: { filePath: true } } },
      });
      if (!product) return null;
      await tx.product.delete({ where: { id } });
      return product.attachments.map(({ filePath }) => filePath);
    });
  }

  async submitDraft(id: string, registrantId: string) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findUnique({ where: { id }, select: { categoryId: true } });
      if (!initial) return null;
      await lockEvaluationCategory(tx, initial.categoryId);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${id} FOR UPDATE`);
      const product = await tx.product.findFirst({
        where: { id, registrantId, status: 'DRAFT' },
        select: { categoryId: true, formData: true },
      });
      if (!product) return null;
      if (product.categoryId !== initial.categoryId) {
        throw new ConflictException('Product category changed while submitting');
      }
      await this.assertActiveCategory(tx, product.categoryId);
      const form = product.formData;
      const hasText = (value: Prisma.JsonValue | undefined) =>
        typeof value === 'string' && value.trim().length > 0;
      if (
        !form || typeof form !== 'object' || Array.isArray(form) ||
        !['entityName', 'representativeName', 'representativeTitle', 'contactAddress', 'provinceName']
          .every((key) => hasText(form[key])) ||
        !(hasText(form.phone) || hasText(form.email)) ||
        !productRegistrationTypes.includes(String(form.registrationType) as (typeof productRegistrationTypes)[number]) ||
        typeof form.sampleQuantity !== 'number' || !Number.isInteger(form.sampleQuantity) ||
        form.sampleQuantity < 1 || typeof form.assessmentYear !== 'number' ||
        !Number.isInteger(form.assessmentYear) || form.assessmentYear < 2020 ||
        form.declarationAccepted !== true
      ) {
        throw new BadRequestException('Complete all required application fields and accept the declaration before submitting');
      }
      const submittedAt = new Date();
      const updated = await tx.product.updateMany({
        where: { id, registrantId, status: 'DRAFT' },
        data: { status: 'SUBMITTED', submittedAt },
      });
      if (!updated.count) return null;
      await recordProductStatusEvent(tx, id, 'DRAFT', 'SUBMITTED', registrantId, submittedAt);
      return tx.product.findUniqueOrThrow({
        where: { id },
        include: registrantProductInclude,
      });
    });
  }

  async addAttachment(
    productId: string,
    registrantId: string,
    input: { type: 'IMAGE' | 'EVIDENCE'; fileName: string; filePath: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`);
      const product = await tx.product.findFirst({
        where: { id: productId, registrantId, status: 'DRAFT' },
        select: { id: true },
      });
      if (!product) return null;
      const count = await tx.attachment.count({ where: { productId } });
      if (count >= MAX_ATTACHMENTS_PER_PRODUCT) {
        throw new ConflictException(`Tối đa ${MAX_ATTACHMENTS_PER_PRODUCT} tệp đính kèm cho mỗi sản phẩm`);
      }
      return tx.attachment.create({
        data: { productId, ...input },
        select: { id: true, type: true, fileName: true, createdAt: true },
      });
    });
  }

  async removeAttachment(
    productId: string,
    attachmentId: string,
    registrantId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`);
      const attachment = await tx.attachment.findFirst({
        where: {
          id: attachmentId,
          productId,
          product: { registrantId, status: 'DRAFT' },
        },
        select: { filePath: true },
      });
      if (!attachment) return null;
      await tx.attachment.delete({ where: { id: attachmentId } });
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

  private async assertActiveCategory(tx: Prisma.TransactionClient, id: string) {
    const available = await tx.productCategory.count({ where: {
      id, isActive: true, group: { isActive: true }, criteriaSet: { is: { isActive: true } },
    } });
    if (!available) throw new ConflictException('Product category, group or criteria set is unavailable for new registration');
  }
}
