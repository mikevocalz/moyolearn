// Shared contract for the composer's grow-with-content behaviour.
//
// The two platforms do not share a mechanism, only a goal. Web measures the
// element's `scrollHeight` and writes a height back; native never measures the
// DOM because there isn't one — RN reports content size through a callback.
// Both forks return props the field spreads, so `Composer` stays platform-free.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textarea height shared types fork

import type { RefObject } from 'react';

/** RN's `onContentSizeChange` payload, narrowed to the part we use. */
export interface ContentSizeChangeEvent {
  nativeEvent: { contentSize: { height: number } };
}

export interface AutoGrowProps {
  /** Web: the element to measure. Undefined on native. */
  ref?: RefObject<HTMLTextAreaElement | null>;
  /** Native: RN's report of how tall the content actually is. */
  onContentSizeChange?: (event: ContentSizeChangeEvent) => void;
  /** Native: the measured height, applied back to the field. */
  style?: { height: number };
}
