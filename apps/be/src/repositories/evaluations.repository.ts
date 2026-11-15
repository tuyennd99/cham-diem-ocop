import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttachmentType,
  EvaluationStatus,
  Prisma,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import {
  EVALUATION_HISTORY_ACTION,
  PRODUCT_RESULT_HISTORY_ACTION,
} from '../constants/products';
import { PrismaService } from '../prisma/prisma.service';
import { EvaluationScoreDto } from '../dtos/evaluations.dto';
import { databaseObject } from '../prisma/sql';
import {
  lockEvaluationCategory,
  recomputeProductResult,
} from '../utils/evaluation-result';
import { buildEvaluationPrintData } from '../utils/print-data';
import { formatProductCode, withProductCode } from '../utils/product-code';
import { recordProductStatusEvent } from '../utils/product-status';

@Injectable()
export class EvaluationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(judgeId: string) {
    return this.prisma.product.findMany({
      where: {
        OR: [
          {
            judgeAssignments: {
              some: {
                judgeId,
                isActive: true,
                judge: {
                  is: {
                    role: { not: Role.REGISTRANT },
                    staffPermissions: { has: StaffPermission.SCORE },
                    isActive: true,
                    verified: true,
                  },
                },
              },
            },
            status: {
              in: [
                ProductStatus.APPROVED,
                ProductStatus.SCORING,
                ProductStatus.COMPLETED,
              ],
            },
          },
          {
            evaluations: {
              some: {
                judgeId,
                status: EvaluationStatus.EXCLUDED,
              },
            },
            status: {
              in: [
                ProductStatus.APPROVED,
                ProductStatus.SCORING,
                ProductStatus.COMPLETED,
              ],
            },
          },
          {
            judgeAssignments: { none: {} },
            category: {
              assignments: {
                some: {
                  judgeId,
                  judge: {
                    is: {
                      role: { not: Role.REGISTRANT },
                      staffPermissions: { has: StaffPermission.SCORE },
                      isActive: true,
                      verified: true,
                    },
                  },
                },
              },
            },
            status: {
              in: [
                ProductStatus.SUBMITTED,
                ProductStatus.APPROVED,
                ProductStatus.SCORING,
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        codeNumber: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        attachments: {
          where: { type: AttachmentType.IMAGE },
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
    }).then((rows) => rows.map(withProductCode));
  }

  async getEvaluation(judgeId: string, productId: string) {
    const context = await this.getAssignedProduct(
      this.prisma,
      judgeId,
      productId,
      true,
    );
    const assignment = context.assignment;
    const criteria = context.product.category.criteriaSet?.criteria ?? [];
    const selectedCriteria = assignment.criterionIds.length
      ? criteria.filter((criterion) =>
          assignment.criterionIds.includes(criterion.id),
        )
      : criteria;
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { judgeId_productId: { judgeId, productId } },
      include: { scores: true },
    });
    if (
      context.product.status === ProductStatus.COMPLETED &&
      !context.isPerProductAssignment &&
      evaluation?.status !== EvaluationStatus.SUBMITTED &&
      evaluation?.status !== EvaluationStatus.EXCLUDED
    ) {
      throw new NotFoundException('Evaluation not found');
    }
    return {
      product: withProductCode({
        id: context.product.id,
        codeNumber: context.product.codeNumber,
        name: context.product.name,
        description: context.product.description,
        formData: context.product.formData,
        category: {
          id: context.product.category.id,
          name: context.product.category.name,
        },
        attachments: context.product.attachments,
      }),
      criteria: selectedCriteria,
      evaluation: evaluation
        ? {
            id: evaluation.id,
            status: evaluation.status,
            total: evaluation.total,
            scores: evaluation.scores,
          }
        : {
            id: null,
            status: EvaluationStatus.IN_PROGRESS,
            total: null,
            scores: [],
          },
    };
  }

  async getEvaluationPrintData(judgeId: string, productId: string) {
    const context = await this.getAssignedProduct(
      this.prisma,
      judgeId,
      productId,
      true,
    );
    const evaluation = await this.prisma.evaluation.findUnique({
      where: { judgeId_productId: { judgeId, productId } },
      include: {
        scores: {
          select: {
            subCriterionId: true,
            optionId: true,
            note: true,
            option: { select: { id: true, label: true, points: true } },
          },
        },
      },
    });
    if (
      context.product.status === ProductStatus.COMPLETED &&
      !context.isPerProductAssignment &&
      evaluation?.status !== EvaluationStatus.SUBMITTED &&
      evaluation?.status !== EvaluationStatus.EXCLUDED
    ) {
      throw new NotFoundException('Evaluation not found');
    }
    return buildEvaluationPrintData({
      evaluationId: evaluation?.id ?? null,
      status: evaluation?.status ?? EvaluationStatus.IN_PROGRESS,
      submittedAt: evaluation?.submittedAt ?? null,
      total: evaluation?.total ?? null,
      assignedCriterionIds: context.assignment.criterionIds,
      submissionSnapshot: evaluation?.submissionSnapshot ?? null,
      currentProduct: {
        id: context.product.id,
        codeNumber: context.product.codeNumber,
        name: context.product.name,
        formData: context.product.formData,
        category: {
          id: context.product.category.id,
          name: context.product.category.name,
          criteriaSet: context.product.category.criteriaSet
            ? {
                id: context.product.category.criteriaSet.id,
                name: context.product.category.criteriaSet.name,
                source: context.product.category.criteriaSet.source,
                version: context.product.category.criteriaSet.version,
                sourceHash: context.product.category.criteriaSet.sourceHash,
                criteria: context.product.category.criteriaSet.criteria.map(
                  (c) => ({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    maxScore: c.maxScore,
                    order: c.order,
                    sectionCode: c.sectionCode,
                    sectionName: c.sectionName,
                    subCriteria: c.subCriteria.map((sub) => ({
                      id: sub.id,
                      code: sub.code,
                      content: sub.content,
                      order: sub.order,
                      options: sub.options.map((opt) => ({
                        id: opt.id,
                        label: opt.label,
                        points: opt.points,
                      })),
                    })),
                  }),
                ),
              }
            : null,
        },
      },
      currentJudge: {
        id: context.assignment.judge.id,
        fullName: context.assignment.judge.fullName,
        organizationUnit: context.assignment.judge.organizationUnit
          ? { name: context.assignment.judge.organizationUnit.name }
          : null,
      },
      liveScores: evaluation?.scores ?? [],
    });
  }

  async findAttachment(
    judgeId: string,
    productId: string,
    attachmentId: string,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { categoryId: true, status: true },
    });
    if (!product) return null;

    const hasPerProduct = await this.prisma.productJudgeAssignment.findUnique({
      where: {
        productId_judgeId: { productId, judgeId },
      },
      select: {
        isActive: true,
        judge: {
          select: {
            role: true,
            staffPermissions: true,
            isActive: true,
            verified: true,
          },
        },
      },
    });
    const hasExcludedEval = await this.prisma.evaluation.findUnique({
      where: { judgeId_productId: { judgeId, productId } },
      select: { status: true },
    });
    const totalPerProductCount = await this.prisma.productJudgeAssignment.count(
      { where: { productId } },
    );
    const hasLegacyAssignment =
      totalPerProductCount === 0
        ? await this.prisma.judgeAssignment.findUnique({
            where: {
              judgeId_categoryId: { judgeId, categoryId: product.categoryId },
              judge: {
                is: {
                  role: { not: Role.REGISTRANT },
                  staffPermissions: { has: StaffPermission.SCORE },
                  isActive: true,
                  verified: true,
                },
              },
            },
          })
        : null;

    const judgeValid =
      (hasPerProduct?.isActive &&
        hasPerProduct.judge.role !== Role.REGISTRANT &&
        hasPerProduct.judge.staffPermissions.includes(StaffPermission.SCORE) &&
        hasPerProduct.judge.isActive &&
        hasPerProduct.judge.verified) ||
      hasExcludedEval?.status === EvaluationStatus.EXCLUDED ||
      Boolean(hasLegacyAssignment);

    if (!judgeValid) {
      throw new ForbiddenException('Product is outside the judge assignment');
    }

    return this.prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        productId,
        product: {
          status: {
            in: [
              ...(totalPerProductCount === 0
                ? [ProductStatus.SUBMITTED]
                : []),
              ProductStatus.APPROVED,
              ProductStatus.SCORING,
              ProductStatus.COMPLETED,
            ],
          },
        },
      },
      select: { fileName: true, filePath: true, type: true },
    });
  }

  async saveDraft(
    judgeId: string,
    productId: string,
    scores: EvaluationScoreDto[],
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );
        const context = await this.getAssignedProduct(tx, judgeId, productId);
        if (context.product.categoryId !== initial.categoryId) {
          throw new ConflictException(
            'Product category changed while saving evaluation',
          );
        }
        const criteria = context.product.category.criteriaSet?.criteria ?? [];
        const allowedIds = this.allowedCriteria(
          context.assignment.criterionIds,
          criteria,
        );
        if (!allowedIds.length)
          throw new ConflictException(
            'No scoring criteria are configured for this product',
          );
        const existing = await tx.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
          select: { id: true, status: true },
        });
        if (existing?.status === EvaluationStatus.SUBMITTED) {
          throw new ConflictException('Submitted evaluations are immutable');
        }
        if (existing?.status === EvaluationStatus.EXCLUDED) {
          throw new ConflictException('Excluded evaluations are read-only');
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
          scores.some(
            (score) =>
              !optionIdsBySubcriterion
                .get(score.subCriterionId)
                ?.has(score.optionId),
          )
        ) {
          throw new ForbiddenException(
            'Scores must use options in assigned criteria',
          );
        }

        const evaluation = await tx.evaluation.upsert({
          where: { judgeId_productId: { judgeId, productId } },
          create: {
            judgeId,
            productId,
            status: EvaluationStatus.IN_PROGRESS,
          },
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
        if (
          context.product.status === ProductStatus.APPROVED ||
          context.product.status === ProductStatus.SUBMITTED
        ) {
          const scoringAt = new Date();
          await tx.product.update({
            where: { id: productId },
            data: { status: ProductStatus.SCORING },
          });
          await recordProductStatusEvent(
            tx,
            productId,
            context.product.status,
            ProductStatus.SCORING,
            judgeId,
            scoringAt,
          );
        }
        return {
          id: evaluation.id,
          status: EvaluationStatus.IN_PROGRESS,
          scores,
        };
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  async submit(judgeId: string, productId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const initial = await tx.product.findUnique({
          where: { id: productId },
          select: { categoryId: true },
        });
        if (!initial) throw new NotFoundException('Product not found');
        await lockEvaluationCategory(tx, initial.categoryId);
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM ${databaseObject('products')} WHERE "id" = ${productId} FOR UPDATE`,
        );
        const context = await this.getAssignedProduct(tx, judgeId, productId);
        if (context.product.categoryId !== initial.categoryId) {
          throw new ConflictException(
            'Product category changed while submitting evaluation',
          );
        }
        const criteria = context.product.category.criteriaSet?.criteria ?? [];
        const assignedCriteria = this.allowedCriteria(
          context.assignment.criterionIds,
          criteria,
        );
        if (!assignedCriteria.length)
          throw new ConflictException(
            'No scoring criteria are configured for this product',
          );
        const expected = criteria
          .filter((criterion) => assignedCriteria.includes(criterion.id))
          .flatMap((criterion) => criterion.subCriteria.map((sub) => sub.id));
        const evaluation = await tx.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
          include: {
            scores: {
              include: {
                subCriterion: {
                  include: {
                    criterion: { select: { id: true, code: true, name: true } },
                  },
                },
                option: { select: { id: true, label: true, points: true } },
              },
            },
          },
        });
        if (evaluation?.status === EvaluationStatus.SUBMITTED) {
          throw new ConflictException('Evaluation was already submitted');
        }
        if (evaluation?.status === EvaluationStatus.EXCLUDED) {
          throw new ConflictException('Excluded evaluations are read-only');
        }
        if (
          !evaluation ||
          evaluation.scores.length !== expected.length ||
          expected.some(
            (id) =>
              !evaluation.scores.some((score) => score.subCriterionId === id),
          )
        ) {
          throw new ConflictException(
            'Score every assigned subcriterion before submitting',
          );
        }
        const total = evaluation.scores.reduce(
          (sum, score) => sum + score.option.points,
          0,
        );
        const submittedAt = new Date();
        const criteriaSet = context.product.category.criteriaSet;
        if (!criteriaSet)
          throw new ConflictException(
            'No scoring criteria are configured for this product',
          );
        const scoreBySubCriterion = new Map(
          evaluation.scores.map((score) => [score.subCriterionId, score]),
        );
        const submissionSnapshot = {
          version: 2,
          submittedAt: submittedAt.toISOString(),
          product: {
            id: context.product.id,
            ...(typeof context.product.codeNumber === 'number'
              ? {
                  codeNumber: context.product.codeNumber,
                  code: formatProductCode(context.product.codeNumber),
                }
              : {}),
            name: context.product.name,
            description: context.product.description,
            formData: context.product.formData,
            category: {
              id: context.product.category.id,
              name: context.product.category.name,
            },
          },
          criteriaSet: {
            id: criteriaSet.id,
            name: criteriaSet.name,
            source: criteriaSet.source,
            version: criteriaSet.version,
            sourceHash: criteriaSet.sourceHash,
          },
          judge: {
            id: context.assignment.judge.id,
            fullName: context.assignment.judge.fullName,
            organizationUnit: context.assignment.judge.organizationUnit,
          },
          assignedCriterionIds: assignedCriteria,
          scores: expected.map((subCriterionId) => {
            const score = scoreBySubCriterion.get(subCriterionId)!;
            return {
              criterion: score.subCriterion.criterion,
              subCriterion: {
                id: score.subCriterion.id,
                code: score.subCriterion.code,
                content: score.subCriterion.content,
              },
              option: score.option,
              note: score.note,
            };
          }),
          total,
        } as Prisma.InputJsonValue;
        const submitted = await tx.evaluation.update({
          where: { id: evaluation.id },
          data: {
            status: EvaluationStatus.SUBMITTED,
            total,
            submittedAt,
            submissionSnapshot,
          },
          select: { id: true, total: true, status: true },
        });

        if (typeof tx.evaluationHistoryEvent?.create === 'function') {
          await tx.evaluationHistoryEvent.create({
            data: {
              evaluationId: evaluation.id,
              action: EVALUATION_HISTORY_ACTION.SUBMITTED,
              fromStatus: EvaluationStatus.IN_PROGRESS,
              toStatus: EvaluationStatus.SUBMITTED,
              actorId: judgeId,
              previousTotal: evaluation.total,
              snapshot: submissionSnapshot,
            },
          });
        }

        await recomputeProductResult(
          tx,
          productId,
          judgeId,
          PRODUCT_RESULT_HISTORY_ACTION.EVALUATION_SUBMITTED,
        );
        return submitted;
      },
      { timeout: 15000, maxWait: 10000 },
    );
  }

  private async getAssignedProduct(
    db: Prisma.TransactionClient | PrismaService,
    judgeId: string,
    productId: string,
    allowReadCompletedOrExcluded = false,
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
                  include: {
                    subCriteria: {
                      orderBy: { order: 'asc' },
                      include: { options: { orderBy: { order: 'asc' } } },
                    },
                  },
                },
              },
            },
          },
        },
        attachments: { select: { id: true, type: true, fileName: true } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');

    const perProductAssignment =
      typeof db.productJudgeAssignment?.findUnique === 'function'
        ? await db.productJudgeAssignment.findUnique({
            where: {
              productId_judgeId: { productId, judgeId },
            },
            include: {
              judge: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                  staffPermissions: true,
                  isActive: true,
                  verified: true,
                  organizationUnit: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
            },
          })
        : null;

    if (perProductAssignment) {
      const judgeOk =
        perProductAssignment.judge.role !== Role.REGISTRANT &&
        perProductAssignment.judge.staffPermissions.includes(
          StaffPermission.SCORE,
        ) &&
        perProductAssignment.judge.isActive &&
        perProductAssignment.judge.verified;

      if (!perProductAssignment.isActive) {
        if (!allowReadCompletedOrExcluded) {
          throw new ForbiddenException(
            'Product is outside the judge assignment',
          );
        }
        const evalRow = await db.evaluation.findUnique({
          where: { judgeId_productId: { judgeId, productId } },
          select: { status: true },
        });
        if (evalRow?.status !== EvaluationStatus.EXCLUDED) {
          throw new ForbiddenException(
            'Product is outside the judge assignment',
          );
        }
      } else if (!judgeOk) {
        throw new ForbiddenException('Product is outside the judge assignment');
      }

      if (
        product.status !== ProductStatus.APPROVED &&
        product.status !== ProductStatus.SCORING &&
        product.status !== ProductStatus.COMPLETED
      ) {
        throw new ConflictException('Product is not open for evaluation');
      }

      return {
        isPerProductAssignment: true,
        assignment: {
          judgeId,
          categoryId: product.categoryId,
          criterionIds: [] as string[],
          judge: perProductAssignment.judge,
        },
        product,
      };
    }

    const totalPerProductCount =
      typeof db.productJudgeAssignment?.count === 'function'
        ? await db.productJudgeAssignment.count({
            where: { productId },
          })
        : 0;
    if (totalPerProductCount > 0) {
      throw new ForbiddenException('Product is outside the judge assignment');
    }

    const assignment = await db.judgeAssignment.findUnique({
      where: {
        judgeId_categoryId: { judgeId, categoryId: product.categoryId },
        judge: {
          is: {
            role: { not: Role.REGISTRANT },
            staffPermissions: { has: StaffPermission.SCORE },
            isActive: true,
            verified: true,
          },
        },
      },
      include: {
        judge: {
          select: {
            id: true,
            fullName: true,
            organizationUnit: {
              select: { id: true, code: true, name: true },
            },
          },
        },
      },
    });
    if (!assignment)
      throw new ForbiddenException('Product is outside the judge assignment');
    if (
      product.status !== ProductStatus.SUBMITTED &&
      product.status !== ProductStatus.APPROVED &&
      product.status !== ProductStatus.SCORING &&
      !(
        allowReadCompletedOrExcluded &&
        product.status === ProductStatus.COMPLETED
      )
    ) {
      throw new ConflictException('Product is not open for evaluation');
    }
    return { isPerProductAssignment: false, assignment, product };
  }

  private allowedCriteria(
    criterionIds: string[],
    criteria: Array<{ id: string }>,
  ): string[] {
    return criterionIds.length
      ? criteria
          .filter((criterion) => criterionIds.includes(criterion.id))
          .map((criterion) => criterion.id)
      : criteria.map((criterion) => criterion.id);
  }
}
