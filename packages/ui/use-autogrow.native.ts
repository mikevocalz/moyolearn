// Grow-with-content height for the composer field — native.
//
// An earlier version of this file was a no-op on the claim that RN's multiline
// TextInput grows by itself. It does not: without an explicit height it settles
// at its default line count and scrolls, exactly like an unmanaged `<textarea>`.
// The mechanism RN gives you is `onContentSizeChange`, which reports the height
// the content actually needs; you store it and hand it back as a style.
//
// Two things this has to get right, both of which are why it is not two lines:
//
// 1. Only commit a height that CHANGED. Writing height on every callback feeds
//    the new frame back into the next measurement, and on Android that is a
//    render loop rather than a wobble.
// 2. Never go below one line. Android reports a content height of 0 on the first
//    pass before layout settles, which would collapse the field to nothing.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textinput height native oncontentsizechange android

import { useCallback, useState } from 'react';
import type { AutoGrowProps, ContentSizeChangeEvent } from './use-autogrow.types';

/**
 * One line of `text-body` (17px) at the composer's line height, plus the
 * field's vertical padding and border. Matches the web fork's resting height so
 * the composer is the same size on both platforms.
 */
const MIN_HEIGHT = 46;

export function useAutoGrow(_value: string): AutoGrowProps {
  const [height, setHeight] = useState(MIN_HEIGHT);

  const onContentSizeChange = useCallback((event: ContentSizeChangeEvent) => {
    const measured = Math.max(MIN_HEIGHT, Math.round(event.nativeEvent.contentSize.height));
    // Sub-pixel jitter between frames is normal; only a real change is worth a
    // re-render, and re-rendering on noise is what starts the Android loop.
    setHeight((current) => (Math.abs(current - measured) > 1 ? measured : current));
  }, []);

  return { onContentSizeChange, style: { height } };
}
