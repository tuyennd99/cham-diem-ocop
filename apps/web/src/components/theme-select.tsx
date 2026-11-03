import { Monitor, Moon, Sun } from 'lucide-react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxTrigger,
} from '@/components/ui/combobox';

const themes: { value: Appearance; icon: typeof Sun; label: string }[] = [
  { value: 'system', icon: Monitor, label: 'Hệ thống' },
  { value: 'light', icon: Sun, label: 'Sáng' },
  { value: 'dark', icon: Moon, label: 'Tối' },
];

export function ThemeSelect() {
  const { appearance, updateAppearance } = useAppearance();
  const current = themes.find((t) => t.value === appearance);
  const CurrentIcon = current?.icon;

  return (
    <Combobox
      value={appearance}
      onValueChange={(value: string) => {
        if (value) updateAppearance(value as Appearance);
      }}
      readOnly
    >
      <ComboboxAnchor className='w-[140px]'>
        {CurrentIcon && <CurrentIcon className='size-4 shrink-0' />}
        <ComboboxInput placeholder='Giao diện' />
        <ComboboxTrigger />
      </ComboboxAnchor>
      <ComboboxContent align='end'>
        <ComboboxEmpty>Không tìm thấy.</ComboboxEmpty>
        {themes.map(({ value, icon: Icon, label }) => (
          <ComboboxItem key={value} value={value} label={label}>
            <span className='flex items-center gap-2'>
              <Icon className='size-4' />
              {label}
            </span>
          </ComboboxItem>
        ))}
      </ComboboxContent>
    </Combobox>
  );
}
