import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SortingState } from '@tanstack/react-table';
import { DEFAULT_PAGE_SIZE } from '@/constants/consts';
import { clampPage, getPageCount } from '@/lib/data-table-utils';

export interface ListSearchState {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface UsePaginatedListOptions<TSearch extends Record<string, any>> {
  /** Controlled search object (e.g. from TanStack Router `Route.useSearch()`). */
  search?: TSearch;
  /** Callback to update controlled search (e.g. `navigate({ search: next })`). */
  onSearchChange?: (next: TSearch) => void;
  /** Parser / normalizer to validate incoming search state. */
  parseSearch?: (raw: Record<string, unknown>) => TSearch;
  /** Default search values when uncontrolled. */
  defaultSearch: TSearch;
  /** Total item count across all pages (used to auto-clamp `page` when items are deleted). */
  total?: number;
  /** Whether the list query is currently loading/pending (prevents clamping while loading). */
  isLoading?: boolean;
  /** Default page size if `search.limit` is undefined. */
  defaultPageSize?: number;
  /** Default sort column ID if `search.sortBy` is undefined. */
  defaultSortBy?: string;
  /** Default sort direction if `search.sortDirection` is undefined. */
  defaultSortDirection?: 'asc' | 'desc';
}

export function usePaginatedList<TSearch extends Record<string, any>>({
  search: controlledSearch,
  onSearchChange,
  parseSearch,
  defaultSearch,
  total,
  isLoading = false,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  defaultSortBy,
  defaultSortDirection = 'desc',
}: UsePaginatedListOptions<TSearch>) {
  const [fallbackSearch, setFallbackSearch] = useState<TSearch>(defaultSearch);
  const appliedSearch = controlledSearch ?? fallbackSearch;

  const applySearch = useCallback(
    (next: TSearch) => {
      const normalized = parseSearch ? parseSearch(next as Record<string, unknown>) : next;
      if (onSearchChange) {
        onSearchChange(normalized);
      } else {
        setFallbackSearch(normalized);
      }
    },
    [onSearchChange, parseSearch],
  );

  const patchSearch = useCallback(
    (patch: Partial<TSearch>, resetPage = true) => {
      applySearch({
        ...appliedSearch,
        ...(resetPage ? { page: 1 } : {}),
        ...patch,
      });
    },
    [appliedSearch, applySearch],
  );

  const page = typeof appliedSearch.page === 'number' ? appliedSearch.page : 1;
  const pageSize = typeof appliedSearch.limit === 'number' ? appliedSearch.limit : defaultPageSize;

  const setPage = useCallback(
    (nextPage: number) => {
      applySearch({
        ...appliedSearch,
        page: Math.max(1, nextPage),
      });
    },
    [appliedSearch, applySearch],
  );

  const setPageSize = useCallback(
    (nextLimit: number) => {
      applySearch({
        ...appliedSearch,
        page: 1,
        limit: nextLimit,
      });
    },
    [appliedSearch, applySearch],
  );

  const sorting = useMemo<SortingState>(() => {
    const sortBy = typeof appliedSearch.sortBy === 'string' ? appliedSearch.sortBy : defaultSortBy;
    if (!sortBy) return [];
    const dir =
      appliedSearch.sortDirection === 'asc' || appliedSearch.sortDirection === 'desc'
        ? appliedSearch.sortDirection
        : defaultSortDirection;
    return [{ id: sortBy, desc: dir === 'desc' }];
  }, [appliedSearch.sortBy, appliedSearch.sortDirection, defaultSortBy, defaultSortDirection]);

  const setSorting = useCallback(
    (nextSorting: SortingState) => {
      const first = nextSorting[0];
      if (!first) {
        applySearch({
          ...appliedSearch,
          page: 1,
          sortBy: undefined,
          sortDirection: undefined,
        });
        return;
      }
      applySearch({
        ...appliedSearch,
        page: 1,
        sortBy: first.id,
        sortDirection: first.desc ? 'desc' : 'asc',
      });
    },
    [appliedSearch, applySearch],
  );

  // Auto-clamp page when deleting the last item on the current page leaves it out of bounds.
  useEffect(() => {
    if (isLoading || typeof total !== 'number') return;
    const maxPage = getPageCount(total, pageSize);
    const safePage = clampPage(page, maxPage);
    if (safePage !== page) {
      applySearch({
        ...appliedSearch,
        page: safePage,
      });
    }
  }, [appliedSearch, applySearch, isLoading, page, pageSize, total]);

  return {
    appliedSearch,
    applySearch,
    patchSearch,
    page,
    pageSize,
    setPage,
    setPageSize,
    sorting,
    setSorting,
  };
}

/**
 * Helper to sort & paginate an in-memory array when manual=false or client-side mode is used.
 */
export function paginateAndSortClientRows<T>(
  items: readonly T[],
  options: {
    page: number;
    pageSize: number;
    sorting: SortingState;
    accessors?: Record<string, (item: T) => string | number | boolean | null | undefined>;
  },
): { rows: T[]; total: number; page: number; totalPages: number } {
  const { page, pageSize, sorting, accessors } = options;
  let working = [...items];

  const activeSort = sorting[0];
  if (activeSort) {
    const dir = activeSort.desc ? -1 : 1;
    const getter =
      accessors?.[activeSort.id] ??
      ((item: T) =>
        (item as Record<string, unknown>)[activeSort.id] as
          string | number | boolean | null | undefined);

    working.sort((a, b) => {
      const valA = getter(a);
      const valB = getter(b);
      if (valA === valB) return 0;
      if (valA === null || valA === undefined || valA === '') return 1;
      if (valB === null || valB === undefined || valB === '') return -1;
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * dir;
      }
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return (Number(valA) - Number(valB)) * dir;
      }
      return String(valA).localeCompare(String(valB), 'vi') * dir;
    });
  }

  const total = working.length;
  const totalPages = getPageCount(total, pageSize);
  const safePage = clampPage(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    rows: working.slice(start, start + pageSize),
    total,
    page: safePage,
    totalPages,
  };
}
