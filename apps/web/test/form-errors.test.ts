import assert from 'node:assert/strict';
import { it } from 'node:test';
import { FormApi, FieldApi } from '@tanstack/react-form';
import { firstFieldError, nativeFieldError, resolveFieldDescribedBy } from '../src/components/form/form-errors.ts';

it('reports native constraint violations without retaining an error for valid or disabled controls', () => {
  const valid = {
    badInput: false, customError: false, patternMismatch: false, rangeOverflow: false,
    rangeUnderflow: false, stepMismatch: false, tooLong: false, tooShort: false,
    typeMismatch: false, valid: true, valueMissing: false,
  };
  const input = {
    willValidate: true, validity: valid, validationMessage: '', type: 'text',
    min: '3', max: '9', minLength: 3, maxLength: 9,
  } as HTMLInputElement;
  assert.equal(nativeFieldError(input), '');

  for (const [flag, match] of [
    ['valueMissing', /nhập/i],
    ['badInput', /hợp lệ/i],
    ['patternMismatch', /định dạng/i],
    ['rangeUnderflow', /3/],
    ['rangeOverflow', /9/],
    ['stepMismatch', /bước/i],
    ['tooShort', /3/],
    ['tooLong', /9/],
  ] as const) {
    const control = { ...input, validity: { ...valid, valid: false, [flag]: true } };
    assert.match(nativeFieldError(control), match, flag);
  }
  const mismatch = { ...valid, valid: false, typeMismatch: true };
  assert.match(nativeFieldError({ ...input, type: 'email', validity: mismatch }), /email/i);
  assert.match(nativeFieldError({ ...input, type: 'url', validity: mismatch }), /đường dẫn/i);
  assert.equal(nativeFieldError({
    ...input, validity: { ...valid, valid: false, customError: true }, validationMessage: 'Lỗi tùy chỉnh',
  }), 'Lỗi tùy chỉnh');
  assert.equal(nativeFieldError({
    ...input, willValidate: false, validity: { ...valid, valid: false, valueMissing: true },
  }), '');
});

it('validates untouched fields on submit and revalidates on change', async () => {
  let submissions = 0;
  const form = new FormApi({ defaultValues: { code: '' }, onSubmit: () => { submissions += 1; } });
  const cleanupForm = form.mount();
  const field = new FieldApi({ form, name: 'code', validators: {
    onChange: ({ value }) => value.trim() ? undefined : 'Vui lòng nhập mã.',
  } });
  const cleanupField = field.mount();
  try {
    await form.handleSubmit();
    assert.equal(submissions, 0);
    assert.equal(firstFieldError(field.state.meta.errors), 'Vui lòng nhập mã.');
    field.handleChange('A');
    assert.equal(firstFieldError(field.state.meta.errors), '');
    await form.handleSubmit();
    assert.equal(submissions, 1);
  } finally {
    cleanupField();
    cleanupForm();
  }
});

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
  const form = new FormApi({ defaultValues: { code: 'AA', name: '' } });
  const cleanupForm = form.mount();
  const field = new FieldApi({ form, name: 'code', validators: {
    onChange: ({ value }) => value.length < 2 ? 'Tối thiểu 2 ký tự.' : undefined,
  } });
  const cleanupField = field.mount();
  const other = new FieldApi({ form, name: 'name' });
  const cleanupOther = other.mount();
  try {
    form.setFieldMeta('code', (prev) => ({ ...prev, errorMap: {
      ...prev.errorMap, onSubmit: 'Mã địa bàn đã tồn tại.',
    } }));
    assert.equal(firstFieldError(field.state.meta.errors), 'Mã địa bàn đã tồn tại.');
    other.handleChange('Khác');
    assert.equal(firstFieldError(field.state.meta.errors), 'Mã địa bàn đã tồn tại.');
    field.setErrorMap({ onSubmit: undefined });
    field.handleChange('B');
    assert.equal(field.state.meta.errorMap.onSubmit, undefined);
    assert.equal(firstFieldError(field.state.meta.errors), 'Tối thiểu 2 ký tự.');
    field.handleChange('BB');
    assert.deepEqual(field.state.meta.errors, []);
  } finally {
    cleanupOther();
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
