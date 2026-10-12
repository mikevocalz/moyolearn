'use client';

import { useMemo } from 'react';
import { useInstanceStore, useStore } from '@acme/ui';

/** Transient values belong to each mounted experiment, never a shared session. */
export function useScienceValue<T>(initial: T) {
  const store = useInstanceStore(() => ({ value: initial }));
  const value = useStore(store, (state) => state.value);
  const setValue = useMemo(() => (next: T | ((previous: T) => T)) => {
    store.setState({ value: typeof next === 'function'
      ? (next as (previous: T) => T)(store.getState().value) : next });
  }, [store]);
  return [value, setValue] as const;
}
