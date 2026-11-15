import { Prisma } from '@prisma/client';
import { formatProductCode, PRODUCT_CODE_MIN_DIGITS, PRODUCT_CODE_PREFIX } from '@ocop/shared';

export { formatProductCode, PRODUCT_CODE_MIN_DIGITS, PRODUCT_CODE_PREFIX };

export function withProductCode<
  T extends { codeNumber?: number | null; code?: string },
>(product: T): T {
  const code =
    typeof product.codeNumber === 'number'
      ? formatProductCode(product.codeNumber)
      : typeof product.code === 'string' && product.code
        ? product.code
        : undefined;
  return code ? { ...product, code } : { ...product };
}

export function buildProductCodeMatchIds(
  query: string | undefined | null,
  rows: ReadonlyArray<{ id: string; codeNumber?: number | null }>,
): string[] {
  const trimmed = query?.trim().toLowerCase() ?? '';
  if (!trimmed) return [];
  const matchedIds: string[] = [];
  for (const row of rows) {
    if (typeof row.codeNumber !== 'number') continue;
    const code = formatProductCode(row.codeNumber).toLowerCase();
    if (code && code.includes(trimmed)) {
      matchedIds.push(row.id);
    }
  }
  return matchedIds;
}

export async function findProductIdsMatchingCodeQuery(
  prisma: {
    product?: {
      findMany?: (args: {
        where?: Prisma.ProductWhereInput;
        select: { id: true; codeNumber: true };
      }) => Promise<Array<{ id: string; codeNumber?: number | null }>>;
    };
  },
  query: string | undefined | null,
  baseWhere?: Prisma.ProductWhereInput,
): Promise<string[]> {
  const trimmed = query?.trim() ?? '';
  if (!trimmed || typeof prisma.product?.findMany !== 'function') return [];
  const rows = await prisma.product.findMany({
    ...(baseWhere ? { where: baseWhere } : {}),
    select: { id: true, codeNumber: true },
  });
  return buildProductCodeMatchIds(trimmed, rows);
}
