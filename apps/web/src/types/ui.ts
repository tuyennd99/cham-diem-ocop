import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | null;
  size?: 'default' | 'sm' | 'lg' | 'icon' | null;
  asChild?: boolean;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;
