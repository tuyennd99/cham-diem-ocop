export function formatExactScore(score: number | null | undefined): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) return '—';
  // Truncate toward zero at 2 decimal places so 89.999 never rounds up to 90.00
  const truncated = Math.trunc(score * 100) / 100;
  return Number.isInteger(truncated) ? String(truncated) : String(truncated);
}

export function formatStarRatingLabel(starRating: number | null | undefined): string {
  if (typeof starRating !== 'number' || !Number.isFinite(starRating)) {
    return 'Chưa xếp sao';
  }
  if (starRating === 5) {
    return 'Mức điểm 5 sao / Đề nghị xem xét 5 sao';
  }
  return `Mức điểm ${starRating} sao`;
}
