import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  CreateOrganizationUnitInput,
  OrganizationUnitRecord,
  UpdateOrganizationUnitInput,
} from '@ocop/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { errorText, messageOf } from '../../lib/api-error';
import { useOrganizationUnits } from '../../queries/admin-users';

interface OrganizationUnitsPanelProps {
  onCreate: (input: CreateOrganizationUnitInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateOrganizationUnitInput) => Promise<unknown>;
}

function UnitEditor({
  unit,
  onUpdate,
}: {
  unit: OrganizationUnitRecord;
  onUpdate: OrganizationUnitsPanelProps['onUpdate'];
}) {
  const [name, setName] = useState(unit.name);
  const [description, setDescription] = useState(unit.description ?? '');
  const [order, setOrder] = useState(String(unit.order));
  const [isActive, setIsActive] = useState(unit.isActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className='route-panel account-form'
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        void onUpdate(unit.id, {
          name,
          description: description || null,
          order: Number(order),
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
        {unit.name}{' '}
        <small>
          · {unit.code} · {unit.isActive ? 'Đang hoạt động' : 'Ngừng nhận tài khoản mới'}
        </small>
      </h3>
      <label>
        Tên đơn vị
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={255}
          required
        />
      </label>
      <label>
        Mô tả
        <Input value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <label>
        Thứ tự
        <Input
          type='number'
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          min={0}
          step={1}
          required
        />
      </label>
      <label>
        <input
          type='checkbox'
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
          disabled={busy}
        />{' '}
        Nhận tài khoản mới
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
        {busy ? 'Đang lưu…' : 'Lưu đơn vị'}
      </Button>
    </form>
  );
}

export function OrganizationUnitsPanel({ onCreate, onUpdate }: OrganizationUnitsPanelProps) {
  const [page, setPage] = useState(1);
  const [queryText, setQueryText] = useState('');
  const [q, setQ] = useState<string | undefined>();
  const [isActive, setIsActive] = useState<boolean | undefined>();
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [order, setOrder] = useState('0');
  const [newIsActive, setNewIsActive] = useState(true);
  const [reason, setReason] = useState('');
  const [createError, setCreateError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    data,
    error: loadError,
    isPending,
    refetch,
  } = useOrganizationUnits({
    page,
    limit: DEFAULT_PAGE_SIZE,
    q,
    isActive,
  });
  const units = data?.data ?? [];

  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setCreateError('');
    setNotice('');
    try {
      const input: CreateOrganizationUnitInput = {
        code,
        name,
        description: description || null,
        order: Number(order),
        isActive: newIsActive,
        reason,
      };
      await onCreate(input);
      setCode('');
      setName('');
      setDescription('');
      setOrder('0');
      setNewIsActive(true);
      setReason('');
      setNotice('Đã tạo đơn vị.');
      setPage(1);
    } catch (cause) {
      setCreateError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  const loadErrorText = errorText(loadError);
  const pageCount = data?.meta?.totalPages ?? 1;

  return (
    <section className='admin-units-panel' aria-label='Quản lý đơn vị'>
      <section className='route-panel'>
        <h2>Tạo đơn vị</h2>
        <form className='account-form' onSubmit={(event) => void createUnit(event)}>
          <label>
            Mã đơn vị
            <Input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              maxLength={50}
              required
            />
          </label>
          <label>
            Tên đơn vị
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label>
            Mô tả
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label>
            Thứ tự
            <Input
              type='number'
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              min={0}
              step={1}
              required
            />
          </label>
          <label>
            <input
              type='checkbox'
              checked={newIsActive}
              onChange={(event) => setNewIsActive(event.target.checked)}
              disabled={busy}
            />{' '}
            Nhận tài khoản mới
          </label>
          <label>
            Lý do tạo đơn vị
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
            {busy ? 'Đang tạo…' : 'Tạo đơn vị'}
          </Button>
        </form>
      </section>

      <section>
        <div className='section-heading'>
          <div>
            <h2>Đơn vị</h2>
            <p>{data?.meta?.total ?? units.length} đơn vị</p>
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
            Tìm theo mã hoặc tên
            <Input value={queryText} onChange={(event) => setQueryText(event.target.value)} />
          </label>
          <label>
            Trạng thái
            <select
              value={isActive === undefined ? '' : String(isActive)}
              onChange={(event) => {
                setIsActive(event.target.value === '' ? undefined : event.target.value === 'true');
                setPage(1);
              }}
            >
              <option value=''>Tất cả</option>
              <option value='true'>Đang hoạt động</option>
              <option value='false'>Đã ngừng</option>
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
        {isPending && <p aria-live='polite'>Đang tải đơn vị…</p>}
        {!isPending && !loadError && units.length === 0 && (
          <div className='empty-state'>
            <h3>Chưa có đơn vị phù hợp</h3>
          </div>
        )}
        {!isPending && !loadError && (
          <div className='record-list'>
            {units.map((unit) => (
              <UnitEditor key={unit.id} unit={unit} onUpdate={onUpdate} />
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
