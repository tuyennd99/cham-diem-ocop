import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useStore, type AnyFieldApi } from '@tanstack/react-form';
import { FormField } from '@/components/form-field';
import InputError from '@/components/input-error';
import { useFieldContext } from '@/components/form/form-context';
import { firstFieldError, nativeFieldError } from '@/components/form/form-errors';
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

export function useNativeFieldError(field: AnyFieldApi) {
  const isTouched = useStore(field.store, (state) => state.meta.isTouched);
  const wasTouched = useRef(isTouched);
  const control = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    if (wasTouched.current && !isTouched) {
      if (control.current?.type === 'number' && control.current.validity.badInput) {
        control.current.value = '';
      }
      control.current = null;
      setError('');
    } else if (control.current) {
      setError(nativeFieldError(control.current));
    }
    wasTouched.current = isTouched;
  });

  function validate(element: HTMLInputElement | HTMLTextAreaElement) {
    control.current = element;
    setError(nativeFieldError(element));
  }

  return {
    error,
    validate,
    invalid(element: HTMLInputElement | HTMLTextAreaElement) {
      field.setMeta((prev) => ({ ...prev, isTouched: true }));
      validate(element);
    },
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
