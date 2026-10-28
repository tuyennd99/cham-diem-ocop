import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { publicAttachmentUrl } from '../../constants/api';
import { PUBLIC_PRODUCT_STATUS_TONE } from '../../constants/product-status';
import { ApiError } from '../../lib/api-error';
import { formatExactScore, formatStarRatingLabel } from '../../lib/print-format';
import { usePublicProduct } from '../../queries/common';
import type { PublicProduct } from '../../types/public';

const PUBLIC_DETAIL_STATUS_COPY = {
  SUBMITTED: {
    label: 'Đã tiếp nhận',
    description: 'Hồ sơ đã được tiếp nhận và đang chờ đánh giá.',
  },
  SCORING: {
    label: 'Đang đánh giá',
    description: 'Hồ sơ đang được chấm theo bộ tiêu chí OCOP.',
  },
  COMPLETED: {
    label: 'Đã hoàn tất đánh giá',
    description: 'Kết quả đánh giá của hồ sơ được hiển thị bên dưới.',
  },
} as const;

export function PublicProductDetailPage({ id }: { id: string }) {
  const {
    data: product,
    error: loadError,
    isPending,
    isFetching,
    refetch,
  } = usePublicProduct<PublicProduct>(id);
  const [failedAttachmentIds, setFailedAttachmentIds] = useState<Set<string>>(() => new Set());
  const isNotFound = loadError instanceof ApiError && loadError.status === 404;

  if (isNotFound)
    return (
      <main className='route-main public-product-page' id='content'>
        <div className='route-container container'>
          <div className='public-product-error'>
            <h1>Không tìm thấy sản phẩm công khai</h1>
            <p>Sản phẩm này không tồn tại hoặc chưa được công khai.</p>
            <Link className='text-link' to='/products'>
              Quay lại danh sách sản phẩm
            </Link>
          </div>
        </div>
      </main>
    );

  if (!product && isPending)
    return (
      <main className='route-main public-product-page' id='content' aria-busy='true'>
        <div className='route-container container'>
          <div className='public-product-skeleton' role='status'>
            <span className='sr-only'>Đang tải sản phẩm</span>
            <div className='skeleton-line public-product-skeleton-back' aria-hidden='true' />
            <div className='public-product-skeleton-heading' aria-hidden='true'>
              <div className='skeleton-line public-product-skeleton-title' />
              <div className='skeleton-line public-product-skeleton-category' />
            </div>
            <div className='public-product-skeleton-layout' aria-hidden='true'>
              <div className='skeleton-media public-product-skeleton-media' />
              <div className='public-product-skeleton-copy'>
                <div className='skeleton-line' />
                <div className='skeleton-line short' />
                <div className='skeleton-line' />
                <div className='skeleton-line short' />
              </div>
            </div>
          </div>
        </div>
      </main>
    );

  if (!product)
    return (
      <main className='route-main public-product-page' id='content'>
        <div className='route-container container'>
          <div className='public-product-error' role='alert'>
            <h1>Chưa tải được sản phẩm</h1>
            <p>Kiểm tra kết nối rồi thử lại.</p>
            <Button
              type='button'
              loading={isFetching}
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              {isFetching ? 'Đang thử lại…' : 'Thử lại'}
            </Button>
          </div>
        </div>
      </main>
    );

  const statusCopy = PUBLIC_DETAIL_STATUS_COPY[product.status];
  const hasImages = product.attachments.length > 0;
  const hasDescription = Boolean(product.description?.trim());
  const hasDetails = hasDescription || product.status === 'COMPLETED';
  const layoutClass = !hasImages
    ? ' public-product-layout--no-image'
    : !hasDetails
      ? ' public-product-layout--media-only'
      : '';

  return (
    <main className='route-main public-product-page' id='content'>
      <div className='route-container container'>
        <article className='public-product-detail' aria-labelledby='public-product-title'>
          <header className='public-product-detail-header'>
            <Link className='public-product-back' to='/products'>
              ← Danh sách sản phẩm
            </Link>
            <div className='public-product-detail-heading'>
              <Badge
                variant='outline'
                className={'status-badge ' + PUBLIC_PRODUCT_STATUS_TONE[product.status]}
              >
                {statusCopy.label}
              </Badge>
              <h1 id='public-product-title'>{product.name}</h1>
              <p className='public-product-category'>{product.category.name}</p>
              <p className='public-product-status-copy'>{statusCopy.description}</p>
            </div>
          </header>

          {loadError && (
            <div className='public-product-refresh-error' role='status'>
              <p>Không thể cập nhật sản phẩm lúc này. Nội dung đã tải vẫn được giữ lại.</p>
              <Button
                variant='secondary'
                type='button'
                loading={isFetching}
                onClick={() => void refetch()}
                disabled={isFetching}
              >
                {isFetching ? 'Đang thử lại…' : 'Thử lại'}
              </Button>
            </div>
          )}

          <div className={'public-product-layout' + layoutClass}>
            {hasImages && (
              <section
                className='public-product-media'
                aria-labelledby='public-product-media-title'
              >
                <h2 id='public-product-media-title'>Hình ảnh sản phẩm</h2>
                <figure className='public-product-image-frame public-product-image-primary'>
                  {failedAttachmentIds.has(product.attachments[0].id) ? (
                    <div
                      className='public-product-image-fallback'
                      role='img'
                      aria-label={product.name + ' — ảnh 1: không tải được hình ảnh này'}
                    >
                      Không tải được hình ảnh này.
                    </div>
                  ) : (
                    <img
                      src={publicAttachmentUrl(product.id, product.attachments[0].id)}
                      alt={product.name + ' — ảnh 1'}
                      loading='eager'
                      decoding='async'
                      onError={() =>
                        setFailedAttachmentIds((current) =>
                          new Set(current).add(product.attachments[0].id),
                        )
                      }
                    />
                  )}
                </figure>
              </section>
            )}

            <div className='public-product-content'>
              {hasDescription && (
                <section
                  className='public-product-intro'
                  aria-labelledby='public-product-intro-title'
                >
                  <h2 id='public-product-intro-title'>Giới thiệu</h2>
                  <p>{product.description}</p>
                </section>
              )}

              {product.status === 'COMPLETED' && (
                <section
                  className='public-product-result'
                  aria-labelledby='public-product-result-title'
                >
                  <h2 id='public-product-result-title'>Kết quả đánh giá</h2>
                  <div className='public-product-result-values'>
                    <p className='public-product-score'>
                      {product.finalScore !== null
                        ? formatExactScore(product.finalScore) + ' / 100 điểm'
                        : 'Chưa có điểm tổng để hiển thị.'}
                    </p>
                    <p className='public-product-stars'>
                      {product.starRating !== null
                        ? formatStarRatingLabel(product.starRating)
                        : 'Chưa có kết quả xếp sao.'}
                    </p>
                  </div>
                  <p className='public-product-result-note'>
                    Kết quả được tính từ phiếu chấm trong hệ thống, không thay thế quyết định công
                    nhận OCOP.
                  </p>
                </section>
              )}
            </div>

            {!hasImages && (
              <section
                className='public-product-no-image'
                aria-labelledby='public-product-no-image-title'
              >
                <h2 id='public-product-no-image-title'>Hình ảnh sản phẩm</h2>
                <p>Chưa có hình ảnh công khai cho sản phẩm này.</p>
              </section>
            )}
          </div>

          {product.attachments.length > 1 && (
            <section
              className='public-product-gallery'
              aria-labelledby='public-product-gallery-title'
            >
              <h2 id='public-product-gallery-title'>Hình ảnh khác</h2>
              <div className='public-product-image-grid'>
                {product.attachments.slice(1).map((attachment, index) => (
                  <figure className='public-product-image-frame' key={attachment.id}>
                    {failedAttachmentIds.has(attachment.id) ? (
                      <div
                        className='public-product-image-fallback'
                        role='img'
                        aria-label={
                          product.name + ' — ảnh ' + (index + 2) + ': không tải được hình ảnh này'
                        }
                      >
                        Không tải được hình ảnh này.
                      </div>
                    ) : (
                      <img
                        src={publicAttachmentUrl(product.id, attachment.id)}
                        alt={product.name + ' — ảnh ' + (index + 2)}
                        loading='lazy'
                        decoding='async'
                        onError={() =>
                          setFailedAttachmentIds((current) => new Set(current).add(attachment.id))
                        }
                      />
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </main>
  );
}
