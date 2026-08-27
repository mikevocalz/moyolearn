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
 * Doc 32 §3's two render paths. Flash v2.5 (~75ms TTFB) streams every live
 * turn; v3 (audio tags, explicitly NOT realtime per ElevenLabs' own guidance)
 * renders the baked set pieces. These are pinned per path, not per call —
 * a caller cannot pick a model any more than it can pick a voice.
 */
export const LIVE_MODEL_ID = 'eleven_flash_v2_5';
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
