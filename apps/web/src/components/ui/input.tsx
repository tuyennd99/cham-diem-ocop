import { forwardRef } from 'react';
import type { InputProps } from '@/types/ui';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot='input'
      className={cn(
        'border-input bg-surface font-ui text-fg placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex h-9 min-h-9 w-full min-w-0 rounded-md border px-3 py-1.5 text-base font-normal shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2 md:text-sm',
        className,
      )}
      {...props}
    />
  );
});
