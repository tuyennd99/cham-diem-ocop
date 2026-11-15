import { USER_ROLE } from '@ocop/shared';
import { createFileRoute } from '@tanstack/react-router';
import { ProductDraftEditor } from '../components/products/ProductDraftEditor';
import { PRODUCT_WORKSPACE_MODE } from '../constants/consts';
import { requireRole } from '../lib/route-guards';

export const Route = createFileRoute('/_app/my/products/new')({
  beforeLoad: requireRole(USER_ROLE.REGISTRANT),
  component: () => <ProductDraftEditor mode={PRODUCT_WORKSPACE_MODE.OWNER} />,
});
