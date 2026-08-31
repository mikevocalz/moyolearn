// Tutor shared constants.
//
// Kept out of `tutor.store.ts` so the audio queue and the store can both read
// the API base URL without a circular import.
// SOT: packages/app/features/tutor/tutor.store.ts · packages/app/features/tutor/tutor-audio.ts
// SOT-KEYWORDS: tutor api url constants base tutor view presentation

import type { AgeBand } from '../capture/age-band.ts';

/** The tutor API base for the current platform. */
export const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

/**
 * Natalie's presentation. These are display values; they do not change the
 * model, voice, captions, or learning policy.
 */
export type TutorView = 'visible' | 'compact' | 'hidden';

/**
 * Doc 23 §3's default presentation by age band. A child can override this, but
 * the room starts here.
 */
export function recommendedTutorViewFor(ageBand: AgeBand): TutorView {
  switch (ageBand) {
    case 'young':
    case 'child':
      return 'visible';
    case 'teen':
      return 'compact';
    case 'adult':
    default:
      return 'hidden';
  }
}
