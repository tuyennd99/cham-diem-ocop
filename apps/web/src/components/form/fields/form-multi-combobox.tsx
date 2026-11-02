import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import {
  FormFieldLayout,
  useResolvedField,
  type BaseFieldLayoutProps,
} from '@/components/form/form-field-layout';
import { MultiCombobox, type MultiComboboxProps } from '@/components/multi-combobox';

export type FormMultiComboboxProps = BaseFieldLayoutProps &
  Omit<
    MultiComboboxProps,
    'id' | 'name' | 'value' | 'onChange' | 'onBlur' | 'aria-invalid' | 'aria-required'
  >;

export function FormMultiCombobox(props: FormMultiComboboxProps) {
  const meta = useResolvedField<string[]>(props.id);
  const {
    label,
    hint,
    hintId,
    optional,
    required,
    className,
    id: _id,
    'aria-describedby': _describedBy,
    ...controlProps
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
      <MultiCombobox
        {...controlProps}
        id={meta.id}
        name={meta.field.name}
        value={meta.value}
        onChange={meta.handleChange}
        onBlur={meta.handleBlur}
        disabled={props.disabled || meta.isSubmitting}
        aria-required={required}
        aria-invalid={Boolean(meta.error)}
        aria-describedby={resolveFieldDescribedBy(
          meta.id,
          Boolean(hint),
          Boolean(meta.error),
          hintId,
          props['aria-describedby'],
        )}
      />
    </FormFieldLayout>
  );
}
