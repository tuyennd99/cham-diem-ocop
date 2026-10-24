import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminCategoryRecord,
  CreateAdminCategoryInput,
  ProductGroupRecord,
  UpdateAdminCategoryInput,
} from '@ocop/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { messageOf } from '../../lib/api-error';

interface CategoryEditorDialogProps {
  open: boolean;
  category: AdminCategoryRecord | null;
  groups: ProductGroupRecord[];
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateAdminCategoryInput) => Promise<unknown>;
  onUpdate: (id: string, input: UpdateAdminCategoryInput) => Promise<unknown>;
}

export function CategoryEditorDialog({
  open,
  category,
  groups,
  onOpenChange,
  onCreate,
  onUpdate,
}: CategoryEditorDialogProps) {
  const isEdit = category !== null;
  const [groupId, setGroupId] = useState(category?.groupId ?? groups[0]?.id ?? '');
  const [name, setName] = useState(category?.name ?? '');
  const [classificationGroup, setClassificationGroup] = useState(
    category?.classificationGroup ?? '',
  );
  const [classificationSubgroup, setClassificationSubgroup] = useState(
    category?.classificationSubgroup ?? '',
  );
  const [description, setDescription] = useState(category?.description ?? '');
  const [order, setOrder] = useState(String(category?.order ?? 0));
  const [isActive, setIsActive] = useState(category?.isActive ?? false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lockedGroupChange = isEdit && (category.submittedReferenceCount ?? 0) > 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (isEdit) {
        await onUpdate(category.id, {
          ...(lockedGroupChange ? {} : { groupId }),
          name,
          classificationGroup,
          classificationSubgroup: classificationSubgroup.trim() || null,
          description: description.trim() || null,
          order: Number(order),
          isActive,
          reason,
        });
      } else {
        await onCreate({
          groupId,
          name,
          classificationGroup,
          classificationSubgroup: classificationSubgroup.trim() || null,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='admin-dialog' data-admin-ui='true'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `Cập nhật phân loại: ${category.name}` : 'Thêm phân loại sản phẩm'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? `Mã phân loại cố định: ${category.id}. Không chuyển nhóm đối với phân loại đã có hồ sơ nộp.`
              : 'Phân loại mới được tạo ở trạng thái ngừng mở đăng ký cho tới khi nạp bộ tiêu chí hợp lệ đủ 100 điểm.'}
          </DialogDescription>
        </DialogHeader>
        <form className='account-form' onSubmit={(event) => void submit(event)}>
          <label>
            Nhóm sản phẩm lớn
            <select
              value={groupId}
              disabled={busy || lockedGroupChange}
              onChange={(event) => setGroupId(event.target.value)}
              required
            >
              <option value=''>Chọn nhóm lớn</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.code} · {group.name}
                  {group.isActive ? '' : ' (đã ngừng)'}
                </option>
              ))}
            </select>
            {lockedGroupChange && (
              <small>
                Phân loại đã có {category.submittedReferenceCount} hồ sơ nộp nên không thể chuyển
                nhóm.
              </small>
            )}
          </label>
          <label>
            Tên phân loại sản phẩm
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label>
            Nhóm phân loại chi tiết
            <Input
              value={classificationGroup}
              onChange={(event) => setClassificationGroup(event.target.value)}
              maxLength={255}
              required
            />
          </label>
          <label>
            Tiểu nhóm phân loại (tùy chọn)
            <Input
              value={classificationSubgroup}
              onChange={(event) => setClassificationSubgroup(event.target.value)}
              maxLength={255}
            />
          </label>
          <label>
            Mô tả (tùy chọn)
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label>
            Thứ tự hiển thị
            <Input
              type='number'
              min={0}
              step={1}
              value={order}
              onChange={(event) => setOrder(event.target.value)}
              required
            />
          </label>
          {isEdit && (
            <label>
              <input
                type='checkbox'
                checked={isActive}
                disabled={busy}
                onChange={(event) => setIsActive(event.target.checked)}
              />{' '}
              Mở cho đăng ký mới (yêu cầu bộ tiêu chí riêng đang hoạt động và tổng điểm tối đa = 100)
            </label>
          )}
          <label>
            Lý do thao tác
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
          <div className='hero-actions'>
            <Button type='submit' disabled={busy || !groupId}>
              {busy ? 'Đang lưu…' : isEdit ? 'Lưu phân loại' : 'Tạo phân loại'}
            </Button>
            <Button
              type='button'
              variant='secondary'
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Đóng
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
