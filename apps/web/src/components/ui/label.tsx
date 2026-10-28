import type { ComponentProps } from 'react';
import { Label as LabelPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Label({
  className,
  htmlFor,
  onClick,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot='label'
      htmlFor={htmlFor}
      className={cn(
        'text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
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
            target.hasAttribute('disabled') ||
            target.getAttribute('aria-disabled') === 'true';

          if (!isDisabled) {
            target.focus();
            target.click();
          }
        }
      }}
      {...props}
    />
  );
}
