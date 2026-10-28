import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type {
  CreateOrganizationUnitInput,
  OrganizationUnitQuery,
  OrganizationUnitRecord,
  UpdateOrganizationUnitInput,
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
            <FormField label='Mã đơn vị (bất biến)' htmlFor='unit-code'>
              <Input
                id='unit-code'
                value={code}
                onChange={(event) => setCode(event.target.value)}
                maxLength={50}
                required
              />
            </FormField>
          )}
          <FormField label='Tên đơn vị' htmlFor='unit-name'>
            <Input
              id='unit-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          <FormField label='Mô tả (tùy chọn)' htmlFor='unit-description'>
            <Input
              id='unit-description'
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <FormField label='Thứ tự hiển thị' htmlFor='unit-order'>
            <Input
              id='unit-order'
              type='number'
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              min={0}
              step={1}
              required
            />
          </FormField>
          <div className='inline-flex items-center gap-2'>
            <Checkbox
              id='organization-units-1'
              checked={isActive}
              onCheckedChange={(checked) => setIsActive(checked === true)}
              disabled={busy}
            />
            <Label htmlFor='organization-units-1' className='cursor-pointer'>
              Nhận tài khoản mới
            </Label>
          </div>
          <FormField label={<>Lý do {isEdit ? 'thay đổi' : 'tạo đơn vị'}</>} htmlFor='unit-reason'>
            <Input
              id='unit-reason'
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          {error && <AlertError title='Không thể lưu đơn vị' errors={[error]} />}
          <div className='admin-actions'>
            <Button type='submit' loading={busy} disabled={busy}>
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
  const currentPage = data?.meta?.page ?? appliedQuery.page ?? 1;
  const currentLimit = appliedQuery.limit ?? DEFAULT_PAGE_SIZE;
  const loadErrorText = errorText(loadError);

  const columns = useMemo<DataTableColumnDef<OrganizationUnitRecord>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Mã đơn vị',
        meta: { cellClassName: 'font-mono text-xs' },
      },
      {
        accessorKey: 'name',
        header: 'Tên đơn vị',
        meta: { isRowHeader: true },
      },
      {
        accessorKey: 'description',
        header: 'Mô tả',
        meta: { cellClassName: 'text-sm text-muted' },
        cell: ({ row }) => row.original.description ?? 'Không có mô tả.',
      },
      {
        accessorKey: 'order',
        header: 'Thứ tự',
        meta: {
          align: 'right',
          cellStyle: { fontVariantNumeric: 'tabular-nums' },
        },
      },
      {
        accessorKey: 'isActive',
        header: 'Trạng thái',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
            {row.original.isActive ? 'Đang hoạt động' : 'Ngừng nhận tài khoản mới'}
          </Badge>
        ),
      },
      {
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
              setEditingUnit(row.original);
            }}
          >
            Sửa
          </Button>
        ),
      },
    ],
    [],
  );

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
            loading={isFetching}
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
        <FormField
          label='Tìm theo mã hoặc tên đơn vị'
          htmlFor='units-filter-q'
          className='admin-filter-field'
          data-filter-width='search'
        >
          <Input
            id='units-filter-q'
            value={draftQ}
            placeholder='Nhập mã hoặc tên đơn vị…'
            onChange={(event) => setDraftQ(event.target.value)}
          />
        </FormField>
        <FormField
          label='Trạng thái'
          htmlFor='units-filter-active'
          className='admin-filter-field'
          data-filter-width='status'
        >
          <Select
            value={draftIsActive === undefined ? ALL : String(draftIsActive)}
            onValueChange={(value) =>
              setDraftIsActive(value === ALL ? undefined : value === 'true')
            }
          >
            <SelectTrigger id='units-filter-active'>
              <SelectValue placeholder='Tất cả' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả</SelectItem>
              <SelectItem value='true'>Đang hoạt động</SelectItem>
              <SelectItem value='false'>Ngừng nhận tài khoản mới</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <div className='admin-actions admin-filter-actions items-end'>
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
        <div className='space-y-2'>
          <AlertError title='Không thể tải danh sách đơn vị' errors={[loadErrorText]} />
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

      {!isPending && !loadError && units.length === 0 && (
        <Card className='admin-table-region empty-card'>
          <h3>Chưa có đơn vị phù hợp</h3>
          <p className='text-muted text-sm'>
            Tạo đơn vị hoạt động để gán cho tài khoản cán bộ và giám khảo nội bộ.
          </p>
        </Card>
      )}

      {!isPending && !loadError && units.length > 0 && (
        <div
          className='admin-table-region'
          role='region'
          aria-label='Bảng đơn vị công tác'
          tabIndex={0}
        >
          <DataTable
            columns={columns}
            data={units}
            total={data?.meta?.total ?? units.length}
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
