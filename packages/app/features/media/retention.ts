// How long a child's uploaded media lives.
//
// Seven days, and shorter than everything around it on purpose. Doc 07 §4 gives
// a raw transcript 30 days and a derived fact 400, on the reasoning that the
// further something is from the child's own voice, the longer it may live.
// Media is the closest thing there is: a photograph of a child's handwriting, or
// a recording of them speaking. It gets the shortest window in the product.
//
// A week is chosen against a real need rather than a round number — a guardian
// or tutor reviewing "what happened in this week's session" is the case that
// requires the file to still exist. Nothing in the product asks for it later.
//
// The TEXT survives: the OCR reading and the transcript of a voice note are what
// the tutoring was actually built on, and they are covered by the transcript's
// own 30-day window. What expires is the original picture and the original
// audio — the raw capture of a child.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 · packages/student-model/src/facts.ts
// SOT-KEYWORDS: media retention ttl expiry delete bunny privacy child data erasure
export const MEDIA_TTL_DAYS = 7;

export const mediaExpiry = (from: Date): string =>
  new Date(from.getTime() + MEDIA_TTL_DAYS * 86_400_000).toISOString();

export const isMediaExpired = (expiresAt: string | undefined, now: Date): boolean =>
  expiresAt !== undefined && Date.parse(expiresAt) <= now.getTime();

/**
 * Everything past its window, for a sweep to delete.
 *
 * Returns the STORAGE KEYS rather than the records, because the caller's job is
 * to delete objects — and handing it whole attachments invites it to decide
 * which ones it feels like removing.
 */
export function expiredKeys(
  items: readonly { storageKey?: string; expiresAt?: string }[],
  now: Date,
): string[] {
  return items
    .filter((item) => item.storageKey !== undefined && isMediaExpired(item.expiresAt, now))
    .map((item) => item.storageKey as string);
}
