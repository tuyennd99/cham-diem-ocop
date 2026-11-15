import { USER_ROLE } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '../lib/route-guards';
import { MySettingsPage } from '../pages/registrant/MySettingsPage';

export const Route = createFileRoute('/_app/my/settings')({
  beforeLoad: requireRole(USER_ROLE.REGISTRANT),
  component: MySettingsPage,
});
