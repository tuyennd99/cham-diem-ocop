import { clsx, type ClassValue } from 'clsx';
import _ from 'lodash';
import { twMerge } from 'tailwind-merge';

export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}

export function normalizeEmail(value: string): string {
  return _.trim(value).toLowerCase();
}

export function optionalText(value: string): string | undefined {
  return _.trim(value) || undefined;
}

export function formatCategoryPath(parts: Array<string | null | undefined>): string {
  return _.compact(parts).join(' · ');
}

export const ENTITY_FORM_KEYS = [
  'entityName',
  'representativeName',
  'representativeTitle',
  'contactAddress',
  'provinceName',
  'phone',
  'email',
] as const;

const entityKeySet = new Set<string>(ENTITY_FORM_KEYS);

export const formLabels: Record<string, string> = {
  entityName: 'Tên chủ thể',
  representativeName: 'Người đại diện',
  representativeTitle: 'Chức danh',
  contactAddress: 'Địa chỉ liên hệ',
  provinceName: 'Tỉnh/thành',
  phone: 'Điện thoại',
  email: 'Email',
  productName: 'Tên sản phẩm',
  registrationType: 'Loại đăng ký',
  sampleQuantity: 'Số lượng mẫu',
  assessmentYear: 'Năm đánh giá',
  declarationAccepted: 'Cam kết hồ sơ',
};

const registrationTypeLabels: Record<string, string> = {
  FIRST: 'Lần đầu',
  UPGRADE: 'Nâng hạng',
  REASSESSMENT: 'Đánh giá lại',
};

export function formatFormValue(value: unknown, key?: string): string {
  if (_.isNil(value) || value === '') return 'Chưa cung cấp';
  if (key === 'registrationType' && typeof value === 'string' && value in registrationTypeLabels) {
    return registrationTypeLabels[value];
  }
  if (_.isBoolean(value)) return value ? 'Có' : 'Không';
  if (_.isArray(value)) return value.map((item) => formatFormValue(item)).join(', ');
  if (_.isPlainObject(value)) {
    return Object.values(value as Record<string, unknown>)
      .map((item) => formatFormValue(item))
      .join(' · ');
  }
  return String(value);
}

export function formatFormEntries(formData: Record<string, unknown> | undefined) {
  return Object.entries(formData ?? {}).map(([key, value]) => ({
    key,
    label: formLabels[key] ?? _.startCase(key),
    value: formatFormValue(value, key),
  }));
}

export function partitionFormEntries(formData: Record<string, unknown> | undefined) {
  return _.partition(formatFormEntries(formData), (entry) => entityKeySet.has(entry.key));
}
