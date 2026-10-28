import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import AppSpin from '@/components/app-spin';
import { AppLayout } from '../layouts/AppLayout';

export const Route = createFileRoute('/_app')({
  pendingComponent: AppSpin,
  beforeLoad: ({ context }) => {
    if (!context.getSession()) throw redirect({ to: '/login' });
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});
