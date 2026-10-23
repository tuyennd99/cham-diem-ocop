import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { times, trim } from 'lodash';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { publicAttachmentUrl } from '../../constants/api';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { PUBLIC_PRODUCT_STATUS_LABEL } from '../../constants/product-status';
import { errorText } from '../../lib/api-error';
import { useCategories, usePublicProducts } from '../../queries/common';
import type { PublicProduct } from '../../types/public';

export function PublicCatalogPage() {
  const [appliedQuery, setAppliedQuery] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);

  const searchForm = useForm({
    defaultValues: { query: '', categoryId: '' },
    onSubmit: async ({ value }) => {
      setPage(1);
      setAppliedQuery(trim(value.query));
      setCategoryId(value.categoryId);
    },
  });

  const categoryRequest = useCategories();
  const productRequest = usePublicProducts<PublicProduct>({
    page,
    limit: DEFAULT_PAGE_SIZE,
    categoryId: categoryId || undefined,
    q: appliedQuery || undefined,
  });
  const categories = categoryRequest.data ?? [];
  const rows = productRequest.data?.data ?? [];
  const meta = productRequest.data?.meta ?? {
    page,
    limit: DEFAULT_PAGE_SIZE,
    total: rows.length,
    totalPages: productRequest.data ? 1 : 0,
  };
  const error = errorText(categoryRequest.error) || errorText(productRequest.error);
  const loading = productRequest.isPending;

  return (
    <main className='route-main' id='content'>
      <div className='route-container container'>
        <div className='section-heading'>
          <div>
            <p className='eyebrow'>TRA CỨU CÔNG KHAI</p>
            <h1>Danh sách sản phẩm OCOP</h1>
          </div>
          <p className='section-intro'>Hồ sơ được hiển thị sau khi chủ thể nộp đăng ký.</p>
        </div>
        <form
          className='lookup-controls'
          onSubmit={(event) => {
            event.preventDefault();
            void searchForm.handleSubmit();
          }}
        >
          <searchForm.Field name='query'>
            {(field) => (
              <div className='field search-field'>
                <label htmlFor='product-search'>Tìm trong toàn danh mục</label>
                <div className='search-row'>
                  <Input
                    id='product-search'
                    type='search'
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    placeholder='Tên sản phẩm, mã hoặc nhóm'
                  />
                  {field.state.value && (
                    <Button
                      type='button'
                      variant='secondary'
                      onClick={() => {
                        field.handleChange('');
                        setAppliedQuery('');
                        setPage(1);
                      }}
                    >
                      Xóa từ khóa
                    </Button>
                  )}
                </div>
              </div>
            )}
          </searchForm.Field>
          <searchForm.Field name='categoryId'>
            {(field) => (
              <div className='field status-field'>
                <label htmlFor='product-category'>Nhóm sản phẩm</label>
                <select
                  id='product-category'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    field.handleChange(event.target.value);
                    setCategoryId(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value=''>Tất cả nhóm</option>
                  {categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.groupName} · {item.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </searchForm.Field>
          <Button type='submit' disabled={loading}>
            Tìm kiếm
          </Button>
        </form>
        <p className='result-count' aria-live='polite'>
          {loading
            ? 'Đang tải hồ sơ…'
            : error
              ? 'Tạm thời chưa tải được dữ liệu'
              : `${meta.total} hồ sơ`}
        </p>
        {!loading && error && (
          <div className='state-panel state-panel-error' role='alert'>
            <div className='state-panel-copy'>
              <p className='state-eyebrow'>TẠM THỜI GIÁN ĐOẠN KẾT NỐI</p>
              <h2>Chưa tải được danh sách sản phẩm OCOP</h2>
              <p>Hệ thống tra cứu đang tạm thời không phản hồi ({error}). Vui lòng thử tải lại.</p>
            </div>
            <div className='state-actions'>
              <button
                type='button'
                className='button button-primary'
                onClick={() => {
                  void categoryRequest.refetch();
                  void productRequest.refetch();
                }}
              >
                Thử lại
              </button>
            </div>
          </div>
        )}
        {loading && (
          <div className='record-list-skeleton' aria-busy='true' aria-label='Đang tải danh sách'>
            {times(4, (index) => (
              <div className='record-row skeleton-record' key={index}>
                <div className='skeleton-media' />
                <div className='skeleton-copy'>
                  <div className='skeleton-line' />
                  <div className='skeleton-line short' />
                  <div className='skeleton-line' />
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className='empty-state'>
            <h2>Chưa có hồ sơ phù hợp</h2>
            <p>Thử đổi từ khóa hoặc nhóm sản phẩm.</p>
          </div>
        )}
        {!loading && !error && (
          <div className='record-list'>
            {rows.map((product) => (
              <article className='record-row' key={product.id}>
                <div className='record-media'>
                  {product.attachments[0] ? (
                    <img
                      src={publicAttachmentUrl(product.id, product.attachments[0].id)}
                      alt={product.name}
                      loading='lazy'
                    />
                  ) : (
                    <span className='empty-media' aria-label='Chưa có ảnh sản phẩm'>
                      OCOP
                    </span>
                  )}
                </div>
                <div className='record-main'>
                  <div className='record-badges'>
                    <span className='badge badge-category'>{product.category.groupName}</span>
                    <span className={`badge status-badge status-${product.status.toLowerCase()}`}>
                      {PUBLIC_PRODUCT_STATUS_LABEL[product.status]}
                    </span>
                  </div>
                  <h2>{product.name}</h2>
                  <p className='record-origin'>{product.category.name}</p>
                  <dl className='record-facts'>
                    <div>
                      <dt>Mã hồ sơ</dt>
                      <dd>{product.id}</dd>
                    </div>
                    <div>
                      <dt>Ngày tạo</dt>
                      <dd>{new Date(product.createdAt).toLocaleDateString('vi-VN')}</dd>
                    </div>
                  </dl>
                </div>
                <div className='record-result'>
                  {product.starRating ? (
                    <div className='rating-block'>
                      <strong>{product.starRating} sao</strong>
                      <span className='stars' aria-label={`${product.starRating} sao`}>
                        ★{product.starRating > 1 ? ` × ${product.starRating}` : ''}
                      </span>
                    </div>
                  ) : (
                    <p className='no-rating'>Chưa có kết quả</p>
                  )}
                  <Link
                    className='button button-secondary detail-link'
                    to='/products/$id'
                    params={{ id: product.id }}
                  >
                    Xem hồ sơ
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
        {!error && (
          <nav className='pagination' aria-label='Phân trang'>
            <Button
              variant='secondary'
              disabled={loading || page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </Button>
            <span className='page-count'>
              Trang {page} / {Math.max(1, meta.totalPages)}
            </span>
            <Button
              variant='secondary'
              disabled={loading || page >= meta.totalPages || meta.totalPages === 0}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </Button>
          </nav>
        )}
      </div>
    </main>
  );
}
