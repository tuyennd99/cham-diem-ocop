import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (handleStoreChange: () => void) => {
  const mediaQuery = window.matchMedia(MOBILE_QUERY);
  mediaQuery.addEventListener('change', handleStoreChange);
  return () => mediaQuery.removeEventListener('change', handleStoreChange);
};

const getSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const getServerSnapshot = () => false;

export const useIsMobile = () =>
  React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
