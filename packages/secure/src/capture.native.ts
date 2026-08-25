// PLATFORM FORK — screen-capture prevention (doc 07-security §2.5).
//
// `expo-screen-capture` sets FLAG_SECURE on Android, which blocks screenshots,
// screen recording AND the recents-carousel thumbnail in one call; on iOS the
// module can only detect a screenshot after the fact, so the same hook does two
// different jobs per platform and the surfaces below need both.
//
// Which surfaces: payment-method entry and the internal support view, per §2.5.
// The learner and family shells get it for the app-switcher reason — a child's
// name and their work should not sit in the recents carousel where the next
// person to open the iPad sees it without unlocking anything.
// SOT: docs/pack/07-security-spec.md §2.5
// SOT-KEYWORDS: screen capture flag_secure screenshot recents blur payment support learner

import { useEffect } from 'react';
import { preventScreenCaptureAsync, allowScreenCaptureAsync } from 'expo-screen-capture';

/**
 * Tags are per-surface so two protected screens mounted at once (a payment sheet
 * over the support view) cannot un-protect each other: the module reference-counts
 * by tag, and a shared tag would make the first unmount release the flag.
 */
export type CaptureGuard = 'payment' | 'support' | 'learner-shell' | 'family-shell';

export function useScreenCaptureGuard(tag: CaptureGuard): void {
  useEffect(() => {
    let released = false;
    void preventScreenCaptureAsync(tag);
    return () => {
      if (released) return;
      released = true;
      void allowScreenCaptureAsync(tag);
    };
  }, [tag]);
}
