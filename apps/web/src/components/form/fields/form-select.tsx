import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import {
  FormFieldLayout,
  useResolvedField,
  type BaseFieldLayoutProps,
} from '@/components/form/form-field-layout';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FormSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export type FormSelectProps = BaseFieldLayoutProps & {
  options: FormSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  onValueChange?: (value: string) => void;
};

export function FormSelect(props: FormSelectProps) {
  const meta = useResolvedField<string>(props.id);
  const emptyValue = `${meta.id}-empty`;

  return (
    <FormFieldLayout
      id={meta.id}
      label={props.label}
      hint={props.hint}
      hintId={props.hintId}
      optional={props.optional}
      required={props.required}
      className={props.className}
      error={meta.error}
    >
      <Select
        value={meta.value || ''}
        disabled={props.disabled || meta.isSubmitting}
        onValueChange={(value) => {
          const next = value === emptyValue ? '' : value;
          meta.handleChange(next);
          props.onValueChange?.(next);
        }}
      >
        <SelectTrigger
          id={meta.id}
          onBlur={meta.handleBlur}
          aria-required={props.required}
          aria-invalid={Boolean(meta.error)}
          aria-describedby={resolveFieldDescribedBy(
            meta.id,
            Boolean(props.hint),
            Boolean(meta.error),
            props.hintId,
            props['aria-describedby'],
          )}
        >
          <SelectValue placeholder={props.placeholder ?? 'Chọn giá trị'} />
        </SelectTrigger>
        <SelectContent>
          {props.allowEmpty && (
            <SelectItem value={emptyValue}>{props.emptyLabel ?? 'Bỏ chọn'}</SelectItem>
          )}
          {meta.value && !props.options.some((option) => option.value === meta.value) && (
            <SelectItem value={meta.value}>{meta.value}</SelectItem>
          )}
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormFieldLayout>
  );
}
