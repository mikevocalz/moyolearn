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

/** The closed tone palette. */
export type ToneKey =
  | 'warm-open'
  | 'thinking-together'
  | 'gentle-after-miss'
  | 'naming-the-mistake'
  | 'quiet-encourage'
  | 'celebrate-small'
  | 'celebrate-big'
  | 'calm-refocus';

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
export const TONE_RENDER: Record<ToneKey, ToneRender> = {
  'warm-open': { emotion: 'happiness', intensity: 0.25, stability: 0.55, similarity: 0.75 },
  'thinking-together': { emotion: 'neutral', intensity: 0.1, stability: 0.65, similarity: 0.7 },
  'gentle-after-miss': { emotion: 'sadness', intensity: 0.2, stability: 0.45, similarity: 0.65 },
  'naming-the-mistake': { emotion: 'neutral', intensity: 0.15, stability: 0.7, similarity: 0.7 },
  'quiet-encourage': { emotion: 'happiness', intensity: 0.2, stability: 0.5, similarity: 0.7 },
  'celebrate-small': { emotion: 'happiness', intensity: 0.5, stability: 0.6, similarity: 0.75 },
  'celebrate-big': { emotion: 'happiness', intensity: 0.75, stability: 0.55, similarity: 0.75 },
  'calm-refocus': { emotion: 'neutral', intensity: 0.1, stability: 0.55, similarity: 0.65 },
};

/** Resolve a tone to its face + voice recipe. Unknown tones fall back to neutral. */
export function toneRenderFor(tone: string | undefined): ToneRender {
  if (!tone || !Object.hasOwn(TONE_RENDER, tone)) return TONE_RENDER['thinking-together'];
  return TONE_RENDER[tone as ToneKey];
}

/** Validate a string is a known tone key. */
export function isToneKey(value: string): value is ToneKey {
  return Object.hasOwn(TONE_RENDER, value);
}
