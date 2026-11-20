import type { SortDirection } from '@ocop/shared';

export type OrderByBuilder<T> = (direction?: SortDirection) => T[];

export function resolveOrderBy<K extends string, T>(
  sortBy: K | undefined,
  sortDirection: SortDirection | undefined,
  builders: Record<K, OrderByBuilder<T>>,
  defaultOrderBy: T[] | OrderByBuilder<T>,
): T[] {
  const builder = sortBy ? builders[sortBy] : undefined;
  if (builder) {
    return builder(sortDirection);
  }
  return typeof defaultOrderBy === 'function'
    ? defaultOrderBy(sortDirection)
    : defaultOrderBy;
}
