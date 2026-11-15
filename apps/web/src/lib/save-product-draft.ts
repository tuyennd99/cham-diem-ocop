import { DRAFT_SAVE_RESULT_KIND, PRODUCT_REGISTRATION_TYPE } from '../constants/consts';
import type { ApiResult } from '../types/api';
import type { ProductAttachmentRecord } from '../types/product';
import type { ProductWriteInput, RegistrantFormData, RegistrantProduct } from '../types/registrant';
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
    !state.reviewRequired && !state.createOutcomeUnknown && state.declarationAccepted !== false
  );
}

const VALID_REGISTRATION_TYPES = new Set<string>([
  PRODUCT_REGISTRATION_TYPE.FIRST,
  PRODUCT_REGISTRATION_TYPE.UPGRADE,
  PRODUCT_REGISTRATION_TYPE.REASSESSMENT,
]);

export interface DirectSubmitValidationInput {
  name: string;
  categoryId: string;
  categoryUnavailable?: boolean;
  localityId?: string | null;
  localityName?: string | null;
  provinceName?: string | null;
  entityName?: string | null;
  representativeName?: string | null;
  representativeTitle?: string | null;
  contactAddress?: string | null;
  phone?: string | null;
  email?: string | null;
  registrationType?: RegistrantFormData['registrationType'] | string | null;
  sampleQuantity?: number | string | null;
  assessmentYear?: number | string | null;
  declarationAccepted?: boolean;
}

export type ProductDraftFieldErrorKey =
  | 'provinceName'
  | 'localityId'
  | 'assessmentYear'
  | 'entityName'
  | 'representativeName'
  | 'representativeTitle'
  | 'phone'
  | 'contactAddress'
  | 'name'
  | 'categoryId'
  | 'registrationType'
  | 'sampleQuantity'
  | 'declarationAccepted';

export const PRODUCT_DRAFT_FIELD_ELEMENT_IDS: Record<ProductDraftFieldErrorKey, string> = {
  provinceName: 'product-draft-1',
  localityId: 'editor-locality-select',
  assessmentYear: 'product-draft-2',
  entityName: 'product-draft-entityName',
  representativeName: 'product-draft-representativeName',
  representativeTitle: 'product-draft-representativeTitle',
  phone: 'product-draft-phone',
  contactAddress: 'product-draft-3',
  name: 'product-draft-4',
  categoryId: 'product-draft-5',
  registrationType: 'product-draft-7',
  sampleQuantity: 'product-draft-sample-qty',
  declarationAccepted: 'product-draft-declaration',
};

const PRODUCT_DRAFT_FIELD_ORDER: ProductDraftFieldErrorKey[] = [
  'provinceName',
  'localityId',
  'assessmentYear',
  'entityName',
  'representativeName',
  'representativeTitle',
  'phone',
  'contactAddress',
  'name',
  'categoryId',
  'registrationType',
  'sampleQuantity',
  'declarationAccepted',
];

function parseStrictNumber(raw: number | string | null | undefined): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.trim() !== '') return Number(raw);
  return NaN;
}

export function getProductDraftFieldErrors(
  input: DirectSubmitValidationInput,
  options?: { intent?: 'draft' | 'submit' },
): Partial<Record<ProductDraftFieldErrorKey, string>> {
  const actionSuffix =
    options?.intent === 'draft' ? 'trước khi lưu bản nháp.' : 'trước khi nộp hồ sơ.';
  const errors: Partial<Record<ProductDraftFieldErrorKey, string>> = {};
  if (!input.provinceName?.trim()) {
    errors.provinceName = `Chọn Tỉnh/Thành phố ${actionSuffix}`;
  }
  if (!input.localityId?.trim() && !input.localityName?.trim()) {
    errors.localityId = `Chọn Xã/Phường ${actionSuffix}`;
  }
  const assessmentYear = parseStrictNumber(input.assessmentYear);
  if (!Number.isInteger(assessmentYear) || assessmentYear < 2020 || assessmentYear > 2100) {
    errors.assessmentYear = 'Năm đánh giá (năm đăng ký) phải là số nguyên từ 2020 đến 2100.';
  }
  if (!input.entityName?.trim()) {
    errors.entityName = `Nhập tên đơn vị sản xuất ${actionSuffix}`;
  }
  if (!input.representativeName?.trim()) {
    errors.representativeName = `Nhập người đại diện ${actionSuffix}`;
  }
  if (!input.representativeTitle?.trim()) {
    errors.representativeTitle = `Nhập chức vụ người đại diện ${actionSuffix}`;
  }
  if (!input.phone?.trim() && !input.email?.trim()) {
    errors.phone = `Nhập ít nhất số điện thoại hoặc email liên hệ ${actionSuffix}`;
  }
  if (!input.contactAddress?.trim()) {
    errors.contactAddress = `Nhập địa chỉ liên hệ ${actionSuffix}`;
  }
  if (!input.name.trim()) {
    errors.name = `Nhập tên sản phẩm ${actionSuffix}`;
  }
  if (!input.categoryId.trim()) {
    errors.categoryId = `Chọn danh mục sản phẩm ${actionSuffix}`;
  } else if (input.categoryUnavailable) {
    errors.categoryId =
      'Danh mục của bản nháp đã ngừng sử dụng; hãy chọn danh mục đang hoạt động trước khi nộp.';
  }
  if (!input.registrationType || !VALID_REGISTRATION_TYPES.has(input.registrationType)) {
    errors.registrationType = `Chọn lần đăng ký đánh giá (hình thức đăng ký) ${actionSuffix}`;
  }
  const sampleQuantity = parseStrictNumber(input.sampleQuantity);
  if (!Number.isInteger(sampleQuantity) || sampleQuantity < 1 || sampleQuantity > 100000) {
    errors.sampleQuantity = 'Số lượng mẫu phải là số nguyên từ 1 đến 100000.';
  }
  if (input.declarationAccepted !== true) {
    errors.declarationAccepted = `Vui lòng xác nhận cam kết ${actionSuffix}`;
  }
  return errors;
}

export function getFirstInvalidProductDraftElementId(
  errors: Partial<Record<ProductDraftFieldErrorKey, string>>,
): string | null {
  for (const key of PRODUCT_DRAFT_FIELD_ORDER) {
    if (errors[key]) {
      return PRODUCT_DRAFT_FIELD_ELEMENT_IDS[key];
    }
  }
  return null;
}

export function getProductSubmitValidationIssues(
  input: DirectSubmitValidationInput,
  options?: { intent?: 'draft' | 'submit' },
): string[] {
  const errors = getProductDraftFieldErrors(input, options);
  return PRODUCT_DRAFT_FIELD_ORDER.map((key) => errors[key]).filter((msg): msg is string =>
    Boolean(msg),
  );
}

export function validateProductDraftInput(input: DirectSubmitValidationInput): void {
  const issues = getProductSubmitValidationIssues(input, { intent: 'draft' });
  if (issues.length > 0) {
    throw new Error(issues.join(' '));
  }
}

export function getSavedProductSubmitIssues(product: {
  name: string;
  localityId: string | null;
  category: { id: string; isActive?: boolean; criteriaSet?: { isActive?: boolean } | null };
  formData?: Record<string, unknown> | null;
}): string[] {
  const form = product.formData ?? {};
  return getProductSubmitValidationIssues({
    name: product.name,
    categoryId: product.category.id,
    categoryUnavailable:
      product.category.isActive === false || product.category.criteriaSet?.isActive === false,
    localityId: product.localityId,
    localityName: typeof form.localityName === 'string' ? form.localityName : undefined,
    provinceName: typeof form.provinceName === 'string' ? form.provinceName : undefined,
    entityName: typeof form.entityName === 'string' ? form.entityName : undefined,
    representativeName:
      typeof form.representativeName === 'string' ? form.representativeName : undefined,
    representativeTitle:
      typeof form.representativeTitle === 'string' ? form.representativeTitle : undefined,
    contactAddress: typeof form.contactAddress === 'string' ? form.contactAddress : undefined,
    phone: typeof form.phone === 'string' ? form.phone : undefined,
    email: typeof form.email === 'string' ? form.email : undefined,
    registrationType: typeof form.registrationType === 'string' ? form.registrationType : undefined,
    sampleQuantity:
      typeof form.sampleQuantity === 'number' || typeof form.sampleQuantity === 'string'
        ? form.sampleQuantity
        : undefined,
    assessmentYear:
      typeof form.assessmentYear === 'number' || typeof form.assessmentYear === 'string'
        ? form.assessmentYear
        : undefined,
    declarationAccepted: form.declarationAccepted === true,
  });
}

export function getUnsavedPrefilledDraftFields(
  savedFormData: Record<string, unknown> | null | undefined,
  currentValues: {
    provinceName?: string;
    localityName?: string;
    phone?: string;
    email?: string;
    assessmentYear?: string;
  },
  savedLocalityId?: string | null,
): string[] {
  const saved = savedFormData ?? {};
  const hasSavedText = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
  const unsaved: string[] = [];
  if (!hasSavedText(saved.provinceName) && currentValues.provinceName?.trim()) {
    unsaved.push('Tỉnh/Thành phố');
  }
  if (!savedLocalityId && !hasSavedText(saved.localityName) && currentValues.localityName?.trim()) {
    unsaved.push('Xã/Phường');
  }
  if (
    !(hasSavedText(saved.phone) || hasSavedText(saved.email)) &&
    Boolean(currentValues.phone?.trim() || currentValues.email?.trim())
  ) {
    unsaved.push('Thông tin liên hệ (SĐT/Email)');
  }
  if (saved.assessmentYear == null && currentValues.assessmentYear?.trim()) {
    unsaved.push('Năm đăng ký');
  }
  return unsaved;
}

export function validateProductDirectSubmitInput(input: DirectSubmitValidationInput): void {
  const issues = getProductSubmitValidationIssues(input);
  if (issues.length > 0) {
    throw new Error(issues.join(' '));
  }
}

export interface ProductDraftCommands {
  create(payload: ProductWriteInput): Promise<ApiResult<RegistrantProduct>>;
  update(id: string, payload: ProductWriteInput): Promise<ApiResult<RegistrantProduct>>;
  upload(id: string, file: File): Promise<ApiResult<ProductAttachmentRecord>>;
  detail(id: string): Promise<ApiResult<RegistrantProduct>>;
  submit?(id: string): Promise<ApiResult<RegistrantProduct>>;
}

export type DraftSaveResult =
  | { kind: typeof DRAFT_SAVE_RESULT_KIND.SAVED; product: RegistrantProduct }
  | { kind: typeof DRAFT_SAVE_RESULT_KIND.SUBMITTED; product: RegistrantProduct }
  | {
      kind: typeof DRAFT_SAVE_RESULT_KIND.UPLOAD_FAILED;
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
  submitAfterSave?: boolean;
  onDraftSaved?: (product: RegistrantProduct) => void;
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
  input.onDraftSaved?.(product);

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
      input.onDraftSaved?.(product);
    } catch (error) {
      const remainingFiles = input.files.slice(index);
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        return {
          kind: DRAFT_SAVE_RESULT_KIND.UPLOAD_FAILED,
          product,
          message: messageOf(error),
          requiresReview: false,
          remainingFiles,
        };
      }

      let refreshMessage = '';
      try {
        product = (await input.commands.detail(product.id)).data;
        input.onDraftSaved?.(product);
      } catch (refreshError) {
        refreshMessage = ` Chưa tải lại được hồ sơ: ${messageOf(refreshError)}`;
      }
      return {
        kind: DRAFT_SAVE_RESULT_KIND.UPLOAD_FAILED,
        product,
        message: `Chưa xác nhận tải tệp. Hãy kiểm tra danh sách tệp trước khi chọn lại.${refreshMessage}`,
        requiresReview: true,
        remainingFiles: [],
      };
    }
  }

  if (input.submitAfterSave) {
    if (!input.commands.submit) {
      throw new Error('Không hỗ trợ nộp hồ sơ trực tiếp.');
    }
    const { data: submittedProduct } = await input.commands.submit(product.id);
    product = submittedProduct;
    input.onDraftSaved?.(product);
    return { kind: DRAFT_SAVE_RESULT_KIND.SUBMITTED, product };
  }

  return { kind: DRAFT_SAVE_RESULT_KIND.SAVED, product };
}
