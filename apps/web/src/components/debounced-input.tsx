import { debounce } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEventHandler, ComponentProps } from 'react';
import { Input } from '@/components/ui/input';

type DebouncedInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'defaultValue'> & {
  value: string;
  delay?: number;
  onValueChange: (value: string) => void;
};

function DebouncedInput({
  value,
  delay = 250,
  onValueChange,
  onChange,
  onBlur,
  ...props
}: DebouncedInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Keep the latest callback in a ref so the debounced fn stays stable even
  // when the caller passes a new onValueChange identity each render.
  const onValueChangeRef = useRef(onValueChange);
  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  const debouncedValueChange = useMemo(
    // Ref read is deferred to when the debounced callback fires, not render-time.
    // eslint-disable-next-line react-hooks/refs
    () => debounce((nextValue: string) => onValueChangeRef.current(nextValue), delay),
    [delay],
  );

  // Sync external value resets into the input (adjust state during render).
  if (prevValue !== value) {
    setPrevValue(value);
    setInputValue(value);
    debouncedValueChange.cancel();
  }

  useEffect(() => {
    return () => {
      debouncedValueChange.cancel();
    };
  }, [debouncedValueChange]);

  const handleChange: ChangeEventHandler<HTMLInputElement> = (event) => {
    const nextValue = event.target.value;

    setInputValue(nextValue);
    onChange?.(event);
    debouncedValueChange(nextValue);
  };

  return (
    <Input
      {...props}
      value={inputValue}
      onChange={handleChange}
      onBlur={(event) => {
        debouncedValueChange.flush();
        onBlur?.(event);
      }}
    />
  );
}

export { DebouncedInput };
