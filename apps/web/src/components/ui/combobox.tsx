'use client';

import * as React from 'react';
import * as ComboboxPrimitive from '@diceui/combobox';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComboboxUiContextValue {
  isOpen: boolean;
  selectedLabel: string;
  searchQuery: string;
  multiple: boolean;
  setOpen: (open: boolean) => void;
}

const ComboboxUiContext = React.createContext<ComboboxUiContextValue | null>(null);

function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function getNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join('');
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return '';
}

function extractComboboxItems(
  children: React.ReactNode,
  map = new Map<string, string>(),
): Map<string, string> {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<Record<string, unknown>>(child)) return;
    const val = child.props?.value;
    if (typeof val === 'string' && val.length > 0 && child.type !== Combobox) {
      const labelProp = typeof child.props.label === 'string' ? child.props.label : undefined;
      const text = (labelProp ?? getNodeText(child.props.children as React.ReactNode)).trim();
      map.set(val, text || val);
    }
    if (child.props?.children) {
      extractComboboxItems(child.props.children as React.ReactNode, map);
    }
  });
  return map;
}

const Combobox = (({
  className,
  value,
  defaultValue,
  onValueChange,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  inputValue: inputValueProp,
  onInputValueChange,
  onFilter: onFilterProp,
  openOnFocus = true,
  multiple,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Root>) => {
  const isMultiple = Boolean(multiple);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const [internalValue, setInternalValue] = React.useState<string | string[]>(
    () => defaultValue ?? (isMultiple ? [] : ''),
  );
  const [searchQuery, setSearchQuery] = React.useState('');

  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const currentValue = value !== undefined ? value : internalValue;

  const itemsMap = React.useMemo(() => extractComboboxItems(children), [children]);

  const selectedLabel = React.useMemo(() => {
    if (isMultiple || typeof currentValue !== 'string' || !currentValue) return '';
    return itemsMap.get(currentValue) ?? '';
  }, [isMultiple, currentValue, itemsMap]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (openProp === undefined) {
        setInternalOpen(nextOpen);
      }
      if (!nextOpen) {
        setSearchQuery('');
      }
      onOpenChange?.(nextOpen);
    },
    [openProp, onOpenChange],
  );

  const handleInputValueChange = React.useCallback(
    (nextInput: string) => {
      if (inputValueProp === undefined) {
        setSearchQuery(nextInput);
      }
      onInputValueChange?.(nextInput);
    },
    [inputValueProp, onInputValueChange],
  );

  const handleValueChange = React.useCallback(
    (nextValue: string & string[]) => {
      if (!isMultiple && nextValue === '') {
        return;
      }
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      setSearchQuery('');
      (onValueChange as ((val: string | string[]) => void) | undefined)?.(nextValue);
    },
    [isMultiple, value, onValueChange],
  );

  const defaultOnFilter = React.useCallback(
    (options: string[], term: string) => {
      const normalizedTerm = normalizeSearchText(term);
      if (!normalizedTerm) return options;
      return options.filter((optValue) => {
        const label = itemsMap.get(optValue) ?? optValue;
        return (
          normalizeSearchText(label).includes(normalizedTerm) ||
          normalizeSearchText(optValue).includes(normalizedTerm)
        );
      });
    },
    [itemsMap],
  );

  const effectiveInputValue =
    inputValueProp !== undefined
      ? inputValueProp
      : isMultiple
        ? searchQuery
        : isOpen
          ? searchQuery
          : selectedLabel;

  const uiContextValue = React.useMemo<ComboboxUiContextValue>(
    () => ({
      isOpen,
      selectedLabel,
      searchQuery,
      multiple: isMultiple,
      setOpen: handleOpenChange,
    }),
    [isOpen, selectedLabel, searchQuery, isMultiple, handleOpenChange],
  );

  return (
    <ComboboxUiContext.Provider value={uiContextValue}>
      <ComboboxPrimitive.Root
        data-slot='combobox'
        className={cn('w-full min-w-0', className)}
        value={currentValue as never}
        onValueChange={handleValueChange as never}
        open={isOpen}
        onOpenChange={handleOpenChange}
        inputValue={effectiveInputValue}
        onInputValueChange={handleInputValueChange}
        onFilter={onFilterProp ?? defaultOnFilter}
        openOnFocus={openOnFocus}
        multiple={multiple as never}
        {...props}
      >
        {children}
      </ComboboxPrimitive.Root>
    </ComboboxUiContext.Provider>
  );
}) as ComboboxPrimitive.ComboboxRootComponentProps;

function ComboboxLabel({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Label>) {
  return (
    <ComboboxPrimitive.Label
      data-slot='combobox-label'
      className={cn('px-0.5 py-1.5 text-sm font-semibold', className)}
      {...props}
    />
  );
}

function ComboboxAnchor({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Anchor>) {
  const uiContext = React.useContext(ComboboxUiContext);
  return (
    <ComboboxPrimitive.Anchor
      data-slot='combobox-anchor'
      data-multiple={uiContext?.multiple ? 'true' : undefined}
      className={cn(
        'border-border bg-surface text-fg data-focused:ring-ring relative flex h-9 min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm shadow-xs transition-[color,box-shadow] data-disabled:cursor-not-allowed data-disabled:opacity-50 data-focused:ring-1',
        className,
      )}
      {...props}
    />
  );
}

function ComboboxInput({
  className,
  placeholder,
  onClick,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Input>) {
  const uiContext = React.useContext(ComboboxUiContext);
  const effectivePlaceholder =
    uiContext && !uiContext.multiple && uiContext.isOpen && uiContext.selectedLabel
      ? uiContext.selectedLabel
      : placeholder;

  return (
    <ComboboxPrimitive.Input
      data-slot='combobox-input'
      placeholder={effectivePlaceholder}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented && uiContext && !uiContext.isOpen) {
          uiContext.setOpen(true);
        }
      }}
      className={cn(
        'placeholder:text-muted-foreground flex h-full min-w-0 flex-1 truncate rounded-md border-0 bg-transparent p-0 text-sm focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        uiContext &&
          !uiContext.multiple &&
          uiContext.isOpen &&
          !uiContext.searchQuery &&
          uiContext.selectedLabel &&
          'placeholder:text-fg/80',
        className,
      )}
      {...props}
    />
  );
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Trigger>) {
  return (
    <ComboboxPrimitive.Trigger
      data-slot='combobox-trigger'
      className={cn(
        'border-input text-muted-foreground hover:text-foreground/80 flex shrink-0 items-center justify-center rounded-r-md bg-transparent transition-colors focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children || <ChevronDown className='size-4 opacity-60' />}
    </ComboboxPrimitive.Trigger>
  );
}

function ComboboxCancel({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Cancel>) {
  return (
    <ComboboxPrimitive.Cancel
      data-slot='combobox-cancel'
      className={cn(
        'bg-background ring-offset-background focus:ring-ring absolute top-1/2 right-1 flex size-6 -translate-y-1/2 items-center justify-center rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none',
        className,
      )}
      {...props}
    />
  );
}

function ComboboxBadgeList({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.BadgeList>) {
  return (
    <ComboboxPrimitive.BadgeList
      data-slot='combobox-badge-list'
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  );
}

function ComboboxBadgeItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.BadgeItem>) {
  return (
    <ComboboxPrimitive.BadgeItem
      data-slot='combobox-badge-item'
      className={cn(
        'bg-secondary inline-flex max-w-full items-center justify-between gap-1 rounded-sm px-2 py-0.5',
        className,
      )}
      {...props}
    >
      <span className='text-secondary-foreground truncate text-[13px]'>{children}</span>
      <ComboboxPrimitive.BadgeItemDelete
        data-slot='combobox-badge-item-delete'
        className='ring-offset-background focus-visible:ring-ring data-highlighted:bg-destructive shrink-0 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:outline-hidden'
      >
        <X className='size-3' />
      </ComboboxPrimitive.BadgeItemDelete>
    </ComboboxPrimitive.BadgeItem>
  );
}

function ComboboxContent({
  sideOffset = 6,
  onWheel,
  onTouchMove,
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Content>) {
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Content
        data-slot='combobox-content'
        sideOffset={sideOffset}
        onWheel={(event) => {
          event.stopPropagation();
          onWheel?.(event);
        }}
        onTouchMove={(event) => {
          event.stopPropagation();
          onTouchMove?.(event);
        }}
        className={cn(
          'border-border bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 pointer-events-auto z-[100] max-h-80 min-w-(--dice-anchor-width) origin-(--dice-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
          className,
        )}
        {...props}
      >
        {children}
      </ComboboxPrimitive.Content>
    </ComboboxPrimitive.Portal>
  );
}

function ComboboxLoading({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Loading>) {
  return (
    <ComboboxPrimitive.Loading
      data-slot='combobox-loading'
      className={cn('text-muted-foreground py-4 text-center text-sm', className)}
      {...props}
    >
      Đang tải...
    </ComboboxPrimitive.Loading>
  );
}

function ComboboxEmpty({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Empty>) {
  return (
    <ComboboxPrimitive.Empty
      data-slot='combobox-empty'
      className={cn('text-muted-foreground py-4 text-center text-sm', className)}
      {...props}
    >
      {children ?? 'Không tìm thấy kết quả.'}
    </ComboboxPrimitive.Empty>
  );
}

function ComboboxGroup({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Group>) {
  return (
    <ComboboxPrimitive.Group
      data-slot='combobox-group'
      className={cn('overflow-hidden', className)}
      {...props}
    />
  );
}

function ComboboxGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.GroupLabel>) {
  return (
    <ComboboxPrimitive.GroupLabel
      data-slot='combobox-group-label'
      className={cn('text-muted-foreground px-2 py-1.5 text-xs font-semibold', className)}
      {...props}
    />
  );
}

function ComboboxItem({
  className,
  children,
  outset = true,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Item> & {
  outset?: boolean;
}) {
  return (
    <ComboboxPrimitive.Item
      data-slot='combobox-item'
      className={cn(
        'data-highlighted:bg-accent-soft data-highlighted:text-fg relative flex w-full cursor-default items-center rounded-sm py-1.5 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50',
        outset ? 'pr-8 pl-2' : 'pr-2 pl-8',
        className,
      )}
      {...props}
    >
      <ComboboxPrimitive.ItemIndicator
        className={cn(
          'absolute flex size-3.5 items-center justify-center',
          outset ? 'right-2' : 'left-2',
        )}
      >
        <Check className='size-4' />
      </ComboboxPrimitive.ItemIndicator>
      <ComboboxPrimitive.ItemText>{children}</ComboboxPrimitive.ItemText>
    </ComboboxPrimitive.Item>
  );
}

function ComboboxSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxPrimitive.Separator>) {
  return (
    <ComboboxPrimitive.Separator
      data-slot='combobox-separator'
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

export {
  Combobox,
  ComboboxAnchor,
  ComboboxBadgeItem,
  ComboboxBadgeList,
  ComboboxCancel,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxLoading,
  ComboboxSeparator,
  ComboboxTrigger,
};
