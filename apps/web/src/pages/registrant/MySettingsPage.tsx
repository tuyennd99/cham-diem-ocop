import { useMemo, useState } from 'react';
import { PageContainer, PageHeader, PageSection } from '@/layouts/PageLayout';
import { useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import AlertError from '@/components/alert-error';
import PageSpin from '@/components/page-spin';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type DataTableColumnDef } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { myRegistrationUnitsApi } from '../../api';
import { AppForm, useAppForm } from '../../components/form';
import { queryKeys } from '../../constants/query-key';
import { ADMINISTRATIVE_PROVINCES, useWardsByProvince } from '../../lib/administrative-divisions';
import { messageOf } from '../../lib/api-error';
import {
  EMPTY_REGISTRATION_UNIT_FORM,
  registrationUnitToFormValues,
  resolveWardLocalityCode,
  toRegistrationUnitWriteInput,
  validateRegistrationUnitInput,
  type RegistrationUnitFormValues,
} from '../../lib/registration-units';
import { useMyRegistrationUnits } from '../../queries/registrant';
import type { RegistrationUnitRecord } from '../../types/registrant';

const PROVINCE_OPTIONS = ADMINISTRATIVE_PROVINCES.map((province) => ({
  value: province.name,
  label: province.name,
}));

export function MySettingsPage() {
  const queryClient = useQueryClient();
  const unitsQuery = useMyRegistrationUnits();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RegistrationUnitRecord | null>(null);
  const [modalSession, setModalSession] = useState(0);
  const [actionError, setActionError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setActionError('');
    setModalSession((prev) => prev + 1);
    setModalOpen(true);
  }

  function openEdit(unit: RegistrationUnitRecord) {
    setEditing(unit);
    setActionError('');
    setModalSession((prev) => prev + 1);
    setModalOpen(true);
  }

  async function handleDelete(unit: RegistrationUnitRecord) {
    setActionError('');
    const confirmed = window.confirm(
      `Xóa đơn vị đăng ký "${unit.entityName}"? Các hồ sơ sản phẩm đã tạo sẽ không bị ảnh hưởng.`,
    );
    if (!confirmed) return;

    setDeletingId(unit.id);
    try {
      await myRegistrationUnitsApi.remove(unit.id);
      toast.success('Đã xóa đơn vị đăng ký.');
      await queryClient.invalidateQueries({
        queryKey: queryKeys.myRegistrationUnits.all,
      });
    } catch (err) {
      setActionError(messageOf(err));
    } finally {
      setDeletingId(null);
    }
  }

  const columns = useMemo<DataTableColumnDef<RegistrationUnitRecord>[]>(
    () => [
      {
        id: 'entityName',
        accessorKey: 'entityName',
        header: 'Chủ thể đăng ký',
        cell: ({ row }) => {
          const unit = row.original;
          return (
            <div>
              <strong className='text-foreground'>{unit.entityName}</strong>
              {unit.phone && (
                <p className='text-muted-foreground mt-0.5 text-xs'>ĐT: {unit.phone}</p>
              )}
            </div>
          );
        },
      },
      {
        id: 'representative',
        accessorKey: 'representativeName',
        header: 'Người đại diện',
        cell: ({ row }) => {
          const unit = row.original;
          return (
            <div>
              <div>{unit.representativeName}</div>
              <p className='text-muted-foreground text-xs'>{unit.representativeTitle}</p>
            </div>
          );
        },
      },
      {
        id: 'locality',
        accessorKey: 'localityName',
        header: 'Địa phương',
        cell: ({ row }) => {
          const unit = row.original;
          return (
            <div>
              <div>{unit.localityName}</div>
              <p className='text-muted-foreground text-xs'>{unit.provinceName}</p>
            </div>
          );
        },
      },
      {
        id: 'contactAddress',
        accessorKey: 'contactAddress',
        header: 'Địa chỉ liên hệ',
        cell: ({ row }) => (
          <span className='line-clamp-2 max-w-xs text-sm'>{row.original.contactAddress}</span>
        ),
      },
      {
        id: 'actions',
        header: 'Thao tác',
        enableSorting: false,
        meta: { align: 'center' },
        cell: ({ row }) => {
          const unit = row.original;
          const isDeleting = deletingId === unit.id;
          return (
            <div className='flex items-center justify-center gap-1.5'>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type='button'
                    variant='secondary'
                    size='icon-sm'
                    aria-label={`Sửa đơn vị ${unit.entityName}`}
                    onClick={() => openEdit(unit)}
                  >
                    <Pencil className='size-4' aria-hidden='true' />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Sửa</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type='button'
                    variant='destructive'
                    size='icon-sm'
                    disabled={isDeleting}
                    aria-label={`Xóa đơn vị ${unit.entityName}`}
                    onClick={() => void handleDelete(unit)}
                  >
                    {isDeleting ? (
                      <Spinner className='size-4' />
                    ) : (
                      <Trash2 className='size-4' aria-hidden='true' />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Xóa</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [deletingId],
  );

  const units = unitsQuery.data ?? [];

  return (
    <PageContainer>
      <PageHeader
        eyebrow='Người đăng ký'
        title='Cấu hình chung'
        description='Quản lý danh sách đơn vị đăng ký thường dùng để chọn nhanh khi lập hồ sơ sản phẩm OCOP.'
        actions={
          <Button type='button' onClick={openCreate}>
            Thêm đơn vị đăng ký
          </Button>
        }
      />

      {actionError && <AlertError title='Không thể thực hiện thao tác' errors={[actionError]} />}

      {unitsQuery.error && (
        <div className='space-y-3'>
          <AlertError
            title='Không thể tải danh sách đơn vị đăng ký'
            errors={[messageOf(unitsQuery.error)]}
          />
          <div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => void unitsQuery.refetch()}
            >
              Thử tải lại
            </Button>
          </div>
        </div>
      )}

      {unitsQuery.isLoading && <PageSpin />}

      {!unitsQuery.isLoading && !unitsQuery.error && (
        <PageSection aria-label='Danh sách đơn vị đăng ký' className='space-y-4'>
          <div>
            <h2 className='text-base font-semibold'>Danh sách đơn vị đăng ký</h2>
            <p className='text-muted-foreground text-sm'>
              Mỗi tài khoản quản lý riêng danh sách đơn vị của mình. Việc sửa hoặc xóa đơn vị đã lưu
              không làm thay đổi các hồ sơ sản phẩm đã tạo.
            </p>
          </div>
          {units.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Chưa có đơn vị đăng ký nào</CardTitle>
                <CardDescription>
                  Thêm trước thông tin đơn vị đăng ký thường dùng để chọn nhanh khi tạo hồ sơ sản
                  phẩm mới.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button type='button' onClick={openCreate}>
                  Thêm đơn vị đăng ký đầu tiên
                </Button>
              </CardContent>
            </Card>
          ) : (
            <DataTable columns={columns} data={units} getRowId={(unit) => unit.id} />
          )}
        </PageSection>
      )}

      <RegistrationUnitFormDialog
        key={modalSession}
        open={modalOpen}
        editing={editing}
        onOpenChange={setModalOpen}
        onSaved={async () => {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.myRegistrationUnits.all,
          });
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </PageContainer>
  );
}

/**
 * Tách state form theo từng phiên mở dialog bằng `key` để tránh `useAppForm`
 * ghi đè lại `defaultValues` rỗng sau `form.reset(unit)` (#34).
 */
function RegistrationUnitFormDialog({
  open,
  editing,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  editing: RegistrationUnitRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const initialValues = useMemo(
    () => (editing ? registrationUnitToFormValues(editing) : EMPTY_REGISTRATION_UNIT_FORM),
    [editing],
  );
  const [selectedProvince, setSelectedProvince] = useState(() => initialValues.provinceName);
  const [modalError, setModalError] = useState('');
  const [saving, setSaving] = useState(false);

  const wards = useWardsByProvince(selectedProvince);
  const wardOptions = useMemo(
    () =>
      wards.map((ward) => ({
        value: ward.name,
        label: ward.name,
      })),
    [wards],
  );

  const form = useAppForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      setSaving(true);
      setModalError('');
      try {
        const computedCode = resolveWardLocalityCode(
          value.localityName,
          wards,
          editing &&
            editing.provinceName === value.provinceName.trim() &&
            editing.localityName === value.localityName.trim()
            ? (editing.localityCode ?? '')
            : value.localityCode,
        );
        const payload = toRegistrationUnitWriteInput({
          ...value,
          localityCode: computedCode,
        });
        if (editing) {
          await myRegistrationUnitsApi.update(editing.id, payload);
          toast.success('Đã cập nhật đơn vị đăng ký.');
        } else {
          await myRegistrationUnitsApi.create(payload);
          toast.success('Đã thêm đơn vị đăng ký.');
        }
        await onSaved();
      } catch (err) {
        setModalError(messageOf(err));
      } finally {
        setSaving(false);
      }
    },
  });

  function validateField<K extends keyof RegistrationUnitFormValues>(
    field: K,
    value: RegistrationUnitFormValues[K],
  ) {
    const errors = validateRegistrationUnitInput({
      ...form.state.values,
      [field]: value,
    });
    return errors[field];
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && saving) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className='admin-dialog max-w-2xl' data-admin-ui='true'>
        <DialogHeader>
          <DialogTitle>{editing ? 'Cập nhật đơn vị đăng ký' : 'Thêm đơn vị đăng ký'}</DialogTitle>
          <DialogDescription>
            Nhập thông tin chủ thể, người đại diện và địa phương của đơn vị đăng ký.
          </DialogDescription>
        </DialogHeader>

        {modalError && <AlertError title='Không thể lưu đơn vị đăng ký' errors={[modalError]} />}

        <AppForm form={form} className='grid gap-4'>
          <form.AppField
            name='entityName'
            validators={{
              onChange: ({ value }) => validateField('entityName', value),
            }}
          >
            {(field) => (
              <field.Input
                label='Chủ thể đăng ký'
                required
                maxLength={255}
                placeholder='HTX Nông nghiệp...'
              />
            )}
          </form.AppField>

          <div className='grid gap-x-4 gap-y-4 sm:grid-cols-2 sm:gap-y-0'>
            <form.AppField
              name='representativeName'
              validators={{
                onChange: ({ value }) => validateField('representativeName', value),
              }}
            >
              {(field) => (
                <field.Input
                  label='Người đại diện'
                  required
                  maxLength={255}
                  placeholder='Họ và tên người đại diện'
                />
              )}
            </form.AppField>

            <form.AppField
              name='representativeTitle'
              validators={{
                onChange: ({ value }) => validateField('representativeTitle', value),
              }}
            >
              {(field) => (
                <field.Input
                  label='Chức vụ người đại diện'
                  required
                  maxLength={255}
                  placeholder='Giám đốc, Chủ hộ...'
                />
              )}
            </form.AppField>
          </div>

          <form.AppField
            name='phone'
            validators={{
              onChange: ({ value }) => validateField('phone', value),
            }}
          >
            {(field) => (
              <field.Input label='Điện thoại' maxLength={30} placeholder='Số điện thoại' />
            )}
          </form.AppField>

          <div className='grid gap-x-4 gap-y-4 sm:grid-cols-2 sm:gap-y-0'>
            <form.AppField
              name='provinceName'
              validators={{
                onChange: ({ value }) => validateField('provinceName', value),
              }}
            >
              {(field) => (
                <field.Combobox
                  label='Tỉnh/Thành phố'
                  required
                  preserveUnknownValue
                  options={PROVINCE_OPTIONS}
                  placeholder='Chọn tỉnh/thành phố'
                  emptyText='Không tìm thấy tỉnh/thành phố.'
                  onValueChange={(nextProvince) => {
                    setSelectedProvince(nextProvince);
                    form.setFieldValue('localityName', '');
                    form.setFieldValue('localityCode', '');
                  }}
                />
              )}
            </form.AppField>

            <form.AppField
              name='localityName'
              validators={{
                onChange: ({ value }) => validateField('localityName', value),
              }}
            >
              {(field) => (
                <field.Combobox
                  label='Xã/Phường'
                  required
                  preserveUnknownValue
                  disabled={!selectedProvince}
                  options={wardOptions}
                  placeholder={selectedProvince ? 'Chọn Xã/Phường' : 'Chọn tỉnh/thành phố trước'}
                  emptyText='Không tìm thấy Xã/Phường.'
                  onValueChange={(nextWardName) => {
                    const nextCode = resolveWardLocalityCode(nextWardName, wards);
                    form.setFieldValue('localityCode', nextCode);
                  }}
                />
              )}
            </form.AppField>
          </div>

          <form.AppField
            name='contactAddress'
            validators={{
              onChange: ({ value }) => validateField('contactAddress', value),
            }}
          >
            {(field) => (
              <field.Input
                label='Địa chỉ liên hệ'
                required
                maxLength={1000}
                placeholder='Số nhà, thôn/xóm, xã/phường, tỉnh/thành phố'
              />
            )}
          </form.AppField>

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Hủy
            </Button>
            <form.SubmitButton loading={saving}>
              {editing ? 'Lưu thay đổi' : 'Thêm đơn vị'}
            </form.SubmitButton>
          </DialogFooter>
        </AppForm>
      </DialogContent>
    </Dialog>
  );
}
