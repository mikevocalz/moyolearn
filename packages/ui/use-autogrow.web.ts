// Grow-with-content height for the composer field — web.
//
// A `<textarea>` does not size to its content; it keeps whatever `rows` gives it
// and scrolls. That is what pinned a one-line answer to the top of an oversized
// box. Measuring `scrollHeight` and writing it back is the standard fix, and it
// is a DOM technique, which is why it lives in a `.web` fork rather than in the
// shared component pretending to be universal.
//
// Height is reset to `auto` before measuring: `scrollHeight` never reports less
// than the current height, so without the reset the field can only ever grow.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textarea height web scrollheight

import { useLayoutEffect, useRef } from 'react';

export function useAutoGrow(value: string): { ref: React.RefObject<HTMLTextAreaElement | null> } {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = `${field.scrollHeight}px`;
  }, [value]);

  return { ref };
}
