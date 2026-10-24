import { createFileRoute, Link } from '@tanstack/react-router';
import { parseAdminProductSearch } from '../lib/admin-search';
import { requirePermission } from '../lib/route-guards';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';

export const Route = createFileRoute('/_app/admin/products/')({
  beforeLoad: requirePermission('VIEW'),
  validateSearch: parseAdminProductSearch,
  errorComponent: ProductsFilterError,
  component: ProductsRoute,
});

function ProductsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AdminProductsPage
      mode='products'
      search={search}
      onSearchChange={(next) => {
        void navigate({ search: next });
      }}
    />
  );
}

function ProductsFilterError() {
  return (
    <section className='admin-page' role='alert'>
      <div className='admin-page-heading'>
        <div>
          <h1>Bộ lọc không hợp lệ</h1>
          <p className='route-intro'>
            Điều kiện tìm kiếm trên địa chỉ trang không đúng định dạng hoặc có xung đột.
          </p>
        </div>
      </div>
      <div className='admin-actions'>
        <Link className='button button-primary' to='/admin/products' search={{}}>
          Về danh sách sản phẩm
        </Link>
      </div>
    </section>
  );
}
