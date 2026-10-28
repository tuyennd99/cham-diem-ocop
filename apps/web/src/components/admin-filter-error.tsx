import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';

export default function AdminFilterError({ mode }: { mode: 'products' | 'registrations' }) {
  const isProducts = mode === 'products';
  return (
    <section className='admin-page'>
      <div className='admin-page-heading'>
        <div><h1>Bộ lọc không hợp lệ</h1></div>
      </div>
      <AlertError
        title='Bộ lọc không hợp lệ'
        errors={['Điều kiện tìm kiếm trên địa chỉ trang không đúng định dạng hoặc có xung đột.']}
      />
      <div className='admin-actions'>
        <Button asChild>
          <Link to={isProducts ? '/admin/products' : '/admin/registrations'} search={{}}>
            {isProducts ? 'Về danh sách sản phẩm' : 'Về danh sách phiếu đăng ký'}
          </Link>
        </Button>
      </div>
    </section>
  );
}
