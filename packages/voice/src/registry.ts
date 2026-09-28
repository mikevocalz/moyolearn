// SOT: docs/voice-v4-upgrade.md; docs/pack/32-tutor-voice-tone.md
// SOT-KEYWORDS: voice registry v4 natalie asset identity
// One licensed Natalie voice asset, rendered with the same model everywhere.
// v4 changes the synthesis model, not the voice ID. PVC assets may require
// v4 fine-tuning in ElevenLabs; never replace the voice to conceal a failure.
import 'server-only';

export const VOICE_OUTPUT_FORMAT = 'mp3_44100_128';
export const LIVE_MODEL_ID = 'eleven_v4';
export const BAKED_MODEL_ID = LIVE_MODEL_ID;

export interface VoiceRegistry {
  readonly voiceId: string;
  readonly liveModelId: typeof LIVE_MODEL_ID;
  readonly bakedModelId: typeof BAKED_MODEL_ID;
  readonly version: number;
}

export function voiceRegistry(): VoiceRegistry | null {
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
  if (!voiceId) return null;
  return { voiceId, liveModelId: LIVE_MODEL_ID, bakedModelId: BAKED_MODEL_ID, version: 2 };
}
