import type { ComponentProps } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export interface LabelProps extends ComponentProps<typeof LabelPrimitive.Root> {
  required?: boolean;
}

const REQUIRED_SUFFIX_RE = /\s*\(bắt buộc\)\s*$/i;

export function Label({ className, htmlFor, required, children, onClick, ...props }: LabelProps) {
  const hasRequiredSuffix = typeof children === 'string' && REQUIRED_SUFFIX_RE.test(children);
  const normalizedChildren =
    typeof children === 'string' && hasRequiredSuffix
      ? children.replace(REQUIRED_SUFFIX_RE, '')
      : children;
  const isRequired = Boolean(required || hasRequiredSuffix);

  return (
    <LabelPrimitive.Root
      data-slot='label'
      htmlFor={htmlFor}
      className={cn(
        'inline-flex items-center gap-1 text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !htmlFor) return;

        const target = document.getElementById(htmlFor);
        if (!target) return;

        const isNativeLabelable =
          target instanceof HTMLInputElement ||
          target instanceof HTMLButtonElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement;

        if (!isNativeLabelable) {
          const isDisabled =
            target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true';

          if (!isDisabled) {
            target.focus();
            target.click();
          }
        }
      }}
      {...props}
    >
      <span>{normalizedChildren}</span>
      {isRequired && (
        <span className='label-required-mark text-destructive font-bold' aria-hidden='true'>
          *
        </span>
      )}
    </LabelPrimitive.Root>
  );
}
