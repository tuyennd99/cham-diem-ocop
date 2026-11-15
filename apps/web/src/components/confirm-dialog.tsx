import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Modal xác nhận cho hành động không hoàn tác được từ UI. Chỉ dùng cho hành
 * động thật sự phá hủy — hành động có thể hoàn tác thì làm luôn, không hỏi.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Xác nhận',
  destructive,
  pending,
  confirmDisabled,
  error,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  confirmDisabled?: boolean;
  error?: string | string[];
  onConfirm: () => void;
}) {
  const errors = Array.isArray(error) ? error : error ? [error] : [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='admin-dialog max-h-[90vh] max-w-md overflow-y-auto'
        data-admin-ui='true'
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {errors.length > 0 && <AlertError title='Không thể thực hiện thao tác' errors={errors} />}
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            loading={pending}
            disabled={pending || confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
