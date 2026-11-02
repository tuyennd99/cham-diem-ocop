import { Input } from '@/components/ui/input';
import type { InputProps } from '@/types/ui';
import { numberInputValue } from '@/components/form/field-values';
import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import { FormFieldLayout, useResolvedField, type BaseFieldLayoutProps } from '@/components/form/form-field-layout';

type NativeInputProps = Omit<
  InputProps,
  'id' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'type' | 'aria-invalid'
>;
type FormInputProps = BaseFieldLayoutProps & NativeInputProps & (
  | { type: 'number'; onValueChange?: (value: number | undefined) => void }
  | { type?: 'text' | 'email' | 'tel' | 'url' | 'search'; onValueChange?: (value: string) => void }
);

export function FormInput(props: FormInputProps) {
  const meta = useResolvedField<string | number | undefined>(props.id);
  const {
    label, hint, hintId, optional, required, className, id: _id,
    onValueChange: _onValueChange, ...inputProps
  } = props;

  return (
    <FormFieldLayout
      id={meta.id}
      label={label}
      hint={hint}
      hintId={hintId}
      optional={optional}
      required={required}
      className={className}
      error={meta.error}
    >
      <Input
        {...inputProps}
        id={meta.id}
        name={meta.field.name}
        required={required}
        value={meta.value ?? ''}
        disabled={props.disabled || meta.isSubmitting}
        aria-invalid={Boolean(meta.error)}
        onBlur={meta.handleBlur}
        aria-describedby={resolveFieldDescribedBy(
          meta.id, Boolean(hint), Boolean(meta.error), hintId, props['aria-describedby'],
        )}
        onChange={(event) => {
          if (props.type === 'number') {
            const next = numberInputValue(event.currentTarget.value, event.currentTarget.valueAsNumber);
            meta.handleChange(next);
            props.onValueChange?.(next);
          } else {
            const next = event.currentTarget.value;
            meta.handleChange(next);
            props.onValueChange?.(next);
          }
        }}
      />
    </FormFieldLayout>
  );
}
