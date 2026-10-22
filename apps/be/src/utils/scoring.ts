export interface EvaluationCriterionTotals {
  total: number;
  criterionTotals: Readonly<Record<string, number>>;
}

export function calculateStars(score: number): number {
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw new RangeError('Score must be a finite number between 0 and 100');
  }

  if (score >= 90) return 5;
  if (score >= 70) return 4;
  if (score >= 50) return 3;
  if (score >= 30) return 2;
  return 1;
}

export function calculateFinalScore(
  evaluations: readonly EvaluationCriterionTotals[],
  criterionIds: readonly string[],
): number | null {
  if (evaluations.length === 0 || criterionIds.length === 0) return null;

  for (const evaluation of evaluations) {
    if (!Number.isFinite(evaluation.total) || evaluation.total < 0) {
      throw new RangeError('Evaluation totals must be finite and non-negative');
    }
    for (const points of Object.values(evaluation.criterionTotals)) {
      if (!Number.isFinite(points) || points < 0) {
        throw new RangeError('Criterion totals must be finite and non-negative');
      }
    }
  }

  const fullCoverage = evaluations.every((evaluation) =>
    criterionIds.every((criterionId) => criterionId in evaluation.criterionTotals),
  );
  if (fullCoverage) {
    return evaluations.reduce((sum, evaluation) => sum + evaluation.total, 0) / evaluations.length;
  }

  let finalScore = 0;
  for (const criterionId of criterionIds) {
    const totals = evaluations
      .map((evaluation) => evaluation.criterionTotals[criterionId])
      .filter((points): points is number => points !== undefined);
    if (totals.length === 0) return null;
    finalScore += totals.reduce((sum, points) => sum + points, 0) / totals.length;
  }

  return finalScore;
}
