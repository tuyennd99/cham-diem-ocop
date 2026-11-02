import { AppForm, useAppForm } from '../src/components/form/index';

export function FormContract() {
  const form = useAppForm({
    defaultValues: {
      code: '',
      password: '',
      note: '',
      count: undefined as number | undefined,
      enabled: false,
      province: '',
      role: '',
      tags: [] as string[],
      dateRange: { fromDay: '2026-11-02', toDay: '' },
    },
  });
  if (false) {
    // @ts-expect-error: field name must exist
    form.setFieldValue('missing', 'x');
    // @ts-expect-error: numeric fields cannot receive strings
    form.setFieldValue('count', '12');
  }
  return (
    <AppForm form={form}>
      <form.AppField name='code'>{(field) => <field.Input label='Mã' />}</form.AppField>
      <form.AppField name='count'>
        {(field) => <field.Input label='Số lượng' type='number' />}
      </form.AppField>
      <form.AppField name='password'>
        {(field) => <field.Password label='Mật khẩu' />}
      </form.AppField>
      <form.AppField name='note'>{(field) => <field.Textarea label='Ghi chú' />}</form.AppField>
      <form.AppField name='enabled'>
        {(field) => <field.Checkbox label='Đang hoạt động' />}
      </form.AppField>
      <form.AppField name='role'>
        {(field) => <field.Select label='Vai trò' options={[]} allowEmpty />}
      </form.AppField>
      <form.AppField name='province'>
        {(field) => <field.Combobox label='Tỉnh' options={[]} allowClear />}
      </form.AppField>
      <form.AppField name='tags'>
        {(field) => <field.MultiCombobox label='Nhãn' options={[]} />}
      </form.AppField>
      <form.AppField name='dateRange'>
        {(field) => <field.DateRange label='Thời gian mở' />}
      </form.AppField>
      <form.Actions submitLabel='Lưu' onCancel={() => form.reset()} />
    </AppForm>
  );
}
