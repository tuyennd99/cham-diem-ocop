import { memo } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageContainerProps extends ComponentProps<'section'> {
  children: ReactNode;
}

export const PageContainer = memo(function PageContainer({
  className,
  children,
  ...props
}: PageContainerProps) {
  return (
    <section className={cn('admin-page', className)} {...props}>
      {children}
    </section>
  );
});

export interface PageHeaderProps extends Omit<ComponentProps<'div'>, 'title'> {
  backLink?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export const PageHeader = memo(function PageHeader({
  backLink,
  eyebrow,
  title,
  badge,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div className={cn('admin-page-heading', className)} {...props}>
      <div>
        {backLink && <div className='mb-1.5'>{backLink}</div>}
        {eyebrow && <p className='eyebrow'>{eyebrow}</p>}
        {badge ? (
          <div className='flex flex-wrap items-center gap-3'>
            <h1 className={backLink ? 'mt-1' : undefined}>{title}</h1>
            {badge}
          </div>
        ) : (
          <h1 className={backLink ? 'mt-1' : undefined}>{title}</h1>
        )}
        {/* {description && <p className='route-intro'>{description}</p>} */}
      </div>
      {actions && <div className='admin-actions'>{actions}</div>}
    </div>
  );
});

export interface FilterPanelProps extends ComponentProps<'div'> {
  children: ReactNode;
}

export const FilterPanel = memo(function FilterPanel({
  className,
  children,
  ...props
}: FilterPanelProps) {
  return (
    <div className={cn('admin-form filter-card', className)} {...props}>
      {children}
    </div>
  );
});

export interface PageSectionProps extends ComponentProps<'section'> {
  children: ReactNode;
}

export const PageSection = memo(function PageSection({
  className,
  children,
  ...props
}: PageSectionProps) {
  return (
    <section className={cn('admin-table-region p-6', className)} {...props}>
      {children}
    </section>
  );
});
