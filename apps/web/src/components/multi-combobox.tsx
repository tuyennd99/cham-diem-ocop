import { useState, type KeyboardEvent } from 'react';
import { CheckIcon, ChevronsUpDownIcon, XIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface MultiComboboxOption {
  value: string;
  label: string;
}

export interface MultiComboboxProps {
  id?: string;
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
  disabled = false,
  options,
  value,
  onChange,
  placeholder = '— Chọn —',
  searchPlaceholder = 'Tìm kiếm...',
  maxTagCount,
  className,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedOptions = options.filter((option) => value.includes(option.value));
  const tagLimit =
    maxTagCount === undefined || !Number.isFinite(maxTagCount)
      ? selectedOptions.length
      : Math.max(0, Math.floor(maxTagCount));
  const visibleOptions = selectedOptions.slice(0, tagLimit);
  const hiddenCount = selectedOptions.length - visibleOptions.length;

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;

    event.preventDefault();
    setOpen(!open);
  };

  return (
    <Popover open={open && !disabled} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <div
          id={id}
          role='combobox'
          tabIndex={disabled ? -1 : 0}
          aria-expanded={open && !disabled}
          aria-haspopup='listbox'
          aria-disabled={disabled || undefined}
          onKeyDown={handleTriggerKeyDown}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'h-auto min-h-9 w-full min-w-0 shrink flex-wrap justify-between whitespace-normal',
            disabled && 'pointer-events-none opacity-50',
            className,
          )}
        >
          <div className='flex min-w-0 flex-1 flex-wrap items-center gap-1'>
            {selectedOptions.length ? (
              <>
                {visibleOptions.map((option) => (
                  <Badge
                    key={option.value}
                    variant='secondary'
                    className='h-auto max-w-full gap-1 py-0.5 pr-1 whitespace-normal'
                  >
                    <span className='min-w-0 break-words'>{option.label}</span>
                    {!disabled && (
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        aria-label={`Xóa ${option.label}`}
                        className='size-4 shrink-0 rounded-full p-0 hover:bg-muted-foreground/20'
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onChange(value.filter((item) => item !== option.value));
                        }}
                      >
                        <XIcon />
                      </Button>
                    )}
                  </Badge>
                ))}
                {hiddenCount > 0 && <Badge variant='secondary'>+{hiddenCount}</Badge>}
              </>
            ) : (
              <span className='text-muted-foreground'>{placeholder}</span>
            )}
          </div>
          <ChevronsUpDownIcon className='ml-2 size-4 shrink-0 opacity-50' />
        </div>
      </PopoverTrigger>
      <PopoverContent className='w-[--radix-popover-trigger-width] p-0' align='start'>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>Không tìm thấy.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const checked = value.includes(option.value);

                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() =>
                      onChange(
                        checked
                          ? value.filter((item) => item !== option.value)
                          : [...value, option.value],
                      )
                    }
                  >
                    <CheckIcon className={cn('size-4', checked ? 'opacity-100' : 'opacity-0')} />
                    <span className='truncate'>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
