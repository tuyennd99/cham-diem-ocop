import type { JudgeQueueQuery } from '@ocop/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { judgeApi } from '../api';
import { queryKeys } from '../constants/query-key';

/** Returns the full `{ data, meta }` envelope with pagination & summary counts from backend. */
export function useJudgeQueue(query: JudgeQueueQuery = {}) {
  return useQuery({
    queryKey: queryKeys.judge.queue(query),
    queryFn: () => judgeApi.queue(query),
    placeholderData: keepPreviousData,
  });
}

export function useEvaluation(productId: string) {
  return useQuery({
    queryKey: queryKeys.judge.evaluation(productId),
    queryFn: async () => (await judgeApi.evaluation(productId)).data,
    // The scoring form is seeded from this data once; never serve a stale cached copy on re-entry.
    gcTime: 0,
  });
}
