import { createElement, lazy, Suspense } from 'react';
import { createFormHook } from '@tanstack/react-form';
import { FormActions, FormSubmitButton } from './app-form';
import { FormCheckbox } from './fields/form-checkbox';
import { FormCombobox } from './fields/form-combobox';
import type { FormDateRangeProps } from './fields/form-date-range';
import { FormInput } from './fields/form-input';
import { FormMultiCombobox } from './fields/form-multi-combobox';
import { FormPassword } from './fields/form-password';
import { FormSelect } from './fields/form-select';
import { FormTextarea } from './fields/form-textarea';
import { fieldContext, formContext } from './form-context';

const LazyDateRange = lazy(() =>
  import('./fields/form-date-range').then((module) => ({
    default: module.FormDateRange,
  })),
);

function DateRangeField(props: FormDateRangeProps) {
  return createElement(Suspense, {
    fallback: createElement('p', { role: 'status' }, 'Đang tải lịch…'),
    children: createElement(LazyDateRange, props),
  });
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Input: FormInput,
    Password: FormPassword,
    Textarea: FormTextarea,
    Checkbox: FormCheckbox,
    Select: FormSelect,
    Combobox: FormCombobox,
    MultiCombobox: FormMultiCombobox,
    DateRange: DateRangeField,
  },
  formComponents: { SubmitButton: FormSubmitButton, Actions: FormActions },
});

export { AppForm } from './app-form';
