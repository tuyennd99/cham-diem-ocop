import { useQuery } from "@tanstack/react-query";
import { myProductsApi } from "../api";
import { queryKeys } from "../constants/query-key";

export function useMyProducts() {
  return useQuery({
    queryKey: queryKeys.myProducts.list,
    queryFn: async () => (await myProductsApi.list()).data,
  });
}

export function useMyProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.myProducts.detail(id ?? ""),
    queryFn: async () => (await myProductsApi.detail(id ?? "")).data,
    enabled: Boolean(id),
  });
}
