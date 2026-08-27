// Handoff-code grammar — the client-safe half of device handoff. The learner
// redeem screen validates and normalizes with these before any network call;
// the crypto (hashing, credential rotation, sign-in) stays in handoff.ts,
// which never enters a client bundle path that needs it.
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: handoff code alphabet normalize well-formed qr url client

/**
 * No I/L/O/0/1: a guardian reads this aloud across a room to a child, and the
 * glyphs that survive that channel are the whole alphabet (Crockford's base32
 * reasoning). 6 of 31 ≈ 8.9e8 codes against a 15-minute, single-use window.
 */
export const HANDOFF_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const HANDOFF_CODE_LENGTH = 6;
export const HANDOFF_TTL_MS = 15 * 60 * 1000;

/** Forgiving on the child's side: case, spaces and dashes all normalize away. */
export function normalizeHandoffCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

export function isWellFormedHandoffCode(raw: string): boolean {
  const code = normalizeHandoffCode(raw);
  return (
    code.length === HANDOFF_CODE_LENGTH && [...code].every((c) => HANDOFF_CODE_ALPHABET.includes(c))
  );
}

/** The QR payload — the same code, wrapped for the camera path. */
export function handoffUrl(code: string): string {
  return `moyo://handoff?code=${normalizeHandoffCode(code)}`;
}
