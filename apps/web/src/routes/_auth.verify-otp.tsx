import { createFileRoute, redirect } from '@tanstack/react-router';
import { loadPendingRegistration } from '../pages/auth/pending-email';
import { VerifyOtpPage } from '../pages/auth/VerifyOtpPage';

export const Route = createFileRoute('/_auth/verify-otp')({
  validateSearch: (search: Record<string, unknown>): { legacy?: boolean } =>
    search.legacy === true || search.legacy === 'true' ? { legacy: true } : {},
  loaderDeps: ({ search }) => ({ legacy: search.legacy === true }),
  loader: async ({ deps }) => {
    const state = await loadPendingRegistration(deps.legacy);
    if (state.kind === 'error' && state.restartTo)
      throw redirect({ to: state.restartTo, replace: true });
    return state;
  },
  staleTime: 0,
  component: VerifyOtpPage,
});
