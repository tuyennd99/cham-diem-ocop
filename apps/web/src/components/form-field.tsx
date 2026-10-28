import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface FormFieldProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Chỉ chứa text hiển thị của field; control đặt ở `children`. */
  label: ReactNode;
  /** `id` của control bên trong `children`. */
  htmlFor?: string;
  labelClassName?: string;
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
      className={cn('grid min-w-0 content-start gap-1.5', className)}
      {...props}
    >
      {optional ? (
        <div className='flex items-baseline justify-between gap-2 flex-wrap'>
          <Label htmlFor={htmlFor} className={labelClassName}>
            {label}
          </Label>
          <span className='field-optional text-xs text-muted-foreground'>{optional}</span>
        </div>
      ) : (
        <Label htmlFor={htmlFor} className={labelClassName}>
          {label}
        </Label>
      )}
      {hint && (
        <p id={resolvedHintId} className='field-hint text-xs text-muted-foreground leading-relaxed'>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}
