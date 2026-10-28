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

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [order, setOrder] = useState(initialOrder);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    open &&
    (name !== initialName ||
      description !== initialDescription ||
      order !== initialOrder ||
      isActive !== initialIsActive ||
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
          reason,
        });
      } else {
        await onCreate({
          name,
          description: description.trim() || null,
          order: Number(order),
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
              ? `Mã danh mục cố định: ${category.id}.`
              : 'Danh mục mới được tạo ở trạng thái ngừng mở đăng ký cho tới khi nạp bộ tiêu chí hợp lệ đủ 100 điểm.'}
          </DialogDescription>
        </DialogHeader>
        <form className='admin-form account-form' onSubmit={(event) => void submit(event)}>
          <FormField label='Tên danh mục sản phẩm' htmlFor='category-name'>
            <Input
              id='category-name'
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </FormField>
          <FormField label='Mô tả (tùy chọn)' htmlFor='category-description'>
            <Input
              id='category-description'
              value={description}
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
              onChange={(event) => setOrder(event.target.value)}
              required
            />
          </FormField>
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
