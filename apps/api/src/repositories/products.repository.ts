import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  category: { select: { id: true, name: true, groupCode: true, groupName: true } },
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
      select: {
        id: true,
        groupCode: true,
        groupName: true,
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
                      orderBy: { points: 'asc' },
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

  async listPublic(input: { page: number; limit: number; categoryId?: string }) {
    const where = {
      status: { in: ['SUBMITTED', 'SCORING', 'COMPLETED'] as const },
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
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
    return this.prisma.product.create({
      data: input,
      include: registrantProductInclude,
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
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${id} FOR UPDATE`);
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
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${id} FOR UPDATE`);
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
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${id} FOR UPDATE`);
      const updated = await tx.product.updateMany({
        where: { id, registrantId, status: 'DRAFT' },
        data: { status: 'SUBMITTED' },
      });
      if (!updated.count) return null;
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
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE`);
      const product = await tx.product.findFirst({
        where: { id: productId, registrantId, status: 'DRAFT' },
        select: { id: true },
      });
      if (!product) return null;
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
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId} FOR UPDATE`);
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
}
