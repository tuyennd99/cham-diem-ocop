import { useQuery } from '@tanstack/react-query';
import { judgeApi } from '../api';
import { queryKeys } from '../constants/query-key';

export function useJudgeQueue() {
  return useQuery({
    queryKey: queryKeys.judge.queue,
    queryFn: async () => (await judgeApi.queue()).data,
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
