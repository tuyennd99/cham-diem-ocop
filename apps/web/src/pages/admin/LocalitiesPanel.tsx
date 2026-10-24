import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  CreateLocalityInput,
  LocalityRecord,
  LocalityType,
  UpdateLocalityInput,
} from '@ocop/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { errorText, messageOf } from '../../lib/api-error';
import { useAdminLocalities } from '../../queries/admin-catalogs';

interface LocalitiesPanelProps {
  canManage: boolean;
  onCreate: (input: CreateLocalityInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateLocalityInput) => Promise<unknown>;
}

function LocalityEditor({
  locality,
  canManage,
  onUpdate,
}: {
  locality: LocalityRecord;
  canManage: boolean;
  onUpdate: LocalitiesPanelProps['onUpdate'];
}) {
  const [name, setName] = useState(locality.name);
  const [type, setType] = useState<LocalityType>(locality.type);
  const [provinceName, setProvinceName] = useState(locality.provinceName);
  const [effectiveFrom, setEffectiveFrom] = useState(locality.effectiveFrom ?? '');
  const [effectiveTo, setEffectiveTo] = useState(locality.effectiveTo ?? '');
  const [isActive, setIsActive] = useState(locality.isActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!canManage) {
    return (
      <article className='record-row'>
        <div className='record-main'>
          <h3>
            {locality.name} <small>· {locality.code}</small>
          </h3>
          <p>
            {locality.type === 'WARD' ? 'Phường' : 'Xã'} · {locality.provinceName}
          </p>
          <p>
            Hiệu lực: {locality.effectiveFrom ?? 'Từ đầu'} →{' '}
            {locality.effectiveTo ?? 'Hiện hành'}
          </p>
        </div>
        <span className='badge'>{locality.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}</span>
      </article>
    );
  }

  return (
    <form
      className='route-panel account-form'
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        void onUpdate(locality.id, {
          name,
          type,
          provinceName,
          effectiveFrom: effectiveFrom.trim() || null,
          effectiveTo: effectiveTo.trim() || null,
          isActive,
          reason,
        })
          .then(
            () => setReason(''),
            (cause: unknown) => setError(messageOf(cause)),
          )
          .finally(() => setBusy(false));
      }}
    >
      <h3>
        {locality.name}{' '}
        <small>
          · {locality.code} · {locality.isActive ? 'Đang sử dụng' : 'Ngừng sử dụng'}
        </small>
      </h3>
      <label>
        Tên xã/phường
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
          required
        />
      </label>
      <label>
        Loại địa bàn
        <select
          value={type}
          onChange={(event) => setType(event.target.value as LocalityType)}
        >
          <option value='COMMUNE'>Xã</option>
          <option value='WARD'>Phường</option>
        </select>
      </label>
      <label>
        Tỉnh / Thành phố
        <Input
          value={provinceName}
          onChange={(event) => setProvinceName(event.target.value)}
          maxLength={255}
          required
        />
      </label>
      <label>
        Hiệu lực từ (ISO 8601 có offset, để trống nếu không giới hạn)
        <Input
          value={effectiveFrom}
          placeholder='2026-01-01T00:00:00+07:00'
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
      </label>
      <label>
        Hiệu lực đến (ISO 8601 có offset, để trống nếu không giới hạn)
        <Input
          value={effectiveTo}
          placeholder='2027-01-01T00:00:00+07:00'
          onChange={(event) => setEffectiveTo(event.target.value)}
        />
      </label>
      <label>
        <input
          type='checkbox'
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          disabled={busy}
        />{' '}
        Mở cho đăng ký mới
      </label>
      <label>
        Lý do thay đổi
        <Input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={255}
          required
        />
      </label>
      {error && (
        <p className='form-note' role='alert'>
          {error}
        </p>
      )}
      <Button type='submit' variant='secondary' disabled={busy}>
        {busy ? 'Đang lưu…' : 'Lưu địa bàn'}
      </Button>
    </form>
  );
}

export function LocalitiesPanel({ canManage, onCreate, onUpdate }: LocalitiesPanelProps) {
  const [page, setPage] = useState(1);
  const [queryText, setQueryText] = useState('');
  const [q, setQ] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<LocalityType | undefined>();
  const [isActiveFilter, setIsActiveFilter] = useState<boolean | undefined>();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<LocalityType>('COMMUNE');
  const [provinceName, setProvinceName] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [newIsActive, setNewIsActive] = useState(true);
  const [reason, setReason] = useState('');
  const [createError, setCreateError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, error: loadError, isPending, refetch } = useAdminLocalities({
    page,
    limit: DEFAULT_PAGE_SIZE,
    q,
    type: typeFilter,
    isActive: isActiveFilter,
  });

  const localities = data?.data ?? [];
  const pageCount = data?.meta?.totalPages ?? 1;
  const loadErrorText = errorText(loadError);

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setCreateError('');
    setNotice('');
    try {
      await onCreate({
        code,
        name,
        type,
        provinceName,
        effectiveFrom: effectiveFrom.trim() || null,
        effectiveTo: effectiveTo.trim() || null,
        isActive: newIsActive,
        reason,
      });
      setCode('');
      setName('');
      setProvinceName('');
      setEffectiveFrom('');
      setEffectiveTo('');
      setNewIsActive(true);
      setReason('');
      setNotice('Đã thêm địa bàn vào danh mục.');
      setPage(1);
    } catch (cause) {
      setCreateError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className='admin-units-panel' aria-label='Danh mục địa bàn xã phường'>
      {canManage && (
        <section className='route-panel'>
          <h2>Thêm địa bàn (Xã / Phường)</h2>
          <p className='form-note'>
            Nhập mã và tên chính thức đã được chủ quản đối chiếu; không tự suy từ địa chỉ nhập tay.
          </p>
          <form className='account-form' onSubmit={(event) => void submitCreate(event)}>
            <label>
              Mã địa bàn
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={50}
                required
              />
            </label>
            <label>
              Tên xã / phường
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={255}
                required
              />
            </label>
            <label>
              Loại địa bàn
              <select
                value={type}
                onChange={(event) => setType(event.target.value as LocalityType)}
              >
                <option value='COMMUNE'>Xã</option>
                <option value='WARD'>Phường</option>
              </select>
            </label>
            <label>
              Tỉnh / Thành phố
              <Input
                value={provinceName}
                onChange={(event) => setProvinceName(event.target.value)}
                maxLength={255}
                required
              />
            </label>
            <label>
              Hiệu lực từ (tùy chọn, ISO 8601 có offset)
              <Input
                value={effectiveFrom}
                placeholder='2026-01-01T00:00:00+07:00'
                onChange={(event) => setEffectiveFrom(event.target.value)}
              />
            </label>
            <label>
              Hiệu lực đến (tùy chọn, ISO 8601 có offset)
              <Input
                value={effectiveTo}
                placeholder='2027-01-01T00:00:00+07:00'
                onChange={(event) => setEffectiveTo(event.target.value)}
              />
            </label>
            <label>
              <input
                type='checkbox'
                checked={newIsActive}
                onChange={(event) => setNewIsActive(event.target.checked)}
                disabled={busy}
              />{' '}
              Mở cho đăng ký mới
            </label>
            <label>
              Lý do tạo địa bàn
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={255}
                required
              />
            </label>
            {createError && (
              <p className='form-note' role='alert'>
                {createError}
              </p>
            )}
            {notice && <p role='status'>{notice}</p>}
            <Button type='submit' disabled={busy}>
              {busy ? 'Đang tạo…' : 'Thêm địa bàn'}
            </Button>
          </form>
        </section>
      )}

      <section>
        <div className='section-heading'>
          <div>
            <h2>Danh mục Xã / Phường</h2>
            <p>{data?.meta?.total ?? localities.length} địa bàn</p>
          </div>
          <Button
            type='button'
            variant='secondary'
            disabled={isPending}
            onClick={() => void refetch()}
          >
            Tải lại
          </Button>
        </div>

        <form
          className='hero-actions'
          onSubmit={(event) => {
            event.preventDefault();
            setQ(queryText.trim() || undefined);
            setPage(1);
          }}
        >
          <label>
            Tìm mã, tên hoặc tỉnh/thành
            <Input value={queryText} onChange={(event) => setQueryText(event.target.value)} />
          </label>
          <label>
            Loại
            <select
              value={typeFilter ?? ''}
              onChange={(event) => {
                setTypeFilter(
                  event.target.value ? (event.target.value as LocalityType) : undefined,
                );
                setPage(1);
              }}
            >
              <option value=''>Tất cả</option>
              <option value='COMMUNE'>Xã</option>
              <option value='WARD'>Phường</option>
            </select>
          </label>
          <label>
            Trạng thái
            <select
              value={isActiveFilter === undefined ? '' : String(isActiveFilter)}
              onChange={(event) => {
                setIsActiveFilter(
                  event.target.value === '' ? undefined : event.target.value === 'true',
                );
                setPage(1);
              }}
            >
              <option value=''>Tất cả</option>
              <option value='true'>Đang sử dụng</option>
              <option value='false'>Ngừng sử dụng</option>
            </select>
          </label>
          <Button type='submit' variant='secondary'>
            Tìm kiếm
          </Button>
        </form>

        {loadErrorText && (
          <div className='form-note' role='alert'>
            <p>{loadErrorText}</p>
            <Button
              type='button'
              variant='secondary'
              disabled={isPending}
              onClick={() => void refetch()}
            >
              Thử lại
            </Button>
          </div>
        )}
        {isPending && <p aria-live='polite'>Đang tải địa bàn…</p>}
        {!isPending && !loadError && localities.length === 0 && (
          <div className='empty-state'>
            <h3>Chưa có danh mục địa bàn</h3>
            <p>
              Nạp danh mục Xã/Phường đã đối chiếu để phục vụ chọn địa bàn khi nộp hồ sơ và báo cáo
              thống kê.
            </p>
          </div>
        )}
        {!isPending && !loadError && localities.length > 0 && (
          <div className='record-list'>
            {localities.map((item) => (
              <LocalityEditor
                key={item.id}
                locality={item}
                canManage={canManage}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
        <div className='hero-actions'>
          <Button
            type='button'
            variant='secondary'
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Trước
          </Button>
          <span>
            Trang {page} / {pageCount}
          </span>
          <Button
            type='button'
            variant='secondary'
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            Sau
          </Button>
        </div>
      </section>
    </section>
  );
}
