'use client';
// Web online/offline detection via the standard window events.
// SOT: packages/app/features/media/TransferTray.tsx
// SOT-KEYWORDS: online offline network web navigator
import { useSyncExternalStore } from 'react';

const getSnapshot = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);

const subscribe = (callback: () => void) => {
  const on = () => callback();
  window.addEventListener('online', on);
  window.addEventListener('offline', on);
  return () => {
    window.removeEventListener('online', on);
    window.removeEventListener('offline', on);
  };
};

/** Returns true when the browser reports a network connection. */
export function useOnline() {
  return useSyncExternalStore(subscribe, getSnapshot, () => true);
}
