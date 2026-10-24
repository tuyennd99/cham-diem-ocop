import { useState } from 'react';
import type { FormEvent } from 'react';
import type {
  AdminCategoryRecord,
  CreateAdminCategoryInput,
  ProductGroupRecord,
  UpdateAdminCategoryInput,
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
  const initialGroupId = category?.groupId ?? groups[0]?.id ?? '';
  const initialName = category?.name ?? '';
  const initialClassificationGroup = category?.classificationGroup ?? '';
  const initialClassificationSubgroup = category?.classificationSubgroup ?? '';
  const initialDescription = category?.description ?? '';
  const initialOrder = String(category?.order ?? 0);
  const initialIsActive = category?.isActive ?? false;

  const [groupId, setGroupId] = useState(initialGroupId);
  const [name, setName] = useState(initialName);
  const [classificationGroup, setClassificationGroup] = useState(initialClassificationGroup);
  const [classificationSubgroup, setClassificationSubgroup] = useState(
    initialClassificationSubgroup,
  );
  const [description, setDescription] = useState(initialDescription);
  const [order, setOrder] = useState(initialOrder);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const lockedGroupChange = isEdit && (category.submittedReferenceCount ?? 0) > 0;
  const dirty =
    open &&
    (groupId !== initialGroupId ||
      name !== initialName ||
      classificationGroup !== initialClassificationGroup ||
      classificationSubgroup !== initialClassificationSubgroup ||
      description !== initialDescription ||
      order !== initialOrder ||
      isActive !== initialIsActive ||
      reason.trim().length > 0);

  useBlocker({
    shouldBlockFn: () =>
      dirty && !window.confirm('Biểu mẫu phân loại có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
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
      !window.confirm('Biểu mẫu phân loại có thay đổi chưa lưu. Đóng hộp thoại và bỏ thay đổi?')
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
    <Dialog open={open} onOpenChange={requestOpenChange}>
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
        <form className='admin-form account-form' onSubmit={(event) => void submit(event)}>
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
              <small className='text-xs text-muted'>
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
            <label className='inline-flex items-center gap-2 cursor-pointer'>
              <input
                type='checkbox'
                checked={isActive}
                disabled={busy}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              <span>
                Mở cho đăng ký mới (yêu cầu bộ tiêu chí riêng đang hoạt động và tổng điểm tối đa =
                100)
              </span>
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
          <div className='admin-actions'>
            <Button type='submit' disabled={busy || !groupId}>
              {busy ? 'Đang lưu…' : isEdit ? 'Lưu phân loại' : 'Tạo phân loại'}
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
