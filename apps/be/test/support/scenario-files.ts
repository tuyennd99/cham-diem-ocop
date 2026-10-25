export const HONEY_E2E_POINTS: Record<string, { gk1: number; gk2: number }> = {
  '1.1': { gk1: 3, gk2: 3 },
  '1.2': { gk1: 2, gk2: 2 },
  '1.3': { gk1: 3, gk2: 3 },
  '1.4': { gk1: 3, gk2: 3 },
  '1.5': { gk1: 3, gk2: 3 },
  '1.6': { gk1: 3, gk2: 3 },
  '1.7': { gk1: 1, gk2: 1 },
  '2.1': { gk1: 3, gk2: 3 },
  '2.2': { gk1: 3, gk2: 3 },
  '2.3': { gk1: 3, gk2: 3 },
  '2.4': { gk1: 1, gk2: 1 },
  '3.1': { gk1: 3, gk2: 3 },
  '3.2': { gk1: 1, gk2: 1 },
  '3.3': { gk1: 3, gk2: 3 },
  '3.4': { gk1: 2, gk2: 2 },
  '3.5': { gk1: 3, gk2: 3 },
  '4.1': { gk1: 5, gk2: 5 },
  '4.2': { gk1: 3, gk2: 3 },
  '4.3': { gk1: 5, gk2: 5 },
  '5.1': { gk1: 5, gk2: 5 },
  '5.2': { gk1: 2, gk2: 2 },
  '5.3': { gk1: 5, gk2: 5 },
  '6.1': { gk1: 2, gk2: 2 },
  '6.2': { gk1: 2, gk2: 2 },
  '6.3': { gk1: 4, gk2: 2 },
  '6.4': { gk1: 4, gk2: 0 },
  '7': { gk1: 0, gk2: 0 },
  '8': { gk1: 0, gk2: 0 },
  '9': { gk1: 2, gk2: 2 },
  '10': { gk1: 1, gk2: 1 },
  '11': { gk1: 1, gk2: 1 },
  '12': { gk1: 1, gk2: 1 },
};

export interface ScenarioCriterion {
  id?: string;
  code?: string;
  subCriteria: Array<{
    id: string;
    code: string;
    options: Array<{
      id: string;
      points: number;
      label?: string;
    }>;
  }>;
}

export function buildHoneyScores(
  criteria: ScenarioCriterion[],
  judge: 'gk1' | 'gk2',
  overrides?: Record<string, number>,
  notes?: Record<string, string>,
): Array<{ subCriterionId: string; optionId: string; note?: string }> {
  const scores: Array<{ subCriterionId: string; optionId: string; note?: string }> = [];
  for (const criterion of criteria) {
    for (const sub of criterion.subCriteria) {
      const targetPoints = overrides?.[sub.code] ?? HONEY_E2E_POINTS[sub.code]?.[judge];
      if (targetPoints === undefined) {
        throw new Error(`Missing target points for sub-criterion ${sub.code} (${judge})`);
      }
      const option = sub.options.find((opt) => opt.points === targetPoints);
      if (!option) {
        throw new Error(
          `No option with ${targetPoints} points found for sub-criterion ${sub.code}`,
        );
      }
      const note = notes?.[sub.code];
      scores.push({
        subCriterionId: sub.id,
        optionId: option.id,
        ...(note ? { note } : {}),
      });
    }
  }
  return scores;
}

const TEN_MIB = 10 * 1024 * 1024;

export const scenarioBuffers = {
  validJpg(): Buffer {
    return Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
  },

  validPng(): Buffer {
    return Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  },

  validPdf(byteLength = 1024): Buffer {
    const header = Buffer.from('%PDF-1.4\n', 'ascii');
    const footer = Buffer.from('\n%%EOF\n', 'ascii');
    if (byteLength < header.length + footer.length) {
      throw new Error(
        `PDF byteLength must be at least ${header.length + footer.length} bytes`,
      );
    }
    const buffer = Buffer.alloc(byteLength, 0x20);
    header.copy(buffer, 0);
    footer.copy(buffer, byteLength - footer.length);
    return buffer;
  },

  overLimitPdf(): Buffer {
    return scenarioBuffers.validPdf(TEN_MIB + 1);
  },

  emptyBuffer(): Buffer {
    return Buffer.alloc(0);
  },

  fakeSignaturePdf(): Buffer {
    return Buffer.from('MZ-fake-executable-not-a-pdf', 'utf8');
  },
};
