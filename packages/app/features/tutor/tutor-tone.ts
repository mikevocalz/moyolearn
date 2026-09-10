// Tutor tone — closed palette and downstream render mappings.
//
// Tone is emitted by the LLM as structured metadata beside the reply (doc 32 §4).
// It is not injected into the spoken text — descriptive text would be spoken by
// Flash — and it is the single source for both voice settings and face emotion.
// A closed palette is a safety surface: it prevents intimacy or companion-like
// tones from drifting in.
//
// A2F emotion names are from `@acme/avatar` (doc 22 §8); the palette maps each
// tone to the closest available emotional category and an intensity. Where the
// source uses "warmth" or "concern" we map to the nearest safe ARKit baseline
// (`happiness` / `sadness`) and keep the intensity low so the expression stays
// pedagogical, not personal.
// SOT: docs/pack/32-tutor-voice-tone.md §4 · packages/avatar/src/emotion.ts
// SOT-KEYWORDS: tutor tone palette emotion mapping voice a2f elevenlabs
import type { EmotionCategory } from '@acme/avatar';
/*
  DERIVED, NOT RESTATED — and the drift this fixes had shipped.

  This file used to declare its own eight-tone union beside `@acme/voice`'s
  nine-tone `TONE_PALETTE`. `safety-serious` existed in the palette, had a voice
  recipe, and had no render entry, so `toneRenderFor` fell through to
  `thinking-together`: for the whole S4 safety script the face rendered a
  neutral thinking expression while the voice delivered the safety register.
  Nothing failed, because a hand-written copy of a union cannot notice that the
  original grew.

  A type-only import, which is how `voice.service.ts` already reaches this
  package — nothing from the egress reaches a bundle, and `check-voice-egress`
  holds the runtime importers to their named surfaces.
*/
import type { ToneKey } from '@acme/voice';

export type { ToneKey };

export interface ToneRender {
  /** The emotion lane for the face. */
  readonly emotion: EmotionCategory;
  /** 0–1 intensity, where 0 is a faint hint and 1 is full. */
  readonly intensity: number;
  /** Voice setting hint for the live TTS path. */
  readonly stability: number;
  /** Voice similarity boost for the live TTS path. */
  readonly similarity: number;
}

/**
 * Per-tone render recipe. These are v1 defaults; the actual live TTS numbers are
 * pinned at the PR against the ElevenLabs dashboard.
 */
/*
  `Record<ToneKey, ToneRender>` is the gate, not documentation: a tone added to
  the palette and not to this table is a `tsc --noEmit` failure. That is the
  second half of the fix — deriving the union means the compiler can see the
  hole, and annotating the record means it has to.
*/
export const TONE_RENDER: Record<ToneKey, ToneRender> = {
  'warm-open': { emotion: 'happiness', intensity: 0.25, stability: 0.55, similarity: 0.75 },
  'thinking-together': { emotion: 'neutral', intensity: 0.1, stability: 0.65, similarity: 0.7 },
  'gentle-after-miss': { emotion: 'sadness', intensity: 0.2, stability: 0.45, similarity: 0.65 },
  'naming-the-mistake': { emotion: 'neutral', intensity: 0.15, stability: 0.7, similarity: 0.7 },
  'quiet-encourage': { emotion: 'happiness', intensity: 0.2, stability: 0.5, similarity: 0.7 },
  'celebrate-small': { emotion: 'happiness', intensity: 0.5, stability: 0.6, similarity: 0.75 },
  'celebrate-big': { emotion: 'happiness', intensity: 0.75, stability: 0.55, similarity: 0.75 },
  'calm-refocus': { emotion: 'neutral', intensity: 0.1, stability: 0.55, similarity: 0.65 },
  /*
    S3 deflection and the S4 handoff — the one register where the face, the
    voice and the script must never disagree.

    `sadness` at LOW intensity, and both halves of that are deliberate. The lane
    is this file's existing convention for concern (`gentle-after-miss` is the
    precedent), and `anger` exists in `EmotionCategory` and must never be
    reached from here: a child being told to stop and talk to someone needs
    calm, steady and kind, never frightening. 0.2 rather than the palette's
    `med`, because the coarse emotion lane at medium reads as visible sadness AT
    a child in distress rather than concern FOR them.

    `stability` and the rest come from the palette's own live recipe
    (`TONE_PALETTE['safety-serious'].live`: stability 0.8, style 0.1, speed
    0.85) so the two packages describe one delivery.

    The AU-level specification — no AU12, AU1 low, AU4 absent or very low, gaze
    high and steady, hands low and still, slower onset and longer hold, with K–2
    softer and 9–12 firmer — lives in the `tone-to-performance` skill's table.
    It is not expressible on this two-field lane, and 0.2 is the calibration
    target for the rater study, not a measured value.
  */
  'safety-serious': { emotion: 'sadness', intensity: 0.2, stability: 0.8, similarity: 0.75 },
};

/**
 * Resolve a tone to its face and voice recipe.
 *
 * NO FALLBACK. It used to substitute `thinking-together` for anything it did
 * not recognise, which is how the safety register rendered a thinking face for
 * however long nobody looked. A render layer that can quietly serve one
 * register in place of another has no way to be wrong loudly, and this is the
 * register where being wrong quietly matters most.
 *
 * Unknown tones are rejected where the tutor turn's structured metadata is
 * validated — `isToneKey` at the store boundary — so by the time a value
 * reaches here the type is the guarantee. Both call sites in `tutor-avatar.tsx`
 * already guard on the tone being present.
 */
export function toneRenderFor(tone: ToneKey): ToneRender {
  return TONE_RENDER[tone];
}

/** Validate a string is a known tone key. */
export function isToneKey(value: string): value is ToneKey {
  return Object.hasOwn(TONE_RENDER, value);
}
