import React, { useEffect, useRef, useState, type ComponentProps, type FC } from 'react';
import {
  addMonths,
  addYears,
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isEqual,
  parse,
  startOfDay,
  startOfMonth,
  startOfYear,
  subYears,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import { ArrowRight, CalendarIcon, Check, ChevronDown } from 'lucide-react';
import { dateMatchModifiers, type Matcher } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateInput } from './date-input';

export interface RangePickerProps {
  triggerProps?: Omit<ComponentProps<typeof Button>, 'children' | 'type'>;
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { range: DateRange; rangeCompare?: DateRange }) => void;
  /** Initial value for start date */
  initialDateFrom?: Date | string;
  /** Initial value for end date */
  initialDateTo?: Date | string;
  /** Initial value for start date for compare */
  initialCompareFrom?: Date | string;
  /** Initial value for end date for compare */
  initialCompareTo?: Date | string;
  /** Alignment of popover */
  align?: 'start' | 'center' | 'end';
  /** Option for showing compare feature */
  showCompare?: boolean;
  /** Disable all dates before today */
  disablePast?: boolean;
  /** Disable all dates after today */
  disableFuture?: boolean;
  /** Disable specific date(s) or a range. Accepts any react-day-picker Matcher. */
  disabledDates?: Matcher | Matcher[];
}

const formatDisplayDate = (date: Date): string => {
  return format(date, 'dd/MM/yyyy', { locale: vi });
};

const getDateAdjustedForTimezone = (dateInput: Date | string): Date => {
  if (typeof dateInput === 'string') {
    return parse(dateInput, 'yyyy-MM-dd', new Date());
  }
  return dateInput;
};

interface DateRange {
  from: Date;
  to: Date | undefined;
}

interface Preset {
  name: string;
  label: string;
}

const PRESETS: Preset[] = [
  { name: 'today', label: 'Hôm nay' },
  { name: 'thisMonth', label: 'Tháng này' },
  { name: 'next3Months', label: '3 tháng tới' },
  { name: 'next6Months', label: '6 tháng tới' },
  { name: 'thisYear', label: 'Năm nay' },
  { name: 'next1Year', label: '1 năm tới' },
  { name: 'next3Years', label: '3 năm tới' },
];

/** The DateRangePicker component allows a user to select a range of dates */
const DateRangePicker: FC<RangePickerProps> = ({
  triggerProps,
  initialDateFrom = startOfDay(new Date()),
  initialDateTo,
  initialCompareFrom,
  initialCompareTo,
  onUpdate,
  align = 'start',
  disablePast = false,
  disableFuture = false,
  disabledDates,
}) => {
  const disabledMatchers = React.useMemo<Matcher[] | undefined>(() => {
    const matchers: Matcher[] = [];
    if (disablePast) matchers.push({ before: startOfDay(new Date()) });
    if (disableFuture) matchers.push({ after: startOfDay(new Date()) });
    if (disabledDates != null) {
      if (Array.isArray(disabledDates)) {
        matchers.push(...disabledDates);
      } else {
        matchers.push(disabledDates);
      }
    }
    return matchers.length > 0 ? matchers : undefined;
  }, [disablePast, disableFuture, disabledDates]);
  const isDateDisabled = React.useCallback(
    (date: Date) => Boolean(disabledMatchers && dateMatchModifiers(date, disabledMatchers)),
    [disabledMatchers],
  );

  const [isOpen, setIsOpen] = useState(false);
  const [isFromValid, setIsFromValid] = useState(true);
  const [isToValid, setIsToValid] = useState(true);
  const [dateInputVersion, setDateInputVersion] = useState(0);
  const resetDateInputs = () => {
    setIsFromValid(true);
    setIsToValid(true);
    setDateInputVersion((version) => version + 1);
  };

  const [range, setRange] = useState<DateRange>({
    from: getDateAdjustedForTimezone(initialDateFrom),
    to: initialDateTo
      ? getDateAdjustedForTimezone(initialDateTo)
      : getDateAdjustedForTimezone(initialDateFrom),
  });
  const [rangeCompare, setRangeCompare] = useState<DateRange | undefined>(
    initialCompareFrom
      ? {
          from: startOfDay(new Date(initialCompareFrom)),
          to: initialCompareTo
            ? startOfDay(new Date(initialCompareTo))
            : startOfDay(new Date(initialCompareFrom)),
        }
      : undefined,
  );

  const openedRangeRef = useRef<DateRange | undefined>(undefined);
  const openedRangeCompareRef = useRef<DateRange | undefined>(undefined);

  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);

  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const handleResize = (): void => {
      setIsSmallScreen(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize, { passive: true });
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const getPresetRange = (presetName: string): DateRange => {
    const preset = PRESETS.find(({ name }) => name === presetName);
    if (!preset) throw new Error(`Unknown date range preset: ${presetName}`);
    const today = new Date();

    switch (preset.name) {
      case 'today':
        return { from: startOfDay(today), to: endOfDay(today) };
      case 'thisMonth':
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case 'next3Months':
        return { from: startOfDay(today), to: endOfDay(addMonths(today, 3)) };
      case 'next6Months':
        return { from: startOfDay(today), to: endOfDay(addMonths(today, 6)) };
      case 'thisYear':
        return { from: startOfYear(today), to: endOfYear(today) };
      case 'next1Year':
        return { from: startOfDay(today), to: endOfDay(addYears(today, 1)) };
      case 'next3Years':
        return { from: startOfDay(today), to: endOfDay(addYears(today, 3)) };
      default:
        return { from: startOfDay(today), to: endOfDay(today) };
    }
  };

  const setPreset = (preset: string): void => {
    const nextRange = getPresetRange(preset);
    resetDateInputs();
    setRange(nextRange);
    if (rangeCompare) {
      setRangeCompare({
        from: subYears(nextRange.from, 1),
        to: nextRange.to ? subYears(nextRange.to, 1) : undefined,
      });
    }
  };

  const checkPreset = (): void => {
    for (const preset of PRESETS) {
      const presetRange = getPresetRange(preset.name);

      const normalizedRangeFrom = startOfDay(range.from);
      const normalizedPresetFrom = startOfDay(presetRange.from);
      const normalizedRangeTo = startOfDay(range.to ?? new Date(0));
      const normalizedPresetTo = startOfDay(presetRange.to ?? new Date(0));

      if (
        isEqual(normalizedRangeFrom, normalizedPresetFrom) &&
        isEqual(normalizedRangeTo, normalizedPresetTo)
      ) {
        setSelectedPreset(preset.name);
        return;
      }
    }

    setSelectedPreset(undefined);
  };

  const resetValues = (): void => {
    resetDateInputs();
    setRange({
      from:
        typeof initialDateFrom === 'string'
          ? getDateAdjustedForTimezone(initialDateFrom)
          : initialDateFrom,
      to: initialDateTo
        ? typeof initialDateTo === 'string'
          ? getDateAdjustedForTimezone(initialDateTo)
          : initialDateTo
        : typeof initialDateFrom === 'string'
          ? getDateAdjustedForTimezone(initialDateFrom)
          : initialDateFrom,
    });
    setRangeCompare(
      initialCompareFrom
        ? {
            from:
              typeof initialCompareFrom === 'string'
                ? getDateAdjustedForTimezone(initialCompareFrom)
                : initialCompareFrom,
            to: initialCompareTo
              ? typeof initialCompareTo === 'string'
                ? getDateAdjustedForTimezone(initialCompareTo)
                : initialCompareTo
              : typeof initialCompareFrom === 'string'
                ? getDateAdjustedForTimezone(initialCompareFrom)
                : initialCompareFrom,
          }
        : undefined,
    );
  };

  useEffect(() => {
    checkPreset();
  }, [range]);

  const areRangesEqual = (a?: DateRange, b?: DateRange): boolean => {
    if (!a || !b) return a === b;
    return (
      a.from.getTime() === b.from.getTime() && (!a.to || !b.to || a.to.getTime() === b.to.getTime())
    );
  };

  useEffect(() => {
    if (isOpen) {
      openedRangeRef.current = range;
      openedRangeCompareRef.current = rangeCompare;
    }
  }, [isOpen]);

  return (
    <Popover
      modal={true}
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          resetValues();
        }
        setIsOpen(open);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          {...triggerProps}
          type='button'
          variant={triggerProps?.variant ?? 'outline'}
          className={cn(
            'h-9 min-h-9 w-full justify-between gap-2 px-3 font-normal',
            !range.from && 'text-muted-foreground',
            triggerProps?.className,
          )}
        >
          <span className='inline-flex items-center gap-2 font-mono text-xs sm:text-sm'>
            <CalendarIcon className='text-primary size-4 shrink-0' />
            <span>
              {`${formatDisplayDate(range.from)}${
                range.to != null ? ' – ' + formatDisplayDate(range.to) : ''
              }`}
            </span>
          </span>
          <ChevronDown className='size-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={6}
        collisionPadding={16}
        className='border-border bg-surface w-auto max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg p-0 shadow-xl'
      >
        {/* Top bar: Date range inputs */}
        <div className='border-border bg-surface-soft/60 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5'>
          <span className='text-muted-foreground text-xs font-medium'>Khoảng ngày đã chọn</span>
          <div className='flex flex-wrap items-start gap-2'>
            <DateInput
              key={`from-${dateInputVersion}`}
              label='Ngày bắt đầu'
              value={range.from}
              onValidityChange={setIsFromValid}
              isDateDisabled={isDateDisabled}
              onChange={(date) => {
                const toDate = range.to == null || date > range.to ? date : range.to;
                setRange((prevRange) => ({
                  ...prevRange,
                  from: date,
                  to: toDate,
                }));
              }}
            />
            <ArrowRight className='text-muted-foreground mt-2 size-3.5 shrink-0' aria-hidden='true' />
            <DateInput
              key={`to-${dateInputVersion}`}
              label='Ngày kết thúc'
              value={range.to}
              onValidityChange={setIsToValid}
              isDateDisabled={isDateDisabled}
              onChange={(date) => {
                const fromDate = date < range.from ? date : range.from;
                setRange((prevRange) => ({
                  ...prevRange,
                  from: fromDate,
                  to: date,
                }));
              }}
            />
          </div>
        </div>

        {/* Main body: Calendar + Presets */}
        <div className='flex flex-col md:flex-row'>
          <div className='p-2'>
            {isSmallScreen && (
              <div className='px-2 pt-1 pb-2'>
                <Select
                  value={selectedPreset}
                  onValueChange={(value) => {
                    setPreset(value);
                  }}
                >
                  <SelectTrigger className='h-8 w-full text-xs'>
                    <SelectValue placeholder='Chọn nhanh khoảng thời gian…' />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Calendar
              mode='range'
              locale={vi}
              onSelect={(value: { from?: Date; to?: Date } | undefined) => {
                if (value?.from != null) {
                  resetDateInputs();
                  setRange({ from: value.from, to: value?.to });
                }
              }}
              selected={range}
              numberOfMonths={isSmallScreen ? 1 : 2}
              defaultMonth={range.from}
              disabled={disabledMatchers}
            />
          </div>

          {!isSmallScreen && (
            <div className='border-border bg-surface-soft/35 flex w-40 flex-col gap-1 border-l p-2.5'>
              <span className='text-muted-foreground px-2.5 py-1 text-[11px] font-semibold tracking-wider uppercase'>
                Chọn nhanh
              </span>
              {PRESETS.map((preset) => {
                const isSelected = selectedPreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    type='button'
                    onClick={() => setPreset(preset.name)}
                    className={cn(
                      'text-fg hover:bg-accent-soft flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected && 'bg-accent-soft text-primary font-semibold',
                    )}
                  >
                    <span>{preset.label}</span>
                    {isSelected && <Check className='text-primary size-3.5 shrink-0' />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className='border-border bg-surface-soft/40 flex items-center justify-between gap-3 border-t px-4 py-2.5'>
          <span className='text-muted-foreground font-mono text-xs'>
            {formatDisplayDate(range.from)}
            {range.to ? ` → ${formatDisplayDate(range.to)}` : ''}
          </span>
          <div className='flex items-center gap-2'>
            <Button
              type='button'
              onClick={() => {
                setIsOpen(false);
                resetValues();
              }}
              variant='secondary'
              size='sm'
            >
              Huỷ
            </Button>
            <Button
              type='button'
              disabled={!isFromValid || !isToValid}
              onClick={() => {
                setIsOpen(false);
                if (
                  !areRangesEqual(range, openedRangeRef.current) ||
                  !areRangesEqual(rangeCompare, openedRangeCompareRef.current)
                ) {
                  onUpdate?.({ range, rangeCompare });
                }
              }}
              size='sm'
            >
              Áp dụng
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangePicker;
