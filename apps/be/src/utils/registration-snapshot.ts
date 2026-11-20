import { BadRequestException } from '@nestjs/common';
import type { Locality, Product, ProductCategory, User } from '@prisma/client';
import {
  formatProductCode,
  type ProductApplicationForm,
  type ProductRegistrationType,
  type RegistrationSnapshotV2,
} from '@ocop/shared';
export type {
  RegistrationSnapshot,
  RegistrationSnapshotV1,
  RegistrationSnapshotV2,
} from '@ocop/shared';
import { productRegistrationTypes } from '../constants/products';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function collectProductApplicationFormErrors(
  form: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  for (const [key, label] of [
    ['entityName', 'tên đơn vị sản xuất'],
    ['representativeName', 'người đại diện'],
    ['representativeTitle', 'chức vụ người đại diện'],
    ['contactAddress', 'địa chỉ liên hệ'],
    ['provinceName', 'tỉnh/thành phố'],
  ]) {
    if (!text(form[key])) errors.push(`thiếu ${label}`);
  }
  if (!(text(form.phone) || text(form.email))) {
    errors.push('thiếu số điện thoại hoặc email liên hệ');
  }
  if (
    !productRegistrationTypes.includes(
      form.registrationType as ProductRegistrationType,
    )
  ) {
    errors.push('chọn lần đăng ký đánh giá hợp lệ');
  }
  if (
    typeof form.sampleQuantity !== 'number' ||
    !Number.isInteger(form.sampleQuantity) ||
    form.sampleQuantity < 1 ||
    form.sampleQuantity > 100000
  ) {
    errors.push('số lượng mẫu phải là số nguyên từ 1 đến 100000');
  }
  if (
    typeof form.assessmentYear !== 'number' ||
    !Number.isInteger(form.assessmentYear) ||
    form.assessmentYear < 2020 ||
    form.assessmentYear > 2100
  ) {
    errors.push('năm đăng ký phải là số nguyên từ 2020 đến 2100');
  }
  if (form.declarationAccepted !== true)
    errors.push('chưa xác nhận cam kết hồ sơ');
  return errors;
}

function normalizeValidatedApplicationForm(
  form: Record<string, unknown>,
): ProductApplicationForm {
  return {
    entityName: (form.entityName as string).trim(),
    representativeName: (form.representativeName as string).trim(),
    representativeTitle: (form.representativeTitle as string).trim(),
    contactAddress: (form.contactAddress as string).trim(),
    provinceName: (form.provinceName as string).trim(),
    ...(text(form.localityName)
      ? { localityName: form.localityName.trim() }
      : {}),
    ...(text(form.localityCode)
      ? { localityCode: form.localityCode.trim() }
      : {}),
    ...(text(form.phone) ? { phone: form.phone.trim() } : {}),
    ...(text(form.email) ? { email: form.email.trim() } : {}),
    registrationType: form.registrationType as ProductRegistrationType,
    sampleQuantity: form.sampleQuantity as number,
    assessmentYear: form.assessmentYear as number,
    declarationAccepted: true,
  };
}

export function mergeProductApplicationFormData(
  current: unknown,
  patch: unknown,
): Record<string, unknown> {
  const base: Record<string, unknown> = { ...(record(current) ?? {}) };
  const incoming = record(patch);
  if (!incoming) return base;
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    if (
      (key === 'phone' ||
        key === 'email' ||
        key === 'localityName' ||
        key === 'localityCode') &&
      (value === null || (typeof value === 'string' && !value.trim()))
    ) {
      delete base[key];
    } else {
      base[key] = typeof value === 'string' ? value.trim() : value;
    }
  }
  return base;
}

export function validateProductDraftWrite(input: {
  name: unknown;
  categoryId: unknown;
  localityId?: string | null;
  formData: unknown;
}): {
  name: string;
  categoryId: string;
  formData: ProductApplicationForm;
} {
  const form = record(input.formData) ?? {};
  const errors: string[] = [];
  if (!text(input.name)) errors.push('thiếu tên sản phẩm');
  if (!text(input.categoryId)) errors.push('thiếu danh mục sản phẩm');
  const formErrors = collectProductApplicationFormErrors(form);
  const hasLocality =
    text(input.localityId) ||
    (text(form.provinceName) && text(form.localityName));
  if (!hasLocality) {
    errors.push('thiếu địa bàn hành chính (xã/phường)');
  }
  errors.push(...formErrors);
  if (errors.length) {
    throw new BadRequestException(`Không thể lưu hồ sơ: ${errors.join('; ')}.`);
  }
  return {
    name: (input.name as string).trim(),
    categoryId: (input.categoryId as string).trim(),
    formData: normalizeValidatedApplicationForm(form),
  };
}

export function validateProductApplicationForm(
  value: unknown,
): ProductApplicationForm {
  const form = record(value) ?? {};
  const errors = collectProductApplicationFormErrors(form);
  if (errors.length) {
    throw new BadRequestException(`Không thể nộp hồ sơ: ${errors.join('; ')}.`);
  }

  return normalizeValidatedApplicationForm(form);
}

export function buildRegistrationSnapshot(input: {
  submittedAt: Date;
  product: Pick<Product, 'id' | 'name' | 'description' | 'formData'> & {
    codeNumber?: number | null;
  };
  registrant: Pick<User, 'id' | 'fullName' | 'email' | 'phone'>;
  category: Pick<ProductCategory, 'id' | 'name'>;
  locality: Pick<Locality, 'id' | 'code' | 'name' | 'provinceName'>;
}): RegistrationSnapshotV2 {
  const code =
    typeof input.product.codeNumber === 'number'
      ? formatProductCode(input.product.codeNumber)
      : undefined;
  return {
    version: 2,
    submittedAt: input.submittedAt.toISOString(),
    product: {
      id: input.product.id,
      ...(typeof input.product.codeNumber === 'number'
        ? { codeNumber: input.product.codeNumber }
        : {}),
      ...(code ? { code } : {}),
      name: input.product.name,
      description: input.product.description,
    },
    registrant: {
      id: input.registrant.id,
      fullName: input.registrant.fullName,
      email: input.registrant.email,
      phone: input.registrant.phone,
    },
    category: {
      id: input.category.id,
      name: input.category.name,
    },
    locality: {
      id: input.locality.id,
      code: input.locality.code,
      name: input.locality.name,
      provinceName: input.locality.provinceName,
    },
    formData: validateProductApplicationForm(input.product.formData),
  };
}

export function extractSafeApplicationForm(
  value: unknown,
): Partial<ProductApplicationForm> {
  const source = record(value);
  if (!source) return {};
  const result: Record<string, string | number | boolean> = {};
  for (const field of [
    'entityName',
    'representativeName',
    'representativeTitle',
    'contactAddress',
    'provinceName',
    'localityName',
    'localityCode',
    'phone',
    'email',
  ]) {
    if (typeof source[field] === 'string') {
      result[field] = source[field];
    }
  }
  if (
    typeof source.registrationType === 'string' &&
    (productRegistrationTypes as readonly string[]).includes(
      source.registrationType,
    )
  ) {
    result.registrationType = source.registrationType;
  }
  if (
    typeof source.sampleQuantity === 'number' &&
    Number.isInteger(source.sampleQuantity) &&
    source.sampleQuantity >= 0 &&
    source.sampleQuantity <= 100000
  ) {
    result.sampleQuantity = source.sampleQuantity;
  }
  if (
    typeof source.assessmentYear === 'number' &&
    Number.isInteger(source.assessmentYear) &&
    source.assessmentYear >= 2020 &&
    source.assessmentYear <= 2100
  ) {
    result.assessmentYear = source.assessmentYear;
  }
  if (typeof source.declarationAccepted === 'boolean') {
    result.declarationAccepted = source.declarationAccepted;
  }
  return result;
}
