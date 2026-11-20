import { PRISMA_ERROR_CODE } from '../constants/auth';

export function isPrismaErrorCode(
  error: unknown,
  code: string,
): error is { code: string; meta?: { target?: unknown } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}

export function isUniqueConstraint(error: unknown): boolean {
  return isPrismaErrorCode(error, PRISMA_ERROR_CODE.UNIQUE_CONSTRAINT);
}
