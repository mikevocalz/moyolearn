'use client';
// Is the device online right now — one subscription, one answer.
//
// Screens were writing the offline branch of their contract (`failure_paths.
// offline`) with no way to know they were in it, so the branch existed in the
// contract and nowhere in the tree. This is the signal that makes it renderable.
//
// Built on TanStack Query's `onlineManager` rather than `navigator.onLine`
// directly: it is already the thing that decides whether a query may run, so a
// banner reading a second source would eventually disagree with the fetches it
// is describing. On web the manager listens to the window's online/offline
// events out of the box; where nothing reports connectivity it stays true, which
// is the right default — a false "you're offline" is worse than none.
//
// `useSyncExternalStore` because the value is external and changes outside
// React; a `useEffect` copy of it renders one frame stale on every transition.
// SOT: packages/app/providers/query-provider.tsx
// SOT-KEYWORDS: online offline connectivity network banner sync external store onlineManager

import { useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (onChange: () => void): (() => void) => onlineManager.subscribe(onChange);
const getSnapshot = (): boolean => onlineManager.isOnline();
// The server has no connectivity to report on the reader's behalf, and an SSR
// pass that guessed "offline" would flash a banner into the first paint.
const getServerSnapshot = (): boolean => true;

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
