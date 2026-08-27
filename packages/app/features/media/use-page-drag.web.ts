'use client';
// `drag-over-page` (doc 30 §5): the whole page acknowledges an incoming drag,
// because a small target on a large screen is hard to hit precisely. Web-only —
// there is no page-level drag on touch, and the native fork says so by
// returning false forever.
//
// A COUNTER, not a boolean: dragenter/dragleave fire for every element the
// drag crosses, so a boolean flickers off at each boundary. The counter only
// reaches zero when the drag has really left the window (or dropped).
// SOT: docs/pack/30-upload-surfaces-spec.md §5
// SOT-KEYWORDS: page drag state window listener dropzone acknowledge web
import { useEffect } from 'react';
import { useInstanceStore, useStore } from '@acme/ui';

export function usePageDrag(): boolean {
  const store = useInstanceStore<{ depth: number }>(() => ({ depth: 0 }));

  useEffect(() => {
    const bump = (by: number) => store.setState((s) => ({ depth: Math.max(0, s.depth + by) }));
    const enter = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) bump(1);
    };
    const leave = () => bump(-1);
    const drop = () => store.setState({ depth: 0 });
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [store]);

  return useStore(store, (s) => s.depth > 0);
}
