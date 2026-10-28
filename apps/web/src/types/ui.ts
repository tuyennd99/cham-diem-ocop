import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from 'react';
import type { BreadcrumbItem } from '@/types/navigation';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
  'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link' | null;
  size?: 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | null;
  asChild?: boolean;
  loading?: boolean;
}

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export type AppLayoutProps = {
  children: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
};

export type AppVariant = 'header' | 'sidebar';

export type AuthLayoutProps = {
  children?: ReactNode;
  name?: string;
  title?: string;
  description?: string;
};

export type UserActionType = 'CREATE' | 'UPDATE' | 'DELETE';

export type UISize = 'sm' | 'default' | 'lg';
