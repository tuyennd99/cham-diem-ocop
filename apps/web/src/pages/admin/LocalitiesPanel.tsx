import { useEffect, useMemo, useState } from 'react';
import type {
  CreateLocalityInput,
  LocalityQuery,
  LocalityRecord,
  UpdateLocalityInput,
} from '@ocop/shared';
import { useBlocker } from '@tanstack/react-router';
import {  useSelector } from '@tanstack/react-form';
import { format } from 'date-fns';
import AlertError from '@/components/alert-error';
import { AppForm, useAppForm } from '@/components/form';
import type { FormDateRangeValue } from '@/components/form/field-values';
import { FormField } from '@/components/form-field';
import PageSpin from '@/components/page-spin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ALL, DEFAULT_PAGE_SIZE } from '../../constants/consts';
import { HTTP_STATUS } from '../../constants/http-status';
import {
  nextVietnameseDayIso,
  vietnameseDateInput,
  vietnameseDayStartIso,
  vietnameseInclusiveEndInput,
} from '../../lib/admin-date';
import {
  ADMINISTRATIVE_PROVINCES,
  useWardsByProvince,
} from '../../lib/administrative-divisions';
import { ApiError, errorText, messageOf } from '../../lib/api-error';
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

type LocalityFormValues = {
  code: string;
  name: string;
  provinceName: string;
  dateRange: FormDateRangeValue;
};

function LocalityFormDialog({
  open,
  locality,
  onOpenChange,
  onCreate,
  onUpdate,
  onSaved,
}: LocalityFormDialogProps) {
  const isEdit = locality !== null;
  const todayYmd = format(new Date(), 'yyyy-MM-dd');
  const defaultValues: LocalityFormValues = {
    code: locality?.code ?? '',
    name: locality?.name ?? '',
    provinceName: locality?.provinceName ?? '',
    dateRange: {
      fromDay: locality?.effectiveFrom ? vietnameseDateInput(locality.effectiveFrom) : todayYmd,
      toDay: locality?.effectiveTo ? vietnameseInclusiveEndInput(locality.effectiveTo) : '',
    },
  };
  const [error, setError] = useState('');

  const form = useAppForm({
    defaultValues,
    onSubmit: async ({ value, formApi }) => {
      setError('');
      try {
        const effectiveFrom = value.dateRange.fromDay
          ? vietnameseDayStartIso(value.dateRange.fromDay)
          : null;
        const effectiveTo = value.dateRange.toDay
          ? nextVietnameseDayIso(value.dateRange.toDay)
          : null;
        if (effectiveFrom && effectiveTo && Date.parse(effectiveFrom) >= Date.parse(effectiveTo)) {
          throw new Error('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
        }
        const common = {
          name: value.name,
          provinceName: value.provinceName,
          effectiveFrom,
          effectiveTo,
          isActive: true,
        };
        if (locality) {
          await onUpdate(locality.id, {
            ...common,
            reason: `Cập nhật địa bàn ${value.name} (${value.provinceName})`,
          });
          onSaved(`Đã cập nhật địa bàn ${value.name}.`);
        } else {
          await onCreate({
            ...common,
            code: value.code.trim(),
            reason: `Thêm địa bàn ${value.name} (${value.provinceName})`,
          });
          onSaved(`Đã thêm địa bàn ${value.name} vào danh mục.`);
        }
        onOpenChange(false);
      } catch (cause) {
        if (!locality && cause instanceof ApiError && cause.status === HTTP_STATUS.CONFLICT) {
          formApi.setFieldMeta('code', (prev) => ({
            ...prev,
            errorMap: {
              ...prev.errorMap,
              onSubmit: 'Mã địa bàn đã tồn tại. Vui lòng nhập mã khác.',
            },
          }));
        } else {
          setError(messageOf(cause));
        }
      }
    },
  });
  const provinceName = useSelector(form.store, (state) => state.values.provinceName);
  const wardsInSelectedProvince = useWardsByProvince(provinceName);
  const isDefaultValue = useSelector(form.store, (state) => state.isDefaultValue);
  const busy = useSelector(form.store, (state) => state.isSubmitting);
  const dirty = open && !isDefaultValue;

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

  return (
    <Dialog open={open} onOpenChange={requestOpenChange}>
      <DialogContent
        className='admin-dialog'
        data-admin-ui='true'
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Cập nhật địa bàn: ${locality.name}` : 'Thêm địa bàn'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Mã địa bàn cố định: ${locality.code}. Chọn Tỉnh / Thành phố, Xã / Phường và khoảng thời gian mở đăng ký.`
              : 'Nhập mã địa bàn, chọn Tỉnh / Thành phố, Xã / Phường và khoảng thời gian mở đăng ký.'}
          </DialogDescription>
        </DialogHeader>
        <AppForm form={form} className='admin-form account-form' error={error} errorTitle='Không thể lưu địa bàn'>
          <form.AppField name='code' validators={{
            onChange: ({ value }) => !value.trim() ? 'Vui lòng nhập mã địa bàn.' : undefined,
          }}>
            {(field) => <field.Input id='locality-code' label={isEdit ? 'Mã địa bàn (bất biến)' : 'Mã địa bàn'}
              placeholder='Nhập mã địa bàn' maxLength={50} required disabled={isEdit} />}
          </form.AppField>
          <form.AppField name='provinceName' validators={{
            onChange: ({ value }) => !value.trim() ? 'Vui lòng chọn tỉnh / thành phố.' : undefined,
          }}>
            {(field) => <field.Combobox id='locality-province' label='Tỉnh / thành phố' required
              options={ADMINISTRATIVE_PROVINCES.map((item) => ({ value: item.name_with_type, label: item.name_with_type }))}
              allowClear preserveUnknownValue placeholder='Chọn tỉnh / thành phố trước'
              onValueChange={() => form.setFieldValue('name', '')} />}
          </form.AppField>
          <form.AppField name='name' validators={{
            onChange: ({ value }) => !value.trim() ? 'Vui lòng chọn xã / phường.' : undefined,
          }}>
            {(field) => <field.Combobox id='locality-name' label='Xã / phường' required
              options={wardsInSelectedProvince.map((item) => ({ value: item.name_with_type, label: item.name_with_type }))}
              disabled={!provinceName} allowClear preserveUnknownValue
              placeholder={provinceName ? 'Chọn xã / phường trong tỉnh…' : 'Chọn tỉnh / thành phố trước'}
              onValueChange={(value) => {
                const ward = wardsInSelectedProvince.find((item) => item.name_with_type === value || item.name === value);
                if (!ward) return;
                if (!isEdit && !form.state.values.code.trim()) {
                  form.setFieldMeta('code', (prev) => ({ ...prev, errorMap: { ...prev.errorMap, onSubmit: undefined } }));
                  form.setFieldValue('code', `XP-${ward.code}`);
                }
              }} />}
          </form.AppField>
          <form.AppField
            name='dateRange'
            validators={{
              onChange: ({ value }) => {
                if (value.fromDay && value.fromDay < todayYmd) {
                  return 'Ngày bắt đầu không được là ngày trong quá khứ.';
                }
                if (value.toDay && value.toDay < todayYmd) {
                  return 'Ngày kết thúc không được là ngày trong quá khứ.';
                }
                if (value.fromDay && value.toDay && value.fromDay > value.toDay) {
                  return 'Ngày kết thúc không được trước ngày bắt đầu.';
                }
                return undefined;
              },
            }}
          >
            {(field) => <field.DateRange label='Thời gian mở' disablePast />}
          </form.AppField>
          <form.Actions submitLabel='Lưu' onCancel={() => requestOpenChange(false)} />
        </AppForm>
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

  const [draftProvinceName, setDraftProvinceName] = useState<string | undefined>(
    appliedQuery.provinceName,
  );
  const [draftQ, setDraftQ] = useState(appliedQuery.q ?? '');
  const [draftIsActive, setDraftIsActive] = useState<boolean | undefined>(appliedQuery.isActive);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLocality, setEditingLocality] = useState<LocalityRecord | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setDraftProvinceName(appliedQuery.provinceName);
    setDraftQ(appliedQuery.q ?? '');
    setDraftIsActive(appliedQuery.isActive);
  }, [appliedQuery.provinceName, appliedQuery.q, appliedQuery.isActive]);

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
          <h1>Địa bàn</h1>
          <p className='route-intro'>
            Quản lý danh mục Xã / Phường ({data?.meta?.total ?? localities.length} địa bàn) phục vụ
            hồ sơ và báo cáo.
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
            provinceName: draftProvinceName,
            q: draftQ.trim() || undefined,
            isActive: draftIsActive,
          });
        }}
      >
        <FormField
          label='Tỉnh / Thành phố'
          htmlFor='localities-filter-province'
          className='admin-filter-field'
          data-filter-width='group'
        >
          <Combobox
            value={draftProvinceName ?? ALL}
            onValueChange={(value) => {
              const nextProvince = value === ALL ? undefined : value;
              setDraftProvinceName(nextProvince);
              setDraftQ('');
            }}
          >
            <ComboboxAnchor>
              <ComboboxInput id='localities-filter-province' placeholder='Tất cả tỉnh / thành phố' />
              <ComboboxTrigger aria-label='Mở danh sách tỉnh / thành phố' />
            </ComboboxAnchor>
            <ComboboxContent>
              <ComboboxEmpty>Không tìm thấy tỉnh / thành phố.</ComboboxEmpty>
              <ComboboxItem value={ALL}>Tất cả tỉnh / thành phố</ComboboxItem>
              {ADMINISTRATIVE_PROVINCES.map((province) => (
                <ComboboxItem key={province.code} value={province.name_with_type}>
                  {province.name_with_type}
                </ComboboxItem>
              ))}
            </ComboboxContent>
          </Combobox>
        </FormField>
        <FormField
          label='Tìm mã hoặc tên xã / phường'
          htmlFor='localities-filter-q'
          className='admin-filter-field'
          data-filter-width='search'
        >
          <Input
            id='localities-filter-q'
            value={draftQ}
            placeholder='Nhập mã hoặc tên xã/phường…'
            onChange={(event) => setDraftQ(event.target.value)}
          />
        </FormField>
        <FormField
          label='Trạng thái'
          htmlFor='localities-filter-active'
          className='admin-filter-field'
          data-filter-width='status'
        >
          <Combobox
            value={draftIsActive === undefined ? ALL : String(draftIsActive)}
            onValueChange={(value) =>
              setDraftIsActive(value === ALL ? undefined : value === 'true')
            }
          >
            <ComboboxAnchor>
              <ComboboxInput id='localities-filter-active' placeholder='Tất cả' />
              <ComboboxTrigger aria-label='Mở danh sách trạng thái địa bàn' />
            </ComboboxAnchor>
            <ComboboxContent>
              <ComboboxEmpty>Không tìm thấy trạng thái.</ComboboxEmpty>
              <ComboboxItem value={ALL}>Tất cả</ComboboxItem>
              <ComboboxItem value='true'>Đang mở đăng ký</ComboboxItem>
              <ComboboxItem value='false'>Ngừng mở đăng ký</ComboboxItem>
            </ComboboxContent>
          </Combobox>
        </FormField>
        <div className='admin-actions admin-filter-actions items-end'>
          <Button type='submit'>Áp dụng</Button>
          {(appliedQuery.provinceName !== undefined ||
            appliedQuery.q !== undefined ||
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
