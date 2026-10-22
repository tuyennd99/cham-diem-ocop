import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationStatus, Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationScoreDto } from '../dtos/evaluations.dto';
import { databaseObject } from '../prisma/sql';
import { lockEvaluationCategory, recomputeProductResult } from '../utils/evaluation-result';

@Injectable()
export class EvaluationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(judgeId: string) {
    const assignments = await this.prisma.judgeAssignment.findMany({
      where: { judgeId },
      select: { categoryId: true },
    });
    if (!assignments.length) return [];
    return this.prisma.product.findMany({
      where: {
        categoryId: { in: assignments.map((assignment) => assignment.categoryId) },
        status: { in: [ProductStatus.SUBMITTED, ProductStatus.SCORING] },
      },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        category: { select: { id: true, name: true, groupName: true } },
        attachments: {
          where: { type: 'IMAGE' },
          orderBy: { createdAt: 'asc' },
          take: 1,
          select: { id: true, fileName: true },
        },
        evaluations: {
          where: { judgeId },
          select: { status: true, total: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async getEvaluation(judgeId: string, productId: string) {
    const context = await this.getAssignedProduct(this.prisma, judgeId, productId, true);
    const assignment = context.assignment;
    const criteria = context.product.category.criteriaSet?.criteria ?? [];
    const selectedCriteria = assignment.criterionIds.length
      ? criteria.filter((criterion) => assignment.criterionIds.includes(criterion.id))
      : criteria;
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { judgeId_productId: { judgeId, productId } },
      include: { scores: true },
    });
    if (context.product.status === ProductStatus.COMPLETED && evaluation?.status !== EvaluationStatus.SUBMITTED) {
      throw new NotFoundException('Evaluation not found');
    }
    return {
      product: {
        id: context.product.id,
        name: context.product.name,
        description: context.product.description,
        formData: context.product.formData,
        category: {
          id: context.product.category.id,
          name: context.product.category.name,
          groupName: context.product.category.groupName,
        },
        attachments: context.product.attachments,
      },
      criteria: selectedCriteria,
      evaluation: evaluation
        ? { id: evaluation.id, status: evaluation.status, total: evaluation.total, scores: evaluation.scores }
        : { id: null, status: EvaluationStatus.IN_PROGRESS, total: null, scores: [] },
    };
  }

  async findAttachment(judgeId: string, productId: string, attachmentId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, select: { categoryId: true } });
    if (!product) return null;
    if (!(await this.prisma.judgeAssignment.findUnique({ where: { judgeId_categoryId: { judgeId, categoryId: product.categoryId } } }))) {
      throw new ForbiddenException('Product is outside the judge assignment');
    }
    return this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        productId,
        product: { status: { in: [ProductStatus.SUBMITTED, ProductStatus.SCORING, ProductStatus.COMPLETED] } },
      },
      select: { fileName: true, filePath: true, type: true },
    });
  }

  async saveDraft(judgeId: string, productId: string, scores: EvaluationScoreDto[]) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findUnique({ where: { id: productId }, select: { categoryId: true } });
      if (!initial) throw new NotFoundException('Product not found');
      await lockEvaluationCategory(tx, initial.categoryId);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`);
      const context = await this.getAssignedProduct(tx, judgeId, productId);
      if (context.product.categoryId !== initial.categoryId) {
        throw new ConflictException('Product category changed while saving evaluation');
      }
      const criteria = context.product.category.criteriaSet?.criteria ?? [];
      const allowedIds = this.allowedCriteria(context.assignment.criterionIds, criteria);
      if (!allowedIds.length) throw new ConflictException('No scoring criteria are configured for this product');
      const existing = await tx.evaluation.findUnique({
        where: { judgeId_productId: { judgeId, productId } },
        select: { id: true, status: true },
      });
      if (existing?.status === EvaluationStatus.SUBMITTED) {
        throw new ConflictException('Submitted evaluations are immutable');
      }

      const subIds = scores.map((score) => score.subCriterionId);
      const validSubcriteria = await tx.subCriterion.findMany({
        where: { id: { in: subIds }, criterionId: { in: allowedIds } },
        include: { options: { select: { id: true } } },
      });
      const optionIdsBySubcriterion = new Map(
        validSubcriteria.map((subcriterion) => [
          subcriterion.id,
          new Set(subcriterion.options.map((option) => option.id)),
        ]),
      );
      if (
        validSubcriteria.length !== scores.length ||
        scores.some((score) => !optionIdsBySubcriterion.get(score.subCriterionId)?.has(score.optionId))
      ) {
        throw new ForbiddenException('Scores must use options in assigned criteria');
      }

      const evaluation = await tx.evaluation.upsert({
        where: { judgeId_productId: { judgeId, productId } },
        create: { judgeId, productId, status: EvaluationStatus.IN_PROGRESS },
        update: { status: EvaluationStatus.IN_PROGRESS },
        select: { id: true },
      });
      await tx.score.deleteMany({ where: { evaluationId: evaluation.id } });
      if (scores.length) {
        await tx.score.createMany({
          data: scores.map((score) => ({
            evaluationId: evaluation.id,
            subCriterionId: score.subCriterionId,
            optionId: score.optionId,
            note: score.note?.trim() || null,
          })),
        });
      }
      await tx.product.update({
        where: { id: productId },
        data: { status: ProductStatus.SCORING },
      });
      return { id: evaluation.id, status: EvaluationStatus.IN_PROGRESS, scores };
    }, { timeout: 15000, maxWait: 10000 });
  }

  async submit(judgeId: string, productId: string) {
    return this.prisma.$transaction(async (tx) => {
      const initial = await tx.product.findUnique({ where: { id: productId }, select: { categoryId: true } });
      if (!initial) throw new NotFoundException('Product not found');
      await lockEvaluationCategory(tx, initial.categoryId);
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`);
      const context = await this.getAssignedProduct(tx, judgeId, productId);
      if (context.product.categoryId !== initial.categoryId) {
        throw new ConflictException('Product category changed while submitting evaluation');
      }
      const criteria = context.product.category.criteriaSet?.criteria ?? [];
      const assignedCriteria = this.allowedCriteria(context.assignment.criterionIds, criteria);
      if (!assignedCriteria.length) throw new ConflictException('No scoring criteria are configured for this product');
      const expected = criteria
        .filter((criterion) => assignedCriteria.includes(criterion.id))
        .flatMap((criterion) => criterion.subCriteria.map((sub) => sub.id));
      const evaluation = await tx.evaluation.findUnique({
        where: { judgeId_productId: { judgeId, productId } },
        include: {
          scores: { include: { subCriterion: { select: { criterionId: true } }, option: { select: { points: true } } } },
        },
      });
      if (evaluation?.status === EvaluationStatus.SUBMITTED) {
        throw new ConflictException('Evaluation was already submitted');
      }
      if (!evaluation || evaluation.scores.length !== expected.length || expected.some((id) => !evaluation.scores.some((score) => score.subCriterionId === id))) {
        throw new ConflictException('Score every assigned subcriterion before submitting');
      }
      const total = evaluation.scores.reduce((sum, score) => sum + score.option.points, 0);
      const submitted = await tx.evaluation.update({
        where: { id: evaluation.id },
        data: { status: EvaluationStatus.SUBMITTED, total },
        select: { id: true, total: true, status: true },
      });

      await recomputeProductResult(tx, productId);
      return submitted;
    }, { timeout: 15000, maxWait: 10000 });
  }

  private async getAssignedProduct(
    db: Prisma.TransactionClient | PrismaService,
    judgeId: string,
    productId: string,
    allowCompleted = false,
  ) {
    const product = await db.product.findUnique({
      where: { id: productId },
      include: {
        category: {
          include: {
            criteriaSet: {
              include: {
                criteria: {
                  orderBy: { order: 'asc' },
                  include: { subCriteria: { orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' } } } } },
                },
              },
            },
          },
        },
        attachments: { select: { id: true, type: true, fileName: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const assignment = await db.judgeAssignment.findUnique({
      where: { judgeId_categoryId: { judgeId, categoryId: product.categoryId } },
    });
    if (!assignment) throw new ForbiddenException('Product is outside the judge assignment');
    if (product.status !== ProductStatus.SUBMITTED && product.status !== ProductStatus.SCORING &&
      !(allowCompleted && product.status === ProductStatus.COMPLETED)) {
      throw new ConflictException('Product is not open for evaluation');
    }
    return { assignment, product };
  }

  private allowedCriteria(
    criterionIds: string[],
    criteria: Array<{ id: string }>,
  ): string[] {
    return criterionIds.length
      ? criteria.filter((criterion) => criterionIds.includes(criterion.id)).map((criterion) => criterion.id)
      : criteria.map((criterion) => criterion.id);
  }
}
