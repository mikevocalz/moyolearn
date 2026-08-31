// Tutor shared constants.
//
// Kept out of `tutor.store.ts` so the audio queue and the store can both read
// the API base URL without a circular import.
// SOT: packages/app/features/tutor/tutor.store.ts · packages/app/features/tutor/tutor-audio.ts
// SOT-KEYWORDS: tutor api url constants base tutor view presentation

import type { AgeBand } from '../capture/age-band.ts';
import type { TutorPresencePreference } from '@acme/ui';

/** The tutor API base for the current platform. */
export const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

/**
 * The baseline presentation for the learner's age band when no explicit
 * preference is set. Screen size, reduced motion, and device state are resolved
 * at the screen level; this is only the starting register.
 */
export function recommendedTutorPresenceFor(ageBand: AgeBand): TutorPresencePreference {
  switch (ageBand) {
    case 'young':
    case 'child':
      return 'visible';
    case 'teen':
      return 'compact';
    case 'adult':
    default:
      // 9-12 and unknown bands are treated as the adult register.
      return 'compact';
  }
}
