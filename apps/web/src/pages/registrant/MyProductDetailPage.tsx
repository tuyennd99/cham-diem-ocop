import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { ConfirmDialog } from '@/components/confirm-dialog';
import PageSpin from '@/components/page-spin';
import { Button } from '@/components/ui/button';
import { myProductsApi } from '../../api';
import { REGISTRANT_PRODUCT_STATUS_LABEL } from '../../constants/product-status';
import { queryKeys } from '../../constants/query-key';
import { errorText, messageOf } from '../../lib/api-error';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { formatFormEntries } from '../../lib/utils';
import { useMyProduct } from '../../queries/registrant';
import type { RegistrantProduct as Product } from '../../types/registrant';
import { AttachmentLink } from './AttachmentLink';

export function MyProductDetailPage({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const { data: product = null, error: loadError, refetch } = useMyProduct(productId);
  const [busy, setBusy] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<{
    id: string;
    fileName: string;
  } | null>(null);
  const visibleError = error || errorText(loadError);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await myProductsApi.submit(productId);
      queryClient.setQueryData(queryKeys.myProducts.detail(productId), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.list });
      setSubmitConfirmOpen(false);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  async function removeAttachment(attachmentId: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await myProductsApi.removeAttachment(productId, attachmentId);
      queryClient.setQueryData<Product>(queryKeys.myProducts.detail(productId), (current) =>
        current
          ? {
              ...current,
              attachments: current.attachments.filter((file) => file.id !== attachmentId),
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.list });
      setDeletingAttachment(null);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  const retry = () => {
    setError('');
    void refetch();
  };

  if (!product)
    return visibleError ? (
      <section className='space-y-3'>
        <h1>Hồ sơ và kết quả</h1>
        <AlertError title='Không thể tải hồ sơ' errors={[visibleError]} />
        <Button type='button' variant='secondary' onClick={retry}>
          Tải lại hồ sơ
        </Button>
      </section>
    ) : (
      <section aria-busy='true' aria-label='Đang tải hồ sơ'>
        <PageSpin />
      </section>
    );

  const statusLabel = REGISTRANT_PRODUCT_STATUS_LABEL[product.status];
  const resultReady = product.status === 'COMPLETED' && typeof product.finalScore === 'number';

  return (
    <section className='route-panel registrant-result-page'>
      <Link className='text-link' to='/my/products'>
        ← Hồ sơ của tôi
      </Link>
      <p className='eyebrow'>HỒ SƠ CHỦ THỂ · {statusLabel}</p>
      <h1>{product.name}</h1>
      <p>{product.category.name}</p>
      {product.submittedAt && (
        <p className='submitted-at'>
          Đã nộp:{' '}
          <time dateTime={product.submittedAt}>
            {new Date(product.submittedAt).toLocaleString('vi-VN', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </time>
        </p>
      )}
      <section className='result-summary' aria-labelledby='result-title'>
        <h2 id='result-title'>Kết quả đánh giá</h2>
        {resultReady ? (
          <p className='result-score'>
            <strong>{formatExactScore(product.finalScore)} điểm</strong>
            <span>{formatStarRatingLabel(product.starRating)}</span>
          </p>
        ) : (
          <p role='status'>
            {product.status === 'DRAFT'
              ? 'Hồ sơ chưa được nộp để đánh giá.'
              : 'Hồ sơ đang chờ hội đồng hoàn tất đánh giá. Kết quả sẽ hiển thị tại đây khi được tổng hợp.'}
          </p>
        )}
      </section>
      {product.description && <p>{product.description}</p>}
      {visibleError && (
        <div className='my-3'>
          <AlertError title='Lỗi thao tác hồ sơ' errors={[visibleError]} />
        </div>
      )}
      <div className='record-result'>
        {visibleError && (
          <Button type='button' variant='secondary' disabled={busy} onClick={retry}>
            Tải lại hồ sơ
          </Button>
        )}
        <Button asChild variant='secondary'>
          <Link to='/print/products/$id/registration' params={{ id: product.id }}>
            In phiếu đăng ký (Mẫu 01)
          </Link>
        </Button>
        {resultReady && (
          <Button asChild variant='secondary'>
            <Link to='/print/products/$id/results' params={{ id: product.id }}>
              In kết quả đánh giá
            </Link>
          </Button>
        )}
        {product.status === 'DRAFT' && (
          <>
            <Button asChild variant='secondary'>
              <Link to='/my/products/$id/edit' params={{ id: product.id }}>
                Sửa bản nháp
              </Link>
            </Button>
            <Button loading={busy} disabled={busy} onClick={() => setSubmitConfirmOpen(true)}>
              Nộp hồ sơ
            </Button>
          </>
        )}
      </div>
      <h2>Tệp đính kèm</h2>
      <ul>
        {product.attachments.map((file) => (
          <li key={file.id}>
            <AttachmentLink productId={productId} attachmentId={file.id} name={file.fileName} /> ·{' '}
            {file.type}
            {product.status === 'DRAFT' && (
              <Button
                variant='secondary'
                size='sm'
                disabled={busy}
                onClick={() => setDeletingAttachment({ id: file.id, fileName: file.fileName })}
              >
                Xóa
              </Button>
            )}
          </li>
        ))}
      </ul>
      <h2>Thông tin hồ sơ</h2>
      <dl className='detail-facts'>
        {formatFormEntries(product.formData).map((entry) => (
          <div key={entry.key}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>

      <ConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={(open) => {
          if (!open && !busy) setSubmitConfirmOpen(false);
        }}
        title={`Nộp hồ sơ: ${product.name}`}
        description='Sau khi nộp, hồ sơ được chuyển tới hội đồng chấm điểm và không thể sửa bản nháp.'
        confirmLabel='Nộp hồ sơ'
        pending={busy}
        onConfirm={() => void submit()}
      />

      <ConfirmDialog
        open={deletingAttachment !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeletingAttachment(null);
        }}
        title={`Xóa tệp đính kèm: ${deletingAttachment?.fileName ?? ''}`}
        description='Tệp sẽ bị xóa khỏi bản nháp hồ sơ sản phẩm.'
        confirmLabel='Xóa tệp'
        destructive
        pending={busy}
        onConfirm={() => {
          if (deletingAttachment) void removeAttachment(deletingAttachment.id);
        }}
      />
    </section>
  );
}
