import { ConflictException } from '@nestjs/common';
import { assertCriteriaSetReady } from './category-availability';

describe('assertCriteriaSetReady', () => {
  it.each([
    null,
    {
      isActive: false,
      criteria: [{ maxScore: 100, subCriteria: [{ options: [{}] }] }],
    },
    { isActive: true, criteria: [] },
    { isActive: true, criteria: [{ maxScore: 100, subCriteria: [] }] },
    {
      isActive: true,
      criteria: [{ maxScore: 100, subCriteria: [{ options: [] }] }],
    },
    {
      isActive: true,
      criteria: [{ maxScore: 99, subCriteria: [{ options: [{}] }] }],
    },
    {
      isActive: true,
      criteria: [{ maxScore: 101, subCriteria: [{ options: [{}] }] }],
    },
  ])('rejects an unavailable or incomplete set: %j', (set) => {
    expect(() => assertCriteriaSetReady(set)).toThrow(ConflictException);
  });

  it('accepts a complete active set totaling exactly 100', () => {
    expect(() =>
      assertCriteriaSetReady({
        isActive: true,
        criteria: [
          { maxScore: 60, subCriteria: [{ options: [{ id: 'a' }] }] },
          { maxScore: 40, subCriteria: [{ options: [{ id: 'b' }] }] },
        ],
      }),
    ).not.toThrow();
  });
});
