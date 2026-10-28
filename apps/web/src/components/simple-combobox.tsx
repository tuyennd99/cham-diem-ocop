'use client';

import * as React from 'react';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isEmpty } from 'lodash'

export interface SimpleComboboxOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SimpleComboboxProps {
  id?: string;
  options: SimpleComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  showSearch?: boolean;
}

export function SimpleCombobox({
  id,
  options,
  value,
  onChange,
  placeholder = '— Chọn —',
  searchPlaceholder = 'Tìm kiếm...',
  emptyText = 'Không tìm thấy.',
  className,
  disabled,
  showSearch = true,
}: SimpleComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type='button'
          variant='outline'
          role='combobox'
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full min-w-0 justify-between font-normal', className)}
        >
          <span title={selected?.label} className={cn('min-w-0 flex-1 truncate text-left', !selected && 'text-muted-foreground')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDownIcon className='ml-2 size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className='p-0 w-(--radix-popover-trigger-width)!'
        align='start'
      >
        <Command>
          {showSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            <CommandEmpty>{isEmpty(options) ? 'Không có dữ liệu' : emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  disabled={option.disabled}
                  onSelect={() => {
                    onChange(option.value === value ? '' : option.value);
                    setOpen(false);
                  }}
                >
                  <CheckIcon
                    className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className='min-w-0 flex-1 truncate' title={option.label}>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
