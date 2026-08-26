// Grow-with-content height for the composer field — web.
//
// A `<textarea>` does not size to its content; it keeps whatever `rows` gives it
// and scrolls. That is what pinned a one-line answer to the top of an oversized
// box. Measuring `scrollHeight` and writing it back is the fix.
//
// Height is reset to `auto` before measuring: `scrollHeight` never reports less
// than the current height, so without the reset the field could only ever grow
// and would never shrink back when text is deleted.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textarea height web scrollheight

import { useLayoutEffect, useRef } from 'react';
import type { AutoGrowProps } from './use-autogrow.types';

export function useAutoGrow(value: string): AutoGrowProps {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return { ref };
}
