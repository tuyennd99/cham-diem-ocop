import { createFileRoute } from '@tanstack/react-router';
import { loadPendingRegistration } from '../pages/auth/pending-email';
import { VerifyOtpPage } from '../pages/auth/VerifyOtpPage';

export const Route = createFileRoute('/_auth/verify-otp')({
  validateSearch: (search: Record<string, unknown>): { legacy?: boolean } =>
    search.legacy === true || search.legacy === 'true' ? { legacy: true } : {},
  loaderDeps: ({ search }) => ({ legacy: search.legacy === true }),
  loader: ({ deps }) => loadPendingRegistration(deps.legacy),
  staleTime: 0,
  component: VerifyOtpPage,
});
