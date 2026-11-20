import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminCategoryRecord,
  CreateAdminCategoryInput,
  UpdateAdminCategoryInput,
} from '@ocop/shared';
import { useBlocker } from '@tanstack/react-router';
import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { messageOf } from '../../lib/api-error';
import { useManagingAgencies } from '../../queries/admin-catalogs';

interface CategoryEditorDialogProps {
  open: boolean;
  category: AdminCategoryRecord | null;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateAdminCategoryInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateAdminCategoryInput) => Promise<unknown>;
}

export function CategoryEditorDialog({
  open,
  category,
  onOpenChange,
  onCreate,
  onUpdate,
}: CategoryEditorDialogProps) {
  const isEdit = category !== null;
  const initialName = category?.name ?? '';
  const initialDescription = category?.description ?? '';
  const initialOrder = String(category?.order ?? 0);
  const initialIsActive = category?.isActive ?? false;
  const initialAgencyIds = (category?.managingAgencies ?? []).map((a) => a.id).sort();

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [order, setOrder] = useState(initialOrder);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [managingAgencyIds, setManagingAgencyIds] = useState<string[]>(initialAgencyIds);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const agenciesQuery = useManagingAgencies(open);
  const agencies = agenciesQuery.data ?? [];

  const sortedCurrentAgencyIds = [...managingAgencyIds].sort();
  const agenciesChanged = sortedCurrentAgencyIds.join(',') !== initialAgencyIds.join(',');

  const dirty =
    open &&
    (name !== initialName ||
      description !== initialDescription ||
      order !== initialOrder ||
      isActive !== initialIsActive ||
      agenciesChanged ||
      reason.trim().length > 0);

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm('Biểu mẫu danh mục có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
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
      !window.confirm('Biểu mẫu danh mục có thay đổi chưa lưu. Đóng hộp thoại và bỏ thay đổi?')
    ) {
      return;
    }
    onOpenChange(false);
  }

  function toggleAgency(agencyId: string, checked: boolean) {
    setManagingAgencyIds((current) =>
      checked ? [...new Set([...current, agencyId])] : current.filter((id) => id !== agencyId),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await onUpdate(category.id, {
          name,
          description: description.trim() || null,
          order: Number(order),
          isActive,
          managingAgencyIds,
          reason,
        });
      } else {
        await onCreate({
          name,
          description: description.trim() || null,
          order: Number(order),
          managingAgencyIds,
          reason,
        });
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
            {isEdit ? `Cập nhật danh mục: ${category.name}` : 'Thêm danh mục sản phẩm'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Mã danh mục cố định: ${category.id}. Thay đổi liên kết Cơ quan chủ trì chỉ áp dụng tự động cho các hồ sơ được duyệt sau thời điểm thay đổi.`
              : 'Danh mục mới được tạo ở trạng thái ngừng mở đăng ký cho tới khi nạp bộ tiêu chí hợp lệ đủ 100 điểm.'}
          </DialogDescription>
        </DialogHeader>
        <form className='admin-form account-form' onSubmit={(event) => void submit(event)}>
          <FormField label='Tên danh mục sản phẩm' htmlFor='category-name'>
            <Input
              id='category-name'
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          <FormField label='Mô tả (tùy chọn)' htmlFor='category-description'>
            <Input
              id='category-description'
              value={description}
              disabled={busy}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FormField>
          <FormField label='Thứ tự hiển thị' htmlFor='category-order'>
            <Input
              id='category-order'
              type='number'
              min={0}
              step={1}
              value={order}
              disabled={busy}
              onChange={(event) => setOrder(event.target.value)}
              required
            />
          </FormField>

          <fieldset className='account-form'>
            <legend className='text-sm font-semibold'>
              Cơ quan chủ trì (Phụ lục I Quyết định 26/2026/QĐ-TTg)
            </legend>
            <p className='text-muted mb-2 text-xs'>
              Một phân loại có thể thuộc một hoặc nhiều cơ quan quản lý. Khi duyệt hồ sơ, hệ thống
              tự động giao cho tất cả giám khảo thuộc các cơ quan này.
            </p>
            <div className='grid gap-2'>
              {agencies.map((agency) => (
                <div key={agency.id} className='inline-flex items-center gap-2'>
                  <Checkbox
                    id={`category-agency-${agency.id}`}
                    checked={managingAgencyIds.includes(agency.id)}
                    disabled={busy}
                    onCheckedChange={(checked) => toggleAgency(agency.id, checked === true)}
                  />
                  <Label htmlFor={`category-agency-${agency.id}`} className='cursor-pointer'>
                    {agency.name} ({agency.code})
                  </Label>
                </div>
              ))}
            </div>
          </fieldset>

          {isEdit && (
            <div className='inline-flex items-center gap-2'>
              <Checkbox
                id='category-editor-1'
                checked={isActive}
                disabled={busy}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor='category-editor-1' className='cursor-pointer'>
                Mở cho đăng ký mới (yêu cầu bộ tiêu chí riêng đang hoạt động và tổng điểm tối đa =
                100)
              </Label>
            </div>
          )}
          <FormField label='Lý do thao tác' htmlFor='category-reason'>
            <Input
              id='category-reason'
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          {error && <AlertError title='Không thể lưu danh mục' errors={[error]} />}
          <div className='admin-actions'>
            <Button type='submit' loading={busy} disabled={busy}>
              {busy ? 'Đang lưu…' : isEdit ? 'Lưu danh mục' : 'Tạo danh mục'}
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
