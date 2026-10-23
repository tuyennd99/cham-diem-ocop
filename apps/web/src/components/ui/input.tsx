import { forwardRef } from 'react';
import type { InputProps } from '@/types/ui';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn('font-ui text-fg', className)} {...props} />;
});
