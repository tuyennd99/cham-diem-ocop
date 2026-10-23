import { PENDING_EMAIL_STORAGE_KEY } from '../../constants/auth';

export function readPendingEmail() {
  try {
    return window.sessionStorage.getItem(PENDING_EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writePendingEmail(email: string) {
  try {
    window.sessionStorage.setItem(PENDING_EMAIL_STORAGE_KEY, email);
  } catch {
    /* Storage can be disabled; keep verification usable. */
  }
}

export function clearPendingEmail() {
  try {
    window.sessionStorage.removeItem(PENDING_EMAIL_STORAGE_KEY);
  } catch {
    /* Verification should still succeed. */
  }
}
