import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, ChevronRight, Circle, Copy, Link2, Play, ZoomIn } from 'lucide-react';
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
    description: 'Kết quả đánh giá của hồ sơ được hiển thị bên dưới sau khi công bố.',
  },
} as const;

const OCOP_PROGRESS_STEPS = [
  {
    status: PRODUCT_STATUS.SUBMITTED,
    label: 'Đã tiếp nhận',
    summary: 'Hồ sơ được gửi lên hệ thống và chờ kiểm tra điều kiện.',
  },
  {
    status: PRODUCT_STATUS.APPROVED,
    label: 'Đã duyệt',
    summary: 'Hồ sơ hợp lệ và được phân công cho hội đồng chấm điểm.',
  },
  {
    status: PRODUCT_STATUS.SCORING,
    label: 'Đang đánh giá',
    summary: 'Các giám khảo chấm điểm độc lập theo bộ tiêu chí OCOP.',
  },
  {
    status: PRODUCT_STATUS.COMPLETED,
    label: 'Hoàn tất & Công bố',
    summary: 'Tổng hợp điểm chấm và công bố kết quả xếp hạng chính thức.',
  },
] as const;

type CopyTarget = 'code' | 'link';

async function writeClipboardText(value: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

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

type ProductMediaItem = {
  kind: 'image' | 'video';
  attachment: PublicProduct['attachments'][number];
  typeIndex: number;
};

function buildProductMediaItems(product: PublicProduct): ProductMediaItem[] {
  const images: ProductMediaItem[] = product.attachments.map((attachment, typeIndex) => ({
    kind: 'image',
    attachment,
    typeIndex,
  }));
  const videos: ProductMediaItem[] = (product.videos ?? []).map((attachment, typeIndex) => ({
    kind: 'video',
    attachment,
    typeIndex,
  }));
  return [...images, ...videos];
}

function ProductMediaGallery({
  product,
  mediaItems,
  selectedMediaIndex,
  failedAttachmentIds,
  onSelectMedia,
  onOpenPreview,
  onMediaError,
}: {
  product: PublicProduct;
  mediaItems: ProductMediaItem[];
  selectedMediaIndex: number;
  failedAttachmentIds: Set<string>;
  onSelectMedia: (index: number) => void;
  onOpenPreview: (imageIndex: number) => void;
  onMediaError: (attachmentId: string) => void;
}) {
  const totalMedia = mediaItems.length;
  const activeItem = mediaItems[selectedMediaIndex];
  if (!activeItem) return null;

  const hasImages = product.attachments.length > 0;
  const hasVideos = (product.videos ?? []).length > 0;
  const sectionTitle =
    hasImages && hasVideos
      ? 'Hình ảnh & video sản phẩm'
      : hasVideos
        ? 'Video sản phẩm'
        : 'Hình ảnh sản phẩm';
  const counterLabel = hasVideos
    ? `${activeItem.kind === 'video' ? 'Video' : 'Ảnh'} · ${selectedMediaIndex + 1} / ${totalMedia}`
    : `Ảnh ${selectedMediaIndex + 1} / ${totalMedia}`;

  const isPrimaryFailed = failedAttachmentIds.has(activeItem.attachment.id);
  const itemNumber = activeItem.typeIndex + 1;
  const activeItemLabel =
    activeItem.kind === 'video'
      ? `${product.name} — video ${itemNumber}`
      : `${product.name} — ảnh ${itemNumber}`;

  return (
    <section className='public-product-media' aria-labelledby='public-product-media-title'>
      <div className='public-product-section-head'>
        <h2 id='public-product-media-title'>{sectionTitle}</h2>
        {totalMedia > 1 && <span className='public-product-media-count'>{counterLabel}</span>}
      </div>

      <figure
        className={
          activeItem.kind === 'video'
            ? 'public-product-image-frame public-product-image-primary is-video'
            : 'public-product-image-frame public-product-image-primary'
        }
      >
        {isPrimaryFailed ? (
          <div
            className={
              activeItem.kind === 'video'
                ? 'public-product-image-fallback public-product-video-fallback'
                : 'public-product-image-fallback'
            }
            role='img'
            aria-label={
              activeItem.kind === 'video'
                ? `${activeItemLabel}: không tải được video này`
                : `${activeItemLabel}: không tải được hình ảnh này`
            }
          >
            {activeItem.kind === 'video'
              ? 'Không tải được video này.'
              : 'Không tải được hình ảnh này.'}
          </div>
        ) : activeItem.kind === 'video' ? (
          <video
            key={activeItem.attachment.id}
            controls
            preload='metadata'
            playsInline
            src={publicAttachmentUrl(product.id, activeItem.attachment.id)}
            aria-label={activeItemLabel}
            onError={() => onMediaError(activeItem.attachment.id)}
          >
            Trình duyệt của bạn không hỗ trợ phát video trực tiếp.
          </video>
        ) : (
          <button
            type='button'
            className='public-product-zoom-trigger'
            onClick={() => onOpenPreview(activeItem.typeIndex)}
            aria-label={`Xem phóng to ${activeItemLabel}`}
          >
            <img
              src={publicAttachmentUrl(product.id, activeItem.attachment.id)}
              alt={activeItemLabel}
              loading='eager'
              decoding='async'
              onError={() => onMediaError(activeItem.attachment.id)}
            />
            <span className='public-product-zoom-pill' aria-hidden='true'>
              <ZoomIn size={15} strokeWidth={2} />
              <span>Phóng to</span>
            </span>
          </button>
        )}
      </figure>

      {totalMedia > 1 && (
        <div
          className='public-product-thumbs'
          role='list'
          aria-label='Chọn hình ảnh hoặc video sản phẩm'
        >
          {mediaItems.map((item, index) => {
            const isActive = index === selectedMediaIndex;
            const isFailed = failedAttachmentIds.has(item.attachment.id);
            const thumbNumber = item.typeIndex + 1;
            const isVideo = item.kind === 'video';
            return (
              <div key={item.attachment.id} role='listitem'>
                <button
                  type='button'
                  className={
                    'public-product-thumb' +
                    (isVideo ? ' public-product-thumb--video' : '') +
                    (isActive ? ' is-active' : '')
                  }
                  onClick={() => onSelectMedia(index)}
                  aria-label={
                    isVideo
                      ? `Xem ${product.name} — video ${thumbNumber}`
                      : `Xem ${product.name} — ảnh ${thumbNumber}`
                  }
                  aria-pressed={isActive}
                >
                  {isFailed ? (
                    <span className='public-product-thumb-fallback'>
                      {isVideo ? 'Lỗi video' : 'Lỗi ảnh'}
                    </span>
                  ) : isVideo ? (
                    <>
                      <video
                        src={publicAttachmentUrl(product.id, item.attachment.id)}
                        preload='metadata'
                        muted
                        playsInline
                        tabIndex={-1}
                        aria-hidden='true'
                        onError={() => onMediaError(item.attachment.id)}
                      />
                      <span className='public-product-thumb-play' aria-hidden='true'>
                        <Play size={12} fill='currentColor' strokeWidth={2} />
                      </span>
                    </>
                  ) : (
                    <img
                      src={publicAttachmentUrl(product.id, item.attachment.id)}
                      alt={`${product.name} — ảnh thu nhỏ ${thumbNumber}`}
                      loading='lazy'
                      decoding='async'
                      onError={() => onMediaError(item.attachment.id)}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OcopEvaluationProgress({ status }: { status: PublicProduct['status'] }) {
  const currentStepIndex = OCOP_PROGRESS_STEPS.findIndex((step) => step.status === status);

  return (
    <section className='public-product-progress' aria-labelledby='public-product-progress-title'>
      <div className='public-product-section-head'>
        <h2 id='public-product-progress-title'>Tiến trình đánh giá OCOP</h2>
        <span className='public-product-progress-tag'>Thang 100 điểm</span>
      </div>
      <ol className='public-product-steps'>
        {OCOP_PROGRESS_STEPS.map((step, index) => {
          const stateClass =
            index < currentStepIndex
              ? 'is-done'
              : index === currentStepIndex
                ? 'is-current'
                : 'is-upcoming';
          return (
            <li key={step.status} className={`public-product-step ${stateClass}`}>
              <span className='public-product-step-icon' aria-hidden='true'>
                {index < currentStepIndex ? (
                  <Check size={14} strokeWidth={2.5} />
                ) : (
                  <Circle size={12} strokeWidth={2.2} />
                )}
              </span>
              <div className='public-product-step-body'>
                <div className='public-product-step-title'>
                  <strong>{step.label}</strong>
                  {index === currentStepIndex && (
                    <span className='public-product-step-now'>Hiện tại</span>
                  )}
                </div>
                <p>{step.summary}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className='public-product-progress-links'>
        <span>Điểm tổng hợp và mức xếp hạng sẽ hiển thị tại đây sau khi công bố.</span>
        <div className='public-product-progress-actions'>
          <Link className='text-link' to='/' hash='workflow'>
            Xem quy trình OCOP
          </Link>
          <Link className='text-link' to='/' hash='criteria'>
            Xem bộ tiêu chí đánh giá
          </Link>
        </div>
      </div>
    </section>
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
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [previewImageIndex, setPreviewImageIndex] = useState<number | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<CopyTarget | null>(null);
  const isNotFound = loadError instanceof ApiError && loadError.status === HTTP_STATUS.NOT_FOUND;

  useEffect(() => {
    setSelectedMediaIndex(0);
    setPreviewImageIndex(null);
    setCopiedTarget(null);
  }, [id]);

  useEffect(() => {
    if (!copiedTarget) return;
    const timeoutId = window.setTimeout(() => setCopiedTarget(null), 2000);
    return () => window.clearTimeout(timeoutId);
  }, [copiedTarget]);

  const handleMediaError = (attachmentId: string) => {
    setFailedAttachmentIds((current) => new Set(current).add(attachmentId));
  };

  const handleCopy = async (target: CopyTarget, value: string) => {
    if (await writeClipboardText(value)) {
      setCopiedTarget(target);
    }
  };

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
  const mediaItems = buildProductMediaItems(product);
  const hasMedia = mediaItems.length > 0;
  const activeMediaIndex = hasMedia ? Math.min(selectedMediaIndex, mediaItems.length - 1) : 0;
  const hasDescription = Boolean(product.description?.trim());
  const layoutClass = !hasMedia ? ' public-product-layout--no-image' : '';
  const productCode = displayProductCode(product);

  return (
    <main className='route-main public-product-page' id='content'>
      <div className='route-container container'>
        <article className='public-product-detail' aria-labelledby='public-product-title'>
          <header className='public-product-detail-header'>
            <div className='public-product-topbar'>
              <Button asChild variant='secondary' className='public-product-back'>
                <Link to='/products'>
                  <ArrowLeft aria-hidden='true' size={20} strokeWidth={2} />
                  <span>Danh sách sản phẩm</span>
                </Link>
              </Button>
              <nav className='public-product-breadcrumb' aria-label='Đường dẫn trang'>
                <Link to='/'>Trang chủ</Link>
                <ChevronRight size={14} aria-hidden='true' />
                <Link to='/products'>Tra cứu</Link>
                <ChevronRight size={14} aria-hidden='true' />
                <span aria-current='page'>{product.name}</span>
              </nav>
            </div>
            <div className='public-product-detail-heading'>
              {'label' in statusCopy && (
                <Badge
                  variant='outline'
                  className={'status-badge ' + PUBLIC_PRODUCT_STATUS_TONE[product.status]}
                >
                  {statusCopy.label}
                </Badge>
              )}
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
            {hasMedia && (
              <ProductMediaGallery
                product={product}
                mediaItems={mediaItems}
                selectedMediaIndex={activeMediaIndex}
                failedAttachmentIds={failedAttachmentIds}
                onSelectMedia={setSelectedMediaIndex}
                onOpenPreview={setPreviewImageIndex}
                onMediaError={handleMediaError}
              />
            )}

            <div className='public-product-content'>
              <section className='public-product-info' aria-labelledby='public-product-info-title'>
                <div className='public-product-section-head'>
                  <h2 id='public-product-info-title'>Thông tin sản phẩm</h2>
                  <Button
                    type='button'
                    variant='secondary'
                    size='sm'
                    className='public-product-share-btn'
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        void handleCopy('link', window.location.href);
                      }
                    }}
                  >
                    {copiedTarget === 'link' ? (
                      <Check size={14} aria-hidden='true' />
                    ) : (
                      <Link2 size={14} aria-hidden='true' />
                    )}
                    <span className='leading-none'>
                      {copiedTarget === 'link' ? 'Đã sao chép liên kết' : 'Chia sẻ liên kết'}
                    </span>
                  </Button>
                </div>
                <dl className='public-product-facts'>
                  <div>
                    <dt>Danh mục</dt>
                    <dd>
                      <Link
                        className='public-product-category-link'
                        to='/products'
                        search={{ categoryId: product.category.id }}
                      >
                        {product.category.name}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt>Mã hồ sơ</dt>
                    <dd className='public-product-code-value'>
                      <span>{productCode}</span>
                      <button
                        type='button'
                        className='public-product-copy-btn'
                        onClick={() => void handleCopy('code', productCode)}
                        aria-label={`Sao chép mã hồ sơ ${productCode}`}
                        title={copiedTarget === 'code' ? 'Đã sao chép' : 'Sao chép mã hồ sơ'}
                      >
                        {copiedTarget === 'code' ? (
                          <Check size={14} aria-hidden='true' />
                        ) : (
                          <Copy size={14} aria-hidden='true' />
                        )}
                      </button>
                    </dd>
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

              {product.status === PRODUCT_STATUS.COMPLETED ? (
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
              ) : (
                <OcopEvaluationProgress status={product.status} />
              )}
            </div>

            {!hasMedia && (
              <section
                className='public-product-no-image'
                aria-labelledby='public-product-no-image-title'
              >
                <h2 id='public-product-no-image-title'>Hình ảnh sản phẩm</h2>
                <p>Chưa có hình ảnh công khai cho sản phẩm này.</p>
              </section>
            )}
          </div>

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
