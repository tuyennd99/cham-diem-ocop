import type { RegistrationUnitRecord, RegistrationUnitWriteInput } from '../types/registrant';
import { ApiError, messageOf } from './api-error';

export interface RegistrationUnitFormValues {
  entityName: string;
  representativeName: string;
  representativeTitle: string;
  contactAddress: string;
  provinceName: string;
  localityName: string;
  localityCode: string;
  phone: string;
}

export const EMPTY_REGISTRATION_UNIT_FORM: RegistrationUnitFormValues = {
  entityName: '',
  representativeName: '',
  representativeTitle: '',
  contactAddress: '',
  provinceName: '',
  localityName: '',
  localityCode: '',
  phone: '',
};

export function registrationUnitToFormValues(
  unit: RegistrationUnitRecord,
): RegistrationUnitFormValues {
  return {
    entityName: unit.entityName,
    representativeName: unit.representativeName,
    representativeTitle: unit.representativeTitle,
    contactAddress: unit.contactAddress,
    provinceName: unit.provinceName,
    localityName: unit.localityName,
    localityCode: unit.localityCode ?? '',
    phone: unit.phone ?? '',
  };
}

export function resolveWardLocalityCode(
  wardName: string,
  wards: ReadonlyArray<{ code: string; name: string }>,
  fallbackCode = '',
): string {
  const trimmedName = wardName.trim();
  if (!trimmedName) return '';
  const matched = wards.find((ward) => ward.name === trimmedName);
  if (matched) return `XP${matched.code}`;
  return fallbackCode.trim();
}

export function validateRegistrationUnitInput(
  values: RegistrationUnitFormValues,
): Partial<Record<keyof RegistrationUnitFormValues, string>> {
  const errors: Partial<Record<keyof RegistrationUnitFormValues, string>> = {};
  const entityName = values.entityName.trim();
  const representativeName = values.representativeName.trim();
  const representativeTitle = values.representativeTitle.trim();
  const contactAddress = values.contactAddress.trim();
  const provinceName = values.provinceName.trim();
  const localityName = values.localityName.trim();
  const localityCode = values.localityCode.trim();
  const phone = values.phone.trim();

  if (!entityName) {
    errors.entityName = 'Nhập tên chủ thể đăng ký.';
  } else if (entityName.length > 255) {
    errors.entityName = 'Tên chủ thể đăng ký tối đa 255 ký tự.';
  }

  if (!representativeName) {
    errors.representativeName = 'Nhập người đại diện.';
  } else if (representativeName.length > 255) {
    errors.representativeName = 'Người đại diện tối đa 255 ký tự.';
  }

  if (!representativeTitle) {
    errors.representativeTitle = 'Nhập chức vụ người đại diện.';
  } else if (representativeTitle.length > 255) {
    errors.representativeTitle = 'Chức vụ người đại diện tối đa 255 ký tự.';
  }

  if (!contactAddress) {
    errors.contactAddress = 'Nhập địa chỉ liên hệ.';
  } else if (contactAddress.length > 1000) {
    errors.contactAddress = 'Địa chỉ liên hệ tối đa 1000 ký tự.';
  }

  if (!provinceName) {
    errors.provinceName = 'Chọn tỉnh/thành phố.';
  } else if (provinceName.length > 100) {
    errors.provinceName = 'Tỉnh/thành phố tối đa 100 ký tự.';
  }

  if (!localityName) {
    errors.localityName = 'Chọn Xã/Phường.';
  } else if (localityName.length > 255) {
    errors.localityName = 'Xã/Phường tối đa 255 ký tự.';
  }

  if (localityCode.length > 50) {
    errors.localityCode = 'Mã địa phương tối đa 50 ký tự.';
  }

  if (phone.length > 30) {
    errors.phone = 'Điện thoại tối đa 30 ký tự.';
  }

  return errors;
}

export function toRegistrationUnitWriteInput(
  values: RegistrationUnitFormValues,
): RegistrationUnitWriteInput {
  return {
    entityName: values.entityName.trim(),
    representativeName: values.representativeName.trim(),
    representativeTitle: values.representativeTitle.trim(),
    contactAddress: values.contactAddress.trim(),
    provinceName: values.provinceName.trim(),
    localityName: values.localityName.trim(),
    localityCode: values.localityCode.trim() || null,
    phone: values.phone.trim() || null,
  };
}

export interface EditorUnitFieldsSlice {
  entityName?: string;
  representativeName?: string;
  representativeTitle?: string;
  contactAddress?: string;
  provinceName?: string;
  localityName?: string;
  localityCode?: string;
  localityId?: string;
  phone?: string;
}

export function hasEnteredUnitDataToConfirm(
  currentValues: EditorUnitFieldsSlice,
  nextUnit: Pick<
    RegistrationUnitRecord,
    | 'entityName'
    | 'representativeName'
    | 'representativeTitle'
    | 'contactAddress'
    | 'provinceName'
    | 'localityName'
    | 'localityCode'
    | 'phone'
  >,
  defaultPhone = '',
): boolean {
  const entityName = currentValues.entityName ?? '';
  const representativeName = currentValues.representativeName ?? '';
  const representativeTitle = currentValues.representativeTitle ?? '';
  const contactAddress = currentValues.contactAddress ?? '';
  const provinceName = currentValues.provinceName ?? '';
  const localityName = currentValues.localityName ?? '';
  const localityCode = currentValues.localityCode ?? '';
  const localityId = currentValues.localityId ?? '';
  const phone = currentValues.phone ?? '';

  const hasEntered =
    entityName.trim() !== '' ||
    representativeName.trim() !== '' ||
    representativeTitle.trim() !== '' ||
    contactAddress.trim() !== '' ||
    provinceName.trim() !== '' ||
    localityName.trim() !== '' ||
    localityId.trim() !== '' ||
    (phone.trim() !== '' && phone.trim() !== defaultPhone.trim());

  if (!hasEntered) return false;

  const nextPhone = nextUnit.phone ?? '';
  const nextLocalityCode = nextUnit.localityCode ?? '';

  return (
    entityName !== nextUnit.entityName ||
    representativeName !== nextUnit.representativeName ||
    representativeTitle !== nextUnit.representativeTitle ||
    contactAddress !== nextUnit.contactAddress ||
    provinceName !== nextUnit.provinceName ||
    localityName !== nextUnit.localityName ||
    localityCode !== nextLocalityCode ||
    localityId !== '' ||
    phone !== nextPhone
  );
}

export function applyRegistrationUnitToEditorValues<T extends EditorUnitFieldsSlice>(
  currentValues: T,
  unit: Pick<
    RegistrationUnitRecord,
    | 'entityName'
    | 'representativeName'
    | 'representativeTitle'
    | 'contactAddress'
    | 'provinceName'
    | 'localityName'
    | 'localityCode'
    | 'phone'
  >,
): T {
  return {
    ...currentValues,
    entityName: unit.entityName,
    representativeName: unit.representativeName,
    representativeTitle: unit.representativeTitle,
    contactAddress: unit.contactAddress,
    provinceName: unit.provinceName,
    localityName: unit.localityName,
    localityCode: unit.localityCode ?? '',
    localityId: '',
    phone: unit.phone ?? '',
  };
}

export const QUICK_SAVE_UNIT_OUTCOME = {
  SKIPPED: 'SKIPPED',
  SAVED: 'SAVED',
  INCOMPLETE: 'INCOMPLETE',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type QuickSaveUnitResult =
  | { kind: typeof QUICK_SAVE_UNIT_OUTCOME.SKIPPED }
  | {
      kind: typeof QUICK_SAVE_UNIT_OUTCOME.SAVED;
      unit: RegistrationUnitRecord;
      nextSelectedUnitId: string;
      nextSaveUnitToSettings: false;
    }
  | {
      kind: typeof QUICK_SAVE_UNIT_OUTCOME.INCOMPLETE;
      message: string;
      fieldErrors: Partial<Record<keyof RegistrationUnitFormValues, string>>;
      nextSaveUnitToSettings: true;
    }
  | {
      kind: typeof QUICK_SAVE_UNIT_OUTCOME.FAILED;
      message: string;
      nextSaveUnitToSettings: true;
    }
  | {
      kind: typeof QUICK_SAVE_UNIT_OUTCOME.UNKNOWN;
      message: string;
      nextSaveUnitToSettings: false;
    };

export async function quickSaveRegistrationUnitAfterDraft(input: {
  enabled: boolean;
  values: EditorUnitFieldsSlice;
  createUnit: (payload: RegistrationUnitWriteInput) => Promise<{ data: RegistrationUnitRecord }>;
}): Promise<QuickSaveUnitResult> {
  if (!input.enabled) {
    return { kind: QUICK_SAVE_UNIT_OUTCOME.SKIPPED };
  }

  const formValues: RegistrationUnitFormValues = {
    entityName: input.values.entityName ?? '',
    representativeName: input.values.representativeName ?? '',
    representativeTitle: input.values.representativeTitle ?? '',
    contactAddress: input.values.contactAddress ?? '',
    provinceName: input.values.provinceName ?? '',
    localityName: input.values.localityName ?? '',
    localityCode: input.values.localityCode ?? '',
    phone: input.values.phone ?? '',
  };

  const fieldErrors = validateRegistrationUnitInput(formValues);
  const errorList = Object.values(fieldErrors).filter((msg): msg is string => Boolean(msg));
  if (errorList.length > 0) {
    return {
      kind: QUICK_SAVE_UNIT_OUTCOME.INCOMPLETE,
      message: `Đã lưu hồ sơ sản phẩm nháp, nhưng chưa lưu đơn vị vào Cấu hình chung vì thông tin đơn vị chưa đầy đủ: ${errorList.join(' ')}`,
      fieldErrors,
      nextSaveUnitToSettings: true,
    };
  }

  try {
    const { data: unit } = await input.createUnit(toRegistrationUnitWriteInput(formValues));
    return {
      kind: QUICK_SAVE_UNIT_OUTCOME.SAVED,
      unit,
      nextSelectedUnitId: unit.id,
      nextSaveUnitToSettings: false,
    };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status >= 400 && cause.status < 500) {
      return {
        kind: QUICK_SAVE_UNIT_OUTCOME.FAILED,
        message: `Đã lưu hồ sơ sản phẩm nháp, nhưng không thể lưu đơn vị vào Cấu hình chung: ${messageOf(cause)}`,
        nextSaveUnitToSettings: true,
      };
    }

    return {
      kind: QUICK_SAVE_UNIT_OUTCOME.UNKNOWN,
      message: `Đã lưu hồ sơ sản phẩm nháp, nhưng chưa rõ đơn vị đã được lưu vào Cấu hình chung hay chưa (${messageOf(cause)}). Vui lòng kiểm tra danh sách đơn vị trong Cấu hình chung trước khi thử lưu lại.`,
      nextSaveUnitToSettings: false,
    };
  }
}
