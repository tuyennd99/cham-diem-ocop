import { createFileRoute } from '@tanstack/react-router';
import { ChangePasswordPage } from '../pages/account/ChangePasswordPage';

export const Route = createFileRoute('/_app/account/password')({
  component: ChangePasswordPage,
});
