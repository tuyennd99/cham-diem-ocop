import { API } from '../constants/api';
import { validateProductFile } from '../lib/attachments';
import type { ProductAttachmentRecord } from '../types/product';
import type {
  ProductWriteInput,
  RegistrantProduct,
  RegistrationUnitRecord,
  RegistrationUnitWriteInput,
} from '../types/registrant';
import { requestBlob, requestJson } from './base-request';

export const myProductsApi = {
  list: () => requestJson<RegistrantProduct[]>({ url: API.my.products }),
  detail: (id: string) => requestJson<RegistrantProduct>({ url: API.my.product(id) }),
  create: (data: ProductWriteInput) =>
    requestJson<RegistrantProduct>({ url: API.my.products, method: 'POST', data }),
  update: (id: string, data: ProductWriteInput) =>
    requestJson<RegistrantProduct>({ url: API.my.product(id), method: 'PUT', data }),
  remove: (id: string) =>
    requestJson<{ id: string }>({ url: API.my.product(id), method: 'DELETE' }),
  submit: (id: string) =>
    requestJson<RegistrantProduct>({ url: API.my.submit(id), method: 'POST' }),
  upload: (id: string, file: File) => {
    validateProductFile(file);
    const data = new FormData();
    data.append('file', file);
    return requestJson<ProductAttachmentRecord>({
      url: API.my.attachments(id),
      method: 'POST',
      data,
    });
  },
  attachment: (id: string, attachmentId: string) =>
    requestBlob(API.my.attachment(id, attachmentId)),
  removeAttachment: (id: string, attachmentId: string) =>
    requestJson<{ id: string }>({ url: API.my.attachment(id, attachmentId), method: 'DELETE' }),
};

export const myRegistrationUnitsApi = {
  list: () => requestJson<RegistrationUnitRecord[]>({ url: API.my.registrationUnits }),
  create: (data: RegistrationUnitWriteInput) =>
    requestJson<RegistrationUnitRecord>({
      url: API.my.registrationUnits,
      method: 'POST',
      data,
    }),
  update: (id: string, data: RegistrationUnitWriteInput) =>
    requestJson<RegistrationUnitRecord>({
      url: API.my.registrationUnit(id),
      method: 'PUT',
      data,
    }),
  remove: (id: string) =>
    requestJson<{ deleted: boolean }>({
      url: API.my.registrationUnit(id),
      method: 'DELETE',
    }),
};
