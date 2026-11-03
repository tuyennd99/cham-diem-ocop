import type { ApiResult } from '../types/api';
import type { ProductAttachmentRecord } from '../types/product';
import type { ProductWriteInput, RegistrantProduct } from '../types/registrant';
import { ApiError, messageOf } from './api-error';
import {
  isVideoFileName,
  MAX_PRODUCT_FILES,
  MAX_PRODUCT_VIDEOS,
  validateProductFile,
} from './attachments';

export function canStartProductDraftSave(state: {
  reviewRequired: boolean;
  createOutcomeUnknown: boolean;
  declarationAccepted?: boolean;
}) {
  return (
    !state.reviewRequired &&
    !state.createOutcomeUnknown &&
    state.declarationAccepted !== false
  );
}

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
  const existingAttachments = input.existingProduct?.attachments ?? [];
  const existingVideos = existingAttachments.filter((att) => isVideoFileName(att.fileName)).length;
  const existingFiles = existingAttachments.length - existingVideos;
  const newVideos = input.files.filter((file) => isVideoFileName(file.name)).length;
  const newFiles = input.files.length - newVideos;

  if (existingFiles + newFiles > MAX_PRODUCT_FILES) {
    throw new Error(
      `Mỗi hồ sơ tối đa ${MAX_PRODUCT_FILES} tệp ảnh hoặc tài liệu (tối đa 2 MB/tệp).`,
    );
  }
  if (existingVideos + newVideos > MAX_PRODUCT_VIDEOS) {
    throw new Error(`Mỗi hồ sơ tối đa ${MAX_PRODUCT_VIDEOS} video (tối đa 50 MB).`);
  }

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
