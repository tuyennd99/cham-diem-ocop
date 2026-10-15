import { calculateFinalScore, calculateStars } from './scoring';

describe('calculateStars', () => {
  it.each([[0, 1], [29.99, 1], [30, 2], [50, 3], [70, 4], [90, 5], [100, 5]])(
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
