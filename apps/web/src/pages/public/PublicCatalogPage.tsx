import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { times, trim } from 'lodash';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { publicAttachmentUrl } from '../../constants/api';
import { ALL, DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { PUBLIC_PRODUCT_STATUS_LABEL } from '../../constants/product-status';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { useCategories, usePublicProducts } from '../../queries/common';
import type { PublicProduct } from '../../types/public';

export function PublicCatalogPage() {
  const session = useSession();
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
  const productError = errorText(productRequest.error);
  const categoryError = errorText(categoryRequest.error);
  const hasAppliedFilters = Boolean(appliedQuery || categoryId);
  const meta = productRequest.data?.meta ?? {
    page,
    limit: DEFAULT_PAGE_SIZE,
    total: rows.length,
    totalPages: productRequest.data ? 1 : 0,
  };
  const loading = productRequest.isPending;

  return (
    <main className='route-main public-catalog' id='content'>
      <div className='route-container container'>
        <div className='section-heading'>
          <div>
            <h1>Tra cứu sản phẩm OCOP</h1>
          </div>
          {/* <p className='section-intro'>Hồ sơ được công khai từ trạng thái Đã tiếp nhận trở đi.</p> */}
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
                <Label htmlFor='product-search'>Tìm trong toàn danh mục</Label>
                <Input
                  id='product-search'
                  type='search'
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder='Tên sản phẩm, mã hoặc danh mục'
                />
              </div>
            )}
          </searchForm.Field>
          <searchForm.Field name='categoryId'>
            {(field) => (
              <div className='field status-field'>
                <Label htmlFor='product-category'>Danh mục sản phẩm</Label>
                <Select
                  value={field.state.value || ALL}
                  onValueChange={(value) => field.handleChange(value === ALL ? '' : value)}
                >
                  <SelectTrigger id='product-category'>
                    <SelectValue placeholder='Tất cả danh mục' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Tất cả danh mục</SelectItem>
                    {categories.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </searchForm.Field>
          <Button type='submit' disabled={loading}>
            Tìm kiếm
          </Button>
        </form>
        <p className='lookup-hint'>Kết quả chỉ cập nhật sau khi bạn nhấn “Tìm kiếm”.</p>
        {categoryError && (
          <p className='form-note' role='status'>
            Chưa tải được danh sách danh mục sản phẩm. Bạn vẫn có thể tìm theo tên hoặc mã hồ sơ.
          </p>
        )}
        <p className='result-count' aria-live='polite'>
          {loading
            ? 'Đang tải hồ sơ…'
            : productError
              ? 'Tạm thời chưa tải được dữ liệu'
              : `${meta.total} hồ sơ`}
        </p>
        {!loading && productError && (
          <div className='state-panel state-panel-error' role='alert'>
            <div className='state-panel-copy'>
              <p className='state-eyebrow'>TẠM THỜI GIÁN ĐOẠN KẾT NỐI</p>
              <h2>Chưa tải được danh sách sản phẩm OCOP</h2>
              <p>Hệ thống tra cứu đang tạm thời không phản hồi. Vui lòng thử tải lại.</p>
            </div>
            <div className='state-actions'>
              <Button
                type='button'
                onClick={() => {
                  void categoryRequest.refetch();
                  void productRequest.refetch();
                }}
              >
                Thử lại
              </Button>
            </div>
          </div>
        )}
        {loading && (
          <div className='record-list-skeleton' aria-hidden='true'>
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
        {!loading && !productError && rows.length === 0 && (
          <div className='empty-state public-catalog-empty'>
            <h2>
              {hasAppliedFilters ? 'Không tìm thấy sản phẩm phù hợp' : 'Chưa có hồ sơ công khai'}
            </h2>
            <p>
              {hasAppliedFilters
                ? 'Thử đổi từ khóa hoặc danh mục sản phẩm, rồi nhấn “Tìm kiếm”.'
                : 'Hồ sơ sẽ xuất hiện tại đây sau khi được tiếp nhận.'}
            </p>
            {!hasAppliedFilters && !session && (
              <div className='state-actions'>
                <Button asChild>
                  <Link to='/register'>Tạo tài khoản</Link>
                </Button>
              </div>
            )}
          </div>
        )}
        {!loading && !productError && (
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
                    <Badge variant='secondary'>{product.category.name}</Badge>
                    <Badge
                      variant='outline'
                      className={`status-badge status-${product.status.toLowerCase()}`}
                    >
                      {PUBLIC_PRODUCT_STATUS_LABEL[product.status]}
                    </Badge>
                  </div>
                  <h2>{product.name}</h2>
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
                      <span className='stars' aria-hidden='true'>
                        ★{product.starRating > 1 ? ` × ${product.starRating}` : ''}
                      </span>
                    </div>
                  ) : (
                    <p className='no-rating'>Chưa có kết quả</p>
                  )}
                  <Button asChild variant='secondary' className='detail-link'>
                    <Link to='/products/$id' params={{ id: product.id }}>
                      Xem hồ sơ
                    </Link>
                  </Button>
                </div>
              </article>
            ))}
          </div>
        )}
        {!productError && meta.total > 0 && (
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
