import type { AdminProductQuery } from '@ocop/shared';
import { API } from '../constants/api';
import { validateProductFile } from '../lib/attachments';
import type { AdminProduct, AdminProductDetail, ProductResults } from '../types/admin';
import type { ProductAttachmentRecord } from '../types/product';
import type { ProductWriteInput, RegistrantProduct } from '../types/registrant';
import { requestBlob, requestJson } from './base-request';

export type AdminProductCreateInput = ProductWriteInput & { registrantId: string; reason: string };
export type AdminProductUpdateInput = ProductWriteInput & { reason: string };

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
