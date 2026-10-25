import { calculateFinalScore, calculateStars } from './scoring';

describe('calculateStars', () => {
  it.each([
    [0, 1],
    [29.99, 1],
    [30, 2],
    [49.99, 2],
    [50, 3],
    [69.99, 3],
    [70, 4],
    [89.99, 4],
    [89.999, 4],
    [90, 5],
    [100, 5],
  ])(
    'maps %s points to %s star(s)',
    (score, stars) => expect(calculateStars(score)).toBe(stars),
  );
});

describe('calculateFinalScore', () => {
  it('averages complete evaluation totals', () => {
    expect(calculateFinalScore([
      { total: 90, criterionTotals: { a: 60, b: 30 } },
      { total: 70, criterionTotals: { a: 40, b: 30 } },
    ], ['a', 'b'])).toBe(80);
  });

  it('averages criterion-by-criterion for partial assignments', () => {
    expect(calculateFinalScore([
      { total: 80, criterionTotals: { a: 50, b: 30 } },
      { total: 40, criterionTotals: { a: 40 } },
    ], ['a', 'b'])).toBe(75);
  });

  it('leaves score empty when required coverage is missing', () => {
    expect(calculateFinalScore([{ total: 30, criterionTotals: { a: 30 } }], ['a', 'b'])).toBeNull();
  });
});

describe('OCOP scenario boundaries (SCORE-01..03)', () => {
  it('maps all SCORE-03 boundary scores without pre-rounding', () => {
    expect(calculateStars(0)).toBe(1);
    expect(calculateStars(29.99)).toBe(1);
    expect(calculateStars(30)).toBe(2);
    expect(calculateStars(49.99)).toBe(2);
    expect(calculateStars(50)).toBe(3);
    expect(calculateStars(69.99)).toBe(3);
    expect(calculateStars(70)).toBe(4);
    expect(calculateStars(89.99)).toBe(4);
    expect(calculateStars(89.999)).toBe(4);
    expect(calculateStars(90)).toBe(5);
    expect(calculateStars(100)).toBe(5);
  });

  it('computes SCORE-01 full assignment average (85 and 78 -> 81.5)', () => {
    expect(
      calculateFinalScore(
        [
          { total: 85, criterionTotals: { c1: 85 } },
          { total: 78, criterionTotals: { c1: 78 } },
        ],
        ['c1'],
      ),
    ).toBe(81.5);
  });

  it('computes SCORE-02 overlapping partial assignments (X=50 vs X=40,Y=35 -> 80)', () => {
    expect(
      calculateFinalScore(
        [
          { total: 50, criterionTotals: { X: 50 } },
          { total: 75, criterionTotals: { X: 40, Y: 35 } },
        ],
        ['X', 'Y'],
      ),
    ).toBe(80);
  });
});
