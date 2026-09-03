// The voice registry — doc 32 §2: "the voice is an asset, not a call".
//
// ONE voice ID — Natalie — pinned here as `{ voiceId, modelId per path,
// version }`. The same ElevenLabs voice ID renders under both models, which is
// what makes one-voice-everywhere possible; the per-band, per-tone settings
// half of the registry lives in `tones.ts` because it is reviewable data and
// this half is deployment configuration.
//
// The voice ID comes from the environment rather than from source: it is not a
// secret the way the API key is, but it IS an asset with a rights review
// attached (doc 32 §2, PR-119), and an asset does not get committed before the
// review that licenses it. A deployment without it has NO voice — the registry
// returns null and every caller degrades to text-only, never to a substitute
// voice, because to a six-year-old a different voice is a different person.
// SOT: docs/pack/32-tutor-voice-tone.md §2 §3
// SOT-KEYWORDS: voice registry natalie voice id flash v2.5 eleven v3 one voice everywhere text only degraded
import 'server-only';

/**
 * ONE MODEL, EVERY PATH, EVERY PLATFORM: v3, live and baked, web and mobile.
 *
 * Doc 32 §3 splits these — Flash v2.5 (~75ms TTFB) for live turns, v3 for the
 * baked set pieces — and that split is why Natalie's voice AUDIBLY CHANGED
 * mid-session: the same voice id rendered by two models is not the same voice,
 * so a baked greeting or filler landing inside a live turn swapped her identity
 * in the middle of a conversation. Doc 32's own binding rule is one voice
 * everywhere, and one voice means one renderer.
 *
 * The cost is honest and must be measured, not assumed: v3 is explicitly NOT a
 * realtime model in ElevenLabs' own guidance, so first-word latency will be
 * worse than Flash's. Identity beats latency — a tutor who changes voice
 * mid-sentence is a different person to a child, while a slower first word is
 * the same person arriving late. The latency budget absorbs it through
 * prefetching, not through a second model.
 *
 * SPEC-002 to file against doc 32 §3: the two-path model split is retired.
 * Product decision, Mike, 2026-09-02: "v3 was one and should be the same across
 * web and mobile."
 */
export const LIVE_MODEL_ID = 'eleven_v3';
export const BAKED_MODEL_ID = 'eleven_v3';

export interface VoiceRegistry {
  readonly voiceId: string;
  readonly liveModelId: typeof LIVE_MODEL_ID;
  readonly bakedModelId: typeof BAKED_MODEL_ID;
  /** Bumped with any settings change, alongside `TONE_PALETTE_VERSION`. */
  readonly version: number;
}

/**
 * The registry, or null when no voice is configured. Null is a STATE, not an
 * error: doc 32 §2 hard rule 1 makes degraded mode text-only, so the absence
 * of the asset must be representable without anything throwing at a child.
 */
export function voiceRegistry(): VoiceRegistry | null {
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!voiceId) return null;
  return { voiceId, liveModelId: LIVE_MODEL_ID, bakedModelId: BAKED_MODEL_ID, version: 1 };
}
