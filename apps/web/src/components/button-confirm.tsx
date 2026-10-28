import * as React from 'react';
import { Spinner } from '@/components/spinner-1';
import { Button } from '@/components/ui/button';

type ConfirmIntent = 'create' | 'update' | 'delete';

type BaseButtonProps = React.ComponentProps<typeof Button>;

const defaultLabelByIntent: Record<ConfirmIntent, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
};

const defaultLoadingLabelByIntent: Record<ConfirmIntent, string> = {
  create: 'Creating...',
  update: 'Updating...',
  delete: 'Deleting...',
};

const defaultButtonPropsByIntent: Record<
  ConfirmIntent,
  Pick<BaseButtonProps, 'variant' | 'type'>
> = {
  create: {
    variant: 'default',
    type: 'button',
  },
  update: {
    variant: 'default',
    type: 'button',
  },
  delete: {
    variant: 'destructive',
    type: 'button',
  },
};

export interface ButtonLoadingProps extends BaseButtonProps {
  intent?: ConfirmIntent;
  loading?: boolean;
  loadingText?: string;
  children?: React.ReactNode;
}

export function ButtonLoading({
  intent = 'create',
  loading = false,
  loadingText,
  children,
  disabled,
  ...restButtonProps
}: ButtonLoadingProps) {
  const content =
    children ??
    (loading ? (loadingText ?? defaultLoadingLabelByIntent[intent]) : defaultLabelByIntent[intent]);

  return (
    <Button
      type='submit'
      variant={defaultButtonPropsByIntent[intent].variant}
      disabled={disabled || loading}
      {...defaultButtonPropsByIntent[intent]}
      {...restButtonProps}
    >
      {content}
      {loading ? <Spinner color='white' size={16} /> : null}
    </Button>
  );
}
