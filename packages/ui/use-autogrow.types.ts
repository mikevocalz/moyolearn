// Shared contract for the composer's grow-with-content behaviour.
//
// The two platforms do not share a mechanism, only a goal. Web measures the
// element's `scrollHeight` and writes a height back; native never measures the
// DOM because there isn't one — the Compose/SwiftUI host measures its own text
// and the hook only has to hand it the bounds to measure within.
// Both forks return props the field spreads, so `Composer` stays platform-free.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5
// SOT-KEYWORDS: autogrow composer textarea height shared types fork

import type { RefObject } from 'react';

/**
 * Lines the field grows to before it scrolls inside itself.
 *
 * Shared by both forks because it is the same product decision on either
 * platform: unbounded growth pushed the whole conversation off the top of the
 * screen, so a child pasting a word problem lost sight of the question they
 * were answering. Four lines is where a typed answer stops being a sentence
 * and starts being an essay.
 */
export const MAX_LINES = 4;

export interface AutoGrowProps {
  /** Web: the element to measure. Undefined on native. */
  ref?: RefObject<HTMLTextAreaElement | null>;
  /**
   * The height the field is allowed to move between.
   *
   * `minHeight` is LOAD-BEARING, not cosmetic — see the native fork. It is a
   * style rather than a class because the native field is a hosted Compose
   * view and a className never reaches the host that measures the text.
   *
   * `maxHeight` is native-only: the web fork measures the element's real
   * line-height in an effect and writes the cap as a height, which is a truer
   * four lines than any number this contract could carry.
   */
  style: { minHeight: number; maxHeight?: number };
}
