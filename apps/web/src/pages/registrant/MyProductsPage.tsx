import { PRODUCT_WORKSPACE_MODE } from '../../constants/consts';
import type { AdminProductSearch } from '../../lib/admin-search';
import { AdminProductsPage } from '../admin/AdminProductsPage';

export function MyProductsPage({
  search,
  onSearchChange,
}: {
  search?: AdminProductSearch;
  onSearchChange?: (next: AdminProductSearch) => void;
} = {}) {
  return (
    <AdminProductsPage
      mode={PRODUCT_WORKSPACE_MODE.OWNER}
      search={search}
      onSearchChange={onSearchChange}
    />
  );
}
