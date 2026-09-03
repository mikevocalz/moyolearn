// Tutor shared constants.
//
// Kept out of `tutor.store.ts` so the audio queue and the store can both read
// the API base URL without a circular import.
// SOT: packages/app/features/tutor/tutor.store.ts · packages/app/features/tutor/tutor-audio.ts
// SOT-KEYWORDS: tutor api url constants base tutor view presentation

import type { AgeBand } from '../capture/age-band.ts';
import type { ResolvedTutorPresence } from '@acme/ui';

/** Re-exported so the tutor feature's existing importers keep one import site. */
export { API_URL } from '../../core/api-url.ts';

/**
 * The baseline presentation for the learner's age band when no explicit
 * preference is set. Screen size, reduced motion, and device state are resolved
 * at the screen level; this is only the starting register.
 *
 * Returns a RESOLVED presence: a recommendation that could itself be `auto`
 * would be a question answering a question, and the screen has to be able to
 * hand the result straight to a component that draws her.
 */
export function recommendedTutorPresenceFor(ageBand: AgeBand): ResolvedTutorPresence {
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
