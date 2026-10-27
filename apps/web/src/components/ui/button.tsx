import { cva } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ButtonProps } from '@/types/ui';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'button inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 py-2 font-ui text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'button-primary bg-accent text-white hover:bg-accent-hover',
        primary: 'button-primary bg-accent text-white hover:bg-accent-hover',
        secondary:
          'button-secondary border border-border bg-surface text-fg hover:border-accent hover:bg-accent-soft',
        destructive: 'bg-destructive text-white hover:opacity-90',
        outline: 'border border-border bg-surface text-fg hover:border-accent hover:bg-accent-soft',
        ghost: 'hover:bg-accent-soft text-fg',
        link: 'text-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 px-4 py-2',
        sm: 'min-h-9 rounded-md px-3 text-xs',
        lg: 'min-h-12 rounded-md px-6 text-base',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot='button'
      data-size={size ?? 'default'}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
