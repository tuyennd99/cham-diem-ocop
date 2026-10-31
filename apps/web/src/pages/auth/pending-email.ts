import { authApi } from '../../api/auth';
import { PENDING_EMAIL_STORAGE_KEY } from '../../constants/auth';
import { ApiError } from '../../lib/api-error';
import type { PendingRegistration } from '../../types/auth';

function parsePending(raw: string | null): PendingRegistration | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PendingRegistration;
    if (
      !value ||
      typeof value.registrationToken !== 'string' ||
      !value.registrationToken ||
      value.registrationToken.length > 256 ||
      typeof value.email !== 'string' ||
      !value.email ||
      (value.mode !== 'register' && value.mode !== 'google-link') ||
      ![value.expiresAt, value.otpExpiresAt, value.resendAvailableAt].every(
        (date) => typeof date === 'string' && Number.isFinite(Date.parse(date)),
      )
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function readPendingEmail(): PendingRegistration | null {
  try {
    return parsePending(window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writePendingEmail(pending: PendingRegistration) {
  const { registrationToken, email, expiresAt, otpExpiresAt, resendAvailableAt, mode } = pending;
  try {
    window.sessionStorage.setItem(
      PENDING_EMAIL_STORAGE_KEY,
      JSON.stringify({
        registrationToken,
        email,
        expiresAt,
        otpExpiresAt,
        resendAvailableAt,
        mode,
      }),
    );
  } catch {
    throw new Error(
      'Không thể lưu phiên xác thực. Vui lòng cho phép lưu trữ trong trình duyệt và thử lại.',
    );
  }
}

export function clearPendingEmail() {
  try {
    window.sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
  } catch {
    /* Verification should still succeed. */
  }
}

export async function verifyPendingRegistration(
  pending: PendingRegistration | null,
  email: string,
  code: string,
) {
  if (pending?.mode === 'google-link') {
    const { data } = await authApi.googleLinkVerify({
      registrationToken: pending.registrationToken,
      code,
    });
    clearPendingEmail();
    return data;
  }
  if (pending) await authApi.verifyOtp({ registrationToken: pending.registrationToken, code });
  else await authApi.legacyVerifyOtp({ email, code });
  clearPendingEmail();
  return null;
}

export type VerificationState =
  | { kind: 'legacy'; email: string }
  | { kind: 'pending'; pending: PendingRegistration }
  | { kind: 'error'; message: string; retryable: boolean; restartTo?: '/register' | '/login' };

export async function loadPendingRegistration(legacy = false): Promise<VerificationState> {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY);
  } catch {
    return {
      kind: 'error',
      message: 'Không thể đọc phiên xác thực. Vui lòng cho phép lưu trữ trong trình duyệt.',
      retryable: false,
    };
  }
  const pending = parsePending(raw);
  const legacyEmail =
    raw && !/[{}\[\]"]/.test(raw) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : '';
  if (legacy || !raw || legacyEmail)
    return { kind: 'legacy', email: pending?.email ?? legacyEmail };
  const invalid = {
    kind: 'error',
    message: 'Phiên xác thực không hợp lệ hoặc đã hết hạn. Vui lòng đăng ký lại.',
    retryable: false,
  } as const;
  if (!pending) return invalid;
  try {
    const { data } = await authApi.registrationStatus({
      registrationToken: pending.registrationToken,
    });
    const checked = parsePending(
      JSON.stringify({ ...data, registrationToken: pending.registrationToken }),
    );
    if (!checked || Date.parse(checked.expiresAt) <= Date.now()) return invalid;
    writePendingEmail(checked);
    return { kind: 'pending', pending: checked };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 410) {
      clearPendingEmail();
      return { ...invalid, restartTo: pending.mode === 'google-link' ? '/login' : '/register' };
    }
    if (cause instanceof ApiError && [400, 401, 404].includes(cause.status)) return invalid;
    return {
      kind: 'error',
      message: 'Chưa thể kiểm tra phiên xác thực. Kiểm tra kết nối và thử lại.',
      retryable: true,
    };
  }
}
