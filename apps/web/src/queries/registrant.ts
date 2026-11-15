import { useQuery } from '@tanstack/react-query';
import { myProductsApi, myRegistrationUnitsApi } from '../api';
import { queryKeys } from '../constants/query-key';

export function useMyProducts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.myProducts.list,
    queryFn: async () => (await myProductsApi.list()).data,
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
