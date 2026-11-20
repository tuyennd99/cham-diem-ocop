import { Prisma } from '@prisma/client';
import {
  formatProductCode,
  PRODUCT_CODE_MIN_DIGITS,
  PRODUCT_CODE_PREFIX,
} from '@ocop/shared';
import { databaseObject } from '../prisma/sql';

export { formatProductCode, PRODUCT_CODE_MIN_DIGITS, PRODUCT_CODE_PREFIX };

const PRODUCT_CODE_QUERY_PATTERN = /^[ocop0-9-]+$/i;

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
    $queryRaw?: <T = unknown>(query: Prisma.Sql) => Promise<T>;
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
  if (!trimmed || !PRODUCT_CODE_QUERY_PATTERN.test(trimmed)) return [];

  if (typeof prisma.$queryRaw === 'function') {
    const codeExpr = Prisma.sql`(${PRODUCT_CODE_PREFIX} || LPAD(p."codeNumber"::text, GREATEST(${PRODUCT_CODE_MIN_DIGITS}, LENGTH(p."codeNumber"::text)), '0'))`;
    const isPrefixCodeQuery = /^o/i.test(trimmed);
    const pattern = isPrefixCodeQuery
      ? `${trimmed.toUpperCase()}%`
      : `%${trimmed}%`;
    const matchClause = isPrefixCodeQuery
      ? Prisma.sql`${codeExpr} LIKE ${pattern}`
      : Prisma.sql`${codeExpr} ILIKE ${pattern}`;
    const scopeClauses: Prisma.Sql[] = [
      Prisma.sql`p."codeNumber" IS NOT NULL`,
      Prisma.sql`p."codeNumber" >= 1`,
      matchClause,
    ];
    if (typeof baseWhere?.registrantId === 'string') {
      scopeClauses.push(
        Prisma.sql`p."registrantId" = ${baseWhere.registrantId}`,
      );
    }
    if (typeof baseWhere?.categoryId === 'string') {
      scopeClauses.push(Prisma.sql`p."categoryId" = ${baseWhere.categoryId}`);
    }
    const statusFilter = baseWhere?.status;
    if (typeof statusFilter === 'string') {
      scopeClauses.push(
        Prisma.sql`p."status" = ${statusFilter}::${databaseObject('ProductStatus')}`,
      );
    } else if (
      statusFilter &&
      typeof statusFilter === 'object' &&
      'not' in statusFilter &&
      typeof statusFilter.not === 'string'
    ) {
      scopeClauses.push(
        Prisma.sql`p."status" <> ${statusFilter.not}::${databaseObject('ProductStatus')}`,
      );
    } else if (
      statusFilter &&
      typeof statusFilter === 'object' &&
      'in' in statusFilter &&
      Array.isArray(statusFilter.in) &&
      statusFilter.in.length > 0
    ) {
      const enumValues = statusFilter.in.map(
        (status) => Prisma.sql`${status}::${databaseObject('ProductStatus')}`,
      );
      scopeClauses.push(Prisma.sql`p."status" IN (${Prisma.join(enumValues)})`);
    }

    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT p."id"
      FROM ${databaseObject('products')} p
      WHERE ${Prisma.join(scopeClauses, ' AND ')}
    `);
    return rows.map((row) => row.id);
  }

  if (typeof prisma.product?.findMany !== 'function') return [];
  const rows = await prisma.product.findMany({
    ...(baseWhere ? { where: baseWhere } : {}),
    select: { id: true, codeNumber: true },
  });
  return buildProductCodeMatchIds(trimmed, rows);
}
