import { useStore } from '@tanstack/react-form';
import { Checkbox } from '@/components/ui/checkbox';
import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import { FormFieldLayout, useResolvedField, type BaseFieldLayoutProps } from '@/components/form/form-field-layout';

type FormCheckboxProps = BaseFieldLayoutProps & { disabled?: boolean };

export function FormCheckbox(props: FormCheckboxProps) {
  const meta = useResolvedField<boolean>(props.id);
  const { label, hint, hintId, optional, required, className, id: _id, disabled, ...controlProps } = props;
  const isTouched = useStore(meta.field.store, (state) => state.meta.isTouched);
  const error = meta.error || (required && !disabled && isTouched && !meta.value ? 'Vui lòng chọn mục này.' : '');

  return (
    <FormFieldLayout id={meta.id} label={label} hint={hint} hintId={hintId} optional={optional} required={required} className={className} error={error}>
      <span onInvalidCapture={() => meta.field.setMeta((prev) => ({ ...prev, isTouched: true }))}>
        <Checkbox
          {...controlProps}
          id={meta.id}
          name={meta.field.name}
          checked={meta.value}
          required={required}
          disabled={disabled || meta.isSubmitting}
          onCheckedChange={(checked) => meta.handleChange(checked === true)}
          onBlur={meta.handleBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(hint), Boolean(error), hintId, props['aria-describedby'])}
        />
      </span>
    </FormFieldLayout>
  );
}
