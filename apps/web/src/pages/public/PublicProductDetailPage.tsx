import { Link } from '@tanstack/react-router';
import { publicAttachmentUrl } from '../../constants/api';
import { PUBLIC_PRODUCT_STATUS_LABEL } from '../../constants/product-status';
import { errorText } from '../../lib/api-error';
import { usePublicProduct } from '../../queries/common';
import type { PublicProduct } from '../../types/public';

export function PublicProductDetailPage({ id }: { id: string }) {
  const { data, error: loadError } = usePublicProduct<PublicProduct>(id);
  const error = errorText(loadError);
  const product = data ?? null;
  if (error)
    return (
      <main className='route-main' id='content'>
        <div className='route-container container'>
          <div className='empty-state' role='alert'>
            <h1>Chưa tải được sản phẩm</h1>
            <p>{error}</p>
            <Link className='text-link' to='/products'>
              Quay lại danh sách
            </Link>
          </div>
        </div>
      </main>
    );
  if (!product)
    return (
      <main className='route-main' id='content'>
        <div className='route-container container'>
          <div className='detail-skeleton' aria-busy='true' aria-label='Đang tải sản phẩm'>
            <div className='skeleton-media' />
            <div className='skeleton-line' />
            <div className='skeleton-line short' />
          </div>
        </div>
      </main>
    );
  return (
    <main className='route-main' id='content'>
      <div className='route-container container'>
        <Link className='text-link' to='/products'>
          ← Danh sách sản phẩm
        </Link>
        <section className='route-panel public-product-detail' aria-labelledby='route-title'>
          <div className='public-product-heading'>
            <div>
              <p className='eyebrow'>
                SẢN PHẨM OCOP · {PUBLIC_PRODUCT_STATUS_LABEL[product.status]}
              </p>
              <h1 id='route-title'>{product.name}</h1>
              <p>
                {product.category.groupName} · {product.category.name}
              </p>
            </div>
            {product.finalScore !== null && (
              <strong className='public-product-rating'>
                {product.finalScore} điểm · {product.starRating} sao
              </strong>
            )}
          </div>
          {product.description && (
            <p className='public-product-description'>{product.description}</p>
          )}
          <h2>Hình ảnh sản phẩm</h2>
          {product.attachments.length ? (
            <div className='public-image-gallery'>
              {product.attachments.map((attachment, index) => (
                <figure key={attachment.id}>
                  <img
                    src={publicAttachmentUrl(product.id, attachment.id)}
                    alt={`${product.name} — ảnh ${index + 1}`}
                    loading='lazy'
                  />
                </figure>
              ))}
            </div>
          ) : (
            <div className='empty-state'>
              <p>Chưa có hình ảnh công khai cho sản phẩm này.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
