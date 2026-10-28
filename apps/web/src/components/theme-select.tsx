import { Monitor, Moon, Sun } from 'lucide-react';
import type { Appearance } from '@/hooks/use-appearance';
import { useAppearance } from '@/hooks/use-appearance';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const themes: { value: Appearance; icon: typeof Sun; label: string }[] = [
  { value: 'system', icon: Monitor, label: 'Hệ thống' },
  { value: 'light', icon: Sun, label: 'Sáng' },
  { value: 'dark', icon: Moon, label: 'Tối' },
];

export function ThemeSelect() {
  const { appearance, updateAppearance } = useAppearance();

  return (
    <Select
      value={appearance}
      onValueChange={(value: string) => updateAppearance(value as Appearance)}
    >
      <SelectTrigger className='w-[140px]'>
        <SelectValue>
          {(() => {
            const current = themes.find((t) => t.value === appearance);
            if (!current) return null;
            const Icon = current.icon;
            return (
              <span className='flex items-center gap-2'>
                <Icon className='size-4' />
                {current.label}
              </span>
            );
          })()}
        </SelectValue>
      </SelectTrigger>
      <SelectContent position='popper' align='end'>
        {themes.map(({ value, icon: Icon, label }) => (
          <SelectItem key={value} value={value}>
            <Icon className='size-4' />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
