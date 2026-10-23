import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { times } from 'lodash';
import { Button } from '@/components/ui/button';
import { errorText } from '../../lib/api-error';
import { useAdminProducts } from '../../queries/admin';
import type { AdminProduct } from '../../types/admin';
import type { ApiResult } from '../../types/api';

export function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const { data: response, error: loadError, isPending: loading } = useAdminProducts(page);
  const error = errorText(loadError);
  const result: ApiResult<AdminProduct[]> = response ?? { data: [] };
  return (
    <section>
      <p className='eyebrow'>QUẢN TRỊ</p>
      <h1>Tất cả hồ sơ</h1>
      {error && (
        <p role='alert' className='form-note'>
          {error}
        </p>
      )}
      {loading && (
        <div
          className='record-list-skeleton'
          aria-busy='true'
          aria-label='Đang tải danh sách hồ sơ'
        >
          {times(5, (index) => (
            <div className='skeleton-block' key={index} />
          ))}
        </div>
      )}
      {!loading && !error && (
        <>
          <p>{result.meta?.total ?? result.data.length} hồ sơ</p>
          {result.data.length ? (
            <div className='record-list'>
              {result.data.map((product) => (
                <article className='record-row' key={product.id}>
                  <div className='record-main'>
                    <span className='badge'>{product.status}</span>
                    <h2>{product.name}</h2>
                    <p>
                      {product.category.groupName} · {product.category.name}
                    </p>
                    <p>
                      {product.registrant.fullName} · {product.registrant.email}
                    </p>
                  </div>
                  <div className='record-result'>
                    <span>
                      {product.evaluations.filter((row) => row.status === 'SUBMITTED').length} phiếu
                    </span>
                    <Link
                      className='button button-secondary'
                      to='/admin/products/$id'
                      params={{ id: product.id }}
                    >
                      Xem kết quả
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className='empty-state'>
              <h2>Chưa có hồ sơ</h2>
              <p>Hồ sơ sẽ xuất hiện sau khi chủ thể nộp đăng ký.</p>
            </div>
          )}
          <div className='hero-actions'>
            <Button
              variant='secondary'
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Trước
            </Button>
            <span>
              Trang {page} / {result.meta?.totalPages ?? 1}
            </span>
            <Button
              variant='secondary'
              disabled={page >= (result.meta?.totalPages ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              Sau
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
