'use client';

import type { AriaAttributes, FocusEventHandler } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxBadgeItem,
  ComboboxBadgeList,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';

export interface MultiComboboxOption {
  value: string;
  label: string;
}

export interface MultiComboboxProps {
  id?: string;
  name?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  'aria-invalid'?: AriaAttributes['aria-invalid'];
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  disabled?: boolean;
  options: MultiComboboxOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  maxTagCount?: number;
  className?: string;
}

export function MultiCombobox({
  id,
  name,
  onBlur,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-required': ariaRequired,
  disabled = false,
  options,
  value,
  onChange,
  placeholder = '— Chọn —',
  searchPlaceholder = 'Tìm kiếm...',
  maxTagCount,
  className,
}: MultiComboboxProps) {
  const selectedOptions = options.filter((option) => value.includes(option.value));
  const tagLimit =
    maxTagCount === undefined || !Number.isFinite(maxTagCount)
      ? selectedOptions.length
      : Math.max(0, Math.floor(maxTagCount));
  const visibleOptions = selectedOptions.slice(0, tagLimit);
  const hiddenCount = selectedOptions.length - visibleOptions.length;

  return (
    <Combobox value={value} onValueChange={onChange} disabled={disabled} multiple autoHighlight>
      <ComboboxAnchor className={cn('h-auto min-h-9 flex-wrap py-1.5', className)}>
        <ComboboxBadgeList>
          {visibleOptions.map((option) => (
            <ComboboxBadgeItem key={option.value} value={option.value}>
              {option.label}
            </ComboboxBadgeItem>
          ))}
          {hiddenCount > 0 && <Badge variant='secondary'>+{hiddenCount}</Badge>}
        </ComboboxBadgeList>
        <ComboboxInput
          id={id}
          name={name}
          onBlur={onBlur}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          aria-required={ariaRequired}
          placeholder={selectedOptions.length > 0 ? searchPlaceholder : placeholder}
          className='h-auto min-w-20 flex-1'
        />
        <ComboboxTrigger />
      </ComboboxAnchor>
      <ComboboxContent>
        <ComboboxEmpty>Không tìm thấy.</ComboboxEmpty>
        {options.map((option) => (
          <ComboboxItem key={option.value} value={option.value} label={option.label}>
            {option.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
