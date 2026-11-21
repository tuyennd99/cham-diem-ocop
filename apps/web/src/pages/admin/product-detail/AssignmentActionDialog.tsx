import AlertError from '@/components/alert-error';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export type AssignmentActionKind = 'reopen-evaluation' | 'remove-assignment';

const ASSIGNMENT_ACTION_CONFIG = {
  'reopen-evaluation': {
    title: 'Mở lại phiếu chấm',
    description:
      'Phiếu chấm sẽ chuyển về trạng thái đang chấm nháp để giám khảo chỉnh sửa và nộp lại.',
    reasonLabel: 'Lý do thao tác (tùy chọn)',
    placeholder: 'Nhập lý do mở lại phiếu chấm (nếu có)…',
    confirmLabel: 'Xác nhận mở lại phiếu',
    pendingLabel: 'Đang mở lại…',
    errorTitle: 'Không thể mở lại phiếu chấm',
    variant: 'primary',
  },
  'remove-assignment': {
    title: 'Gỡ giám khảo khỏi hồ sơ',
    description:
      'Giám khảo sẽ bị gỡ khỏi phân công của hồ sơ này và phiếu chấm (nếu có) chuyển sang lịch sử.',
    reasonLabel: 'Lý do thao tác (tùy chọn)',
    placeholder: 'Nhập lý do gỡ phân công (nếu có)…',
    confirmLabel: 'Xác nhận gỡ giám khảo',
    pendingLabel: 'Đang gỡ…',
    errorTitle: 'Không thể thực hiện thao tác',
    variant: 'destructive',
  },
} as const;

export function AssignmentActionDialog({
  open,
  kind,
  judgeName,
  contextSummary,
  reason,
  reasonFieldId,
  error,
  busy,
  onReasonChange,
  onConfirm,
  onClose,
}: {
  open: boolean;
  kind: AssignmentActionKind;
  judgeName: string;
  contextSummary?: string;
  reason: string;
  reasonFieldId: string;
  error: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const config = ASSIGNMENT_ACTION_CONFIG[kind];

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className='admin-dialog max-w-lg' data-admin-ui='true'>
        <DialogHeader className='pr-6'>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        {judgeName && (
          <div className='border-border bg-secondary/70 rounded-md border px-3.5 py-2.5 text-sm'>
            <div className='text-fg font-semibold'>{judgeName}</div>
            {contextSummary && <div className='text-muted mt-0.5 text-xs'>{contextSummary}</div>}
          </div>
        )}
        <div className='flex flex-col gap-4'>
          <FormField label={config.reasonLabel} htmlFor={reasonFieldId}>
            <Textarea
              id={reasonFieldId}
              rows={3}
              className='min-h-20 resize-y'
              value={reason}
              maxLength={255}
              disabled={busy}
              placeholder={config.placeholder}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          </FormField>
          {error && <AlertError title={config.errorTitle} errors={[error]} />}
          <DialogFooter className='pt-2'>
            <Button type='button' variant='outline' disabled={busy} onClick={onClose}>
              Đóng
            </Button>
            <Button
              type='button'
              variant={config.variant}
              loading={busy}
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? config.pendingLabel : config.confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
