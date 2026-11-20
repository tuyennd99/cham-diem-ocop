import type { MyProductQuery } from '@ocop/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { myProductsApi, myRegistrationUnitsApi } from '../api';
import { queryKeys } from '../constants/query-key';

export function useMyProducts(query: MyProductQuery = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.myProducts.list(query),
    queryFn: () => myProductsApi.list(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMyProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myProducts.detail(id ?? ''),
    queryFn: async () => (await myProductsApi.detail(id ?? '')).data,
    enabled: Boolean(id),
  });
}

export function useMyRegistrationUnits(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myRegistrationUnits.list,
    queryFn: async () => (await myRegistrationUnitsApi.list()).data,
    enabled,
  });
}
