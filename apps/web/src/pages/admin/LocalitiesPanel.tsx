import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  CreateLocalityInput,
  LocalityQuery,
  LocalityRecord,
  LocalityType,
  UpdateLocalityInput,
} from '@ocop/shared';
import { useBlocker } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL, DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { localityEffectiveValue, vietnameseDateTimeInput } from '../../lib/admin-date';
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
      if (effectiveFrom && effectiveTo && Date.parse(effectiveFrom) >= Date.parse(effectiveTo)) {
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
            <FormField label='Mã địa bàn (bất biến)' htmlFor='locality-code'>
              <Input
                id='locality-code'
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={50}
                required
              />
            </FormField>
          )}
          <FormField label='Tên xã / phường' htmlFor='locality-name'>
            <Input
              id='locality-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          <FormField label='Loại địa bàn' htmlFor='locality-type'>
            <Select value={type} onValueChange={(val) => setType(val as LocalityType)}>
              <SelectTrigger id='locality-type'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='COMMUNE'>Xã</SelectItem>
                <SelectItem value='WARD'>Phường</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          <FormField label='Tỉnh / Thành phố' htmlFor='locality-province'>
            <Input
              id='locality-province'
              value={provinceName}
              onChange={(event) => setProvinceName(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          <FormField
            label='Hiệu lực từ (giờ Việt Nam, để trống nếu không giới hạn)'
            htmlFor='locality-effective-from'
          >
            <Input
              id='locality-effective-from'
              type='datetime-local'
              step='0.001'
              value={effectiveFromInput}
              onChange={(event) => setEffectiveFromInput(event.target.value)}
            />
          </FormField>
          <FormField
            label='Hiệu lực đến (giờ Việt Nam, để trống nếu không giới hạn)'
            htmlFor='locality-effective-to'
          >
            <Input
              id='locality-effective-to'
              type='datetime-local'
              step='0.001'
              value={effectiveToInput}
              onChange={(event) => setEffectiveToInput(event.target.value)}
            />
          </FormField>
          <div className='inline-flex items-center gap-2'>
            <Checkbox
              id='localities-1'
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
              disabled={busy}
            />
            <Label htmlFor='localities-1' className='cursor-pointer'>
              Mở cho đăng ký mới
            </Label>
          </div>
          <FormField
            label={<>Lý do {isEdit ? 'thay đổi' : 'tạo địa bàn'}</>}
            htmlFor='locality-reason'
          >
            <Input
              id='locality-reason'
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          {error && <AlertError title='Không thể lưu địa bàn' errors={[error]} />}
          <div className='admin-actions'>
            <Button type='submit' loading={busy} disabled={busy}>
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
  const currentPage = data?.meta?.page ?? appliedQuery.page ?? 1;
  const currentLimit = appliedQuery.limit ?? DEFAULT_PAGE_SIZE;
  const loadErrorText = errorText(loadError);

  const columns = useMemo<DataTableColumnDef<LocalityRecord>[]>(() => {
    const cols: DataTableColumnDef<LocalityRecord>[] = [
      {
        accessorKey: 'code',
        header: 'Mã địa bàn',
        meta: { cellClassName: 'font-mono text-xs' },
      },
      {
        accessorKey: 'name',
        header: 'Tên xã / phường',
        meta: { isRowHeader: true },
      },
      {
        accessorKey: 'type',
        header: 'Loại',
        cell: ({ row }) => (row.original.type === 'WARD' ? 'Phường' : 'Xã'),
      },
      {
        accessorKey: 'provinceName',
        header: 'Tỉnh / Thành phố',
      },
      {
        id: 'effectiveRange',
        header: 'Khoảng hiệu lực',
        meta: { cellClassName: 'text-xs text-muted' },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <>
              {item.effectiveFrom ? new Date(item.effectiveFrom).toLocaleString('vi-VN') : 'Từ đầu'}{' '}
              →{' '}
              {item.effectiveTo ? new Date(item.effectiveTo).toLocaleString('vi-VN') : 'Hiện hành'}
            </>
          );
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Đang mở đăng ký' : 'Ngừng mở đăng ký'}
          </Badge>
        ),
      },
    ];

    if (canManage) {
      cols.push({
        id: 'actions',
        header: 'Thao tác',
        meta: { align: 'right' },
        cell: ({ row }) => (
          <Button
            type='button'
            variant='secondary'
            size='sm'
            onClick={() => {
              setCreateOpen(false);
              setEditingLocality(row.original);
            }}
          >
            Sửa
          </Button>
        ),
      });
    }

    return cols;
  }, [canManage]);

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
            loading={isFetching}
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
        <FormField
          label='Tìm mã, tên hoặc tỉnh/thành'
          htmlFor='localities-filter-q'
          className='admin-filter-field'
          data-filter-width='search'
        >
          <Input
            id='localities-filter-q'
            value={draftQ}
            placeholder='Nhập mã, tên xã/phường hoặc tỉnh…'
            onChange={(event) => setDraftQ(event.target.value)}
          />
        </FormField>
        <FormField
          label='Loại địa bàn'
          htmlFor='localities-filter-type'
          className='admin-filter-field'
          data-filter-width='status'
        >
          <Select
            value={draftType ?? ALL}
            onValueChange={(value) =>
              setDraftType(value === ALL ? undefined : (value as LocalityType))
            }
          >
            <SelectTrigger id='localities-filter-type'>
              <SelectValue placeholder='Tất cả' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả</SelectItem>
              <SelectItem value='COMMUNE'>Xã</SelectItem>
              <SelectItem value='WARD'>Phường</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label='Trạng thái'
          htmlFor='localities-filter-active'
          className='admin-filter-field'
          data-filter-width='status'
        >
          <Select
            value={draftIsActive === undefined ? ALL : String(draftIsActive)}
            onValueChange={(value) =>
              setDraftIsActive(value === ALL ? undefined : value === 'true')
            }
          >
            <SelectTrigger id='localities-filter-active'>
              <SelectValue placeholder='Tất cả' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả</SelectItem>
              <SelectItem value='true'>Đang mở đăng ký</SelectItem>
              <SelectItem value='false'>Ngừng mở đăng ký</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <div className='admin-actions admin-filter-actions items-end'>
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
        <div className='space-y-2'>
          <AlertError title='Không thể tải địa bàn' errors={[loadErrorText]} />
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

      {isPending && <PageSpin />}

      {!isPending && !loadError && localities.length === 0 && (
        <Card className='admin-table-region empty-card'>
          <h3>Chưa có địa bàn phù hợp</h3>
          <p className='text-muted text-sm'>
            Nạp danh mục Xã/Phường đã đối chiếu để phục vụ chọn địa bàn khi nộp hồ sơ và báo cáo
            thống kê.
          </p>
        </Card>
      )}

      {!isPending && !loadError && localities.length > 0 && (
        <div
          className='admin-table-region'
          role='region'
          aria-label='Bảng danh mục Xã Phường'
          tabIndex={0}
        >
          <DataTable
            columns={columns}
            data={localities}
            total={data?.meta?.total ?? localities.length}
            page={currentPage}
            pageSize={currentLimit}
            getRowId={(row) => row.id}
            onPageChange={(nextPage) => applyQuery({ ...appliedQuery, page: nextPage })}
            onPageSizeChange={(nextLimit) =>
              applyQuery({ ...appliedQuery, page: 1, limit: nextLimit })
            }
          />
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
