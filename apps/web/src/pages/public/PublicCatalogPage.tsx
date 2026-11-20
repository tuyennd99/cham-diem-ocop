import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { ImageOff } from 'lucide-react';
import { ImagePreviewDialog, type ImagePreviewItem } from '@/components/image-preview-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { publicAttachmentUrl } from '../../constants/api';
import { ALL, DEFAULT_PAGE_SIZE, LIST_PAGE_SIZES } from '../../constants/consts';
import { PUBLIC_PRODUCT_STATUS_LABEL } from '../../constants/product-status';
import { usePaginatedList } from '../../hooks/use-paginated-list';
import { formatDate } from '../../lib/admin-date';
import {
  normalizePublicProductsSearch,
  parsePublicProductsSearch,
  type PublicProductsSearch,
} from '../../lib/admin-search';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { displayProductCode } from '../../lib/print-format';
import { isSeoEligibleProduct } from '../../lib/seo';
import { useCategories, usePublicProducts } from '../../queries/common';
import type { PublicProduct } from '../../types/public';

interface PublicCatalogPageProps {
  search?: PublicProductsSearch;
  onSearchChange?: (next: PublicProductsSearch) => void;
}

const DEFAULT_SEARCH: PublicProductsSearch = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
};

function formatCatalogDate(value: string | Date): string {
  return formatDate(value);
}

function buildVisiblePages(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pages = new Set<number>([1, totalPages]);
  for (let candidate = currentPage - 2; candidate <= currentPage + 2; candidate += 1) {
    if (candidate >= 1 && candidate <= totalPages) {
      pages.add(candidate);
    }
  }
  return [...pages].sort((a, b) => a - b);
}

export function PublicCatalogPage({
  search: controlledSearch,
  onSearchChange,
}: PublicCatalogPageProps = {}) {
  const session = useSession();
  const [previewGallery, setPreviewGallery] = useState<{
    items: ImagePreviewItem[];
    index: number;
    label: string;
  } | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(() => new Set());

  const { appliedSearch, applySearch, page, pageSize, setPage, setPageSize } =
    usePaginatedList<PublicProductsSearch>({
      search: controlledSearch,
      onSearchChange,
      parseSearch: parsePublicProductsSearch,
      defaultSearch: DEFAULT_SEARCH,
      defaultPageSize: DEFAULT_PAGE_SIZE,
    });

  const searchForm = useForm({
    defaultValues: {
      query: appliedSearch.q ?? '',
      categoryId: appliedSearch.categoryId ?? '',
    },
    onSubmit: async ({ value }) => {
      const nextQ = value.query.trim();
      applySearch({
        page: 1,
        limit: pageSize,
        q: nextQ || undefined,
        categoryId: value.categoryId || undefined,
      });
    },
  });

  useEffect(() => {
    searchForm.setFieldValue('query', appliedSearch.q ?? '');
    searchForm.setFieldValue('categoryId', appliedSearch.categoryId ?? '');
  }, [appliedSearch.categoryId, appliedSearch.q, searchForm]);

  const categoryRequest = useCategories();
  const productRequest = usePublicProducts<PublicProduct>({
    page,
    limit: pageSize,
    categoryId: appliedSearch.categoryId || undefined,
    q: appliedSearch.q || undefined,
    approvedOnly: true,
  });
  const categories = categoryRequest.data ?? [];
  const rows = (productRequest.data?.data ?? []).filter(isSeoEligibleProduct);
  const productError = errorText(productRequest.error);
  const categoryError = errorText(categoryRequest.error);
  const hasAppliedFilters = Boolean(appliedSearch.q || appliedSearch.categoryId);
  const meta = productRequest.data?.meta ?? {
    page,
    limit: pageSize,
    total: rows.length,
    totalPages: productRequest.data ? 1 : 0,
  };
  const loading = productRequest.isPending;

  const buildPageSearch = (targetPage: number): PublicProductsSearch =>
    normalizePublicProductsSearch(
      {
        page: Math.max(1, targetPage),
        limit: pageSize,
        q: appliedSearch.q || undefined,
        categoryId: appliedSearch.categoryId || undefined,
      },
      DEFAULT_PAGE_SIZE,
    );

  const totalPages = Math.max(1, meta.totalPages);
  const sequentialPages = buildVisiblePages(page, totalPages);

  useEffect(() => {
    if (loading) return;
    const maxPage = Math.max(1, meta.totalPages);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [loading, meta.totalPages, page, setPage]);

  const startRow = meta.total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endRow = meta.total > 0 ? Math.min(meta.total, startRow + rows.length - 1) : 0;

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
                <Combobox
                  value={field.state.value || ALL}
                  onValueChange={(value) => field.handleChange(value === ALL ? '' : value)}
                >
                  <ComboboxAnchor>
                    <ComboboxInput id='product-category' placeholder='Tất cả danh mục' />
                    <ComboboxTrigger />
                  </ComboboxAnchor>
                  <ComboboxContent>
                    <ComboboxEmpty>Không tìm thấy danh mục.</ComboboxEmpty>
                    <ComboboxItem value={ALL}>Tất cả danh mục</ComboboxItem>
                    {categories.map((item) => (
                      <ComboboxItem key={item.id} value={item.id}>
                        {item.name}
                      </ComboboxItem>
                    ))}
                  </ComboboxContent>
                </Combobox>
              </div>
            )}
          </searchForm.Field>
          <Button type='submit' disabled={loading}>
            Tìm kiếm
          </Button>
        </form>
        {/* <p className='lookup-hint'>Kết quả chỉ cập nhật sau khi bạn nhấn “Tìm kiếm”.</p> */}
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
            {Array.from({ length: 4 }, (_, index) => (
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
            {rows.map((product) => {
              const image = product.attachments[0];
              return (
                <article className='record-row' key={product.id}>
                  <div className='record-media'>
                    {image && !failedImageIds.has(image.id) ? (
                      <button
                        type='button'
                        className='block size-full cursor-zoom-in border-0 bg-transparent p-0'
                        aria-label={`Xem phóng to ảnh ${product.name}`}
                        onClick={() =>
                          setPreviewGallery({
                            items: product.attachments.map((att, idx) => ({
                              kind: 'url',
                              id: att.id,
                              name: `${product.name} — Ảnh ${idx + 1}`,
                              url: publicAttachmentUrl(product.id, att.id),
                            })),
                            index: 0,
                            label: product.name,
                          })
                        }
                      >
                        <img
                          src={publicAttachmentUrl(product.id, image.id)}
                          alt={product.name}
                          loading='lazy'
                          onError={() =>
                            setFailedImageIds((current) => new Set(current).add(image.id))
                          }
                        />
                      </button>
                    ) : (
                      <span className='empty-media' role='img' aria-label='Chưa có ảnh sản phẩm'>
                        <ImageOff aria-hidden='true' size={22} strokeWidth={1.75} />
                        <span aria-hidden='true'>Chưa có ảnh</span>
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
                    <h2>
                      <Link to='/products/$id' params={{ id: product.id }}>
                        {product.name}
                      </Link>
                    </h2>
                    <dl className='record-facts'>
                      <div>
                        <dt>Mã hồ sơ</dt>
                        <dd title={product.id}>{displayProductCode(product)}</dd>
                      </div>
                      <div>
                        <dt>Ngày tạo</dt>
                        <dd>{formatCatalogDate(product.createdAt)}</dd>
                      </div>
                    </dl>
                    <div className='record-result'>
                      {product.publicationState !== 'UNPUBLISHED' && product.starRating ? (
                        <div className='rating-block'>
                          <strong>{product.starRating} sao</strong>
                          <span className='stars' aria-hidden='true'>
                            ★{product.starRating > 1 ? ` × ${product.starRating}` : ''}
                          </span>
                        </div>
                      ) : (
                        <p className='no-rating'>Chưa có kết quả đánh giá</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {!productError && meta.total > 0 && (
          <nav
            className='pagination flex flex-wrap items-center justify-between gap-3'
            aria-label='Phân trang'
          >
            <div className='flex items-center gap-3'>
              <Combobox
                value={String(pageSize)}
                onValueChange={(v) => {
                  const nextSize = Number(v);
                  if (Number.isFinite(nextSize) && nextSize > 0) {
                    setPageSize(nextSize);
                  }
                }}
                readOnly
                className='w-32'
              >
                <ComboboxAnchor className='h-9 min-h-9 w-32'>
                  <ComboboxInput aria-label='Số hồ sơ mỗi trang' />
                  <ComboboxTrigger />
                </ComboboxAnchor>
                <ComboboxContent>
                  <ComboboxEmpty>Không tìm thấy.</ComboboxEmpty>
                  {LIST_PAGE_SIZES.map((opt) => (
                    <ComboboxItem key={opt} value={String(opt)} label={`${opt} / trang`}>
                      {opt} / trang
                    </ComboboxItem>
                  ))}
                </ComboboxContent>
              </Combobox>
              <span className='text-muted text-xs'>
                Hiển thị {startRow}–{Math.max(startRow, endRow)} / {meta.total}
              </span>
            </div>

            <div className='flex flex-wrap items-center gap-2'>
              {!loading && page > 1 ? (
                <Button asChild variant='secondary'>
                  <Link to='/products' search={buildPageSearch(page - 1)} rel='prev'>
                    Trang trước
                  </Link>
                </Button>
              ) : (
                <Button variant='secondary' disabled onClick={() => setPage(page - 1)}>
                  Trang trước
                </Button>
              )}
              {totalPages > 1 && (
                <div className='flex items-center gap-1' aria-label='Danh sách trang'>
                  {sequentialPages.map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      asChild
                      variant={pageNumber === page ? 'primary' : 'secondary'}
                      size='sm'
                    >
                      <Link
                        to='/products'
                        search={buildPageSearch(pageNumber)}
                        aria-current={pageNumber === page ? 'page' : undefined}
                      >
                        {pageNumber}
                      </Link>
                    </Button>
                  ))}
                </div>
              )}
              <span className='page-count'>
                Trang {page} / {totalPages}
              </span>
              {!loading && page < meta.totalPages ? (
                <Button asChild variant='secondary'>
                  <Link to='/products' search={buildPageSearch(page + 1)} rel='next'>
                    Trang sau
                  </Link>
                </Button>
              ) : (
                <Button variant='secondary' disabled onClick={() => setPage(page + 1)}>
                  Trang sau
                </Button>
              )}
            </div>
          </nav>
        )}
        <ImagePreviewDialog
          items={previewGallery?.items ?? []}
          activeIndex={previewGallery ? previewGallery.index : null}
          onIndexChange={(nextIndex) => {
            if (nextIndex === null) {
              setPreviewGallery(null);
            } else {
              setPreviewGallery((prev) => (prev ? { ...prev, index: nextIndex } : null));
            }
          }}
          contextLabel={previewGallery?.label}
        />
      </div>
    </main>
  );
}
