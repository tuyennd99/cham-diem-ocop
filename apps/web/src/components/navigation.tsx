import type { ComponentProps } from 'react';
import {
  Link as TanStackLink,
  useLocation as useTanStackLocation,
  useNavigate as useTanStackNavigate,
} from '@tanstack/react-router';

type LinkProps = Omit<ComponentProps<typeof TanStackLink>, 'to'> & {
  to: string;
};

export function Link({ to, ...props }: LinkProps) {
  return <TanStackLink {...props} to={to} />;
}

type NavigateOptions = {
  replace?: boolean;
};

export function useNavigate() {
  const navigate = useTanStackNavigate();

  return (to: string | number, options?: NavigateOptions) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }

    return navigate({ to, replace: options?.replace });
  };
}

export function useLocation() {
  return useTanStackLocation();
}
