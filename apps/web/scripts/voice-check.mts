// Read-only account check; never changes a voice or prints credentials.
// SOT: docs/voice-v4-upgrade.md
// SOT-KEYWORDS: voice v4 account check professional clone synthesis probe
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), true, console);
const { voiceEgress } = await import('@acme/voice');
const result = await voiceEgress().checkConfiguration();
console.log(JSON.stringify(result, null, 2));
// Readiness is the synthesis probe, not the metadata. It does not assert
// `fineTuningState`: ElevenLabs keys `fine_tuning.state` by fine-tunable model,
// and `/v1/models` reports `can_be_finetuned: false` for eleven_v4, so a v4
// state can never appear and requiring one can never pass. `liveModelFineTunable`
// is printed so a future model that IS fine-tunable is visible here rather than
// silently unchecked.
if (!result.configured || !result.modelAvailable || !result.voiceCategory || !result.synthesisOk) {
  console.error(`Voice configuration is not verified for v4. synthesisOk=${result.synthesisOk} synthesisError=${result.synthesisError ?? 'none'}`);
  if (result.synthesisError === 'payment_issue') {
    console.error('The provider refused synthesis for billing, not for voice setup. Settle the outstanding ElevenLabs invoice and rerun; no voice or model change will fix this.');
  }
  process.exitCode = 1;
}
