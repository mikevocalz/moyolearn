// The spoken-utterance tag — how the voice route knows a sentence is Natalie's.
//
// THE CHOICE THIS FILE IS, spelled out because doc 32's hardest structural rule
// ("nothing learner-authored may reach the TTS payload") hangs on it. Two ways
// to deliver audio for a coaching turn were on the table:
//
//   a) grow the `CoachEvent` union an `audio` frame kind. The union is
//      load-bearing — `tooling/check-fail-closed.mjs` pins its terminal frames,
//      every exhaustive consumer switches on it, and interleaving audio bytes
//      into the SSE stream couples the safety transport to a vendor's mp3
//      framing. Rejected.
//   b) a separate `/api/tutor/voice` route that renders ONLY sentences the
//      server already emitted. Chosen — but "already emitted" cannot be proved
//      against the session's STORED turns, because the message route lets the
//      client append `role: 'tutor'` rows (`session.client.ts:remember` is the
//      legitimate writer), so stored turns are client-writable and verifying
//      against them would be trusting the client with different paperwork.
//
// So the proof is a MAC instead: as the coach route streams a plane-passed
// chunk, it mints `HMAC(secret, [v, tone, previousText, text])` and rides it on
// the wire frame beside the text. The voice route recomputes and compares.
// Only the server holds the secret, and the server only ever mints tags for
// text that just left `runSafetyPlaneStream` — so the ONLY payloads the TTS
// egress can be asked to speak are, structurally, Natalie's screened output
// (this path) and the frozen baked scripts. A learner's own words never
// acquire a valid tag, whatever they type and whatever they store.
//
// The tag binds tone and `previous_text` too, because both are part of the TTS
// payload — an attacker who could swap `previousText` would be feeding the
// provider text of their choosing under a valid tag. It deliberately does NOT
// bind time: replaying a tag re-renders a sentence Natalie already said, which
// is the same audio the child already heard, at the replayer's own budget.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · packages/app/features/tutor/coach.service.ts (CoachEvent) · tooling/check-voice-egress.mjs
// SOT-KEYWORDS: voice utterance tag hmac mint verify server emitted sentence window tts payload learner authored never
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { DEFAULT_TONE, OPENING_TONE } from '@acme/voice';

/** Versioned into the MAC so a future payload change invalidates old tags. */
const TAG_VERSION = 'voice-utterance-v1';

export interface SpokenUtterance {
  /** The sentence window exactly as the SSE chunk carried it. */
  readonly text: string;
  /** The previous window of the same turn, or null at the turn's start. */
  readonly previousText: string | null;
  /** A tone palette key, chosen server-side. */
  readonly tone: string;
}

/**
 * The signing key. Derived from the auth secret rather than adding a second
 * secret to rotate; the purpose string keeps a voice tag from ever verifying
 * as anything else derived the same way. Null (no secret configured) means no
 * tags are minted and none verify — voice silently stays text-only, which is
 * the degraded mode doc 32 §2 prescribes.
 */
const signingKey = (): Buffer | null => {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.PAYLOAD_SECRET;
  if (!secret) return null;
  return createHmac('sha256', secret).update(TAG_VERSION).digest();
};

const macFor = (key: Buffer, utterance: SpokenUtterance): Buffer =>
  createHmac('sha256', key)
    // JSON array encoding is the field separator: no concatenation ambiguity
    // between (text, previousText) splits, which is the classic MAC mistake.
    .update(JSON.stringify([TAG_VERSION, utterance.tone, utterance.previousText ?? '', utterance.text]))
    .digest();

/**
 * The tone a turn's frames carry, derived from LESSON STATE the route already
 * holds: the opening turn (nothing said yet) is `warm-open`; every working
 * turn is `thinking-together`. This is doc 32 PR-120's slot — when the tutor
 * LLM emits `tone` as structured metadata beside the reply, that value (still
 * a closed-palette key, still server-side) replaces this derivation. What may
 * NEVER replace it is a client-supplied tone or anything read off the child's
 * affect; the palette's own header carries that rule.
 */
export const toneForTurn = (opening: boolean): string => (opening ? OPENING_TONE : DEFAULT_TONE);

/** Mints the tag a chunk frame carries. Null when no secret is configured. */
export function mintUtteranceTag(utterance: SpokenUtterance): string | null {
  const key = signingKey();
  if (key === null) return null;
  return macFor(key, utterance).toString('base64url');
}

/** Whether this exact (text, previousText, tone) triple was server-emitted. */
export function verifyUtteranceTag(utterance: SpokenUtterance, tag: string): boolean {
  const key = signingKey();
  if (key === null) return false;

  let presented: Buffer;
  try {
    presented = Buffer.from(tag, 'base64url');
  } catch {
    return false;
  }

  const expected = macFor(key, utterance);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
