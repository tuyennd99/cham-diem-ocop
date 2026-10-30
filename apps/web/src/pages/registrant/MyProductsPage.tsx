import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/confirm-dialog';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { myProductsApi } from '../../api';
import { queryKeys } from '../../constants/query-key';
import { errorText, messageOf } from '../../lib/api-error';
import { useMyProducts } from '../../queries/registrant';
import type { RegistrantProduct as Product } from '../../types/registrant';

export function MyProductsPage() {
  const queryClient = useQueryClient();
  const { data: products = [], error: loadError, isPending: loading, refetch } = useMyProducts();
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    mode: 'submit' | 'delete';
    product: Product;
  } | null>(null);
  const error = actionError || errorText(loadError);

  const refresh = async () => {
    setActionError('');
    await refetch();
  };

  async function executeConfirm() {
    if (!confirmState || busy) return;
    const { mode, product } = confirmState;
    setBusy(true);
    setActionError('');
    try {
      if (mode === 'delete') {
        await myProductsApi.remove(product.id);
        queryClient.setQueryData<Product[]>(queryKeys.myProducts.list, (rows = []) =>
          rows.filter((item) => item.id !== product.id),
        );
      } else {
        const { data } = await myProductsApi.submit(product.id);
        queryClient.setQueryData<Product[]>(queryKeys.myProducts.list, (rows = []) =>
          rows.map((item) => (item.id === product.id ? { ...item, ...data } : item)),
        );
        queryClient.setQueryData<Product>(queryKeys.myProducts.detail(product.id), (current) =>
          current ? { ...current, ...data } : data,
        );
      }
      setConfirmState(null);
    } catch (cause) {
      setActionError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>KHU VỰC NGƯỜI ĐĂNG KÝ</p>
          <h1>Hồ sơ của tôi</h1>
        </div>
        <Button asChild>
          <Link to='/my/products/new'>Tạo hồ sơ</Link>
        </Button>
      </div>
      {error && (
        <div className='mb-4 space-y-2'>
          <AlertError title='Không thể xử lý hồ sơ' errors={[error]} />
          <Button
            type='button'
            variant='secondary'
            disabled={loading || busy}
            onClick={() => void refresh()}
          >
            Thử lại
          </Button>
        </div>
      )}
      {loading && <PageSpin />}
      {!loading && !error && !products.length && (
        <div className='empty-state'>
          <h2>Chưa có hồ sơ</h2>
          <p>Tạo bản nháp để bắt đầu đăng ký sản phẩm.</p>
          <Button asChild>
            <Link to='/my/products/new'>Tạo hồ sơ</Link>
          </Button>
        </div>
      )}
      {!loading && !error && (
        <div className='record-list'>
          {products.map((product) => (
            <article className='record-row' key={product.id}>
              <div className='record-main'>
                <div className='record-badges'>
                  <Badge variant='secondary'>{product.category.name}</Badge>
                  <Badge variant='outline'>{product.status}</Badge>
                </div>
                <h2>{product.name}</h2>
                <p className='record-origin'>
                  {product.submittedAt
                    ? `Đã nộp ${new Date(product.submittedAt).toLocaleString('vi-VN')}`
                    : `Cập nhật ${new Date(product.updatedAt).toLocaleString('vi-VN')}`}
                </p>
                <p>{product.attachments.length} tệp đính kèm</p>
              </div>
              <div className='record-result'>
                {product.finalScore !== null && (
                  <strong>
                    {product.finalScore} điểm · {product.starRating} sao
                  </strong>
                )}
                <Button asChild variant='secondary'>
                  <Link to='/my/products/$id' params={{ id: product.id }}>
                    Mở hồ sơ
                  </Link>
                </Button>
                {product.status === 'DRAFT' && (
                  <>
                    <Link
                      className='text-link'
                      to='/my/products/$id/edit'
                      params={{ id: product.id }}
                    >
                      Sửa bản nháp
                    </Link>
                    <Button
                      variant='secondary'
                      disabled={busy}
                      onClick={() => setConfirmState({ mode: 'submit', product })}
                    >
                      Nộp hồ sơ
                    </Button>
                    <Button
                      variant='secondary'
                      disabled={busy}
                      onClick={() => setConfirmState({ mode: 'delete', product })}
                    >
                      Xóa
                    </Button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmState(null);
        }}
        title={
          confirmState?.mode === 'delete'
            ? `Xóa bản nháp: ${confirmState.product.name}`
            : `Nộp hồ sơ: ${confirmState?.product.name ?? ''}`
        }
        description={
          confirmState?.mode === 'delete'
            ? 'Bản nháp sản phẩm sẽ bị xóa vĩnh viễn và không thể khôi phục.'
            : 'Nộp hồ sơ này để bắt đầu đánh giá? Sau khi nộp, không thể sửa bản nháp.'
        }
        confirmLabel={confirmState?.mode === 'delete' ? 'Xóa bản nháp' : 'Nộp hồ sơ'}
        destructive={confirmState?.mode === 'delete'}
        pending={busy}
        onConfirm={() => void executeConfirm()}
      />
    </section>
  );
}
