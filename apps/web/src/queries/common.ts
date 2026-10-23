import type { PublicLocalityQuery } from '@ocop/shared';
import { useQuery } from '@tanstack/react-query';
import { authApi, productsApi } from '../api';
import { queryKeys } from '../constants/query-key';
import type { PublicProductParams } from '../types/public';

export type { CategoryRecord } from '../types/product';
export type { PublicProductParams } from '../types/public';

// `/categories` returns the full shape (classification + criteria set); views pick what they need.

export function useMe() {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => (await authApi.me()).data,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => (await productsApi.categories()).data,
    staleTime: 5 * 60_000,
  });
}

export function useLocalities(
  query: Pick<PublicLocalityQuery, 'page' | 'limit' | 'q'>,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.localities.list(query),
    queryFn: () => productsApi.localities(query),
    enabled,
  });
}

/** Returns the full `{ data, meta }` envelope because lists need pagination meta. */
export function usePublicProducts<T>(params: PublicProductParams) {
  return useQuery({
    queryKey: queryKeys.publicProducts.list(params),
    queryFn: () => productsApi.list<T>(params),
  });
}

export function usePublicProduct<T>(id: string) {
  return useQuery({
    queryKey: queryKeys.publicProducts.detail(id),
    queryFn: async () => (await productsApi.detail<T>(id)).data,
  });
}
