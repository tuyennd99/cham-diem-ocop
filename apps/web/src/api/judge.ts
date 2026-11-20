import { API } from '../constants/api';
import type {
  EvaluationData,
  JudgeQueueMeta,
  JudgeQueueQuery,
  QueueProduct,
  SavedEvaluation,
  SaveEvaluationInput,
  SubmitEvaluationInput,
  SubmittedEvaluation,
} from '../types/judge';
import { requestBlob, requestJson } from './base-request';

export const judgeApi = {
  queue: (params?: JudgeQueueQuery) =>
    requestJson<QueueProduct[], JudgeQueueMeta>({ url: API.judge.products, params }),
  evaluation: (id: string) => requestJson<EvaluationData>({ url: API.judge.evaluation(id) }),
  save: (id: string, data: SaveEvaluationInput) =>
    requestJson<SavedEvaluation>({ url: API.judge.evaluation(id), method: 'PUT', data }),
  submit: (id: string, data?: SubmitEvaluationInput) =>
    requestJson<SubmittedEvaluation>({ url: API.judge.submitEvaluation(id), method: 'POST', data }),
  attachment: (id: string, attachmentId: string) =>
    requestBlob(API.judge.attachment(id, attachmentId)),
};
