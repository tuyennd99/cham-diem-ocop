import type { ComponentProps } from 'react';
import PasswordInput from '@/components/password-input';
import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import { FormFieldLayout, useResolvedField, type BaseFieldLayoutProps } from '@/components/form/form-field-layout';

type FormPasswordProps = BaseFieldLayoutProps & Omit<
  ComponentProps<typeof PasswordInput>,
  'id' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'aria-invalid'
>;

export function FormPassword(props: FormPasswordProps) {
  const meta = useResolvedField<string>(props.id);
  const { label, hint, hintId, optional, required, className, id: _id, ...controlProps } = props;

  return (
    <FormFieldLayout id={meta.id} label={label} hint={hint} hintId={hintId} optional={optional} required={required} className={className} error={meta.error}>
      <PasswordInput
        {...controlProps}
        id={meta.id}
        name={meta.field.name}
        value={meta.value}
        required={required}
        disabled={controlProps.disabled || meta.isSubmitting}
        onChange={(event) => meta.handleChange(event.currentTarget.value)}
        onBlur={meta.handleBlur}
        aria-invalid={Boolean(meta.error)}
        aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(hint), Boolean(meta.error), hintId, controlProps['aria-describedby'])}
      />
    </FormFieldLayout>
  );
}
