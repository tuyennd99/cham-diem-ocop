import assert from 'node:assert/strict';
import { it } from 'node:test';
import { FormApi, FieldApi } from '@tanstack/react-form';
import { firstFieldError, resolveFieldDescribedBy } from '../src/components/form/form-errors.ts';

it('extracts readable errors and links only existing descriptions', () => {
  assert.equal(firstFieldError([]), '');
  assert.equal(firstFieldError([undefined, null, {}, '', '  ']), '');
  assert.equal(firstFieldError([{ message: 'Trùng mã.' }]), 'Trùng mã.');
  assert.equal(firstFieldError([new Error('Không thể lưu.')]), 'Không thể lưu.');
  assert.equal(firstFieldError([[undefined, 'Lỗi đầu', 'Lỗi sau']]), 'Lỗi đầu');
  assert.equal(resolveFieldDescribedBy('code', false, false), undefined);
  assert.equal(resolveFieldDescribedBy('code', true, true), 'code-error code-hint');
  assert.equal(resolveFieldDescribedBy('code', true, true, 'hint', 'outside hint'), 'code-error hint outside');
});

it('shows a server error immediately and preserves client errors on edit', () => {
  const form = new FormApi({ defaultValues: { code: 'AA' } });
  const cleanupForm = form.mount();
  const field = new FieldApi({ form, name: 'code', validators: {
    onChange: ({ value }) => value.length < 2 ? 'Tối thiểu 2 ký tự.' : undefined,
  } });
  const cleanupField = field.mount();
  try {
    form.setFieldMeta('code', (prev) => ({ ...prev, errorMap: {
      ...prev.errorMap, onSubmit: 'Mã địa bàn đã tồn tại.',
    } }));
    assert.equal(firstFieldError(field.state.meta.errors), 'Mã địa bàn đã tồn tại.');
    field.setErrorMap({ onSubmit: undefined });
    field.handleChange('B');
    assert.equal(field.state.meta.errorMap.onSubmit, undefined);
    assert.equal(firstFieldError(field.state.meta.errors), 'Tối thiểu 2 ký tự.');
    field.handleChange('BB');
    assert.deepEqual(field.state.meta.errors, []);
  } finally {
    cleanupField();
    cleanupForm();
  }
});

it('recognizes restored defaults even though isDirty stays true', () => {
  const form = new FormApi({ defaultValues: { code: 'A' } });
  const cleanupForm = form.mount();
  const field = new FieldApi({ form, name: 'code' });
  const cleanupField = field.mount();
  try {
    assert.equal(form.state.isDefaultValue, true);
    field.handleChange('B');
    assert.equal(form.state.isDefaultValue, false);
    field.handleChange('A');
    assert.equal(form.state.isDefaultValue, true);
    assert.equal(form.state.isDirty, true);
  } finally {
    cleanupField();
    cleanupForm();
  }
});
