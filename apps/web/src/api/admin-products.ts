import type { AdminProductQuery } from '@ocop/shared';
import { API } from '../constants/api';
import { validateProductFile } from '../lib/attachments';
import type { AdminProduct, AdminProductDetail, ProductResults } from '../types/admin';
import type { ProductAttachmentRecord } from '../types/product';
import type { ProductWriteInput, RegistrantProduct } from '../types/registrant';
import { requestBlob, requestJson } from './base-request';

export type AdminProductCreateInput = ProductWriteInput & { registrantId: string; reason: string };
export type AdminProductUpdateInput = ProductWriteInput & { reason: string };

export interface AddProductJudgeAssignmentResponse {
  requiresRestoreConfirmation: true;
  previousEvaluation: {
    id: string;
    previousStatus: string;
    total: number | null;
    submittedAt: string | null;
    excludedAt: string | null;
    excludeReason: string | null;
    scoreCount: number;
  };
}

export const adminProductsApi = {
  list: (query: AdminProductQuery) =>
    requestJson<AdminProduct[]>({ url: API.admin.products, params: query }),
  detail: (id: string) => requestJson<AdminProductDetail>({ url: API.admin.product(id) }),
  create: (data: AdminProductCreateInput) =>
    requestJson<RegistrantProduct>({ url: API.admin.products, method: 'POST', data }),
  update: (id: string, data: AdminProductUpdateInput) =>
    requestJson<RegistrantProduct>({ url: API.admin.product(id), method: 'PUT', data }),
  remove: (id: string, reason: string) =>
    requestJson<{ id: string }>({ url: API.admin.product(id), method: 'DELETE', data: { reason } }),
  submit: (id: string, reason: string) =>
    requestJson<RegistrantProduct>({
      url: API.admin.productSubmit(id),
      method: 'POST',
      data: { reason },
    }),
  approve: (id: string, reason?: string) =>
    requestJson<AdminProductDetail>({
      url: API.admin.productApprove(id),
      method: 'POST',
      data: { reason },
    }),
  returnProduct: (id: string, reason: string) =>
    requestJson<AdminProductDetail>({
      url: API.admin.productReturn(id),
      method: 'POST',
      data: { reason },
    }),
  publishResults: (id: string, reason?: string) =>
    requestJson<AdminProductDetail>({
      url: API.admin.productPublishResults(id),
      method: 'POST',
      data: { reason },
    }),
  reopen: (id: string, reason: string) =>
    requestJson<AdminProductDetail>({
      url: API.admin.productReopen(id),
      method: 'POST',
      data: { reason },
    }),
  eligibleJudges: (id: string) =>
    requestJson<import('../types/admin').AdminJudge[]>({
      url: API.admin.productEligibleJudges(id),
    }),
  addAssignment: (
    id: string,
    data: { judgeId: string; reason?: string; confirmRestore?: boolean },
  ) =>
    requestJson<AdminProductDetail | AddProductJudgeAssignmentResponse>({
      url: API.admin.productAssignments(id),
      method: 'POST',
      data,
    }),
  removeAssignment: (id: string, judgeId: string, reason?: string) =>
    requestJson<AdminProductDetail>({
      url: API.admin.productAssignment(id, judgeId),
      method: 'DELETE',
      data: { reason },
    }),
  reopenEvaluation: (id: string, evaluationId: string, reason?: string) =>
    requestJson<AdminProductDetail>({
      url: API.admin.productEvaluationReopen(id, evaluationId),
      method: 'POST',
      data: { reason },
    }),
  attachments: (id: string) =>
    requestJson<ProductAttachmentRecord[]>({ url: API.admin.productAttachments(id) }),
  upload: (id: string, file: File, reason: string) => {
    validateProductFile(file);
    const data = new FormData();
    data.append('file', file);
    data.append('reason', reason);
    return requestJson<ProductAttachmentRecord>({
      url: API.admin.productAttachments(id),
      method: 'POST',
      data,
    });
  },
  attachment: (id: string, attachmentId: string) =>
    requestBlob(API.admin.productAttachment(id, attachmentId)),
  removeAttachment: (id: string, attachmentId: string, reason: string) =>
    requestJson<{ id: string }>({
      url: API.admin.productAttachment(id, attachmentId),
      method: 'DELETE',
      data: { reason },
    }),
  results: (id: string) => requestJson<ProductResults>({ url: API.admin.productResults(id) }),
};
