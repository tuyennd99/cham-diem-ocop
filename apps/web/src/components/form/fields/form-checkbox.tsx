import { Checkbox } from '@/components/ui/checkbox';
import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import { FormFieldLayout, useResolvedField, type BaseFieldLayoutProps } from '@/components/form/form-field-layout';

type FormCheckboxProps = BaseFieldLayoutProps & { disabled?: boolean };

export function FormCheckbox(props: FormCheckboxProps) {
  const meta = useResolvedField<boolean>(props.id);
  const { label, hint, hintId, optional, required, className, id: _id, disabled, ...controlProps } = props;

  return (
    <FormFieldLayout id={meta.id} label={label} hint={hint} hintId={hintId} optional={optional} required={required} className={className} error={meta.error}>
      <Checkbox
        {...controlProps}
        id={meta.id}
        name={meta.field.name}
        checked={meta.value}
        required={required}
        disabled={disabled || meta.isSubmitting}
        onCheckedChange={(checked) => meta.handleChange(checked === true)}
        onBlur={meta.handleBlur}
        aria-invalid={Boolean(meta.error)}
        aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(hint), Boolean(meta.error), hintId, props['aria-describedby'])}
      />
    </FormFieldLayout>
  );
}
