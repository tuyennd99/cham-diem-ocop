import { ConflictException } from '@nestjs/common';
import { EvaluationStatus, Prisma, ProductStatus } from '@prisma/client';
import { databaseObject } from '../prisma/sql';
import { calculateFinalScore, calculateStars } from './scoring';

export async function lockEvaluationCategory(
  tx: Prisma.TransactionClient,
  categoryId: string,
): Promise<void> {
  // shortcut: serialize scoring writes per category; use finer locks if measured contention warrants
  await tx.$queryRaw(Prisma.sql`
    SELECT "id" FROM ${databaseObject('product_categories')}
    WHERE "id" = ${categoryId} FOR UPDATE
  `);
}

export async function recomputeProductResult(
  tx: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      categoryId: true,
      category: {
        select: {
          criteriaSet: {
            select: {
              criteria: {
                select: { id: true, subCriteria: { select: { id: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!product)
    throw new ConflictException(
      'Product changed while recomputing evaluation result',
    );
  if (product.status === ProductStatus.COMPLETED) return;

  const criteria = product.category.criteriaSet?.criteria ?? [];
  const assignments = await tx.judgeAssignment.findMany({
    where: { categoryId: product.categoryId },
    select: { judgeId: true, criterionIds: true },
  });
  const existingEvaluationCount = await tx.evaluation.count({
    where: { productId },
  });
  const evaluations = assignments.length
    ? await tx.evaluation.findMany({
        where: {
          productId,
          judgeId: { in: assignments.map(({ judgeId }) => judgeId) },
        },
        include: {
          scores: {
            include: {
              subCriterion: { select: { id: true, criterionId: true } },
              option: { select: { subCriterionId: true, points: true } },
            },
          },
        },
      })
    : [];
  const evaluationsByJudge = new Map(
    evaluations
      .filter((evaluation) => evaluation.status === EvaluationStatus.SUBMITTED)
      .map((evaluation) => [evaluation.judgeId, evaluation]),
  );
  const criterionIds = criteria.map(({ id }) => id);
  const totals = [];
  let complete = assignments.length > 0 && criteria.length > 0;

  for (const assignment of assignments) {
    const allowed = assignment.criterionIds.length
      ? criterionIds.filter((id) => assignment.criterionIds.includes(id))
      : criterionIds;
    const expectedSubcriteria = criteria
      .filter(({ id }) => allowed.includes(id))
      .flatMap(({ subCriteria }) => subCriteria.map(({ id }) => id));
    const evaluation = evaluationsByJudge.get(assignment.judgeId);
    if (!evaluation) {
      complete = false;
      continue;
    }
    if (
      evaluation.scores.length !== expectedSubcriteria.length ||
      expectedSubcriteria.some(
        (id) => !evaluation.scores.some((score) => score.subCriterionId === id),
      ) ||
      evaluation.scores.some(
        (score) =>
          !expectedSubcriteria.includes(score.subCriterionId) ||
          score.option.subCriterionId !== score.subCriterionId,
      )
    ) {
      throw new ConflictException(
        'Submitted evaluation does not match its assigned criteria',
      );
    }

    const criterionTotals: Record<string, number> = {};
    for (const score of evaluation.scores) {
      const criterionId = score.subCriterion.criterionId;
      criterionTotals[criterionId] =
        (criterionTotals[criterionId] ?? 0) + score.option.points;
    }
    totals.push({
      total: evaluation.scores.reduce(
        (sum, score) => sum + score.option.points,
        0,
      ),
      criterionTotals,
    });
  }

  const coveredCriteria = new Set(
    assignments.flatMap((assignment) =>
      assignment.criterionIds.length
        ? criterionIds.filter((id) => assignment.criterionIds.includes(id))
        : criterionIds,
    ),
  );
  if (criterionIds.some((id) => !coveredCriteria.has(id))) complete = false;
  const finalScore = complete
    ? calculateFinalScore(totals, criterionIds)
    : null;
  await tx.product.update({
    where: { id: productId },
    data:
      finalScore === null
        ? {
            status: existingEvaluationCount
              ? ProductStatus.SCORING
              : ProductStatus.SUBMITTED,
            finalScore: null,
            starRating: null,
          }
        : {
            status: ProductStatus.COMPLETED,
            finalScore,
            starRating: calculateStars(finalScore),
          },
  });
}
