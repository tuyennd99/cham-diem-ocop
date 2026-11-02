import { ALL } from '@/constants/consts';
import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import {
  FormFieldLayout,
  useResolvedField,
  type BaseFieldLayoutProps,
} from '@/components/form/form-field-layout';
import type { SimpleComboboxOption } from '@/components/simple-combobox';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';

export type FormComboboxProps = BaseFieldLayoutProps & {
  options: SimpleComboboxOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  preserveUnknownValue?: boolean;
  onValueChange?: (value: string) => void;
};

export function FormCombobox(props: FormComboboxProps) {
  const meta = useResolvedField<string>(props.id);

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
      <Combobox
        value={meta.value || ''}
        disabled={props.disabled || meta.isSubmitting}
        autoHighlight
        onValueChange={(value) => {
          const next = value === ALL ? '' : value;
          meta.handleChange(next);
          props.onValueChange?.(next);
        }}
      >
        <ComboboxAnchor>
          <ComboboxInput
            id={meta.id}
            name={meta.field.name}
            placeholder={props.placeholder ?? 'Chọn giá trị'}
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
          />
          <ComboboxTrigger aria-label='Mở danh sách lựa chọn' />
        </ComboboxAnchor>
        <ComboboxContent>
          <ComboboxEmpty>{props.emptyText ?? 'Không tìm thấy.'}</ComboboxEmpty>
          {props.allowClear && (
            <ComboboxItem value={ALL}>{props.clearLabel ?? 'Bỏ chọn'}</ComboboxItem>
          )}
          {props.preserveUnknownValue &&
            meta.value &&
            !props.options.some((option) => option.value === meta.value) && (
              <ComboboxItem value={meta.value}>{meta.value}</ComboboxItem>
            )}
          {props.options.map((option) => (
            <ComboboxItem
              key={option.value}
              value={option.value}
              label={option.label}
              disabled={option.disabled}
            >
              {option.label}
            </ComboboxItem>
          ))}
        </ComboboxContent>
      </Combobox>
    </FormFieldLayout>
  );
}
