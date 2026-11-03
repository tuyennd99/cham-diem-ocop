# Kiểm tra dữ liệu form

`Input`, `Password` và `Textarea` hiển thị lỗi của các ràng buộc HTML như `required`, `type`, `pattern`, `minLength`, `min`, `max` và `step`. `Checkbox` hỗ trợ `required`.

Với quy tắc nghiệp vụ hoặc các trường chọn (`Select`, `Combobox`, `MultiCombobox`, `DateRange`), khai báo validator cho `AppField`. `onChange` kiểm tra ngay khi giá trị thay đổi và cả khi gửi form:

```tsx
<form.AppField
  name='code'
  validators={{
    onChange: ({ value }) =>
      /^[A-Z0-9-]+$/.test(value) ? undefined : 'Mã chỉ gồm chữ in hoa, số và dấu gạch ngang.',
  }}
>
  {(field) => <field.Input label='Mã' required />}
</form.AppField>
```

Validator trả về chuỗi lỗi hoặc `undefined` khi hợp lệ. Với trường chọn, `required` đánh dấu giao diện; vẫn cần validator để kiểm tra giá trị bắt buộc.
