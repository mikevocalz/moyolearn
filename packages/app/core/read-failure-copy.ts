// What a screen SAYS when a read did not land, decided from the failure itself.
//
// `ReadFailure` (packages/ui) owns the shape; this owns the sentence, because
// the sentence depends on the cause and every screen was guessing it. The one
// that mattered: an expired session and a dropped connection both arrived as
// "an error", so six surfaces told a signed-out reader to "try again" — an
// action that fails identically forever. A retry loop with no exit is a dead end
// wearing a button.
//
// Two causes, two sentences, one place:
//   · 401 — the session ended. Say so, and the way out is signing in.
//   · anything else — the read failed. Say so, and the way out is retrying.
//
// Both carry a REASSURANCE the caller supplies, and it is required rather than
// optional. On a family surface a failed read is frightening in proportion to
// what the screen is about — a parent who cannot load Alerts does not read
// "error", they read "something happened to my child" — so every failure here
// owes an explicit statement of what did NOT happen.
// SOT: packages/app/core/api-fetch.ts · packages/ui/ReadFailure.tsx
// SOT-KEYWORDS: read failure copy signed out session expired honest error retry family tone

import { isUnauthenticated } from './api-fetch.ts';

export interface ReadFailureCopy {
  title: string;
  description: string;
  /** The caller renders a sign-in exit instead of leaning on retry alone. */
  signedOut: boolean;
}

/**
 * @param subject What could not be read, in the reader's words and lower case
 *   — "your alerts", "this report". It is spoken mid-sentence in both branches.
 * @param reassurance What is still true despite the failure, as a full sentence.
 */
export function readFailureCopy(
  error: unknown,
  subject: string,
  reassurance: string,
): ReadFailureCopy {
  if (isUnauthenticated(error)) {
    return {
      title: 'You’ve been signed out',
      description: `${reassurance} Sign in again to see ${subject}.`,
      signedOut: true,
    };
  }
  return {
    title: `We couldn’t load ${subject}`,
    description: `${reassurance} This screen just needs a connection.`,
    signedOut: false,
  };
}
