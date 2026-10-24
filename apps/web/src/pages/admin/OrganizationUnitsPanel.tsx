import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  CreateOrganizationUnitInput,
  OrganizationUnitQuery,
  OrganizationUnitRecord,
  UpdateOrganizationUnitInput,
} from '@ocop/shared';
import { useBlocker } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { errorText, messageOf } from '../../lib/api-error';
import { useOrganizationUnits } from '../../queries/admin-users';

export interface OrganizationUnitsPanelProps {
  query?: OrganizationUnitQuery;
  onQueryChange?: (next: OrganizationUnitQuery) => void;
  onCreate: (input: CreateOrganizationUnitInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateOrganizationUnitInput) => Promise<unknown>;
}

interface UnitFormDialogProps {
  open: boolean;
  unit: OrganizationUnitRecord | null;
  defaultOrder: number;
  onOpenChange: (open: boolean) => void;
  onCreate: OrganizationUnitsPanelProps['onCreate'];
  onUpdate: OrganizationUnitsPanelProps['onUpdate'];
  onSaved: (message: string) => void;
}

function UnitFormDialog({
  open,
  unit,
  defaultOrder,
  onOpenChange,
  onCreate,
  onUpdate,
  onSaved,
}: UnitFormDialogProps) {
  const isEdit = unit !== null;
  const initialCode = unit?.code ?? '';
  const initialName = unit?.name ?? '';
  const initialDescription = unit?.description ?? '';
  const initialOrder = String(unit?.order ?? defaultOrder);
  const initialIsActive = unit?.isActive ?? true;

  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [order, setOrder] = useState(initialOrder);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    open &&
    (code !== initialCode ||
      name !== initialName ||
      description !== initialDescription ||
      order !== initialOrder ||
      isActive !== initialIsActive ||
      reason.trim().length > 0);

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm('Biểu mẫu đơn vị có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
    enableBeforeUnload: () => dirty,
  });

  function requestOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }
    if (busy) return;
    if (
      dirty &&
      !window.confirm('Biểu mẫu đơn vị có thay đổi chưa lưu. Đóng hộp thoại và bỏ thay đổi?')
    ) {
      return;
    }
    onOpenChange(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await onUpdate(unit.id, {
          name,
          description: description.trim() || null,
          order: Number(order),
          isActive,
          reason,
        });
        onSaved(`Đã cập nhật đơn vị ${name}.`);
      } else {
        await onCreate({
          code,
          name,
          description: description.trim() || null,
          order: Number(order),
          isActive,
          reason,
        });
        onSaved(`Đã tạo đơn vị ${name}.`);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent className='admin-dialog' data-admin-ui='true'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Cập nhật đơn vị: ${unit.name}` : 'Tạo đơn vị quản lý'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Mã đơn vị cố định: ${unit.code}. Đơn vị ngừng nhận tài khoản mới vẫn hiển thị trên các tài khoản đã gán.`
              : 'Nhập mã và tên đơn vị công tác của cán bộ/giám khảo.'}
          </DialogDescription>
        </DialogHeader>
        <form className='admin-form account-form' onSubmit={(event) => void submit(event)}>
          {!isEdit && (
            <label htmlFor='unit-code'>
              Mã đơn vị (bất biến)
              <Input
                id='unit-code'
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={50}
                required
              />
            </label>
          )}
          <label htmlFor='unit-name'>
            Tên đơn vị
            <Input
              id='unit-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label htmlFor='unit-description'>
            Mô tả (tùy chọn)
            <Input
              id='unit-description'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label htmlFor='unit-order'>
            Thứ tự hiển thị
            <Input
              id='unit-order'
              type='number'
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              min={0}
              step={1}
              required
            />
          </label>
          <label className='inline-flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={busy}
            />
            <span>Nhận tài khoản mới</span>
          </label>
          <label htmlFor='unit-reason'>
            Lý do {isEdit ? 'thay đổi' : 'tạo đơn vị'}
            <Input
              id='unit-reason'
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
          <div className='admin-actions'>
            <Button type='submit' disabled={busy}>
              {busy ? 'Đang lưu…' : isEdit ? 'Lưu đơn vị' : 'Tạo đơn vị'}
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={busy}
              onClick={() => requestOpenChange(false)}
            >
              Đóng
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrganizationUnitsPanel({
  query: controlledQuery,
  onQueryChange,
  onCreate,
  onUpdate,
}: OrganizationUnitsPanelProps) {
  const [fallbackQuery, setFallbackQuery] = useState<OrganizationUnitQuery>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const appliedQuery = controlledQuery ?? fallbackQuery;

  function applyQuery(next: OrganizationUnitQuery) {
    if (onQueryChange) {
      onQueryChange(next);
    } else {
      setFallbackQuery(next);
    }
  }

  const [draftQ, setDraftQ] = useState(appliedQuery.q ?? '');
  const [draftIsActive, setDraftIsActive] = useState<boolean | undefined>(appliedQuery.isActive);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<OrganizationUnitRecord | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setDraftQ(appliedQuery.q ?? '');
    setDraftIsActive(appliedQuery.isActive);
  }, [appliedQuery.q, appliedQuery.isActive]);

  const {
    data,
    error: loadError,
    isPending,
    isFetching,
    refetch,
  } = useOrganizationUnits({
    page: appliedQuery.page ?? 1,
    limit: appliedQuery.limit ?? DEFAULT_PAGE_SIZE,
    q: appliedQuery.q,
    isActive: appliedQuery.isActive,
  });

  const units = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 0;
  const currentPage = data?.meta?.page ?? appliedQuery.page ?? 1;
  const loadErrorText = errorText(loadError);

  return (
    <section className='admin-page' aria-label='Quản lý đơn vị'>
      <div className='admin-page-heading'>
        <div>
          <h2>Đơn vị công tác</h2>
          <p className='route-intro'>
            {data?.meta?.total ?? units.length} đơn vị công tác dành cho tài khoản nội bộ.
          </p>
        </div>
        <div className='admin-actions'>
          <Button
            type='button'
            variant='secondary'
            disabled={isPending}
            onClick={() => void refetch()}
          >
            Tải lại
          </Button>
          <Button
            type='button'
            onClick={() => {
              setEditingUnit(null);
              setCreateOpen(true);
            }}
          >
            Tạo đơn vị
          </Button>
        </div>
      </div>

      {notice && (
        <p className='form-message' role='status'>
          {notice}
        </p>
      )}

      <form
        className='admin-filters'
        onSubmit={(event) => {
          event.preventDefault();
          applyQuery({
            ...appliedQuery,
            page: 1,
            q: draftQ.trim() || undefined,
            isActive: draftIsActive,
          });
        }}
      >
        <label htmlFor='units-filter-q'>
          Tìm theo mã hoặc tên đơn vị
          <Input
            id='units-filter-q'
            value={draftQ}
            placeholder='Nhập mã hoặc tên đơn vị…'
            onChange={(event) => setDraftQ(event.target.value)}
          />
        </label>
        <label htmlFor='units-filter-active'>
          Trạng thái
          <select
            id='units-filter-active'
            value={draftIsActive === undefined ? '' : String(draftIsActive)}
            onChange={(event) =>
              setDraftIsActive(
                event.target.value === '' ? undefined : event.target.value === 'true',
              )
            }
          >
            <option value=''>Tất cả</option>
            <option value='true'>Đang hoạt động</option>
            <option value='false'>Ngừng nhận tài khoản mới</option>
          </select>
        </label>
        <div className='admin-actions items-end'>
          <Button type='submit'>Áp dụng</Button>
          {(appliedQuery.q !== undefined || appliedQuery.isActive !== undefined) && (
            <Button
              type='button'
              variant='secondary'
              onClick={() =>
                applyQuery({ page: 1, limit: appliedQuery.limit ?? DEFAULT_PAGE_SIZE })
              }
            >
              Xóa bộ lọc
            </Button>
          )}
        </div>
      </form>

      {isFetching && !isPending && (
        <p className='form-note' role='status'>
          Đang cập nhật danh sách đơn vị…
        </p>
      )}

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
        <div className='admin-table-region empty-card'>
          <h3>Chưa có đơn vị phù hợp</h3>
          <p className='text-sm text-muted'>
            Tạo đơn vị hoạt động để gán cho tài khoản cán bộ và giám khảo nội bộ.
          </p>
        </div>
      )}

      {!isPending && !loadError && units.length > 0 && (
        <div
          className='admin-table-region'
          role='region'
          aria-label='Bảng đơn vị công tác'
          tabIndex={0}
        >
          <table className='admin-data-table'>
            <thead>
              <tr>
                <th scope='col'>Mã đơn vị</th>
                <th scope='col'>Tên đơn vị</th>
                <th scope='col'>Mô tả</th>
                <th scope='col' style={{ textAlign: 'right' }}>
                  Thứ tự
                </th>
                <th scope='col'>Trạng thái</th>
                <th scope='col' style={{ textAlign: 'right' }}>
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id}>
                  <td className='font-mono text-xs'>{unit.code}</td>
                  <th scope='row' className='font-semibold'>
                    {unit.name}
                  </th>
                  <td className='text-sm text-muted'>{unit.description ?? 'Không có mô tả.'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {unit.order}
                  </td>
                  <td>
                    <span className={`status-badge ${unit.isActive ? 'completed' : 'draft'}`}>
                      {unit.isActive ? 'Đang hoạt động' : 'Ngừng nhận tài khoản mới'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      type='button'
                      variant='secondary'
                      size='sm'
                      onClick={() => {
                        setCreateOpen(false);
                        setEditingUnit(unit);
                      }}
                    >
                      Sửa
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className='table-footer'>
            <div className='page-info'>
              Hiển thị <strong>{units.length}</strong> /{' '}
              <strong>{data?.meta?.total ?? units.length}</strong> đơn vị
            </div>
            <div className='pagination-actions'>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={currentPage <= 1}
                onClick={() => applyQuery({ ...appliedQuery, page: currentPage - 1 })}
              >
                Trước
              </Button>
              <span className='text-xs font-semibold px-2'>
                {totalPages > 0 ? `Trang ${currentPage} / ${totalPages}` : 'Chưa có đơn vị phù hợp'}
              </span>
              <Button
                type='button'
                variant='secondary'
                size='sm'
                disabled={totalPages === 0 || currentPage >= totalPages}
                onClick={() => applyQuery({ ...appliedQuery, page: currentPage + 1 })}
              >
                Sau
              </Button>
            </div>
          </div>
        </div>
      )}

      <UnitFormDialog
        key={editingUnit?.id ?? (createOpen ? 'create-unit' : 'closed-unit')}
        open={createOpen || editingUnit !== null}
        unit={editingUnit}
        defaultOrder={units.length + 1}
        onOpenChange={(open) => {
          if (open) return;
          setCreateOpen(false);
          setEditingUnit(null);
        }}
        onCreate={onCreate}
        onUpdate={onUpdate}
        onSaved={(msg) => setNotice(msg)}
      />
    </section>
  );
}
