import { format } from 'date-fns';
import type { FormDateRangeValue } from '@/components/form/field-values';
import { resolveFieldDescribedBy } from '@/components/form/form-errors';
import {
  FormFieldLayout,
  useResolvedField,
  type BaseFieldLayoutProps,
} from '@/components/form/form-field-layout';
import DateRangePicker, { type RangePickerProps } from '@/components/range-picker';

export type FormDateRangeProps = BaseFieldLayoutProps & {
  disabled?: boolean;
  align?: RangePickerProps['align'];
  disablePast?: boolean;
  disableFuture?: boolean;
  disabledDates?: RangePickerProps['disabledDates'];
};

export function FormDateRange(props: FormDateRangeProps) {
  const meta = useResolvedField<FormDateRangeValue>(props.id);
  const today = format(new Date(), 'yyyy-MM-dd');
  const { fromDay, toDay } = meta.value;

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
      <DateRangePicker
        key={`${fromDay}|${toDay}`}
        initialDateFrom={fromDay || today}
        initialDateTo={toDay || fromDay || today}
        align={props.align ?? 'start'}
        disablePast={props.disablePast}
        disableFuture={props.disableFuture}
        disabledDates={props.disabledDates}
        triggerProps={{
          id: meta.id,
          disabled: props.disabled || meta.isSubmitting,
          'aria-invalid': Boolean(meta.error),
          'aria-required': props.required,
          'aria-describedby': resolveFieldDescribedBy(
            meta.id,
            Boolean(props.hint),
            Boolean(meta.error),
            props.hintId,
            props['aria-describedby'],
          ),
          onBlur: meta.handleBlur,
        }}
        onUpdate={({ range }) => {
          meta.handleChange({
            fromDay: format(range.from, 'yyyy-MM-dd'),
            toDay: format(range.to ?? range.from, 'yyyy-MM-dd'),
          });
          meta.handleBlur();
        }}
      />
    </FormFieldLayout>
  );
}
