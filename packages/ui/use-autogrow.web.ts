// Grow-with-content height for the composer field — web.
//
// A `<textarea>` does not size to its content; it keeps whatever `rows` gives it
// and scrolls. That is what pinned a one-line answer to the top of an oversized
// box. Measuring `scrollHeight` and writing it back is the fix.
//
// Height is reset to `auto` before measuring: `scrollHeight` never reports less
// than the current height, so without the reset the field could only ever grow
// and would never shrink back when text is deleted.
//
// It grows to MAX_LINES and then scrolls. Unbounded growth pushed the whole
// conversation off the top of the screen — a child pasting a word problem lost
// sight of the question they were answering. Four lines is where a typed answer
// stops being a sentence and starts being an essay; past that, the field
// scrolls and the thread stays visible.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textarea height web scrollheight

import { useLayoutEffect, useRef } from 'react';
import type { AutoGrowProps } from './use-autogrow.types';

/** Lines of text the field grows to before it starts scrolling. */
export const MAX_LINES = 4;

export function useAutoGrow(value: string): AutoGrowProps {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const field = ref.current;
    if (!field) return;

    field.style.height = 'auto';

    /*
      The cap is computed from the field's OWN line-height rather than a fixed
      pixel value, because the type ramp is dialled per surface — `text-body` is
      15px in ops chrome and 17px in front of a child, so a hardcoded max would
      be four lines for one and three for the other.
    */
    const lineHeight = Number.parseFloat(globalThis.getComputedStyle(field).lineHeight);
    const style = globalThis.getComputedStyle(field);
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const max = Number.isNaN(lineHeight) ? Infinity : lineHeight * MAX_LINES + padding;

    const next = Math.min(field.scrollHeight, max);
    field.style.height = `${next}px`;
    // Only scroll once it is actually capped, so a one-line answer never shows
    // a scrollbar track.
    field.style.overflowY = field.scrollHeight > max ? 'auto' : 'hidden';
  }, [value]);

  return { ref };
}
