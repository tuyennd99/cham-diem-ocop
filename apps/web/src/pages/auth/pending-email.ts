import { authApi } from '../../api/auth';
import {
  PENDING_EMAIL_STORAGE_KEY,
  REGISTRATION_VERIFICATION_MODE,
  VERIFICATION_STATE_KIND,
} from '../../constants/auth';
import { HTTP_STATUS } from '../../constants/http-status';
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
      (value.mode !== REGISTRATION_VERIFICATION_MODE.REGISTER &&
        value.mode !== REGISTRATION_VERIFICATION_MODE.GOOGLE_LINK) ||
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
  if (pending?.mode === REGISTRATION_VERIFICATION_MODE.GOOGLE_LINK) {
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
  | { kind: typeof VERIFICATION_STATE_KIND.LEGACY; email: string }
  | { kind: typeof VERIFICATION_STATE_KIND.PENDING; pending: PendingRegistration }
  | {
      kind: typeof VERIFICATION_STATE_KIND.ERROR;
      message: string;
      retryable: boolean;
      restartTo?: '/register' | '/login';
    };

export async function loadPendingRegistration(legacy = false): Promise<VerificationState> {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY);
  } catch {
    return {
      kind: VERIFICATION_STATE_KIND.ERROR,
      message: 'Không thể đọc phiên xác thực. Vui lòng cho phép lưu trữ trong trình duyệt.',
      retryable: false,
    };
  }
  const pending = parsePending(raw);
  const legacyEmail =
    raw && !/[{}\[\]"]/.test(raw) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : '';
  if (legacy || !raw || legacyEmail)
    return { kind: VERIFICATION_STATE_KIND.LEGACY, email: pending?.email ?? legacyEmail };
  const invalid = {
    kind: VERIFICATION_STATE_KIND.ERROR,
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
    return { kind: VERIFICATION_STATE_KIND.PENDING, pending: checked };
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === HTTP_STATUS.GONE) {
      clearPendingEmail();
      return {
        ...invalid,
        restartTo:
          pending.mode === REGISTRATION_VERIFICATION_MODE.GOOGLE_LINK ? '/login' : '/register',
      };
    }
    if (
      cause instanceof ApiError &&
      [HTTP_STATUS.BAD_REQUEST, HTTP_STATUS.UNAUTHORIZED, HTTP_STATUS.NOT_FOUND].includes(
        cause.status as never,
      )
    )
      return invalid;
    return {
      kind: VERIFICATION_STATE_KIND.ERROR,
      message: 'Chưa thể kiểm tra phiên xác thực. Kiểm tra kết nối và thử lại.',
      retryable: true,
    };
  }
}
