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
  error?: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {error && <AlertError title='Không thể thực hiện thao tác' errors={[error]} />}
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            loading={pending}
            disabled={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
