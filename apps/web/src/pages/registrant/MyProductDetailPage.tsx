import { AdminProductDetailPage } from '../admin/AdminProductDetailPage';

export function MyProductDetailPage({ productId }: { productId: string }) {
  return <AdminProductDetailPage productId={productId} mode='owner' />;
}
