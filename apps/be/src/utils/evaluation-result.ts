import { ConflictException } from '@nestjs/common';
import {
  EvaluationStatus,
  Prisma,
  ProductPublicationState,
  ProductStatus,
  Role,
  StaffPermission,
} from '@prisma/client';
import { PRODUCT_RESULT_HISTORY_ACTION } from '../constants/products';
import { databaseObject } from '../prisma/sql';
import { calculateFinalScore, calculateStars } from './scoring';
import { recordProductStatusEvent } from './product-status';

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
  actorId: string,
  triggerEvent: string = PRODUCT_RESULT_HISTORY_ACTION.RECOMPUTE,
): Promise<void> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      completedAt: true,
      finalScore: true,
      starRating: true,
      publicationState: true,
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
  if (!product) {
    throw new ConflictException(
      'Product changed while recomputing evaluation result',
    );
  }

  const productAssignments =
    typeof tx.productJudgeAssignment?.findMany === 'function'
      ? await tx.productJudgeAssignment.findMany({
          where: { productId },
          select: {
            judgeId: true,
            isActive: true,
            mustSubmitToComplete: true,
          },
        })
      : [];

  if (productAssignments.length === 0 && product.status === ProductStatus.COMPLETED) {
    return;
  }

  const criteria = product.category?.criteriaSet?.criteria ?? [];
  const criterionIds = criteria.map(({ id }) => id);
  const allSubcriterionIds = criteria.flatMap(({ subCriteria }) =>
    subCriteria.map(({ id }) => id),
  );

  if (productAssignments.length > 0) {
    const activeAssignments = productAssignments.filter((a) => a.isActive);
    const activeJudgeIds = activeAssignments.map((a) => a.judgeId);
    const evaluations = activeJudgeIds.length
      ? await tx.evaluation.findMany({
          where: {
            productId,
            judgeId: { in: activeJudgeIds },
            status: { not: EvaluationStatus.EXCLUDED },
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

    const submittedByJudge = new Map(
      evaluations
        .filter((e) => e.status === EvaluationStatus.SUBMITTED)
        .map((e) => [e.judgeId, e]),
    );

    const totals: Array<{
      total: number;
      criterionTotals: Record<string, number>;
    }> = [];

    for (const assignment of activeAssignments) {
      const evaluation = submittedByJudge.get(assignment.judgeId);
      if (!evaluation) continue;
      if (
        evaluation.scores.length !== allSubcriterionIds.length ||
        allSubcriterionIds.some(
          (id) =>
            !evaluation.scores.some((score) => score.subCriterionId === id),
        ) ||
        evaluation.scores.some(
          (score) =>
            !allSubcriterionIds.includes(score.subCriterionId) ||
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

    const mandatoryAssignments = activeAssignments.filter(
      (a) => a.mustSubmitToComplete,
    );
    const allMandatorySubmitted = mandatoryAssignments.every((a) =>
      submittedByJudge.has(a.judgeId),
    );
    const complete =
      criteria.length > 0 && totals.length >= 1 && allMandatorySubmitted;

    const finalScore = complete
      ? calculateFinalScore(totals, criterionIds)
      : null;
    const starRating = finalScore !== null ? calculateStars(finalScore) : null;

    const hasAnyActiveEvaluation = evaluations.length > 0;
    const nextStatus =
      finalScore !== null
        ? ProductStatus.COMPLETED
        : hasAnyActiveEvaluation || product.status === ProductStatus.SCORING
          ? ProductStatus.SCORING
          : ProductStatus.APPROVED;

    const scoreOrStarChanged =
      product.finalScore !== finalScore || product.starRating !== starRating;

    let nextPublicationState = product.publicationState;
    if (
      product.publicationState === ProductPublicationState.PUBLISHED &&
      scoreOrStarChanged
    ) {
      nextPublicationState = ProductPublicationState.UPDATING;
    }

    const transitionedAt =
      nextStatus !== product.status ? new Date() : undefined;
    const completedAt =
      nextStatus === ProductStatus.COMPLETED
        ? (product.completedAt ?? transitionedAt ?? new Date())
        : null;

    await tx.product.update({
      where: { id: productId },
      data: {
        status: nextStatus,
        finalScore,
        starRating,
        completedAt,
        publicationState: nextPublicationState,
      },
    });

    if (nextStatus !== product.status) {
      await recordProductStatusEvent(
        tx,
        productId,
        product.status,
        nextStatus,
        actorId,
        transitionedAt,
      );
    }

    if (
      scoreOrStarChanged ||
      nextPublicationState !== product.publicationState
    ) {
      await tx.productResultHistory.updateMany({
        where: { productId, isCurrent: true },
        data: { isCurrent: false },
      });
      await tx.productResultHistory.create({
        data: {
          productId,
          action: triggerEvent,
          finalScore,
          starRating,
          isCurrent: true,
          actorId,
          snapshot: {
            evaluationCount: totals.length,
            publicationState: nextPublicationState,
          },
        },
      });
    }
    return;
  }

  // Legacy fallback for products without ProductJudgeAssignment rows
  if (product.status === ProductStatus.COMPLETED) return;

  const assignments = await tx.judgeAssignment.findMany({
    where: {
      categoryId: product.categoryId,
      judge: {
        is: {
          role: { not: Role.REGISTRANT },
          staffPermissions: { has: StaffPermission.SCORE },
          isActive: true,
          verified: true,
        },
      },
    },
    select: { judgeId: true, criterionIds: true },
  });
  const existingEvaluationCount = await tx.evaluation.count({
    where: { productId, status: { not: EvaluationStatus.EXCLUDED } },
  });
  const evaluations = assignments.length
    ? await tx.evaluation.findMany({
        where: {
          productId,
          judgeId: { in: assignments.map(({ judgeId }) => judgeId) },
          status: { not: EvaluationStatus.EXCLUDED },
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
  const nextStatus =
    finalScore === null
      ? existingEvaluationCount
        ? ProductStatus.SCORING
        : product.status
      : ProductStatus.COMPLETED;
  const transitionedAt = nextStatus !== product.status ? new Date() : undefined;
  const completedAt =
    nextStatus === ProductStatus.COMPLETED
      ? (product.completedAt ?? transitionedAt)
      : undefined;
  await tx.product.update({
    where: { id: productId },
    data:
      finalScore === null
        ? {
            status: nextStatus,
            finalScore: null,
            starRating: null,
          }
        : {
            status: nextStatus,
            finalScore,
            starRating: calculateStars(finalScore),
            ...(completedAt ? { completedAt } : {}),
          },
  });
  if (nextStatus !== product.status) {
    await recordProductStatusEvent(
      tx,
      productId,
      product.status,
      nextStatus,
      actorId,
      transitionedAt,
    );
  }
}
