import type { Criterion } from '@ocop/shared';

export interface CriterionGroup {
  key: string;
  label: string;
  items: Criterion[];
}

const SECTION_PREFIX_META: ReadonlyArray<{
  prefix: RegExp;
  key: string;
  label: string;
}> = [
  { prefix: /^A/i, key: 'A', label: 'A. Sản phẩm và sức mạnh cộng đồng' },
  { prefix: /^B/i, key: 'B', label: 'B. Khả năng tiếp thị' },
  { prefix: /^C/i, key: 'C', label: 'C. Chất lượng sản phẩm' },
];

function resolveCriterionGroupMeta(criterion: Criterion): { key: string; label: string } {
  const secCode = criterion.sectionCode?.trim();
  const secName = criterion.sectionName?.trim();
  if (secCode) {
    return {
      key: `${secCode}:${secName ?? ''}`,
      label: secName ? `Phần ${secCode} · ${secName}` : `Phần ${secCode}`,
    };
  }
  const matched = SECTION_PREFIX_META.find((entry) => entry.prefix.test(criterion.code));
  if (matched) return { key: matched.key, label: matched.label };
  return { key: 'other', label: 'Tiêu chí được phân công' };
}

export function groupJudgeCriteria(criteria: readonly Criterion[]): CriterionGroup[] {
  const groups: CriterionGroup[] = [];
  const byKey = new Map<string, CriterionGroup>();

  for (const criterion of criteria) {
    const { key, label } = resolveCriterionGroupMeta(criterion);
    let group = byKey.get(key);
    if (!group) {
      group = { key, label, items: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    group.items.push(criterion);
  }

  return groups;
}
