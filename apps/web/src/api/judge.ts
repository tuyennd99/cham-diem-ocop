import { API } from '../constants/api';
import type {
  EvaluationData,
  QueueProduct,
  SavedEvaluation,
  SaveEvaluationInput,
  SubmittedEvaluation,
} from '../types/judge';
import { requestBlob, requestJson } from './base-request';

export const judgeApi = {
  queue: () => requestJson<QueueProduct[]>({ url: API.judge.products }),
  evaluation: (id: string) => requestJson<EvaluationData>({ url: API.judge.evaluation(id) }),
  save: (id: string, data: SaveEvaluationInput) =>
    requestJson<SavedEvaluation>({ url: API.judge.evaluation(id), method: 'PUT', data }),
  submit: (id: string) =>
    requestJson<SubmittedEvaluation>({ url: API.judge.submitEvaluation(id), method: 'POST' }),
  attachment: (id: string, attachmentId: string) =>
    requestBlob(API.judge.attachment(id, attachmentId)),
};
