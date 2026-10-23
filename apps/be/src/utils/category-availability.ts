import { ConflictException } from '@nestjs/common';

export interface CriteriaAvailabilityInput {
  isActive: boolean;
  criteria: {
    maxScore: number;
    subCriteria: { options: unknown[] }[];
  }[];
}

export function assertCriteriaSetReady(set: CriteriaAvailabilityInput | null) {
  const criteria = set?.criteria ?? [];
  const maxScore = criteria.reduce(
    (sum, criterion) => sum + criterion.maxScore,
    0,
  );
  const complete =
    criteria.length > 0 &&
    criteria.every(
      (criterion) =>
        criterion.subCriteria.length > 0 &&
        criterion.subCriteria.every(
          (subCriterion) => subCriterion.options.length > 0,
        ),
    );
  if (!set?.isActive || !complete || maxScore !== 100) {
    throw new ConflictException(
      'A verified active 100-point criteria set is required',
    );
  }
}
