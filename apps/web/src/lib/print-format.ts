import { formatProductCode } from '@ocop/shared';

export { formatProductCode };

export function displayProductCode(
  product:
    | {
        id: string;
        code?: string | null;
        codeNumber?: number | null;
      }
    | null
    | undefined,
): string {
  if (!product) return '';
  if (typeof product.code === 'string' && product.code.trim().length > 0) {
    return product.code.trim();
  }
  if (typeof product.codeNumber === 'number') {
    const formatted = formatProductCode(product.codeNumber);
    if (formatted) return formatted;
  }
  return product.id;
}

export function matchesProductSearchKeyword(
  product: {
    id: string;
    name: string;
    code?: string | null;
    codeNumber?: number | null;
  },
  keyword: string | undefined | null,
): boolean {
  const trimmed = keyword?.trim().toLowerCase() ?? '';
  if (!trimmed) return true;
  const code = displayProductCode(product).toLowerCase();
  return (
    product.name.toLowerCase().includes(trimmed) ||
    product.id.toLowerCase().includes(trimmed) ||
    (code.length > 0 && code.includes(trimmed))
  );
}

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
