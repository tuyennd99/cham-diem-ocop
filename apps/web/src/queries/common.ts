import type { PublicLocalityQuery } from '@ocop/shared';
import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import { authApi, productsApi } from '../api';
import { queryKeys } from '../constants/query-key';
import { isSeoEligibleProduct } from '../lib/seo';
import type { PublicProductParams } from '../types/public';

export type { CategoryRecord } from '../types/product';
export type { PublicProductParams } from '../types/public';

// `/categories` returns the full shape (classification + criteria set); views pick what they need.

export function categoriesQueryOptions() {
  return queryOptions({
    queryKey: queryKeys.categories,
    queryFn: async () => (await productsApi.categories()).data,
    staleTime: 5 * 60_000,
  });
}

function sanitizePublicProductItem<T>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  const record = item as {
    publicationState?: string | null;
    finalScore?: number | null;
    starRating?: number | null;
  };
  if (record.publicationState === 'PUBLISHED') return item;
  const next = { ...item } as typeof record;
  if ('finalScore' in record) next.finalScore = null;
  if ('starRating' in record) next.starRating = null;
  return next as T;
}

export function publicProductsQueryOptions<T>(params: PublicProductParams) {
  return queryOptions({
    queryKey: queryKeys.publicProducts.list(params),
    queryFn: async () => {
      const result = await productsApi.list<T>(params);
      const sanitized = (result.data ?? []).map(sanitizePublicProductItem);
      if (!params.approvedOnly) {
        return {
          ...result,
          data: sanitized,
        };
      }
      return {
        ...result,
        data: sanitized.filter((item) =>
          isSeoEligibleProduct(
            item as { status?: string | null; approvedAt?: string | Date | null },
          ),
        ),
      };
    },
  });
}

export function publicProductDetailQueryOptions<T>(id: string) {
  return queryOptions({
    queryKey: queryKeys.publicProducts.detail(id),
    queryFn: async () => sanitizePublicProductItem((await productsApi.detail<T>(id)).data),
  });
}

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await authApi.me()).data,
  });
}

export function useCategories(enabled = true) {
  return useQuery({
    ...categoriesQueryOptions(),
    enabled,
  });
}

export function useLocalities(
  query: Pick<PublicLocalityQuery, 'page' | 'limit' | 'q' | 'provinceName'>,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.localities.list(query),
    queryFn: () => productsApi.localities(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Returns the full `{ data, meta }` envelope because lists need pagination meta. */
export function usePublicProducts<T>(params: PublicProductParams) {
  return useQuery({
    ...publicProductsQueryOptions<T>(params),
    placeholderData: keepPreviousData,
  });
}

export function usePublicProduct<T>(id: string) {
  return useQuery({
    ...publicProductDetailQueryOptions<T>(id),
  });
}
