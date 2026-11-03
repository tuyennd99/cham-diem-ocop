# Shared Form & Field Controllers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo bộ form dùng chung với tám controller (`Input`, `Password`, `Textarea`, `Checkbox`, `Select`, `Combobox`, `MultiCombobox`, `DateRange`) và chuyển `LocalityFormDialog` sang bộ form này, giữ hành vi nghiệp vụ hiện có.

**Architecture:** Dùng context/hook chính thức của TanStack Form và tái dùng layout/control hiện có. Controller subscribe field value/errors và trạng thái đang lưu; số giữ kiểu cố định, lỗi server dùng metadata API có sẵn. DateRange dùng `React.lazy` và remount theo giá trị đã xác nhận; guard dùng `isDefaultValue`.

**Tech Stack:** Node `>=24.7 <25` theo `package.json` gốc; React 19; TypeScript 7; `@tanstack/react-form` 1.33.5 đang cài; Tailwind v4; Radix UI; Dice UI; `node:test`.

**Spec:** `design.md`, mục 1, 6, 7, 9 và 10; hành vi hiện có tại `apps/web/src/pages/admin/LocalitiesPanel.tsx:70-353`. Đọc cả hai trước khi thực thi.

## Global Constraints

- Không thêm npm dependency. Import `useStore`, `FormApi`, `FieldApi` và type từ `@tanstack/react-form`; không import trực tiếp dependency gián tiếp `@tanstack/react-store`.
- Theo `design.md`: “Label và input cách 4px, hàng form cách 12–16px, các nút cách 8px.”
- Theo `design.md`: “Desktop dùng chuột: button, input một dòng và select cao 36px”; “Textarea tối thiểu 80–96px”; “Trên màn hình nhỏ hoặc con trỏ thô, vùng bấm tối thiểu 44px.” Dùng token/CSS admin hiện có; không ép textarea hay MultiCombobox nhiều dòng cao 36px.
- Theo `design.md`: “Tiêu đề, tab và nút dùng sentence case tiếng Việt.” Lỗi giữ dữ liệu đã nhập; không thêm autosave.
- Label, hint, lỗi, `aria-invalid`, `aria-describedby`, `onBlur` phải gắn tới phần tử tương tác thật. Dùng `useId()` nếu caller không truyền ID; không chỉ dùng tên field vì nhiều form có thể cùng tên field.
- Guard giữ hành vi hiện tại bằng `open && !isDefaultValue`. Không dùng `isDirty`: sửa rồi khôi phục giá trị gốc vẫn làm thuộc tính đó true.
- Input số giữ `number | undefined`, input chữ giữ `string`. Không dùng `'' as unknown as number`, không suy đoán kiểu từ giá trị hiện tại, không ghi `NaN` vào state.
- Thay đổi thị giác chỉ thuộc vùng admin. Đợt này chỉ migrate `LocalityFormDialog`, giữ bảng và bộ lọc của LocalitiesPanel.
- Working tree đang có nhiều thay đổi từ trước. Đọc diff trước khi sửa, không hoàn tác hoặc commit lẫn thay đổi khác. Bước sửa kế hoạch này chỉ chỉnh tài liệu.

## Nguồn và quyết định đã kiểm chứng

- [TanStack/form — createFormHook](https://github.com/TanStack/form/blob/main/packages/react-form/src/createFormHook.tsx) và [form composition](https://tanstack.com/form/latest/docs/framework/react/guides/form-composition): chọn context/hook chính thức, không tự tạo registry/state mới. Đối chiếu source bản cài 1.33.5 ở `apps/web/node_modules/@tanstack/react-form/src/` trước khi dùng API mới từ tài liệu online.
- `ui/combobox.tsx` đã tìm kiếm tiếng Việt không dấu. Tái dùng; `ALL` trong `constants/consts.ts` thực tế là `'ALL'`, không phải `'__ALL__'`.
- Đã chạy FormApi/FieldApi thật: sửa `A → B → A` cho `isDirty: true`, `isDefaultValue: true`. `errors` được suy ra từ `errorMap`, không ghi thủ công. TanStack xóa submit error sau thay đổi hợp lệ; controller xóa slot `onSubmit` trước mỗi edit để đáp ứng yêu cầu xóa ngay cả khi giá trị mới chưa hợp lệ.
- [Node 24 module hooks](https://nodejs.org/download/release/v24.7.0/docs/api/module.html): resolver nhỏ chỉ dành cho test xử lý import `.ts` thiếu đuôi đang có. Cần `--experimental-transform-types` vì `ApiError` có parameter property. Không cài `tsx` hoặc sửa hàng loạt import production.
- DateRangePicker chưa có controlled API và chưa nhận props trigger. Thêm `triggerProps`, dùng `key` theo khoảng đã xác nhận để đồng bộ reset; giữ chọn nháp/Áp dụng/Hủy hiện có. Không cần viết lại picker.

## Bản đồ file và phụ thuộc

| File | Trách nhiệm |
| --- | --- |
| `apps/web/test/register-typescript.mjs` | Resolver test Node cho import tương đối và alias `@/`; không xử lý TSX |
| `apps/web/tsconfig.form-tests.json` | Kiểm tra kiểu test/fixture mới, tách khỏi production config |
| `apps/web/src/components/form/form-context.ts` | Context TanStack chính thức |
| `apps/web/src/components/form/form-errors.ts` | Chuẩn hóa lỗi và ID mô tả |
| `apps/web/src/components/form/field-values.ts` | Chuyển input số và type khoảng ngày |
| `apps/web/src/components/form/form-field-layout.tsx` | Layout, subscribe metadata và cập nhật field |
| `apps/web/src/components/form/fields/form-input.tsx` | Input chữ/số |
| `apps/web/src/components/form/fields/form-password.tsx` | PasswordInput adapter |
| `apps/web/src/components/form/fields/form-textarea.tsx` | Textarea adapter |
| `apps/web/src/components/form/fields/form-checkbox.tsx` | Checkbox boolean adapter |
| `apps/web/src/components/form/fields/form-select.tsx` | Select adapter |
| `apps/web/src/components/form/fields/form-combobox.tsx` | Single Combobox, clear và giá trị legacy |
| `apps/web/src/components/form/fields/form-multi-combobox.tsx` | MultiCombobox adapter |
| `apps/web/src/components/form/fields/form-date-range.tsx` | DateRangePicker adapter |
| `apps/web/src/components/multi-combobox.tsx` | Forward ARIA và blur đến input thật |
| `apps/web/src/components/range-picker/index.tsx` | Forward props đến trigger thật |
| `apps/web/src/components/form/app-form.tsx` | HTML form, vùng lỗi, submit/cancel |
| `apps/web/src/components/form/index.ts` | Hook factory và lazy DateRange |
| `apps/web/src/pages/admin/LocalitiesPanel.tsx` | Migrate riêng dialog |
| `apps/web/test/form-errors.test.ts`, `form-values.test.ts` | Test helper và TanStack metadata thật |
| `apps/web/test/form-contract.typecheck.tsx` | Fixture kiểm tra API TypeScript |

Thực thi tuần tự Task 1 → 2 → 3 → 4 → 5. Khuyến nghị thực thi trực tiếp vì các task dùng chung context/type. Chỉ giao agent độc lập khi người dùng chọn cách đó.

---

### Task 1: Test runner, context và hợp đồng lỗi/giá trị

**Files:**
- Create: `apps/web/test/register-typescript.mjs`
- Create: `apps/web/tsconfig.form-tests.json`
- Create: `apps/web/src/components/form/form-context.ts`
- Create: `apps/web/src/components/form/form-errors.ts`
- Create: `apps/web/src/components/form/field-values.ts`
- Create: `apps/web/test/form-errors.test.ts`
- Create: `apps/web/test/form-values.test.ts`

**Interfaces:**
- Produces: `fieldContext`, `formContext`, `useFieldContext<T>()`, `useFormContext()` từ `createFormHookContexts()`.
- Produces: `firstFieldError(errors: readonly unknown[]): string`.
- Produces: `resolveFieldDescribedBy(id: string, hasHint: boolean, hasError: boolean, hintId?: string, describedBy?: string): string | undefined`.
- Produces: `numberInputValue(raw: string, valueAsNumber: number): number | undefined`.
- Produces: `FormDateRangeValue = { fromDay: string; toDay: string }`.
- Không tạo wrapper `setFormFieldError`/`clearFormFieldServerError`; dùng `setFieldMeta`/`setErrorMap` có sẵn.

- [ ] **Step 1: Tạo resolver test và chạy baseline**

Nội dung `register-typescript.mjs`:

```js
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';

const sourceRoot = new URL('../src/', import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    const mapped = specifier.startsWith('@/')
      ? new URL(specifier.slice(2), sourceRoot).href : specifier;
    try {
      return nextResolve(mapped, context);
    } catch (error) {
      if (!['ERR_MODULE_NOT_FOUND', 'ERR_UNSUPPORTED_DIR_IMPORT'].includes(error.code)) throw error;
      if (!(mapped.startsWith('.') || mapped.startsWith('file:')) || extname(mapped)) throw error;
      for (const suffix of ['.ts', '/index.ts']) {
        const candidate = new URL(mapped + suffix, context.parentURL);
        if (existsSync(candidate)) return nextResolve(candidate.href, context);
      }
      throw error;
    }
  },
});
```

Chạy từ root, dùng đường dẫn tương đối cho `--import` để hoạt động trên Windows:

```bash
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/admin-catalogs.test.ts apps/web/test/admin-date.test.ts
```

Expected: 3 test pass. Cách chạy đã được smoke-test bằng resolver tạm trên Node 24.18.0 khi sửa kế hoạch. `--test-isolation=none` tránh tạo process con bị chặn trong môi trường hiện tại. Runner chỉ chạy logic `.ts`, không chạy JSX hoặc tương tác DOM.

- [ ] **Step 2: Viết failing tests bằng metadata thật**

`form-errors.test.ts`:

```ts
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
```

`form-values.test.ts`:

```ts
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { numberInputValue } from '../src/components/form/field-values.ts';

it('keeps numbers numeric after clearing and typing again', () => {
  let value: number | undefined = 12;
  value = numberInputValue('', NaN);
  assert.equal(value, undefined);
  value = numberInputValue('23', 23);
  assert.equal(value, 23);
  assert.equal(typeof value, 'number');
  assert.equal(numberInputValue('0', 0), 0);
  assert.equal(numberInputValue('-1.5', -1.5), -1.5);
  assert.equal(numberInputValue('1e', NaN), undefined);
  assert.equal(numberInputValue('1e999', Infinity), undefined);
});
```

- [ ] **Step 3: Xác nhận fail trước khi tạo helper**

```bash
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/form-errors.test.ts apps/web/test/form-values.test.ts
```

Expected: fail vì hai helper module chưa tồn tại. Không dùng typecheck thay cho test.

- [ ] **Step 4: Tạo context/helper nhỏ nhất**

`form-context.ts`:

```ts
import { createFormHookContexts } from '@tanstack/react-form';
export const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();
```

`form-errors.ts`:

```ts
export function firstFieldError(errors: readonly unknown[]): string {
  for (const error of errors) {
    if (typeof error === 'string' && error.trim()) return error.trim();
    if (Array.isArray(error)) {
      const message = firstFieldError(error);
      if (message) return message;
    } else if (error && typeof error === 'object' && 'message' in error) {
      if (typeof error.message === 'string' && error.message.trim()) return error.message.trim();
    }
  }
  return '';
}

export function resolveFieldDescribedBy(
  id: string, hasHint: boolean, hasError: boolean, hintId?: string, describedBy?: string,
): string | undefined {
  const ids = [hasError ? `${id}-error` : '', hasHint ? (hintId ?? `${id}-hint`) : '', describedBy ?? '']
    .join(' ').split(/\s+/).filter(Boolean);
  return [...new Set(ids)].join(' ') || undefined;
}
```

`field-values.ts`:

```ts
export type FormDateRangeValue = { fromDay: string; toDay: string };
export function numberInputValue(raw: string, valueAsNumber: number): number | undefined {
  return raw !== '' && Number.isFinite(valueAsNumber) ? valueAsNumber : undefined;
}
```

- [ ] **Step 5: Thêm test typecheck riêng và chạy green**

`tsconfig.form-tests.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "types": ["vite/client", "node"] },
  "include": ["test/form-errors.test.ts", "test/form-values.test.ts", "test/form-contract.typecheck.tsx"]
}
```

```bash
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/form-errors.test.ts apps/web/test/form-values.test.ts
pnpm --filter @ocop/web exec tsc --noEmit -p tsconfig.form-tests.json
pnpm --filter @ocop/web typecheck
```

Expected: 4 test pass và hai typecheck pass. Production config hiện chỉ include `src`; cấu hình mới bảo đảm test mới cũng được kiểm tra kiểu.

- [ ] **Step 6: Review diff và commit riêng khi thực thi**

```bash
git add apps/web/test/register-typescript.mjs apps/web/tsconfig.form-tests.json apps/web/src/components/form/form-context.ts apps/web/src/components/form/form-errors.ts apps/web/src/components/form/field-values.ts apps/web/test/form-errors.test.ts apps/web/test/form-values.test.ts
git diff --cached --stat
git commit -m "feat(web): add shared form context and tested field contracts"
```

---

### Task 2: Layout và bốn controller cơ bản

**Files:**
- Create: `apps/web/src/components/form/form-field-layout.tsx`
- Create: `apps/web/src/components/form/fields/form-input.tsx`
- Create: `apps/web/src/components/form/fields/form-password.tsx`
- Create: `apps/web/src/components/form/fields/form-textarea.tsx`
- Create: `apps/web/src/components/form/fields/form-checkbox.tsx`

**Interfaces:**
- Consumes: context/helper Task 1; `FormField`, `InputError`, Input/PasswordInput/Textarea/Checkbox hiện có.
- Produces: `BaseFieldLayoutProps`, `FormFieldLayout`, `useResolvedField<T>(id?: string)` như dưới.
- Produces: `FormInput`, `FormPassword`, `FormTextarea`, `FormCheckbox`. Field số dùng `number | undefined`; password/textarea dùng `string`; checkbox dùng `boolean`.

- [ ] **Step 1: Tạo layout và hook subscribe nhỏ**

Trong `form-field-layout.tsx`, import React `useId`/`ReactNode`, TanStack `useStore`, FormField/InputError, `cn` từ `@/lib/utils` và context/helper:

```tsx
export interface BaseFieldLayoutProps {
  label: ReactNode;
  id?: string;
  hint?: ReactNode;
  hintId?: string;
  optional?: ReactNode;
  required?: boolean;
  className?: string;
  'aria-describedby'?: string;
}

export function useResolvedField<T>(customId?: string) {
  const generatedId = useId();
  const field = useFieldContext<T>();
  const value = useStore(field.store, (state) => state.value);
  const errors = useStore(field.store, (state) => state.meta.errors);
  const isSubmitting = useStore(field.form.store, (state) => state.isSubmitting);
  return {
    field, value, isSubmitting, id: customId ?? generatedId, error: firstFieldError(errors),
    handleChange(next: T) {
      field.setErrorMap({ onSubmit: undefined });
      field.handleChange(next);
    },
    handleBlur: field.handleBlur,
  };
}

export function FormFieldLayout({
  id, label, hint, hintId, optional, required, className, error, children,
}: BaseFieldLayoutProps & { id: string; error: string; children: ReactNode }) {
  return <FormField htmlFor={id} label={label} hint={hint} hintId={hintId}
    optional={optional} required={required} className={cn('gap-1', className)}>
    {children}
    <InputError id={`${id}-error`} role='alert' message={error} />
  </FormField>;
}
```

Không subscribe toàn bộ `form.values` trong hook/layout. FormField hiện mặc định `gap-1.5` (6px), nên layout mới truyền `gap-1` để đạt 4px; không sửa spacing toàn cục của FormField đang dùng chung. Chiều cao control tiếp tục theo CSS admin hiện có.

- [ ] **Step 2: Tạo Input, giữ nhánh kiểu theo prop cố định**

Import `Input` từ `@/components/ui/input`, `InputProps` từ `@/types/ui`, và layout/helper của Task 1–2:

```tsx
type NativeInputProps = Omit<InputProps,
  'id' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'type' | 'aria-invalid'>;
type FormInputProps = BaseFieldLayoutProps & NativeInputProps & (
  { type: 'number'; onValueChange?: (value: number | undefined) => void } |
  { type?: 'text' | 'email' | 'tel' | 'url' | 'search'; onValueChange?: (value: string) => void }
);

export function FormInput(props: FormInputProps) {
  const meta = useResolvedField<string | number | undefined>(props.id);
  const { label, hint, hintId, optional, required, className, id: _id,
    onValueChange: _onValueChange, ...inputProps } = props;
  return <FormFieldLayout id={meta.id} label={label} hint={hint} hintId={hintId}
    optional={optional} required={required} className={className} error={meta.error}>
    <Input {...inputProps} id={meta.id} name={meta.field.name} required={required}
      value={meta.value ?? ''} disabled={props.disabled || meta.isSubmitting}
      aria-invalid={Boolean(meta.error)} onBlur={meta.handleBlur}
      aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(hint), Boolean(meta.error), hintId, props['aria-describedby'])}
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
      }} />
  </FormFieldLayout>;
}
```

Caller khai báo defaultValues đúng loại field; không truyền field số vào controller chuỗi. Không hỗ trợ file/radio/range input qua controller này.

- [ ] **Step 3: Tạo Password, Textarea và Checkbox**

Hợp đồng props, import `ComponentProps` từ React:

```tsx
type FormPasswordProps = BaseFieldLayoutProps & Omit<ComponentProps<typeof PasswordInput>,
  'id' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'aria-invalid'>;
type FormTextareaProps = BaseFieldLayoutProps & Omit<ComponentProps<typeof Textarea>,
  'id' | 'name' | 'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'aria-invalid'>;
type FormCheckboxProps = BaseFieldLayoutProps & { disabled?: boolean };
```

Tạo export function tên tương ứng trong từng file. Tách props layout `{ label, hint, hintId, optional, required, className, id, ...controlProps }`, gọi hook đúng type, và trả FormFieldLayout với control bên trong:

```tsx
// FormPassword: const meta = useResolvedField<string>(id);
<PasswordInput {...controlProps} id={meta.id} name={meta.field.name} value={meta.value}
  required={required} disabled={controlProps.disabled || meta.isSubmitting}
  onChange={(event) => meta.handleChange(event.currentTarget.value)} onBlur={meta.handleBlur}
  aria-invalid={Boolean(meta.error)}
  aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(hint), Boolean(meta.error), hintId, controlProps['aria-describedby'])} />

// FormTextarea: const meta = useResolvedField<string>(id);
<Textarea {...controlProps} id={meta.id} name={meta.field.name} value={meta.value}
  required={required} disabled={controlProps.disabled || meta.isSubmitting}
  onChange={(event) => meta.handleChange(event.currentTarget.value)} onBlur={meta.handleBlur}
  aria-invalid={Boolean(meta.error)}
  aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(hint), Boolean(meta.error), hintId, controlProps['aria-describedby'])} />

// FormCheckbox: const meta = useResolvedField<boolean>(id);
<Checkbox id={meta.id} name={meta.field.name} checked={meta.value} required={required}
  disabled={controlProps.disabled || meta.isSubmitting}
  onCheckedChange={(checked) => meta.handleChange(checked === true)} onBlur={meta.handleBlur}
  aria-invalid={Boolean(meta.error)}
  aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(hint), Boolean(meta.error), hintId, controlProps['aria-describedby'])} />
```

FormFieldLayout nhận đủ label/hint/optional/required/className vừa tách, `id={meta.id}`, `error={meta.error}`. Checkbox không lưu `'indeterminate'` vào boolean, không áp chiều cao text input cho ô checkbox.

- [ ] **Step 4: Kiểm tra task và commit**

```bash
pnpm --filter @ocop/web typecheck
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/form-errors.test.ts apps/web/test/form-values.test.ts
git add apps/web/src/components/form/form-field-layout.tsx apps/web/src/components/form/fields/form-input.tsx apps/web/src/components/form/fields/form-password.tsx apps/web/src/components/form/fields/form-textarea.tsx apps/web/src/components/form/fields/form-checkbox.tsx
git diff --cached --stat
git commit -m "feat(web): add shared form layout and basic controllers"
```

Expected: typecheck pass, 4 test pass trước commit. Kiểm tra kiểu không chứng minh DOM/accessibility; nghiệm thu tương tác ở Task 5.

---

### Task 3: Controller lựa chọn/ngày và primitive accessibility

**Files:**
- Modify: `apps/web/src/components/multi-combobox.tsx:22-69`
- Modify: `apps/web/src/components/range-picker/index.tsx:32-53,88-97,270-289`
- Create: `apps/web/src/components/form/fields/form-select.tsx`
- Create: `apps/web/src/components/form/fields/form-combobox.tsx`
- Create: `apps/web/src/components/form/fields/form-multi-combobox.tsx`
- Create: `apps/web/src/components/form/fields/form-date-range.tsx`

**Interfaces:**
- Consumes: `BaseFieldLayoutProps`, `useResolvedField<T>`, `FormDateRangeValue`, `resolveFieldDescribedBy`.
- Produces: bốn controller theo props bên dưới; MultiCombobox nhận thêm input accessibility/blur; RangePicker nhận `triggerProps`. Props cũ giữ nguyên.

- [ ] **Step 1: Bổ sung forwarding tại hai primitive**

Thêm vào `MultiComboboxProps`, import React types:

```tsx
'aria-invalid'?: AriaAttributes['aria-invalid'];
'aria-describedby'?: string;
'aria-required'?: boolean;
onBlur?: FocusEventHandler<HTMLInputElement>;
name?: string;
```

Destructure `'aria-invalid': ariaInvalid`, `'aria-describedby': ariaDescribedBy`, `'aria-required': ariaRequired`, `onBlur`, `name`; cập nhật input thật, giữ tags/options hiện có:

```tsx
<ComboboxInput id={id} name={name} onBlur={onBlur}
  aria-invalid={ariaInvalid} aria-describedby={ariaDescribedBy} aria-required={ariaRequired}
  placeholder={selectedOptions.length > 0 ? searchPlaceholder : placeholder}
  className='h-auto min-w-20 flex-1' />
```

Không dùng native `required` cho input tìm kiếm: ô query có thể rỗng dù mảng đã có lựa chọn. Validator mảng kiểm tra `value.length`.

RangePicker thêm prop sau, import `ComponentProps` từ React:

```tsx
triggerProps?: Omit<ComponentProps<typeof Button>, 'children' | 'type'>;
```

Destructure `triggerProps` trong DateRangePicker. Trên Button trigger hiện có, thêm spread trước props cố định và gộp className:

```tsx
<Button {...triggerProps} type='button' variant={triggerProps?.variant ?? 'outline'}
  className={cn('h-9 min-h-9 w-full justify-between gap-2 px-3 font-normal',
    !range.from && 'text-muted-foreground', triggerProps?.className)}>
  {/* Giữ nguyên children hiện có của Button trigger. */}
</Button>
```

Không sửa cơ chế chọn nháp/Áp dụng/Hủy hay ép caller cũ đổi props. `disabled`, `id`, ARIA, `onBlur` phải đến Button thật.

- [ ] **Step 2: Tạo Select/Combobox với sentinel chỉ ở biên UI**

```tsx
export interface FormSelectOption { value: string; label: string; disabled?: boolean }
export type FormSelectProps = BaseFieldLayoutProps & {
  options: FormSelectOption[]; placeholder?: string; disabled?: boolean;
  allowEmpty?: boolean; emptyLabel?: string; onValueChange?: (value: string) => void;
};
export type FormComboboxProps = BaseFieldLayoutProps & {
  options: SimpleComboboxOption[]; placeholder?: string; emptyText?: string; disabled?: boolean;
  allowClear?: boolean; clearLabel?: string; preserveUnknownValue?: boolean;
  onValueChange?: (value: string) => void;
};
```

Import option type từ `simple-combobox.tsx`, `ALL` từ `constants/consts.ts`. Trong từng function, dùng `useResolvedField<string>(props.id)` và FormFieldLayout bao control. Option values không rỗng; `ALL` được dành riêng cho lựa chọn clear của Combobox, không dùng làm mã danh mục ở caller này.

Binding Select, import Select/Trigger/Value/Content/Item từ UI hiện có:

```tsx
const emptyValue = `${meta.id}-empty`;
<Select value={meta.value || ''} disabled={props.disabled || meta.isSubmitting}
  onValueChange={(value) => {
    const next = value === emptyValue ? '' : value;
    meta.handleChange(next);
    props.onValueChange?.(next);
  }}>
  <SelectTrigger id={meta.id} onBlur={meta.handleBlur} aria-required={props.required}
    aria-invalid={Boolean(meta.error)}
    aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(props.hint), Boolean(meta.error), props.hintId, props['aria-describedby'])}>
    <SelectValue placeholder={props.placeholder ?? 'Chọn giá trị'} />
  </SelectTrigger>
  <SelectContent>
    {props.allowEmpty && <SelectItem value={emptyValue}>{props.emptyLabel ?? 'Bỏ chọn'}</SelectItem>}
    {meta.value && !props.options.some((option) => option.value === meta.value) &&
      <SelectItem value={meta.value}>{meta.value}</SelectItem>}
    {props.options.map((option) => <SelectItem key={option.value} value={option.value}
      disabled={option.disabled}>{option.label}</SelectItem>)}
  </SelectContent>
</Select>
```

Select dùng `''` để hiện placeholder; không tạo `SelectItem value=''`.

Binding Combobox, import các primitive `ui/combobox`:

```tsx
<Combobox value={meta.value || ''} disabled={props.disabled || meta.isSubmitting} autoHighlight
  onValueChange={(value) => {
    const next = value === ALL ? '' : value;
    meta.handleChange(next);
    props.onValueChange?.(next);
  }}>
  <ComboboxAnchor>
    <ComboboxInput id={meta.id} name={meta.field.name} placeholder={props.placeholder ?? 'Chọn giá trị'}
      onBlur={meta.handleBlur} aria-required={props.required} aria-invalid={Boolean(meta.error)}
      aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(props.hint), Boolean(meta.error), props.hintId, props['aria-describedby'])} />
    <ComboboxTrigger aria-label='Mở danh sách lựa chọn' />
  </ComboboxAnchor>
  <ComboboxContent>
    <ComboboxEmpty>{props.emptyText ?? 'Không tìm thấy.'}</ComboboxEmpty>
    {props.allowClear && <ComboboxItem value={ALL}>{props.clearLabel ?? 'Bỏ chọn'}</ComboboxItem>}
    {props.preserveUnknownValue && meta.value && !props.options.some((option) => option.value === meta.value) &&
      <ComboboxItem value={meta.value}>{meta.value}</ComboboxItem>}
    {props.options.map((option) => <ComboboxItem key={option.value} value={option.value}
      label={option.label} disabled={option.disabled}>{option.label}</ComboboxItem>)}
  </ComboboxContent>
</Combobox>
```

Không lưu sentinel trong form. Không viết lại tìm kiếm không dấu hoặc dùng native required trên input tìm kiếm. `preserveUnknownValue` chỉ dùng cho giá trị legacy đang hiển thị rõ, không để giữ xã của tỉnh trước sau khi đổi tỉnh.

- [ ] **Step 3: Tạo MultiCombobox và DateRange adapters**

```tsx
export type FormMultiComboboxProps = BaseFieldLayoutProps & Omit<MultiComboboxProps,
  'id' | 'name' | 'value' | 'onChange' | 'onBlur' | 'aria-invalid' | 'aria-required'>;
export type FormDateRangeProps = BaseFieldLayoutProps & {
  disabled?: boolean; align?: RangePickerProps['align'];
  disablePast?: boolean; disableFuture?: boolean; disabledDates?: RangePickerProps['disabledDates'];
};
```

MultiCombobox dùng `useResolvedField<string[]>(props.id)`. Tách props layout khỏi `controlProps` trước khi spread; đặt control dưới FormFieldLayout:

```tsx
<MultiCombobox {...controlProps} id={meta.id} name={meta.field.name}
  value={meta.value} onChange={meta.handleChange} onBlur={meta.handleBlur}
  disabled={props.disabled || meta.isSubmitting} aria-required={props.required}
  aria-invalid={Boolean(meta.error)}
  aria-describedby={resolveFieldDescribedBy(meta.id, Boolean(props.hint), Boolean(meta.error), props.hintId, props['aria-describedby'])} />
```

DateRange dùng `useResolvedField<FormDateRangeValue>(props.id)` và `format` từ date-fns. Đặt control dưới FormFieldLayout:

```tsx
const today = format(new Date(), 'yyyy-MM-dd');
const { fromDay, toDay } = meta.value;
<DateRangePicker key={`${fromDay}|${toDay}`}
  initialDateFrom={fromDay || today} initialDateTo={toDay || fromDay || today}
  align={props.align ?? 'start'} disablePast={props.disablePast}
  disableFuture={props.disableFuture} disabledDates={props.disabledDates}
  triggerProps={{
    id: meta.id, disabled: props.disabled || meta.isSubmitting,
    'aria-invalid': Boolean(meta.error), 'aria-required': props.required,
    'aria-describedby': resolveFieldDescribedBy(meta.id, Boolean(props.hint), Boolean(meta.error), props.hintId, props['aria-describedby']),
    onBlur: meta.handleBlur,
  }}
  onUpdate={({ range }) => {
    meta.handleChange({
      fromDay: format(range.from, 'yyyy-MM-dd'),
      toDay: format(range.to ?? range.from, 'yyyy-MM-dd'),
    });
    meta.handleBlur();
  }} />
```

Export `FormDateRange` theo tên. Key đổi khi khoảng đã xác nhận đổi hoặc reset về khoảng khác, bỏ nháp cũ và remount picker. Không ghi fallback ngày hiển thị vào form: `toDay: ''` vẫn rỗng đến khi người dùng Áp dụng thay đổi. Hủy/đóng popover không ghi form.

- [ ] **Step 4: Kiểm tra callers, test và typecheck**

```bash
rg -n 'MultiCombobox|DateRangePicker' apps/web/src
pnpm --filter @ocop/web typecheck
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/form-errors.test.ts apps/web/test/form-values.test.ts apps/web/test/admin-date.test.ts
```

Expected: caller cũ không cần đổi props, typecheck pass, 6 test pass. Kiểm tra DOM và reset tại Task 5.

- [ ] **Step 5: Commit riêng, chỉ stage hunk mới ở primitive**

```bash
git add -p apps/web/src/components/multi-combobox.tsx apps/web/src/components/range-picker/index.tsx
git add apps/web/src/components/form/fields/form-select.tsx apps/web/src/components/form/fields/form-combobox.tsx apps/web/src/components/form/fields/form-multi-combobox.tsx apps/web/src/components/form/fields/form-date-range.tsx
git diff --cached --stat
git commit -m "feat(web): add accessible selection and date controllers"
```

---

### Task 4: Hook factory, form shell và hợp đồng TypeScript

**Files:**
- Create: `apps/web/src/components/form/app-form.tsx`
- Create: `apps/web/src/components/form/index.ts`
- Create: `apps/web/test/form-contract.typecheck.tsx`

**Interfaces:**
- Consumes: Task 2–3 controllers; `fieldContext`, `formContext`, `useFormContext`.
- Produces: `useAppForm`, `withForm`, `AppForm`, `FormSubmitButton`, `FormActions`.
- `AppFormProps = { form: AnyFormApi; error?: string; errorTitle?: string; className?: string; children: ReactNode }`.
- `FormSubmitButtonProps = Omit<ButtonProps, 'type'> & { busyLabel?: ReactNode }`.
- `FormActionsProps = { submitLabel: ReactNode; busyLabel?: ReactNode; cancelLabel?: ReactNode; onCancel?: () => void; disabled?: boolean; children?: ReactNode }`.

- [ ] **Step 1: Viết typecheck fixture trước entry**

`form-contract.typecheck.tsx`:

```tsx
import { AppForm, useAppForm } from '../src/components/form/index';

export function FormContract() {
  const form = useAppForm({ defaultValues: {
    code: '', password: '', note: '', count: undefined as number | undefined,
    enabled: false, province: '', role: '', tags: [] as string[],
    dateRange: { fromDay: '2026-11-02', toDay: '' },
  } });
  if (false) {
    // @ts-expect-error: field name must exist
    form.setFieldValue('missing', 'x');
    // @ts-expect-error: numeric fields cannot receive strings
    form.setFieldValue('count', '12');
  }
  return <AppForm form={form}>
    <form.AppField name='code'>{(field) => <field.Input label='Mã' />}</form.AppField>
    <form.AppField name='count'>{(field) => <field.Input label='Số lượng' type='number' />}</form.AppField>
    <form.AppField name='password'>{(field) => <field.Password label='Mật khẩu' />}</form.AppField>
    <form.AppField name='note'>{(field) => <field.Textarea label='Ghi chú' />}</form.AppField>
    <form.AppField name='enabled'>{(field) => <field.Checkbox label='Đang hoạt động' />}</form.AppField>
    <form.AppField name='role'>{(field) => <field.Select label='Vai trò' options={[]} allowEmpty />}</form.AppField>
    <form.AppField name='province'>{(field) => <field.Combobox label='Tỉnh' options={[]} allowClear />}</form.AppField>
    <form.AppField name='tags'>{(field) => <field.MultiCombobox label='Nhãn' options={[]} />}</form.AppField>
    <form.AppField name='dateRange'>{(field) => <field.DateRange label='Thời gian mở' />}</form.AppField>
    <form.Actions submitLabel='Lưu' onCancel={() => form.reset()} />
  </AppForm>;
}
```

Run: `pnpm --filter @ocop/web exec tsc --noEmit -p tsconfig.form-tests.json`.
Expected: fail vì entry chưa tồn tại. Không đưa TSX fixture vào lệnh Node test.

- [ ] **Step 2: Tạo shell và hành động dùng context**

Trong `app-form.tsx`, import `AnyFormApi`, `useStore`, React types/useState, Button/`ButtonProps`, AlertError, `messageOf`, formContext/useFormContext. Dùng đúng props đã khai báo ở Interfaces:

```tsx
export function AppForm({ form, error, errorTitle = 'Không thể lưu', className, children }: AppFormProps) {
  const [unexpectedError, setUnexpectedError] = useState('');
  const message = error || unexpectedError;
  return <formContext.Provider value={form}>
    <form className={className} onSubmit={(event) => {
      event.preventDefault();
      event.stopPropagation();
      if (form.state.isSubmitting) return;
      setUnexpectedError('');
      void form.handleSubmit().catch((cause: unknown) => setUnexpectedError(messageOf(cause)));
    }}>
      {children}
      {message && <AlertError title={errorTitle} errors={[message]} />}
    </form>
  </formContext.Provider>;
}

export function FormSubmitButton({ busyLabel = 'Đang lưu…', disabled, children, ...props }: FormSubmitButtonProps) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  return <Button {...props} type='submit' loading={isSubmitting}
    disabled={disabled || isSubmitting || !canSubmit}>{isSubmitting ? busyLabel : children}</Button>;
}

export function FormActions({ submitLabel, busyLabel, cancelLabel = 'Đóng', onCancel, disabled, children }: FormActionsProps) {
  const form = useFormContext();
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  return <div className='admin-actions'>
    <FormSubmitButton busyLabel={busyLabel} disabled={disabled}>{submitLabel}</FormSubmitButton>
    {onCancel && <Button type='button' variant='secondary' disabled={disabled || isSubmitting}
      onClick={onCancel}>{cancelLabel}</Button>}
    {children}
  </div>;
}
```

Provider là bắt buộc cho `<form.Actions>`. Không tạo `<form.Form>` chỉ để chuyển tiếp props; không lồng hai HTML form. Callback nghiệp vụ vẫn xử lý lỗi field/HTTP; shell bắt lỗi bất ngờ để không có Promise rejection không được xử lý.

- [ ] **Step 3: Tạo factory, lazy-load DateRange thật sự**

Trong `index.ts`, import `createFormHook`, React `createElement`/`lazy`/`Suspense`, các controller nhẹ, context và form components. Import `FormDateRangeProps` bằng `import type`:

```ts
const LazyDateRange = lazy(() => import('./fields/form-date-range').then((module) => ({
  default: module.FormDateRange,
})));
function DateRangeField(props: FormDateRangeProps) {
  return createElement(Suspense, {
    fallback: createElement('p', { role: 'status' }, 'Đang tải lịch…'),
    children: createElement(LazyDateRange, props),
  });
}
export const { useAppForm, withForm } = createFormHook({
  fieldContext, formContext,
  fieldComponents: {
    Input: FormInput, Password: FormPassword, Textarea: FormTextarea, Checkbox: FormCheckbox,
    Select: FormSelect, Combobox: FormCombobox, MultiCombobox: FormMultiCombobox, DateRange: DateRangeField,
  },
  formComponents: { SubmitButton: FormSubmitButton, Actions: FormActions },
});
export { AppForm } from './app-form';
```

Dùng createElement vì entry là `.ts`. Không static import picker vào registry: chỉ tách file không tạo chunk riêng.

- [ ] **Step 4: Kiểm tra hợp đồng, test và build**

```bash
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec tsc --noEmit -p tsconfig.form-tests.json
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/form-errors.test.ts apps/web/test/form-values.test.ts
pnpm --filter @ocop/web build
```

Expected: hai typecheck pass, 4 test pass, build pass; build tạo chunk tải động chứa picker. Không dùng build thay thế tsc.

- [ ] **Step 5: Review và commit task**

```bash
git add apps/web/src/components/form/app-form.tsx apps/web/src/components/form/index.ts apps/web/test/form-contract.typecheck.tsx
git diff --cached --stat
git commit -m "feat(web): expose composed app forms and submit actions"
```

---

### Task 5: Migrate LocalityFormDialog và nghiệm thu

**Files:**
- Modify: `apps/web/src/pages/admin/LocalitiesPanel.tsx:70-353`
- Test: `apps/web/test/form-errors.test.ts`, `form-values.test.ts`, `admin-catalogs.test.ts`, `admin-date.test.ts`
- Verify: `apps/web/test/form-contract.typecheck.tsx`

**Interfaces:**
- Consumes: `useAppForm`, `AppForm`, `useStore`; `LocalityFormDialogProps` không đổi.
- Produces: cùng `onCreate(CreateLocalityInput)`, `onUpdate(id, UpdateLocalityInput)` và `onSaved` đang có; không đổi API/backend.
- `LocalityFormValues = { code: string; name: string; type: LocalityType; provinceName: string; dateRange: FormDateRangeValue }`.

- [ ] **Step 1: Chuyển defaults, giữ dữ liệu legacy**

Giữ `todayYmd` và các hàm ngày Việt Nam hiện có. Bỏ bảy state field/error field và `busy` riêng, giữ state lỗi toàn form. Defaults:

```tsx
const defaultValues: LocalityFormValues = {
  code: locality?.code ?? '', name: locality?.name ?? '', type: locality?.type ?? 'COMMUNE',
  provinceName: locality?.provinceName ?? '',
  dateRange: {
    fromDay: locality?.effectiveFrom ? vietnameseDateInput(locality.effectiveFrom) : todayYmd,
    toDay: locality?.effectiveTo ? vietnameseInclusiveEndInput(locality.effectiveTo) : '',
  },
};
```

Giữ field `type` làm fallback cho locality legacy ngoài options. Parent đang mount dialog có điều kiện; giữ cách đó để locality khác không nhận state cũ.

- [ ] **Step 2: Chuyển submit và guard**

Truyền `defaultValues` và callback sau vào `useAppForm`. `wardsInSelectedProvince` lấy bằng subscription ở dưới; callback chỉ chạy sau render:

```tsx
onSubmit: async ({ value, formApi }) => {
  setError('');
  try {
    const effectiveFrom = value.dateRange.fromDay ? vietnameseDayStartIso(value.dateRange.fromDay) : null;
    const effectiveTo = value.dateRange.toDay ? nextVietnameseDayIso(value.dateRange.toDay) : null;
    if (effectiveFrom && effectiveTo && Date.parse(effectiveFrom) >= Date.parse(effectiveTo)) {
      throw new Error('Thời điểm kết thúc phải sau thời điểm bắt đầu.');
    }
    const ward = wardsInSelectedProvince.find((item) => item.name_with_type === value.name || item.name === value.name);
    const resolvedType: LocalityType = ward
      ? ward.type === 'phuong' ? 'WARD' : 'COMMUNE'
      : value.name.startsWith('Phường') ? 'WARD' : value.type;
    const common = {
      name: value.name, type: resolvedType, provinceName: value.provinceName,
      effectiveFrom, effectiveTo, isActive: true,
    };
    if (locality) {
      await onUpdate(locality.id, { ...common, reason: `Cập nhật địa bàn ${value.name} (${value.provinceName})` });
      onSaved(`Đã cập nhật địa bàn ${value.name}.`);
    } else {
      await onCreate({ ...common, code: value.code.trim(), reason: `Thêm địa bàn ${value.name} (${value.provinceName})` });
      onSaved(`Đã thêm địa bàn ${value.name} vào danh mục.`);
    }
    onOpenChange(false);
  } catch (cause) {
    if (!locality && cause instanceof ApiError && cause.status === HTTP_STATUS.CONFLICT) {
      formApi.setFieldMeta('code', (prev) => ({ ...prev, errorMap: {
        ...prev.errorMap, onSubmit: 'Mã địa bàn đã tồn tại. Vui lòng nhập mã khác.',
      } }));
    } else {
      setError(messageOf(cause));
    }
  }
},
```

Thêm subscription ngoài callback, import `FormDateRangeValue` bằng type và `useStore` từ react-form:

```tsx
const provinceName = useStore(form.store, (state) => state.values.provinceName);
const wardsInSelectedProvince = useWardsByProvince(provinceName);
const isDefaultValue = useStore(form.store, (state) => state.isDefaultValue);
const busy = useStore(form.store, (state) => state.isSubmitting);
const dirty = open && !isDefaultValue;
useBlocker({
  shouldBlockFn: () => dirty && !window.confirm('Biểu mẫu địa bàn có thay đổi chưa lưu. Rời trang và bỏ thay đổi?'),
  enableBeforeUnload: () => dirty,
});
```

Giữ `requestOpenChange` hiện có với busy/dirty mới; lưu thành công vẫn gọi trực tiếp `onOpenChange(false)` để không hỏi bỏ thay đổi vừa lưu. Không subscribe toàn bộ `state.values` trong dialog.

- [ ] **Step 3: Chuyển JSX và callback liên trường**

```tsx
<AppForm form={form} className='admin-form account-form' error={error} errorTitle='Không thể lưu địa bàn'>
  <form.AppField name='code' validators={{
    onSubmit: ({ value }) => !value.trim() ? 'Vui lòng nhập mã địa bàn.' : undefined,
  }}>{(field) => <field.Input id='locality-code' label={isEdit ? 'Mã địa bàn (bất biến)' : 'Mã địa bàn'}
    placeholder='Nhập mã địa bàn' maxLength={50} required disabled={isEdit} />}</form.AppField>
  <form.AppField name='provinceName' validators={{
    onSubmit: ({ value }) => !value.trim() ? 'Vui lòng chọn tỉnh / thành phố.' : undefined,
  }}>{(field) => <field.Combobox id='locality-province' label='Tỉnh / thành phố' required
    options={ADMINISTRATIVE_PROVINCES.map((item) => ({ value: item.name_with_type, label: item.name_with_type }))}
    allowClear preserveUnknownValue placeholder='Chọn tỉnh / thành phố trước'
    onValueChange={() => form.setFieldValue('name', '')} />}</form.AppField>
  <form.AppField name='name' validators={{
    onSubmit: ({ value }) => !value.trim() ? 'Vui lòng chọn xã / phường.' : undefined,
  }}>{(field) => <field.Combobox id='locality-name' label='Xã / phường' required
    options={wardsInSelectedProvince.map((item) => ({ value: item.name_with_type, label: item.name_with_type }))}
    disabled={!provinceName} allowClear preserveUnknownValue
    placeholder={provinceName ? 'Chọn xã / phường trong tỉnh…' : 'Chọn tỉnh / thành phố trước'}
    onValueChange={(value) => {
      const ward = wardsInSelectedProvince.find((item) => item.name_with_type === value || item.name === value);
      if (!ward) return;
      form.setFieldValue('type', ward.type === 'phuong' ? 'WARD' : 'COMMUNE');
      if (!isEdit && !form.state.values.code.trim()) {
        form.setFieldMeta('code', (prev) => ({ ...prev, errorMap: { ...prev.errorMap, onSubmit: undefined } }));
        form.setFieldValue('code', `XP-${ward.code}`);
      }
    }} />}</form.AppField>
  <form.AppField name='dateRange'>{(field) => <field.DateRange label='Thời gian mở' />}</form.AppField>
  <form.Actions submitLabel={isEdit ? 'Lưu địa bàn' : 'Thêm địa bàn'} onCancel={() => requestOpenChange(false)} />
</AppForm>
```

Controller cập nhật field trước khi gọi `onValueChange`. Đổi tỉnh xóa xã ngay; chọn xã chỉ sinh mã nếu tạo mới và mã đang trống. Code edit luôn disabled, không có trong update payload. Validator submit phải chặn thiếu tỉnh/xã dù field chưa được chạm; native required của ô tìm kiếm không thay thế validation này.

- [ ] **Step 4: Chạy kiểm tra tự động**

```bash
pnpm --filter @ocop/web typecheck
pnpm --filter @ocop/web exec tsc --noEmit -p tsconfig.form-tests.json
node --experimental-transform-types --import ./apps/web/test/register-typescript.mjs --test --test-isolation=none apps/web/test/form-errors.test.ts apps/web/test/form-values.test.ts apps/web/test/admin-catalogs.test.ts apps/web/test/admin-date.test.ts
pnpm --filter @ocop/web build
```

Expected: hai typecheck và build pass; 7 test pass. Nếu baseline có lỗi không liên quan, ghi file/lỗi cụ thể, không tự mở rộng scope sửa toàn repo.

- [ ] **Step 5: Nghiệm thu trình duyệt và ghi bằng chứng**

Dùng `/admin/localities`, DevTools Network/Elements/Accessibility; dùng React DevTools Profiler nếu đã có. Không cài thư viện DOM test trong task này.

| Thao tác | Kết quả phải có |
| --- | --- |
| Mở form rồi đóng ngay; sửa mã rồi trả về giá trị ban đầu và đóng | Không hỏi bỏ thay đổi |
| Đổi dữ liệu rồi nhấn Đóng/Escape/Back/reload | Có cảnh báo phù hợp; hủy giữ dữ liệu; đang lưu không đóng dialog |
| Submit thiếu tỉnh hoặc xã | Không có request tạo/sửa; lỗi tiếng Việt ở field tương ứng |
| Đổi tỉnh | Xã bị xóa, options đổi theo tỉnh, không giữ xã cũ ngầm |
| Bỏ chọn tỉnh/xã | Form nhận chuỗi rỗng; không lưu `ALL`; placeholder hiện đúng; submit bị validator chặn |
| Chọn xã khi mã rỗng ở chế độ thêm | Sinh `XP-<ward.code>`, suy ra WARD/COMMUNE; mã đã nhập không bị ghi đè |
| Sửa locality legacy ngoài options | Tỉnh/xã hiện đúng; code bất biến; payload update không chứa code |
| API tạo trả 409 rồi sửa mã | Lỗi ngay dưới mã, xóa khi edit; dữ liệu khác giữ; gửi lại được |
| API lỗi khác hoặc lỗi mạng | AlertError hiện, dữ liệu giữ, hết loading, gửi lại được |
| Chọn khoảng ngày rồi Hủy/Escape | Giá trị form và payload không đổi |
| Áp dụng khoảng khác, gọi `form.reset()` qua debugger | Nút lịch và lần mở tiếp phản ánh defaults, không giữ khoảng vừa chọn |
| Giữ `toDay: ''`, chỉ sửa mã/tên rồi lưu | `effectiveTo: null`, không tự biến thành ngày hiện tại |
| Chọn cùng ngày đầu/cuối | Gửi đầu ngày `+07:00` và đầu ngày kế tiếp làm kết thúc exclusive |
| Tab đến label/control, dùng mũi tên/Enter chọn xã | Label liên kết control thật, bàn phím hoạt động trong Dialog |
| Inspect mã/combobox/nút lịch có hint/lỗi | ID không trùng, ARIA trỏ đúng phần tử thật, lỗi có `role=alert` |
| Gõ mã trong Profiler | Không subscribe toàn bộ values làm field độc lập render theo từng phím; đổi tỉnh được phép cập nhật xã phụ thuộc |
| Xem ở 320, 375, 414, 768, 1024, 1440px | Không tràn ngang; 36px desktop và vùng bấm 44px màn nhỏ/con trỏ thô; lỗi dài không kéo cao input |

Các controller chưa có caller thật (Password/Textarea/Checkbox/Select/MultiCombobox/input số) mới có kiểm tra kiểu và helper logic trong đợt này. Không ghi nhận chúng đã pass tương tác trình duyệt; khi dùng ở form thật, nghiệm thu blur validation, bàn phím, ARIA và disabled tại caller đó.

- [ ] **Step 6: Review và commit migration riêng**

```bash
git add -p apps/web/src/pages/admin/LocalitiesPanel.tsx
git diff --cached --stat
git commit -m "refactor(web): migrate locality dialog to shared form controllers"
```

## Tự rà soát trước bàn giao

Các mục đã đánh dấu dưới đây là kiểm tra nội dung kế hoạch, không phải trạng thái triển khai:

- [x] Đã nêu đủ tám controller, một nguồn form state và dynamic import cho DateRange.
- [x] Hợp đồng số dựa trên prop `type`, rỗng là `undefined`, DOM hiển thị `''`; không ép kiểu che lỗi runtime.
- [x] Test mẫu dùng FormApi/FieldApi thật, giữ lỗi client, không ghi `meta.errors`.
- [x] Guard dự kiến dùng subscription `isDefaultValue`; có bước giữ đóng/rời trang/busy.
- [x] File map có hai primitive cần truyền ARIA; bước kiểm tra bao gồm callers cũ.
- [x] Có typecheck test riêng; runner có extensionless resolution và transform parameter property, không cần `tsx`.
- [x] Có nghiệm thu 409, ngày trống, exclusive `+07:00`, tỉnh/xã phụ thuộc và legacy.
- [x] Phân biệt kiểm tra kiểu với UI test; có hướng dẫn chỉ stage thay đổi thuộc task.

Kiểm chứng khi sửa tài liệu: trích bốn test/helper mẫu vào thư mục tạm, chạy 4/4 pass và kiểm tra kiểu pass; đã xóa thư mục tạm. Resolver tạm cùng lệnh Node đề xuất chạy 3/3 test hiện có (`admin-catalogs`, `admin-date`) pass. Chưa kiểm thử trình duyệt hoặc triển khai controller.

## Bàn giao thực thi

Hai lựa chọn: thực thi trực tiếp tuần tự với `superpowers:executing-plans`, hoặc giao mỗi task cho agent mới với `superpowers:subagent-driven-development` và review giữa các task. Khuyến nghị thực thi trực tiếp vì context, type và luồng locality liên kết chặt. Sửa kế hoạch chưa bắt đầu triển khai mã ứng dụng.
