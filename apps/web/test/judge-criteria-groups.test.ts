import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Criterion } from '@ocop/shared';
import { groupJudgeCriteria } from '../src/lib/judge-criteria-groups';

function criterion(
  id: string,
  code: string,
  sectionCode?: string | null,
  sectionName?: string | null,
): Criterion {
  return {
    id,
    code,
    name: `Criterion ${code}`,
    order: 1,
    maxScore: 10,
    sectionCode: sectionCode ?? null,
    sectionName: sectionName ?? null,
    subCriteria: [],
  };
}

describe('groupJudgeCriteria (#54)', () => {
  it('groups by explicit sectionCode/sectionName first, then A/B/C prefix and fallback while preserving order', () => {
    const groups = groupJudgeCriteria([
      criterion('1', 'A1'),
      criterion('2', 'X1', 'II', 'Kinh tế'),
      criterion('3', 'B1'),
      criterion('4', 'A2'),
      criterion('5', 'C1'),
      criterion('6', 'X2', 'II', 'Kinh tế'),
      criterion('7', 'Z9'),
      criterion('8', 'Y1', 'III'),
    ]);

    assert.deepEqual(
      groups.map((g) => ({
        key: g.key,
        label: g.label,
        ids: g.items.map((item) => item.id),
      })),
      [
        { key: 'A', label: 'A. Sản phẩm và sức mạnh cộng đồng', ids: ['1', '4'] },
        { key: 'II:Kinh tế', label: 'Phần II · Kinh tế', ids: ['2', '6'] },
        { key: 'B', label: 'B. Khả năng tiếp thị', ids: ['3'] },
        { key: 'C', label: 'C. Chất lượng sản phẩm', ids: ['5'] },
        { key: 'other', label: 'Tiêu chí được phân công', ids: ['7'] },
        { key: 'III:', label: 'Phần III', ids: ['8'] },
      ],
    );
  });
});
