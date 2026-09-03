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

/*
  THE STALL BUDGET.

  A hung request is worse than a failed one: `fetch` has no timeout of its own,
  so a dropped connection on a congested network leaves the promise pending
  forever and the stage sits on "Thinking" with no way out but killing the app.
  A child reads that as the tutor ignoring them. The store already owns a
  graceful destination for a turn that never arrived — `{ kind: 'retry' }`,
  which draws "I couldn't reach Natalie just then. Your work is saved." and a
  button — and these are what make it reachable.

  Two numbers, not one, because the two failures look nothing alike. The first
  covers the wait for response HEADERS, which is a live connection question.
  The second is re-armed on every frame and covers a stream that opened and
  then went quiet, which is the failure a single overall deadline either fires
  on too early (a long, healthy turn) or never (a socket held open by a dead
  peer).

  Deliberately shorter than a server-side model timeout: the point is to reach
  the retry line while the room is still watching, not to be precisely right
  about whose fault it was.
*/
export const COACH_RESPONSE_TIMEOUT_MS = 12_000;
export const COACH_STALL_TIMEOUT_MS = 15_000;

/**
 * The same discipline for one spoken sentence (`/api/tutor/voice`).
 *
 * Shorter, because voice is a garnish on words the child already has: the
 * queue's own failure path is to move on in text, so the only thing a timeout
 * buys here is that it moves on at all. Without one a single hung POST leaves
 * `isPlaying` true and every later sentence of the turn queued behind it —
 * silence for the rest of the turn, which is the exact outcome the 204
 * text-only contract exists to avoid.
 */
export const VOICE_SENTENCE_TIMEOUT_MS = 8_000;

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
