import type { Assignment, AssignmentInput } from '../types/admin';

export function assignmentScopeFor(
  assignments: readonly Pick<Assignment, 'judgeId' | 'categoryId' | 'criterionIds'>[],
  judgeId: string,
  categoryId: string,
): string[] {
  return [
    ...(assignments.find(
      (row) => row.judgeId === judgeId && row.categoryId === categoryId,
    )?.criterionIds ?? []),
  ];
}

export function assignmentPayload(assignments: readonly Assignment[]): AssignmentInput[] {
  return assignments.map(({ judgeId, categoryId, criterionIds }) => ({
    judgeId,
    categoryId,
    criterionIds: [...criterionIds],
  }));
}
