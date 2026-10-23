import type { ApiResult } from '../types/api';
import type { ProductAttachmentRecord } from '../types/product';
import type { ProductWriteInput, RegistrantProduct } from '../types/registrant';
import { ApiError, messageOf } from './api-error';
import { validateProductFile } from './attachments';

const MAX_PRODUCT_ATTACHMENTS = 20;

export interface ProductDraftCommands {
  create(payload: ProductWriteInput): Promise<ApiResult<RegistrantProduct>>;
  update(id: string, payload: ProductWriteInput): Promise<ApiResult<RegistrantProduct>>;
  upload(id: string, file: File): Promise<ApiResult<ProductAttachmentRecord>>;
  detail(id: string): Promise<ApiResult<RegistrantProduct>>;
}

export type DraftSaveResult =
  | { kind: 'saved'; product: RegistrantProduct }
  | {
      kind: 'upload-failed';
      product: RegistrantProduct;
      message: string;
      requiresReview: boolean;
      remainingFiles: File[];
    };

export async function saveProductDraft(input: {
  existingProduct?: RegistrantProduct;
  payload: ProductWriteInput;
  files: File[];
  commands: ProductDraftCommands;
}): Promise<DraftSaveResult> {
  for (const file of input.files) validateProductFile(file);
  if (
    (input.existingProduct?.attachments.length ?? 0) + input.files.length >
    MAX_PRODUCT_ATTACHMENTS
  )
    throw new Error(`Mỗi hồ sơ tối đa ${MAX_PRODUCT_ATTACHMENTS} tệp.`);

  const payload = input.existingProduct
    ? {
        ...input.payload,
        formData: { ...input.existingProduct.formData, ...input.payload.formData },
      }
    : input.payload;
  let product = input.existingProduct
    ? (await input.commands.update(input.existingProduct.id, payload)).data
    : (await input.commands.create(payload)).data;

  for (let index = 0; index < input.files.length; index++) {
    const file = input.files[index];
    try {
      const { data: uploaded } = await input.commands.upload(product.id, file);
      product = {
        ...product,
        attachments: product.attachments.some(({ id }) => id === uploaded.id)
          ? product.attachments
          : [...product.attachments, uploaded],
      };
    } catch (error) {
      const remainingFiles = input.files.slice(index);
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return {
          kind: 'upload-failed',
          product,
          message: messageOf(error),
          requiresReview: false,
          remainingFiles,
        };
      }

      let refreshMessage = '';
      try {
        product = (await input.commands.detail(product.id)).data;
      } catch (refreshError) {
        refreshMessage = ` Chưa tải lại được hồ sơ: ${messageOf(refreshError)}`;
      }
      return {
        kind: 'upload-failed',
        product,
        message: `Chưa xác nhận tải tệp. Hãy kiểm tra danh sách tệp trước khi chọn lại.${refreshMessage}`,
        requiresReview: true,
        remainingFiles: [],
      };
    }
  }

  return { kind: 'saved', product };
}
