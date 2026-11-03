import React, { useEffect, useId, useRef } from 'react';
import { addDays, addMonths, addYears, getDate, getMonth, getYear } from 'date-fns';
import InputError from '@/components/input-error';
import { cn } from '@/lib/utils';
import { parseDateInputParts, type DateInputParts } from './date-input-validation';

interface DateInputProps {
  value?: Date;
  onChange: (date: Date) => void;
  onValidityChange?: (valid: boolean) => void;
  isDateDisabled?: (date: Date) => boolean;
  label?: string;
}

function dateParts(value?: Date): DateInputParts {
  const date = value ?? new Date();
  return {
    day: String(getDate(date)).padStart(2, '0'),
    month: String(getMonth(date) + 1).padStart(2, '0'),
    year: String(getYear(date)),
  };
}

const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  onValidityChange,
  isDateDisabled,
  label = 'Ngày',
}) => {
  const [date, setDate] = React.useState<DateInputParts>(() => dateParts(value));
  const [error, setError] = React.useState('');
  const editingRef = useRef(false);
  const errorId = useId();

  const monthRef = useRef<HTMLInputElement | null>(null);
  const dayRef = useRef<HTMLInputElement | null>(null);
  const yearRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingRef.current) return;
    setDate(dateParts(value));
    setError('');
    onValidityChange?.(true);
  }, [value, onValidityChange]);

  const updateDate = (next: DateInputParts) => {
    setDate(next);
    const parsed = parseDateInputParts(next);
    const nextError = !parsed
      ? 'Ngày không hợp lệ.'
      : isDateDisabled?.(parsed)
        ? 'Ngày này không thể chọn.'
        : '';
    setError(nextError);
    onValidityChange?.(!nextError);
    if (parsed && !nextError) onChange(parsed);
  };

  const handleInputChange =
    (field: keyof DateInputParts) => (event: React.ChangeEvent<HTMLInputElement>) => {
      updateDate({ ...date, [field]: event.currentTarget.value });
    };

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    editingRef.current = true;
    if (window.innerWidth > 1024) event.currentTarget.select();
  };

  const handleBlur = () => {
    editingRef.current = false;
    const parsed = parseDateInputParts(date);
    const nextError = !parsed
      ? 'Ngày không hợp lệ.'
      : isDateDisabled?.(parsed)
        ? 'Ngày này không thể chọn.'
        : '';
    setError(nextError);
    onValidityChange?.(!nextError);
    if (parsed && !nextError) setDate(dateParts(parsed));
  };

  const handleKeyDown = (field: keyof DateInputParts) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }

    if (
      !/^[0-9]$/.test(e.key) &&
      ![
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'Delete',
        'Tab',
        'Backspace',
        'Enter',
        'Home',
        'End',
        'Shift',
      ].includes(e.key)
    ) {
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseDateInputParts(date);
      if (!current) return;
      const direction = e.key === 'ArrowUp' ? 1 : -1;
      const next =
        field === 'day'
          ? addDays(current, direction)
          : field === 'month'
            ? addMonths(current, direction)
            : addYears(current, direction);
      if (getYear(next) >= 1000 && getYear(next) <= 9999) updateDate(dateParts(next));
      return;
    }

    if (e.key === 'ArrowRight') {
      if (
        e.currentTarget.selectionStart === e.currentTarget.value.length ||
        (e.currentTarget.selectionStart === 0 &&
          e.currentTarget.selectionEnd === e.currentTarget.value.length)
      ) {
        e.preventDefault();
        if (field === 'day') monthRef.current?.focus();
        if (field === 'month') yearRef.current?.focus();
      }
    } else if (e.key === 'ArrowLeft') {
      if (
        e.currentTarget.selectionStart === 0 ||
        (e.currentTarget.selectionStart === 0 &&
          e.currentTarget.selectionEnd === e.currentTarget.value.length)
      ) {
        e.preventDefault();
        if (field === 'month') dayRef.current?.focus();
        if (field === 'year') monthRef.current?.focus();
      }
    }
  };

  return (
    <div role='group' aria-label={label} className='flex min-w-0 flex-col gap-1'>
      <div
        className={cn(
          'border-border bg-surface text-fg focus-within:border-ring focus-within:ring-ring/50 inline-flex h-8 items-center rounded-md border px-2 font-mono text-xs tabular-nums transition-shadow focus-within:ring-2',
          error && 'border-destructive',
        )}
      >
        <input
          type='text'
          inputMode='numeric'
          aria-label={`${label} - ngày`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          ref={dayRef}
          maxLength={2}
          value={date.day}
          onChange={handleInputChange('day')}
          onKeyDown={handleKeyDown('day')}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className='text-fg w-6 border-none bg-transparent p-0 text-center outline-none'
          placeholder='DD'
        />
        <span aria-hidden='true' className='text-muted-foreground/50 select-none'>/</span>
        <input
          type='text'
          inputMode='numeric'
          aria-label={`${label} - tháng`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          ref={monthRef}
          maxLength={2}
          value={date.month}
          onChange={handleInputChange('month')}
          onKeyDown={handleKeyDown('month')}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className='text-fg w-6 border-none bg-transparent p-0 text-center outline-none'
          placeholder='MM'
        />
        <span aria-hidden='true' className='text-muted-foreground/50 select-none'>/</span>
        <input
          type='text'
          inputMode='numeric'
          aria-label={`${label} - năm`}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          ref={yearRef}
          maxLength={4}
          value={date.year}
          onChange={handleInputChange('year')}
          onKeyDown={handleKeyDown('year')}
          onFocus={handleFocus}
          onBlur={handleBlur}
          className='text-fg w-10 border-none bg-transparent p-0 text-center outline-none'
          placeholder='YYYY'
        />
      </div>
      <InputError id={errorId} role='alert' message={error} className='text-xs' />
    </div>
  );
};

DateInput.displayName = 'DateInput';

export { DateInput };
