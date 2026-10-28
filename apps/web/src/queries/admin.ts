import type { AdminReportFilterQuery, AdminReportQuery } from '@ocop/shared';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../api';
import { queryKeys } from '../constants/query-key';

export function useAdminDashboard(query: AdminReportFilterQuery = {}, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.dashboard(query),
    queryFn: async () => (await adminApi.dashboard(query)).data,
    enabled,
  });
}

export function useAdminRegistrationsReport(query: AdminReportQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.reports.registrations(query),
    queryFn: async () => (await adminApi.registrationsReport(query)).data,
    enabled,
  });
}

export function useAdminResultsReport(query: AdminReportQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.admin.reports.results(query),
    queryFn: async () => (await adminApi.resultsReport(query)).data,
    enabled,
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
