import type { AdminCriteriaSetQuery, AdminEvaluationQuery } from '@ocop/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { scoringPrintApi } from '../api/scoring-print';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { queryKeys } from '../constants/query-key';

export function useAdminCriteriaSets(query: AdminCriteriaSetQuery) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.criteriaSets.list(query),
    queryFn: () => scoringPrintApi.criteriaSets(query),
    placeholderData: keepPreviousData,
  });
}

export function useAdminCriteriaSetDetail(id: string | null) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.criteriaSets.detail(id ?? ''),
    queryFn: () => scoringPrintApi.criteriaSetDetail(id!),
    enabled: Boolean(id),
  });
}

export function useCriteriaSetPrintData(id: string) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.criteriaSets.printData(id),
    queryFn: () => scoringPrintApi.criteriaSetPrintData(id),
    enabled: Boolean(id),
  });
}

export function useAdminEvaluations(query: AdminEvaluationQuery, enabled = true) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.evaluations.list(query),
    queryFn: () => scoringPrintApi.evaluations(query),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useEvaluationPrintData(evaluationId: string) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.evaluations.printData(evaluationId),
    queryFn: () => scoringPrintApi.evaluationPrintData(evaluationId),
    enabled: Boolean(evaluationId),
  });
}

export function useJudgeEvaluationPrintData(productId: string) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.judgeEvaluationPrintData(productId),
    queryFn: () => scoringPrintApi.judgeEvaluationPrintData(productId),
    enabled: Boolean(productId),
  });
}

export function useRegistrationPrintData(
  mode: typeof PRODUCT_WORKSPACE_MODE.ADMIN | typeof PRODUCT_WORKSPACE_MODE.OWNER,
  productId: string,
) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.registrationPrintData(mode, productId),
    queryFn: () =>
      mode === PRODUCT_WORKSPACE_MODE.ADMIN
        ? scoringPrintApi.adminRegistrationPrintData(productId)
        : scoringPrintApi.myRegistrationPrintData(productId),
    enabled: Boolean(productId),
  });
}

export function useResultsPrintData(
  mode: typeof PRODUCT_WORKSPACE_MODE.ADMIN | typeof PRODUCT_WORKSPACE_MODE.OWNER,
  productId: string,
) {
  return useQuery({
    queryKey: queryKeys.scoringPrint.resultsPrintData(mode, productId),
    queryFn: () =>
      mode === PRODUCT_WORKSPACE_MODE.ADMIN
        ? scoringPrintApi.adminResultsPrintData(productId)
        : scoringPrintApi.myResultsPrintData(productId),
    enabled: Boolean(productId),
  });
}
