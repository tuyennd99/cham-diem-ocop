import { BadRequestException, ConflictException } from '@nestjs/common';

export interface AssignmentEntryInput {
  judgeId: string;
  categoryId: string;
  criterionIds: string[];
}

export interface CategoryWithCriteria {
  id: string;
  name: string;
  criteriaSet?: {
    criteria: Array<{ id: string; code: string }>;
  } | null;
}

export function assignmentKey(judgeId: string, categoryId: string): string {
  return JSON.stringify([judgeId, categoryId]);
}

export function parseAssignmentKey(key: string): [string, string] {
  return JSON.parse(key) as [string, string];
}

export function validateAssignmentCriteriaScope(
  assignments: readonly AssignmentEntryInput[],
  categoryById: ReadonlyMap<string, CategoryWithCriteria>,
): void {
  for (const assignment of assignments) {
    const criteria = new Set(
      categoryById
        .get(assignment.categoryId)
        ?.criteriaSet?.criteria.map(({ id }) => id) ?? [],
    );
    if (
      assignment.criterionIds.some((criterionId) => !criteria.has(criterionId))
    ) {
      throw new BadRequestException(
        'Assignment criterion must belong to its category',
      );
    }
  }
}

export function assertOpenProductsCoveredByAssignments(
  assignments: readonly AssignmentEntryInput[],
  openProducts: ReadonlyArray<{ id: string; categoryId: string }>,
  categories: readonly CategoryWithCriteria[],
): void {
  const byCategory = new Map<string, AssignmentEntryInput[]>();
  for (const assignment of assignments) {
    const current = byCategory.get(assignment.categoryId) ?? [];
    current.push(assignment);
    byCategory.set(assignment.categoryId, current);
  }
  const coverageIssues: string[] = [];
  const openCategoryIds = new Set(
    openProducts.map(({ categoryId }) => categoryId),
  );
  for (const category of categories.filter(({ id }) =>
    openCategoryIds.has(id),
  )) {
    const categoryAssignments = byCategory.get(category.id) ?? [];
    const criteria = category.criteriaSet?.criteria ?? [];
    const covered = new Set(
      categoryAssignments.flatMap(({ criterionIds }) =>
        criterionIds.length ? criterionIds : criteria.map(({ id }) => id),
      ),
    );
    const missing = criteria.filter(({ id }) => !covered.has(id));
    if (!categoryAssignments.length || missing.length) {
      coverageIssues.push(
        `${category.name}: ${!categoryAssignments.length ? 'chưa có giám khảo' : `thiếu ${missing.map(({ code }) => code).join(', ')}`}`,
      );
    }
  }
  if (coverageIssues.length) {
    throw new ConflictException(
      `Phân công chưa phủ đủ tiêu chí cho ${coverageIssues.join('; ')}`,
    );
  }
}

export function computeChangedAssignmentKeys(
  before: readonly AssignmentEntryInput[],
  assignments: readonly AssignmentEntryInput[],
  categoryById: ReadonlyMap<string, CategoryWithCriteria>,
): { changedKeys: Set<string>; hasChanges: boolean } {
  const assignmentsByKey = new Map(
    assignments.map((assignment) => [
      assignmentKey(assignment.judgeId, assignment.categoryId),
      assignment,
    ]),
  );
  const previousByKey = new Map(
    before.map((assignment) => [
      assignmentKey(assignment.judgeId, assignment.categoryId),
      assignment,
    ]),
  );
  const allKeys = new Set([
    ...assignmentsByKey.keys(),
    ...previousByKey.keys(),
  ]);
  const changedKeys = new Set<string>();

  const sameScope = (judgeId: string, categoryId: string) => {
    const criteria =
      categoryById.get(categoryId)?.criteriaSet?.criteria.map(({ id }) => id) ??
      [];
    const resolve = (ids: string[] | undefined) =>
      ids?.length
        ? criteria.filter((id) => ids.includes(id)).sort()
        : ids
          ? [...criteria].sort()
          : [];
    const key = assignmentKey(judgeId, categoryId);
    const oldIds = resolve(previousByKey.get(key)?.criterionIds);
    const newIds = resolve(assignmentsByKey.get(key)?.criterionIds);
    return (
      oldIds.length === newIds.length &&
      oldIds.every((id, index) => id === newIds[index])
    );
  };

  for (const key of allKeys) {
    const [judgeId, categoryId] = parseAssignmentKey(key);
    if (!sameScope(judgeId, categoryId)) changedKeys.add(key);
  }

  return {
    changedKeys,
    hasChanges: changedKeys.size > 0 || before.length !== assignments.length,
  };
}
