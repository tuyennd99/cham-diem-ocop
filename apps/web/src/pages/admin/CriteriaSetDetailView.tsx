import { useMemo, useRef, useState } from 'react';
import type { CatalogCriterion } from '@ocop/shared';
import { Card } from '@/components/ui/card';

/** Renders a criteria set detail layout with a sticky left navigation menu that scrolls to each criterion. */
export function CriteriaSetDetailView({ criteria }: { criteria: CatalogCriterion[] }) {
  const [selectedCriterionId, setSelectedCriterionId] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const activeId = selectedCriterionId ?? criteria[0]?.id ?? null;

  const sections = useMemo(() => {
    const groups: Array<{ key: string; label: string; items: CatalogCriterion[] }> = [];
    const byKey = new Map<string, (typeof groups)[number]>();
    for (const criterion of criteria) {
      const key = `${criterion.sectionCode}:${criterion.sectionName}`;
      let group = byKey.get(key);
      if (!group) {
        group = {
          key,
          label: `Phần ${criterion.sectionCode} · ${criterion.sectionName}`,
          items: [],
        };
        byKey.set(key, group);
        groups.push(group);
      }
      group.items.push(criterion);
    }
    return groups;
  }, [criteria]);

  if (criteria.length === 0) return null;

  return (
    <div className='grid items-start gap-4 md:grid-cols-[248px_minmax(0,1fr)]'>
      <aside
        aria-label='Mục lục tiêu chí'
        className='border-border bg-surface rounded-xl border p-3 md:sticky md:top-0 md:max-h-[calc(100dvh-6rem)] md:overflow-y-auto'
      >
        {sections.map((section) => (
          <div className='criteria-nav-group' key={section.key}>
            <h2>{section.label}</h2>
            {section.items.map((criterion) => {
              const isCurrent = criterion.id === activeId;
              return (
                <button
                  type='button'
                  key={criterion.id}
                  className={`criterion-nav-item ${isCurrent ? 'is-current' : ''}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => {
                    setSelectedCriterionId(criterion.id);
                    cardRefs.current[criterion.id]?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                >
                  <span className='criterion-nav-name'>
                    {criterion.code}. {criterion.name}
                  </span>
                  <span className='criterion-nav-meta'>
                    <span>Tối đa {criterion.maxScore} điểm</span>
                    <span>{criterion.subCriteria.length} chỉ tiêu</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </aside>

      <div className='grid min-w-0 gap-4'>
        {criteria.map((criterion) => (
          <div
            key={criterion.id}
            className='scroll-mt-4'
            ref={(el) => {
              cardRefs.current[criterion.id] = el;
            }}
          >
            <Card className='score-card p-4'>
              <h3>
                Phần {criterion.sectionCode} ({criterion.sectionName}) — {criterion.code}.{' '}
                {criterion.name} (Tối đa {criterion.maxScore} điểm)
              </h3>
              {criterion.subCriteria.map((sub) => (
                <div key={sub.id} className='mt-2'>
                  <strong>
                    {sub.code}. {sub.content}
                  </strong>
                  <ul>
                    {sub.options.map((opt) => (
                      <li key={opt.id}>
                        {opt.label} — <strong>{opt.points} điểm</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
