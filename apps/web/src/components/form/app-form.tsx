import { useState, type ReactNode } from 'react';
import { useStore, type AnyFormApi } from '@tanstack/react-form';
import type { ButtonProps } from '@/types/ui';
import { messageOf } from '@/lib/api-error';
import { cn } from '@/lib/utils';
import AlertError from '@/components/alert-error';
import { Button } from '@/components/ui/button';
import { formContext, useFormContext } from './form-context';

export type AppFormProps = {
  form: AnyFormApi;
  error?: string;
  errorTitle?: string;
  className?: string;
  children: ReactNode;
};

export type FormSubmitButtonProps = Omit<ButtonProps, 'type'> & { busyLabel?: ReactNode };

export type FormActionsProps = {
  submitLabel: ReactNode;
  busyLabel?: ReactNode;
  cancelLabel?: ReactNode;
  onCancel?: () => void;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
};

export function AppForm({
  form,
  error,
  errorTitle = 'Không thể lưu',
  className,
  children,
}: AppFormProps) {
  const [unexpectedError, setUnexpectedError] = useState('');
  const message = error || unexpectedError;
  return (
    <formContext.Provider value={form}>
      <form
        className={className}
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (form.state.isSubmitting) return;
          setUnexpectedError('');
          void form.handleSubmit().catch((cause: unknown) => setUnexpectedError(messageOf(cause)));
        }}
      >
        {children}
        {message && <AlertError title={errorTitle} errors={[message]} />}
      </form>
    </formContext.Provider>
  );
}

export function FormSubmitButton({
  busyLabel = 'Đang lưu…',
  disabled,
  children,
  ...props
}: FormSubmitButtonProps) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  return (
    <Button
      {...props}
      type='submit'
      loading={isSubmitting}
      disabled={disabled || isSubmitting || !canSubmit}
    >
      {isSubmitting ? busyLabel : children}
    </Button>
  );
}

export function FormActions({
  submitLabel,
  busyLabel,
  cancelLabel = 'Đóng',
  onCancel,
  disabled,
  className,
  children,
}: FormActionsProps) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  return (
    <div className={cn('admin-actions justify-end', className)}>
      <FormSubmitButton busyLabel={busyLabel} disabled={disabled}>
        {submitLabel}
      </FormSubmitButton>
      {onCancel && (
        <Button
          type='button'
          variant='secondary'
          disabled={disabled || isSubmitting}
          onClick={onCancel}
        >
          {cancelLabel}
        </Button>
      )}
      {children}
    </div>
  );
}
