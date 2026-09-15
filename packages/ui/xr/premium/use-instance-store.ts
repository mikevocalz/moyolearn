// Project rule: never React useState. Component-local, multi-instance-safe
// state lives in a vanilla zustand store held in a ref (a stable container,
// not React state). Mirrors @acme/ui's use-instance-store so spatial (Viro)
// components don't depend on the RN UI kit.
import { useRef } from 'react';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { useStore } from 'zustand';

export function useInstanceStore<S>(init: () => S): StoreApi<S> {
  const ref = useRef<StoreApi<S> | null>(null);
  ref.current ??= createStore<S>(() => init());
  return ref.current;
}

export { useStore };
