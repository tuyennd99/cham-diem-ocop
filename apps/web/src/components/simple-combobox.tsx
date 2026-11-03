'use client';

import { isEmpty } from 'lodash';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';

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
  emptyText = 'Không tìm thấy.',
  className,
  disabled,
  showSearch = true,
}: SimpleComboboxProps) {
  return (
    <Combobox
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      readOnly={!showSearch}
      autoHighlight
    >
      <ComboboxAnchor className={className}>
        <ComboboxInput id={id} placeholder={placeholder} />
        <ComboboxTrigger />
      </ComboboxAnchor>
      <ComboboxContent>
        <ComboboxEmpty>{isEmpty(options) ? 'Không có dữ liệu' : emptyText}</ComboboxEmpty>
        {options.map((option) => (
          <ComboboxItem
            key={option.value}
            value={option.value}
            label={option.label}
            disabled={option.disabled}
          >
            {option.label}
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
