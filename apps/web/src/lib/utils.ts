import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function optionalText(value: string): string | undefined {
  return value.trim() || undefined;
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
  entityName: 'Tên đơn vị sản xuất',
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

function startCaseLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

export function formatFormValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === '') return 'Chưa cung cấp';
  if (key === 'registrationType' && typeof value === 'string' && value in registrationTypeLabels) {
    return registrationTypeLabels[value];
  }
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (Array.isArray(value)) return value.map((item) => formatFormValue(item)).join(', ');
  if (
    typeof value === 'object' &&
    value !== null &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  ) {
    return Object.values(value as Record<string, unknown>)
      .map((item) => formatFormValue(item))
      .join(' · ');
  }
  return String(value);
}

export interface FormattedFormEntry {
  key: string;
  label: string;
  value: string;
}

export function formatFormEntries(
  formData: Record<string, unknown> | undefined,
): FormattedFormEntry[] {
  return Object.entries(formData ?? {}).map(([key, value]) => ({
    key,
    label: formLabels[key] ?? startCaseLabel(key),
    value: formatFormValue(value, key),
  }));
}

export function partitionFormEntries(
  formData: Record<string, unknown> | undefined,
): [FormattedFormEntry[], FormattedFormEntry[]] {
  const entityEntries: FormattedFormEntry[] = [];
  const productEntries: FormattedFormEntry[] = [];
  for (const entry of formatFormEntries(formData)) {
    if (entityKeySet.has(entry.key)) entityEntries.push(entry);
    else productEntries.push(entry);
  }
  return [entityEntries, productEntries];
}
