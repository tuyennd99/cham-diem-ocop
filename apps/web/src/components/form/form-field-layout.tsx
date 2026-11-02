import { useId, type ReactNode } from 'react';
import { useStore } from '@tanstack/react-form';
import { FormField } from '@/components/form-field';
import InputError from '@/components/input-error';
import { useFieldContext } from '@/components/form/form-context';
import { firstFieldError } from '@/components/form/form-errors';
import { cn } from '@/lib/utils';

export interface BaseFieldLayoutProps {
  label: ReactNode;
  id?: string;
  hint?: ReactNode;
  hintId?: string;
  optional?: ReactNode;
  required?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

export function useResolvedField<T>(customId?: string) {
  const generatedId = useId();
  const field = useFieldContext<T>();
  const value = useStore(field.store, (state) => state.value);
  const errors = useStore(field.store, (state) => state.meta.errors);
  const isSubmitting = useStore(field.form.store, (state) => state.isSubmitting);

  return {
    field,
    value,
    isSubmitting,
    id: customId ?? generatedId,
    error: firstFieldError(errors),
    handleChange(next: T) {
      field.setErrorMap({ onSubmit: undefined });
      field.handleChange(next);
    },
    handleBlur: field.handleBlur,
  };
}

export function FormFieldLayout({
  id,
  label,
  hint,
  hintId,
  optional,
  required,
  className,
  error,
  children,
}: BaseFieldLayoutProps & { id: string; error: string; children: ReactNode }) {
  return (
    <FormField
      htmlFor={id}
      label={label}
      hint={hint}
      hintId={hintId}
      optional={optional}
      required={required}
      className={cn('gap-1', className)}
    >
      {children}
      <InputError id={`${id}-error`} role='alert' message={error} />
    </FormField>
  );
}
