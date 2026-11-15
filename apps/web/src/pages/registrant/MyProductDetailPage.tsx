import { PRODUCT_WORKSPACE_MODE } from '../../constants/consts';
import { AdminProductDetailPage } from '../admin/AdminProductDetailPage';

export function MyProductDetailPage({ productId }: { productId: string }) {
  return <AdminProductDetailPage productId={productId} mode={PRODUCT_WORKSPACE_MODE.OWNER} />;
}
