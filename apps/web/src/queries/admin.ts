import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api';
import { queryKeys } from '../constants/query-key';

export function useAdminDashboard() {
  return useQuery({
    queryKey: queryKeys.admin.dashboard,
    queryFn: async () => (await adminApi.dashboard()).data,
  });
}

export function useAdminJudges() {
  return useQuery({
    queryKey: queryKeys.admin.judges,
    queryFn: async () => (await adminApi.judges()).data,
  });
}

export function useAdminAssignments() {
  return useQuery({
    queryKey: queryKeys.admin.assignments,
    queryFn: async () => (await adminApi.assignments()).data,
    // The assignment editor is seeded from this data once; always start from the server copy.
    gcTime: 0,
  });
}

/** Returns the full `{ data, meta }` envelope because the list needs pagination meta. */
export function useAdminProducts(page: number) {
  return useQuery({
    queryKey: queryKeys.admin.products(page),
    queryFn: () => adminApi.products(page),
  });
}

export function useAdminProductResults(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.productResults(id),
    queryFn: async () => (await adminApi.productResults(id)).data,
  });
}
