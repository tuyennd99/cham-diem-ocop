import type {
  Criterion,
  Evaluation,
  EvaluationScore,
  JudgeQueueCounts,
  JudgeQueueMeta,
  JudgeQueueQuery,
  Product,
  ProductAttachment,
} from '@ocop/shared';
import type { Attachment, Category } from './product';

export type { JudgeQueueCounts, JudgeQueueMeta, JudgeQueueQuery };

export type QueueProduct = Pick<
  Product,
  | 'id'
  | 'code'
  | 'codeNumber'
  | 'name'
  | 'description'
  | 'status'
  | 'createdAt'
  | 'updatedAt'
  | 'category'
> & {
  createdAt: string;
  updatedAt?: string;
  category: Category;
  attachments: Attachment[];
  attachmentCount?: number;
  evaluations: { status: string; total: number | null }[];
};

export interface EvaluationData {
  product: Pick<Product, 'id' | 'code' | 'codeNumber' | 'name' | 'description'> & {
    formData: Record<string, unknown>;
    category: Pick<Category, 'id' | 'name'>;
    attachments: Required<Pick<ProductAttachment, 'id' | 'fileName' | 'type'>>[];
  };
  criteria: Criterion[];
  evaluation: Evaluation;
}

export interface SaveEvaluationInput {
  scores: EvaluationScore[];
  versionToken?: string;
}
export interface SubmitEvaluationInput {
  versionToken?: string;
}
export interface SavedEvaluation {
  id: string;
  status: string;
  scores: EvaluationScore[];
  versionToken?: string;
}
export interface SubmittedEvaluation {
  id: string;
  status: string;
  total: number;
  versionToken?: string;
}
