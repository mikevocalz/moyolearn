// What a learner's device is allowed to keep (doc 07-security §2.2).
//
// "Client caches hold schedule/mastery projections, never conversation bodies."
// The check is deliberately shape-based rather than a key allowlist, because the
// failure it prevents is a feature caching a reply under an innocent key. Free
// prose is the signal: a projection is numbers, dates, ids and short labels, and
// a 400-character string in a cache entry is a tutoring turn no matter what the
// key is called.
//
// It errs toward refusing. A refused cache write costs a network round trip; a
// permitted one puts a child's conversation on a shared iPad, and only one of
// those is on the list of things this product is judged on.
// SOT: docs/pack/07-security-spec.md §2.2
// SOT-KEYWORDS: projection learner cache transcript prose refuse shape check

/** Longer than any label, shorter than any real tutoring turn. */
export const MAX_CACHED_STRING = 240;

const TRANSCRIPT_KEYS = /(transcript|message|turn|reply|utterance|conversation|chat|prompt)/i;

const offendingString = (value: unknown): string | null => {
  if (typeof value === 'string') return value.length > MAX_CACHED_STRING ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = offendingString(item);
      if (hit !== null) return hit;
    }
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      if (TRANSCRIPT_KEYS.test(key)) return `${key}: ${String(item).slice(0, 40)}`;
      const hit = offendingString(item);
      if (hit !== null) return hit;
    }
  }
  return null;
};

export function assertNotTranscriptShaped(key: string, value: unknown): void {
  if (TRANSCRIPT_KEYS.test(key)) {
    throw new Error(
      `Refusing to cache "${key}" on a learner device: conversation bodies never leave the server (doc 07 §2.2).`,
    );
  }
  const offender = offendingString(value);
  if (offender !== null) {
    throw new Error(
      `Refusing to cache "${key}": the value looks like a conversation body, not a projection (${offender.slice(0, 60)}…).`,
    );
  }
}
