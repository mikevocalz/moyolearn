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
// It grows to MAX_LINES and then scrolls — see `use-autogrow.types` for why
// there is a cap at all.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textarea height web scrollheight

import { useLayoutEffect, useRef } from 'react';
import { MAX_LINES, type AutoGrowProps } from './use-autogrow.types';

export function useAutoGrow(value: string, floor: number): AutoGrowProps {
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
    const style = globalThis.getComputedStyle(field);
    const lineHeight = Number.parseFloat(style.lineHeight);
    const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
    const max = Number.isNaN(lineHeight) ? Infinity : lineHeight * MAX_LINES + padding;

    // Floored by the row's resting height, so the measured content height can
    // never write the field shorter than the keys standing beside it.
    const next = Math.max(floor, Math.min(field.scrollHeight, max));
    field.style.height = `${next}px`;
    // Only scroll once it is actually capped, so a one-line answer never shows
    // a scrollbar track.
    field.style.overflowY = field.scrollHeight > max ? 'auto' : 'hidden';
  }, [value, floor]);

  /*
    The floor is returned as well as read, because the element the effect writes
    to only exists after the first paint — without it the field would render one
    frame shorter than the keys beside it before settling onto the row. No cap
    here: the effect above computes a truer one from the element's own metrics.
  */
  return { ref, style: { minHeight: floor } };
}
