export function firstFieldError(errors: readonly unknown[]): string {
  for (const error of errors) {
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (Array.isArray(error)) {
      const message = firstFieldError(error);
      if (message) return message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
    }
  }
  return '';
}

export function nativeFieldError(control: HTMLInputElement | HTMLTextAreaElement): string {
  const { validity } = control;
  if (!control.willValidate || validity.valid) return '';
  if (validity.customError) return control.validationMessage || 'Giá trị không hợp lệ.';
  if (validity.badInput) return 'Vui lòng nhập một giá trị hợp lệ.';
  if (validity.valueMissing) return 'Vui lòng nhập thông tin này.';
  if (validity.typeMismatch) {
    if (control.type === 'email') return 'Vui lòng nhập địa chỉ email hợp lệ.';
    if (control.type === 'url') return 'Vui lòng nhập đường dẫn hợp lệ.';
    return 'Giá trị không đúng định dạng.';
  }
  if (validity.patternMismatch) return 'Giá trị không đúng định dạng yêu cầu.';
  if (validity.tooShort) return `Vui lòng nhập ít nhất ${control.minLength} ký tự.`;
  if (validity.tooLong) return `Vui lòng nhập tối đa ${control.maxLength} ký tự.`;
  if (validity.rangeUnderflow && 'min' in control) return `Giá trị phải lớn hơn hoặc bằng ${control.min}.`;
  if (validity.rangeOverflow && 'max' in control) return `Giá trị phải nhỏ hơn hoặc bằng ${control.max}.`;
  if (validity.stepMismatch) return 'Giá trị không đúng bước nhập cho phép.';
  return control.validationMessage || 'Giá trị không hợp lệ.';
}

export function resolveFieldDescribedBy(
  id: string,
  hasHint: boolean,
  hasError: boolean,
  hintId?: string,
  describedBy?: string,
): string | undefined {
  const ids = [hasError ? `${id}-error` : '', hasHint ? (hintId ?? `${id}-hint`) : '', describedBy ?? '']
    .join(' ')
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(ids)].join(' ') || undefined;
}
