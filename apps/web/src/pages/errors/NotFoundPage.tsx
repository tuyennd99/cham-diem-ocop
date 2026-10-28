import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <main className='route-main' id='content'>
      <div className='route-container container'>
        <section className='route-panel'>
          <p className='eyebrow'>404 · KHÔNG TÌM THẤY TRANG</p>
          <h1>Trang này không tồn tại</h1>
          <p>Đường dẫn có thể đã thay đổi hoặc không còn khả dụng.</p>
          <Button asChild>
            <Link to='/'>Về trang chủ</Link>
          </Button>
        </section>
      </div>
    </main>
  );
}
