import * as React from 'react';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type Locale,
} from 'react-day-picker';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = 'label',
  buttonVariant = 'ghost',
  locale,
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>['variant'];
}) {
  const defaultClassNames = getDefaultClassNames();

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        'group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:--spacing(9)] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent',
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code ?? 'vi-VN', { month: 'short' }),
        ...formatters,
      }}
      classNames={{
        root: cn('w-fit', defaultClassNames.root),
        months: cn('relative flex flex-col gap-5 md:flex-row', defaultClassNames.months),
        month: cn('flex w-full flex-col gap-3', defaultClassNames.month),
        nav: cn(
          'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
          defaultClassNames.nav,
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant, size: 'icon-sm' }),
          'size-8 min-h-8 p-0 select-none aria-disabled:opacity-40',
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant, size: 'icon-sm' }),
          'size-8 min-h-8 p-0 select-none aria-disabled:opacity-40',
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          'flex h-8 w-full items-center justify-center px-8',
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          'flex h-8 w-full items-center justify-center gap-1.5 text-sm font-semibold',
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn('relative rounded-(--cell-radius)', defaultClassNames.dropdown_root),
        dropdown: cn('absolute inset-0 bg-popover opacity-0', defaultClassNames.dropdown),
        caption_label: cn(
          'font-semibold capitalize select-none text-foreground',
          captionLayout === 'label'
            ? 'text-sm'
            : 'flex items-center gap-1 rounded-(--cell-radius) text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground',
          defaultClassNames.caption_label,
        ),
        month_grid: cn('w-full border-collapse', defaultClassNames.month_grid),
        weekdays: cn('flex', defaultClassNames.weekdays),
        weekday: cn(
          'w-9 rounded-(--cell-radius) text-center text-xs font-semibold text-muted-foreground select-none',
          defaultClassNames.weekday,
        ),
        week: cn('mt-1.5 flex w-full', defaultClassNames.week),
        week_number_header: cn('w-9 select-none', defaultClassNames.week_number_header),
        week_number: cn(
          'text-xs text-muted-foreground select-none',
          defaultClassNames.week_number,
        ),
        day: cn(
          'group/day relative size-9 p-0 text-center text-sm select-none [&:last-child[data-selected=true]_button]:rounded-r-(--cell-radius)',
          props.showWeekNumber
            ? '[&:nth-child(2)[data-selected=true]_button]:rounded-l-(--cell-radius)'
            : '[&:first-child[data-selected=true]_button]:rounded-l-(--cell-radius)',
          defaultClassNames.day,
        ),
        range_start: cn(
          'relative isolate z-0 rounded-l-(--cell-radius) bg-accent-soft',
          defaultClassNames.range_start,
        ),
        range_middle: cn('rounded-none bg-accent-soft', defaultClassNames.range_middle),
        range_end: cn(
          'relative isolate z-0 rounded-r-(--cell-radius) bg-accent-soft',
          defaultClassNames.range_end,
        ),
        today: cn(
          'rounded-(--cell-radius) font-semibold text-primary',
          defaultClassNames.today,
        ),
        outside: cn(
          'text-muted-foreground/45 aria-selected:text-muted-foreground/70',
          defaultClassNames.outside,
        ),
        disabled: cn('text-muted-foreground opacity-40', defaultClassNames.disabled),
        hidden: cn('invisible', defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return <div data-slot='calendar' ref={rootRef} className={cn(className)} {...props} />;
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === 'left') {
            return <ChevronLeftIcon className={cn('size-4', className)} {...props} />;
          }

          if (orientation === 'right') {
            return <ChevronRightIcon className={cn('size-4', className)} {...props} />;
          }

          return <ChevronDownIcon className={cn('size-4', className)} {...props} />;
        },
        DayButton: ({ ...props }) => <CalendarDayButton locale={locale} {...props} />,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className='flex size-9 items-center justify-center text-center'>{children}</div>
            </td>
          );
        },
        ...components,
      }}
      {...props}
    />
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames();

  const ref = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus();
  }, [modifiers.focused]);

  return (
    <button
      ref={ref}
      type='button'
      data-day={day.date.toLocaleDateString(locale?.code ?? 'vi-VN')}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        'text-fg hover:bg-accent-soft relative isolate z-10 inline-flex size-9 items-center justify-center rounded-(--cell-radius) border-0 bg-transparent p-0 text-sm leading-none font-normal transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
        'group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-2 group-data-[focused=true]/day:ring-ring/60',
        'data-[range-middle=true]:bg-accent-soft data-[range-middle=true]:text-fg data-[range-middle=true]:rounded-none data-[range-middle=true]:font-medium',
        'data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-start=true]:rounded-(--cell-radius) data-[range-start=true]:font-semibold data-[range-start=true]:hover:bg-accent-hover',
        'data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground data-[range-end=true]:rounded-(--cell-radius) data-[range-end=true]:font-semibold data-[range-end=true]:hover:bg-accent-hover',
        'data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[selected-single=true]:font-semibold data-[selected-single=true]:hover:bg-accent-hover',
        modifiers.today &&
          !modifiers.selected &&
          'ring-primary/40 text-primary font-semibold ring-1 ring-inset',
        modifiers.outside && !modifiers.selected && 'text-muted-foreground/45',
        defaultClassNames.day,
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };
