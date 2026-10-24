import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  CreateLocalityInput,
  LocalityQuery,
  LocalityRecord,
  LocalityType,
  UpdateLocalityInput,
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
import {
  localityEffectiveValue,
  vietnameseDateTimeInput,
} from '../../lib/admin-date';
import { errorText, messageOf } from '../../lib/api-error';
import { useAdminLocalities } from '../../queries/admin-catalogs';

export interface LocalitiesPanelProps {
  canManage: boolean;
  query?: LocalityQuery;
  onQueryChange?: (next: LocalityQuery) => void;
  onCreate: (input: CreateLocalityInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateLocalityInput) => Promise<unknown>;
}

interface LocalityFormDialogProps {
  open: boolean;
  locality: LocalityRecord | null;
  onOpenChange: (open: boolean) => void;
  onCreate: LocalitiesPanelProps['onCreate'];
  onUpdate: LocalitiesPanelProps['onUpdate'];
  onSaved: (message: string) => void;
}

function LocalityFormDialog({
  open,
  locality,
  onOpenChange,
  onCreate,
  onUpdate,
  onSaved,
}: LocalityFormDialogProps) {
  const isEdit = locality !== null;
  const initialCode = locality?.code ?? '';
  const initialName = locality?.name ?? '';
  const initialType: LocalityType = locality?.type ?? 'COMMUNE';
  const initialProvince = locality?.provinceName ?? '';
  const initialEffectiveFrom = vietnameseDateTimeInput(locality?.effectiveFrom);
  const initialEffectiveTo = vietnameseDateTimeInput(locality?.effectiveTo);
  const initialIsActive = locality?.isActive ?? true;

  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState(initialName);
  const [type, setType] = useState<LocalityType>(initialType);
  const [provinceName, setProvinceName] = useState(initialProvince);
  const [effectiveFromInput, setEffectiveFromInput] = useState(initialEffectiveFrom);
  const [effectiveToInput, setEffectiveToInput] = useState(initialEffectiveTo);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    open &&
    (code !== initialCode ||
      name !== initialName ||
      type !== initialType ||
      provinceName !== initialProvince ||
      effectiveFromInput !== initialEffectiveFrom ||
      effectiveToInput !== initialEffectiveTo ||
      isActive !== initialIsActive ||
      reason.trim().length > 0);

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm('Biểu mẫu địa bàn có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
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
      !window.confirm('Biểu mẫu địa bàn có thay đổi chưa lưu. Đóng hộp thoại và bỏ thay đổi?')
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
      const effectiveFrom = localityEffectiveValue(effectiveFromInput, locality?.effectiveFrom);
      const effectiveTo = localityEffectiveValue(effectiveToInput, locality?.effectiveTo);
      if (
        effectiveFrom &&
        effectiveTo &&
        Date.parse(effectiveFrom) >= Date.parse(effectiveTo)
      ) {
        throw new Error('Thời điểm Hiệu lực đến phải sau thời điểm Hiệu lực từ.');
      }

      if (isEdit) {
        await onUpdate(locality.id, {
          name,
          type,
          provinceName,
          effectiveFrom,
          effectiveTo,
          isActive,
          reason,
        });
        onSaved(`Đã cập nhật địa bàn ${name}.`);
      } else {
        await onCreate({
          code,
          name,
          type,
          provinceName,
          effectiveFrom,
          effectiveTo,
          isActive,
          reason,
        });
        onSaved(`Đã thêm địa bàn ${name} vào danh mục.`);
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
            {isEdit ? `Cập nhật địa bàn: ${locality.name}` : 'Thêm địa bàn (Xã / Phường)'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Mã địa bàn cố định: ${locality.code}. Ngày hiệu lực theo múi giờ Việt Nam (UTC+07:00).`
              : 'Nhập mã và tên chính thức đã được chủ quản đối chiếu; không tự suy từ địa chỉ nhập tay.'}
          </DialogDescription>
        </DialogHeader>
        <form className='admin-form account-form' onSubmit={(event) => void submit(event)}>
          {!isEdit && (
            <label htmlFor='locality-code'>
              Mã địa bàn (bất biến)
              <Input
                id='locality-code'
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={50}
                required
              />
            </label>
          )}
          <label htmlFor='locality-name'>
            Tên xã / phường
            <Input
              id='locality-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label htmlFor='locality-type'>
            Loại địa bàn
            <select
              id='locality-type'
              value={type}
              onChange={(event) => setType(event.target.value as LocalityType)}
            >
              <option value='COMMUNE'>Xã</option>
              <option value='WARD'>Phường</option>
            </select>
          </label>
          <label htmlFor='locality-province'>
            Tỉnh / Thành phố
            <Input
              id='locality-province'
              value={provinceName}
              onChange={(event) => setProvinceName(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label htmlFor='locality-effective-from'>
            Hiệu lực từ (giờ Việt Nam, để trống nếu không giới hạn)
            <Input
              id='locality-effective-from'
              type='datetime-local'
              step='0.001'
              value={effectiveFromInput}
              onChange={(event) => setEffectiveFromInput(event.target.value)}
            />
          </label>
          <label htmlFor='locality-effective-to'>
            Hiệu lực đến (giờ Việt Nam, để trống nếu không giới hạn)
            <Input
              id='locality-effective-to'
              type='datetime-local'
              step='0.001'
              value={effectiveToInput}
              onChange={(event) => setEffectiveToInput(event.target.value)}
            />
          </label>
          <label className='inline-flex items-center gap-2 cursor-pointer'>
            <input
              type='checkbox'
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              disabled={busy}
            />
            <span>Mở cho đăng ký mới</span>
          </label>
          <label htmlFor='locality-reason'>
            Lý do {isEdit ? 'thay đổi' : 'tạo địa bàn'}
            <Input
              id='locality-reason'
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
              {busy ? 'Đang lưu…' : isEdit ? 'Lưu địa bàn' : 'Thêm địa bàn'}
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

export function LocalitiesPanel({
  canManage,
  query: controlledQuery,
  onQueryChange,
  onCreate,
  onUpdate,
}: LocalitiesPanelProps) {
  const [fallbackQuery, setFallbackQuery] = useState<LocalityQuery>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
  });
  const appliedQuery: LocalityQuery = controlledQuery ?? fallbackQuery;

  function applyQuery(next: LocalityQuery) {
    if (onQueryChange) {
      onQueryChange(next);
    } else {
      setFallbackQuery(next);
    }
  }

  const [draftQ, setDraftQ] = useState(appliedQuery.q ?? '');
  const [draftType, setDraftType] = useState<LocalityType | undefined>(appliedQuery.type);
  const [draftIsActive, setDraftIsActive] = useState<boolean | undefined>(appliedQuery.isActive);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLocality, setEditingLocality] = useState<LocalityRecord | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setDraftQ(appliedQuery.q ?? '');
    setDraftType(appliedQuery.type);
    setDraftIsActive(appliedQuery.isActive);
  }, [appliedQuery.q, appliedQuery.type, appliedQuery.isActive]);

  const {
    data,
    error: loadError,
    isPending,
    isFetching,
    refetch,
  } = useAdminLocalities({
    page: appliedQuery.page ?? 1,
    limit: appliedQuery.limit ?? DEFAULT_PAGE_SIZE,
    q: appliedQuery.q,
    type: appliedQuery.type,
    provinceName: appliedQuery.provinceName,
    isActive: appliedQuery.isActive,
  });

  const localities = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 0;
  const currentPage = data?.meta?.page ?? appliedQuery.page ?? 1;
  const loadErrorText = errorText(loadError);

  return (
    <section className='admin-page' aria-label='Danh mục địa bàn xã phường'>
      <div className='admin-page-heading'>
        <div>
          <h2>Danh mục Xã / Phường</h2>
          <p className='route-intro'>
            {data?.meta?.total ?? localities.length} địa bàn được quản lý phục vụ hồ sơ và báo cáo.
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
          {canManage && (
            <Button
              type='button'
              onClick={() => {
                setEditingLocality(null);
                setCreateOpen(true);
              }}
            >
              Thêm địa bàn
            </Button>
          )}
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
            type: draftType,
            isActive: draftIsActive,
          });
        }}
      >
        <label htmlFor='localities-filter-q'>
          Tìm mã, tên hoặc tỉnh/thành
          <Input
            id='localities-filter-q'
            value={draftQ}
            placeholder='Nhập mã, tên xã/phường hoặc tỉnh…'
            onChange={(event) => setDraftQ(event.target.value)}
          />
        </label>
        <label htmlFor='localities-filter-type'>
          Loại địa bàn
          <select
            id='localities-filter-type'
            value={draftType ?? ''}
            onChange={(event) =>
              setDraftType(
                event.target.value ? (event.target.value as LocalityType) : undefined,
              )
            }
          >
            <option value=''>Tất cả</option>
            <option value='COMMUNE'>Xã</option>
            <option value='WARD'>Phường</option>
          </select>
        </label>
        <label htmlFor='localities-filter-active'>
          Trạng thái
          <select
            id='localities-filter-active'
            value={draftIsActive === undefined ? '' : String(draftIsActive)}
            onChange={(event) =>
              setDraftIsActive(
                event.target.value === '' ? undefined : event.target.value === 'true',
              )
            }
          >
            <option value=''>Tất cả</option>
            <option value='true'>Đang mở đăng ký</option>
            <option value='false'>Ngừng mở đăng ký</option>
          </select>
        </label>
        <div className='admin-actions items-end'>
          <Button type='submit'>Áp dụng</Button>
          {(appliedQuery.q !== undefined ||
            appliedQuery.type !== undefined ||
            appliedQuery.isActive !== undefined) && (
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
          Đang cập nhật danh mục địa bàn…
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

      {isPending && <p aria-live='polite'>Đang tải địa bàn…</p>}

      {!isPending && !loadError && localities.length === 0 && (
        <div className='admin-table-region empty-card'>
          <h3>Chưa có địa bàn phù hợp</h3>
          <p className='text-sm text-muted'>
            Nạp danh mục Xã/Phường đã đối chiếu để phục vụ chọn địa bàn khi nộp hồ sơ và báo cáo
            thống kê.
          </p>
        </div>
      )}

      {!isPending && !loadError && localities.length > 0 && (
        <div
          className='admin-table-region'
          role='region'
          aria-label='Bảng danh mục Xã Phường'
          tabIndex={0}
        >
          <table className='admin-data-table'>
            <thead>
              <tr>
                <th scope='col'>Mã địa bàn</th>
                <th scope='col'>Tên xã / phường</th>
                <th scope='col'>Loại</th>
                <th scope='col'>Tỉnh / Thành phố</th>
                <th scope='col'>Khoảng hiệu lực</th>
                <th scope='col'>Trạng thái</th>
                {canManage && (
                  <th scope='col' style={{ textAlign: 'right' }}>
                    Thao tác
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {localities.map((item) => (
                <tr key={item.id}>
                  <td className='font-mono text-xs'>{item.code}</td>
                  <th scope='row' className='font-semibold'>
                    {item.name}
                  </th>
                  <td>{item.type === 'WARD' ? 'Phường' : 'Xã'}</td>
                  <td>{item.provinceName}</td>
                  <td className='text-xs text-muted'>
                    {item.effectiveFrom
                      ? new Date(item.effectiveFrom).toLocaleString('vi-VN')
                      : 'Từ đầu'}{' '}
                    →{' '}
                    {item.effectiveTo
                      ? new Date(item.effectiveTo).toLocaleString('vi-VN')
                      : 'Hiện hành'}
                  </td>
                  <td>
                    <span className={`status-badge ${item.isActive ? 'completed' : 'draft'}`}>
                      {item.isActive ? 'Đang mở đăng ký' : 'Ngừng mở đăng ký'}
                    </span>
                  </td>
                  {canManage && (
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        type='button'
                        variant='secondary'
                        size='sm'
                        onClick={() => {
                          setCreateOpen(false);
                          setEditingLocality(item);
                        }}
                      >
                        Sửa
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className='table-footer'>
            <div className='page-info'>
              Hiển thị <strong>{localities.length}</strong> /{' '}
              <strong>{data?.meta?.total ?? localities.length}</strong> địa bàn
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
                {totalPages > 0 ? `Trang ${currentPage} / ${totalPages}` : 'Chưa có địa bàn phù hợp'}
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

      {canManage && (
        <LocalityFormDialog
          key={editingLocality?.id ?? (createOpen ? 'create-locality' : 'closed-locality')}
          open={createOpen || editingLocality !== null}
          locality={editingLocality}
          onOpenChange={(open) => {
            if (open) return;
            setCreateOpen(false);
            setEditingLocality(null);
          }}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onSaved={(msg) => setNotice(msg)}
        />
      )}
    </section>
  );
}
