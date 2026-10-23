import { useState } from 'react';
import type { AdminProductQuery, LocalityRecord } from '@ocop/shared';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorText } from '../../lib/api-error';
import { useSession } from '../../lib/auth';
import { hasStaffPermission } from '../../lib/session-contract';
import { PrivateAttachmentThumbnail } from '../../pages/registrant/AttachmentLink';
import { useAdminProductList, type AdminProductMode } from '../../queries/admin-products';
import { useLocalities } from '../../queries/common';

const initialQuery: AdminProductQuery = {
  page: 1,
  limit: 20,
  dateBasis: 'submittedAt',
  sortBy: 'submittedAt',
  sortDirection: 'desc',
};

function nextVietnameseDay(day: string) {
  const [year, month, date] = day.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return `${next.toISOString().slice(0, 10)}T00:00:00+07:00`;
}

export function AdminProductsPage({ mode = 'products' }: { mode?: AdminProductMode }) {
  const session = useSession();
  const canManage = hasStaffPermission(session?.user, 'MANAGE');
  const [query, setQuery] = useState(initialQuery);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [localitySearch, setLocalitySearch] = useState('');
  const [localityPage, setLocalityPage] = useState(1);
  const [selectedLocality, setSelectedLocality] = useState<LocalityRecord | null>(null);
  const localityQuery = useLocalities({
    page: localityPage,
    limit: 20,
    q: localitySearch || undefined,
  });
  const {
    data: response,
    error: loadError,
    isPending: loading,
  } = useAdminProductList(mode, canManage, query);
  const error = errorText(loadError);
  const data = response?.data ?? [];
  const meta = response?.meta;

  function setFilter<K extends keyof AdminProductQuery>(key: K, value: AdminProductQuery[K]) {
    setQuery((current) => ({
      ...current,
      page: 1,
      [key]: value || undefined,
      ...(key === 'localityId' && value ? { unmappedLocality: undefined } : {}),
      ...(key === 'unmappedLocality' && value ? { localityId: undefined } : {}),
    }));
  }

  function setDate(day: string, key: 'from' | 'toExclusive') {
    const next = { ...dateRange, [key === 'from' ? 'from' : 'to']: day };
    setDateRange(next);
    setQuery((current) => ({
      ...current,
      page: 1,
      from: next.from && next.to ? `${next.from}T00:00:00+07:00` : undefined,
      toExclusive: next.from && next.to ? nextVietnameseDay(next.to) : undefined,
    }));
  }

  return (
    <section className='route-panel'>
      <p className='eyebrow'>QUẢN TRỊ</p>
      <div className='section-heading'>
        <div>
          <h1>{mode === 'products' ? 'Sản phẩm' : 'Phiếu đăng ký'}</h1>
          <p>Dữ liệu và tổng số trang lấy trực tiếp từ máy chủ.</p>
        </div>
        {canManage && (
          <Link className='button button-primary' to='/admin/registrations/new'>
            Thêm phiếu đăng ký
          </Link>
        )}
      </div>
      <form className='account-form' onSubmit={(event) => event.preventDefault()}>
        <label>
          Tìm sản phẩm, mã hoặc chủ thể
          <Input
            value={query.q ?? ''}
            maxLength={100}
            onChange={(event) => setFilter('q', event.target.value)}
          />
        </label>
        <label>
          Tên hoặc email chủ thể
          <Input
            value={query.registrantQ ?? ''}
            maxLength={100}
            onChange={(event) => setFilter('registrantQ', event.target.value)}
          />
        </label>
        <label>
          Mã nhóm
          <Input
            value={query.groupId ?? ''}
            maxLength={100}
            onChange={(event) => setFilter('groupId', event.target.value)}
          />
        </label>
        <label>
          Mã danh mục
          <Input
            value={query.categoryId ?? ''}
            maxLength={100}
            onChange={(event) => setFilter('categoryId', event.target.value)}
          />
        </label>
        <label>
          Trạng thái
          <select
            value={query.status ?? ''}
            onChange={(event) =>
              setFilter('status', (event.target.value || undefined) as AdminProductQuery['status'])
            }
          >
            <option value=''>Tất cả</option>
            <option value='DRAFT'>Nháp</option>
            <option value='SUBMITTED'>Đã nộp</option>
            <option value='SCORING'>Đang chấm</option>
            <option value='COMPLETED'>Hoàn thành</option>
          </select>
        </label>
        <label>
          Lần đăng ký
          <select
            value={query.registrationType ?? ''}
            onChange={(event) =>
              setFilter(
                'registrationType',
                (event.target.value || undefined) as AdminProductQuery['registrationType'],
              )
            }
          >
            <option value=''>Tất cả</option>
            <option value='FIRST'>Lần đầu</option>
            <option value='UPGRADE'>Nâng hạng</option>
            <option value='REASSESSMENT'>Đánh giá lại</option>
          </select>
        </label>
        <label>
          Năm đánh giá
          <Input
            type='number'
            min={2020}
            max={2100}
            value={query.assessmentYear ?? ''}
            onChange={(event) =>
              setFilter(
                'assessmentYear',
                event.target.value ? Number(event.target.value) : undefined,
              )
            }
          />
        </label>
        <label>
          Địa bàn
          <Input
            value={localitySearch}
            maxLength={100}
            placeholder='Tìm xã/phường'
            onChange={(event) => {
              setLocalitySearch(event.target.value);
              setLocalityPage(1);
            }}
          />
          <select
            value={query.localityId ?? ''}
            onChange={(event) => {
              const id = event.target.value;
              const selected =
                localityQuery.data?.data.find(({ id: localityId }) => localityId === id) ?? null;
              setSelectedLocality(selected);
              setFilter('localityId', id || undefined);
            }}
          >
            <option value=''>Tất cả địa bàn</option>
            {selectedLocality &&
              !localityQuery.data?.data.some(({ id }) => id === selectedLocality.id) && (
                <option value={selectedLocality.id}>
                  {selectedLocality.name} · {selectedLocality.provinceName}
                </option>
              )}
            {localityQuery.data?.data.map((locality) => (
              <option key={locality.id} value={locality.id}>
                {locality.name} · {locality.provinceName}
              </option>
            ))}
          </select>
          <span>
            Trang địa bàn {localityPage} / {localityQuery.data?.meta?.totalPages ?? 1}
          </span>
          <Button
            type='button'
            variant='secondary'
            disabled={localityPage <= 1}
            onClick={() => setLocalityPage((page) => page - 1)}
          >
            Trước
          </Button>
          <Button
            type='button'
            variant='secondary'
            disabled={localityPage >= (localityQuery.data?.meta?.totalPages ?? 1)}
            onClick={() => setLocalityPage((page) => page + 1)}
          >
            Sau
          </Button>
        </label>
        <label className='declaration-field'>
          <input
            type='checkbox'
            checked={query.unmappedLocality ?? false}
            onChange={(event) => setFilter('unmappedLocality', event.target.checked || undefined)}
          />{' '}
          Chưa gắn địa bàn
        </label>
        <label>
          Khoảng ngày theo
          <select
            value={query.dateBasis ?? 'submittedAt'}
            onChange={(event) =>
              setFilter('dateBasis', event.target.value as AdminProductQuery['dateBasis'])
            }
          >
            <option value='submittedAt'>Ngày nộp</option>
            <option value='completedAt'>Ngày hoàn thành</option>
          </select>
        </label>
        <label>
          Từ ngày (GMT+7)
          <Input
            type='date'
            value={dateRange.from}
            onChange={(event) => setDate(event.target.value, 'from')}
          />
        </label>
        <label>
          Đến ngày, gồm cả ngày (GMT+7)
          <Input
            type='date'
            value={dateRange.to}
            onChange={(event) => setDate(event.target.value, 'toExclusive')}
          />
        </label>
        <label>
          Số sao
          <select
            value={query.starRating ?? ''}
            onChange={(event) =>
              setFilter(
                'starRating',
                (event.target.value
                  ? Number(event.target.value)
                  : undefined) as AdminProductQuery['starRating'],
              )
            }
          >
            <option value=''>Tất cả</option>
            <option value='1'>1 sao</option>
            <option value='2'>2 sao</option>
            <option value='3'>3 sao</option>
            <option value='4'>4 sao</option>
            <option value='5'>5 sao</option>
          </select>
        </label>
        <label>
          Sắp xếp
          <select
            value={query.sortBy ?? 'submittedAt'}
            onChange={(event) =>
              setFilter('sortBy', event.target.value as AdminProductQuery['sortBy'])
            }
          >
            <option value='submittedAt'>Ngày nộp</option>
            <option value='name'>Tên sản phẩm</option>
            <option value='finalScore'>Điểm</option>
          </select>
        </label>
        <label>
          Thứ tự
          <select
            value={query.sortDirection ?? 'desc'}
            onChange={(event) =>
              setFilter('sortDirection', event.target.value as AdminProductQuery['sortDirection'])
            }
          >
            <option value='desc'>Giảm dần</option>
            <option value='asc'>Tăng dần</option>
          </select>
        </label>
      </form>
      {error && (
        <p role='alert' className='form-note'>
          {error}
        </p>
      )}
      {loading && <p>Đang tải danh sách…</p>}
      {!loading && !error && (
        <>
          <p>{meta?.total ?? data.length} hồ sơ</p>
          {data.length ? (
            <div className='record-list'>
              {data.map((product) => {
                const image = product.attachments.find((file) => file.type === 'IMAGE');
                const year = product.formData.assessmentYear;
                const registrationType = product.formData.registrationType;
                return (
                  <article className='record-row' key={product.id}>
                    {image && (
                      <PrivateAttachmentThumbnail
                        mode='admin'
                        productId={product.id}
                        attachmentId={image.id}
                        name={product.name}
                      />
                    )}
                    <div className='record-main'>
                      <span className='badge'>{product.status}</span>
                      <h2>{product.name}</h2>
                      <p>
                        {product.id} · {product.category.groupName} · {product.category.name}
                      </p>
                      <p>
                        {product.registrant.fullName} · {product.registrant.email}
                      </p>
                      <p>
                        {product.locality?.name ?? 'Chưa gắn địa bàn'}
                        {product.locality ? ` · ${product.locality.provinceName}` : ''} · Năm{' '}
                        {year ?? '—'} · {registrationType ?? 'Chưa khai báo'}
                      </p>
                      <p>
                        {product.submittedAt
                          ? `Đã nộp ${new Date(product.submittedAt).toLocaleString('vi-VN')}`
                          : 'Chưa nộp'}
                      </p>
                    </div>
                    <div className='record-result'>
                      {product.status === 'COMPLETED' && (
                        <strong>
                          {product.finalScore ?? '—'} điểm · {product.starRating ?? '—'} sao
                        </strong>
                      )}
                      <Link
                        className='button button-secondary'
                        to={
                          mode === 'products' ? '/admin/products/$id' : '/admin/registrations/$id'
                        }
                        params={{ id: product.id }}
                      >
                        Mở hồ sơ
                      </Link>
                      {canManage && product.status === 'DRAFT' && (
                        <Link
                          className='text-link'
                          to='/admin/registrations/$id/edit'
                          params={{ id: product.id }}
                        >
                          Sửa phiếu đăng ký
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className='empty-state'>
              <h2>Chưa có hồ sơ</h2>
              <p>Không có hồ sơ phù hợp với bộ lọc hiện tại.</p>
            </div>
          )}
          <div className='hero-actions'>
            <Button
              variant='secondary'
              disabled={(query.page ?? 1) <= 1}
              onClick={() => setFilter('page', (query.page ?? 1) - 1)}
            >
              Trước
            </Button>
            <span>
              Trang {meta?.page ?? query.page ?? 1} / {meta?.totalPages ?? 1}
            </span>
            <Button
              variant='secondary'
              disabled={(query.page ?? 1) >= (meta?.totalPages ?? 1)}
              onClick={() => setQuery((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}
            >
              Sau
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
