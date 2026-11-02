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
