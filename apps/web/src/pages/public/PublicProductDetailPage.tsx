import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { ImagePreviewDialog } from '@/components/image-preview-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { publicAttachmentUrl } from '../../constants/api';
import { HTTP_STATUS } from '../../constants/http-status';
import {
  PRODUCT_PUBLICATION_STATE,
  PRODUCT_STATUS,
  PUBLIC_PRODUCT_STATUS_TONE,
} from '../../constants/product-status';
import { formatDate } from '../../lib/admin-date';
import { ApiError } from '../../lib/api-error';
import {
  displayProductCode,
  formatExactScore,
  formatStarRatingLabel,
} from '../../lib/print-format';
import { usePublicProduct } from '../../queries/common';
import type { PublicProduct } from '../../types/public';

const PUBLIC_DETAIL_STATUS_COPY = {
  SUBMITTED: {
    label: 'Đã tiếp nhận',
    description: 'Hồ sơ đã được tiếp nhận và đang chờ xét duyệt.',
  },
  APPROVED: {
    label: 'Đã duyệt',
    description: 'Hồ sơ đã được duyệt và phân công hội đồng đánh giá.',
  },
  SCORING: {
    label: 'Đang đánh giá',
    description: 'Hồ sơ đang được chấm theo bộ tiêu chí OCOP.',
  },
  COMPLETED: {
    label: 'Đã hoàn tất đánh giá',
    description: 'Kết quả đánh giá của hồ sơ được hiển thị bên dưới sau khi công bố.',
  },
} as const;

export function PublicProductNotFound() {
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
}

export function PublicProductDetailPage({ id }: { id: string }) {
  const {
    data: product,
    error: loadError,
    isPending,
    isFetching,
    refetch,
  } = usePublicProduct<PublicProduct>(id);
  const [failedAttachmentIds, setFailedAttachmentIds] = useState<Set<string>>(() => new Set());
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const isNotFound = loadError instanceof ApiError && loadError.status === HTTP_STATUS.NOT_FOUND;

  if (isNotFound) return <PublicProductNotFound />;

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
  const layoutClass = !hasImages ? ' public-product-layout--no-image' : '';

  return (
    <main className='route-main public-product-page' id='content'>
      <div className='route-container container'>
        <article className='public-product-detail' aria-labelledby='public-product-title'>
          <header className='public-product-detail-header'>
            <Button asChild variant='secondary' className='public-product-back'>
              <Link to='/products'>
                <ArrowLeft aria-hidden='true' size={20} strokeWidth={2} />
                <span>Danh sách sản phẩm</span>
              </Link>
            </Button>
            <div className='public-product-detail-heading'>
              <Badge
                variant='outline'
                className={'status-badge ' + PUBLIC_PRODUCT_STATUS_TONE[product.status]}
              >
                {statusCopy.label}
              </Badge>
              <h1 id='public-product-title'>{product.name}</h1>
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
                    <button
                      type='button'
                      className='block size-full cursor-zoom-in border-0 bg-transparent p-0'
                      onClick={() => setPreviewImageIndex(0)}
                      aria-label={`Xem phóng to ${product.name} — ảnh 1`}
                    >
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
                    </button>
                  )}
                </figure>
              </section>
            )}

            <div className='public-product-content'>
              <section className='public-product-info' aria-labelledby='public-product-info-title'>
                <h2 id='public-product-info-title'>Thông tin sản phẩm</h2>
                <dl className='public-product-facts'>
                  <div>
                    <dt>Danh mục</dt>
                    <dd>{product.category.name}</dd>
                  </div>
                  <div>
                    <dt>Mã hồ sơ</dt>
                    <dd>{displayProductCode(product)}</dd>
                  </div>
                  <div>
                    <dt>Ngày tạo</dt>
                    <dd>
                      <time dateTime={product.createdAt}>{formatDate(product.createdAt)}</time>
                    </dd>
                  </div>
                </dl>
              </section>

              {hasDescription && (
                <section
                  className='public-product-intro'
                  aria-labelledby='public-product-intro-title'
                >
                  <h2 id='public-product-intro-title'>Giới thiệu</h2>
                  <p>{product.description}</p>
                </section>
              )}

              {product.status === PRODUCT_STATUS.COMPLETED && (
                <section
                  className='public-product-result'
                  aria-labelledby='public-product-result-title'
                >
                  <h2 id='public-product-result-title'>Kết quả đánh giá</h2>
                  {product.publicationState === PRODUCT_PUBLICATION_STATE.PUBLISHED &&
                  product.finalScore !== null ? (
                    <>
                      <div className='public-product-result-values'>
                        <p className='public-product-score'>
                          {formatExactScore(product.finalScore) + ' / 100 điểm'}
                        </p>
                        <p className='public-product-stars'>
                          {product.starRating !== null
                            ? formatStarRatingLabel(product.starRating)
                            : 'Chưa có kết quả xếp sao.'}
                        </p>
                      </div>
                      <p className='public-product-result-note'>
                        Kết quả được tính từ phiếu chấm trong hệ thống, không thay thế quyết định
                        công nhận OCOP.
                      </p>
                    </>
                  ) : product.publicationState === PRODUCT_PUBLICATION_STATE.UPDATING ? (
                    <p className='public-product-result-note'>
                      Kết quả đang được cập nhật sau khi có phiếu chấm bổ sung và chờ công bố lại.
                    </p>
                  ) : (
                    <p className='public-product-result-note'>
                      Hồ sơ đã hoàn tất chấm điểm và đang chờ công bố kết quả chính thức.
                    </p>
                  )}
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
                      <button
                        type='button'
                        className='block size-full cursor-zoom-in border-0 bg-transparent p-0'
                        onClick={() => setPreviewImageIndex(index + 1)}
                        aria-label={`Xem phóng to ${product.name} — ảnh ${index + 2}`}
                      >
                        <img
                          src={publicAttachmentUrl(product.id, attachment.id)}
                          alt={product.name + ' — ảnh ' + (index + 2)}
                          loading='lazy'
                          decoding='async'
                          onError={() =>
                            setFailedAttachmentIds((current) => new Set(current).add(attachment.id))
                          }
                        />
                      </button>
                    )}
                  </figure>
                ))}
              </div>
            </section>
          )}

          <ImagePreviewDialog
            items={product.attachments.map((att, idx) => ({
              kind: 'url',
              id: att.id,
              name: `${product.name} — Ảnh ${idx + 1}`,
              url: publicAttachmentUrl(product.id, att.id),
            }))}
            activeIndex={previewImageIndex}
            onIndexChange={setPreviewImageIndex}
            contextLabel={product.name}
          />
        </article>
      </div>
    </main>
  );
}
