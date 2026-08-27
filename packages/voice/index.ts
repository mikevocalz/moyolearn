// @acme/voice — the ElevenLabs voice egress (doc 32): the only package in the
// repo that holds the ElevenLabs credential, exactly as @acme/inference is the
// only one holding Anthropic's. Server-side only.
//
// One voice everywhere; two render paths (Flash v2.5 live, Eleven v3 baked); a
// closed nine-entry tone palette, band-modulated; a per-learner daily voice
// budget whose exhaustion is silent text-only, never an error at a child.
//
// A feature never imports this package. The only importers are the voice API
// routes, the web composition root, and the bake script —
// `tooling/check-voice-egress.mjs` fails the build on any other import, and
// fails it again if THIS package grows an import of the learner-message path.
// SOT: docs/pack/32-tutor-voice-tone.md · tooling/check-voice-egress.mjs
// SOT-KEYWORDS: voice barrel egress elevenlabs tone palette baked budget registry natalie
export {
  DEFAULT_TONE,
  OPENING_TONE,
  TONES,
  TONE_PALETTE,
  TONE_PALETTE_VERSION,
  UnknownTone,
  assertTone,
  isTone,
  voiceSettingsFor,
} from './src/tones.ts';
export type { A2fEmotion, LiveRecipe, ToneKey, ToneRecipe } from './src/tones.ts';
export { BAKED_MODEL_ID, LIVE_MODEL_ID, voiceRegistry } from './src/registry.ts';
export type { VoiceRegistry } from './src/registry.ts';
export {
  FLASH_USD_PER_CHAR,
  VOICE_BUDGETS,
  estimatedUsdFor,
  inMemoryVoiceLedger,
  installVoiceBudgetLedger,
  sharedVoiceBudgetLedger,
  voiceBudgetStateFor,
  voiceDayKey,
} from './src/budget.ts';
export type { VoiceBudgetLedger, VoiceBudgetState, VoiceLedgerDay } from './src/budget.ts';
export {
  BAKED_PIECES,
  BAKED_PIECE_IDS,
  BAKED_VERSION,
  bakedObjectKey,
  bakedServePlan,
  isBakedPieceId,
} from './src/baked.ts';
export type { BakedPiece, BakedPieceId, BakedServePlan } from './src/baked.ts';
export { createVoiceEgress, voiceEgress } from './src/eleven.ts';
export type {
  BakedClip,
  SpeakSentenceInput,
  SpokenSentence,
  VoiceEgress,
  VoiceEgressOptions,
  VoiceTransport,
} from './src/eleven.ts';
