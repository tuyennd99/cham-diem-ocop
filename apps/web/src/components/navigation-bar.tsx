import { useCallback, useEffect, useRef } from 'react';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css';
import { useRouterState } from '@tanstack/react-router';

NProgress.configure({
  showSpinner: false,
  minimum: 0.08,
  trickleSpeed: 100,
});

export function NavigationLoadingBar() {
  const isLoading = useRouterState({
    select: (state) => state.status === 'pending',
  });
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFinishTimer = useCallback(() => {
    if (finishTimer.current) {
      clearTimeout(finishTimer.current);
      finishTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearFinishTimer();
      NProgress.done(true);
    };
  }, [clearFinishTimer]);

  useEffect(() => {
    if (isLoading) {
      clearFinishTimer();
      NProgress.start();
    } else {
      clearFinishTimer();
      NProgress.done();
    }
  }, [clearFinishTimer, isLoading]);

  return null;
}
