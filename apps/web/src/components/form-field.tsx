import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Chỉ chứa text hiển thị của field; control đặt ở `children`. */
  label: ReactNode;
  /** `id` của control bên trong `children`. */
  htmlFor?: string;
  labelClassName?: string;
  /** Đánh dấu trường bắt buộc bằng dấu `*` màu đỏ trên `<Label>`. */
  required?: boolean;
  /** Mô tả / hướng dẫn cho trường nhập liệu, render ngoài `<Label>`. */
  hint?: ReactNode;
  /** `id` của hint (mặc định `${htmlFor}-hint` nếu có `htmlFor`) để control liên kết qua `aria-describedby`. */
  hintId?: string;
  /** Nhãn phụ như `(không bắt buộc)` hiển thị cùng hàng với `label`. */
  optional?: ReactNode;
  children: ReactNode;
}

/**
 * Nhóm label + hint + control:
 * `<Label>` chỉ chứa text nhãn, `hint` render thành `<p>` độc lập bên ngoài `<Label>`,
 * control là sibling liên kết qua `htmlFor`/`id` và `aria-describedby`.
 */
export function FormField({
  label,
  htmlFor,
  labelClassName,
  required,
  hint,
  hintId,
  optional,
  className,
  children,
  ...props
}: FormFieldProps) {
  const resolvedHintId = hintId ?? (htmlFor ? `${htmlFor}-hint` : undefined);

  return (
    <div
      data-slot='form-field'
      className={cn('flex min-w-0 flex-col gap-1.5', className)}
      {...props}
    >
      {optional ? (
        <div className='mb-auto flex flex-wrap items-baseline justify-between gap-2'>
          <Label htmlFor={htmlFor} required={required} className={labelClassName}>
            {label}
          </Label>
          <span className='field-optional text-muted-foreground text-xs'>{optional}</span>
        </div>
      ) : (
        <Label htmlFor={htmlFor} required={required} className={cn('mb-auto', labelClassName)}>
          {label}
        </Label>
      )}
      {hint && (
        <p id={resolvedHintId} className='field-hint text-muted-foreground text-xs leading-relaxed'>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}
