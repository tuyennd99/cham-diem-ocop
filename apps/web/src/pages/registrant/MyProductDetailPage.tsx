import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
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
  const visibleError = error || errorText(loadError);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const { data } = await myProductsApi.submit(productId);
      queryClient.setQueryData(queryKeys.myProducts.detail(productId), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.myProducts.list });
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
      <section>
        <h1>Hồ sơ và kết quả</h1>
        <p role='alert' className='form-note'>
          {visibleError}
        </p>
        <Button type='button' variant='secondary' onClick={retry}>
          Tải lại hồ sơ
        </Button>
      </section>
    ) : (
      <section className='detail-skeleton' aria-busy='true' aria-label='Đang tải hồ sơ'>
        <div className='skeleton-line' />
        <div className='skeleton-line short' />
        <div className='skeleton-block' />
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
      <p>
        {product.category.groupName} · {product.category.name}
      </p>
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
        <p role='alert' className='form-note'>
          {visibleError}
        </p>
      )}
      <div className='record-result'>
        {visibleError && (
          <Button type='button' variant='secondary' disabled={busy} onClick={retry}>
            Tải lại hồ sơ
          </Button>
        )}
        <Link
          className='button button-secondary'
          to='/print/products/$id/registration'
          params={{ id: product.id }}
        >
          In phiếu đăng ký (Mẫu 01)
        </Link>
        {resultReady && (
          <Link
            className='button button-secondary'
            to='/print/products/$id/results'
            params={{ id: product.id }}
          >
            In kết quả đánh giá
          </Link>
        )}
        {product.status === 'DRAFT' && (
          <>
            <Link
              className='button button-secondary'
              to='/my/products/$id/edit'
              params={{ id: product.id }}
            >
              Sửa bản nháp
            </Link>
            <Button disabled={busy} onClick={() => void submit()}>
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
                disabled={busy}
                onClick={() => void removeAttachment(file.id)}
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
    </section>
  );
}
