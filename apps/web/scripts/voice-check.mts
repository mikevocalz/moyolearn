// Read-only account check; never changes a voice or prints credentials.
// SOT: docs/voice-v4-upgrade.md
// SOT-KEYWORDS: voice v4 account check professional clone fine tuning
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), true, console);
const { voiceEgress } = await import('@acme/voice');
const result = await voiceEgress().checkConfiguration();
console.log(JSON.stringify(result, null, 2));
const pvcReady = result.voiceCategory !== 'professional' || result.fineTuningState === 'fine_tuned';
if (!result.configured || !result.modelAvailable || !result.voiceCategory || !pvcReady) {
  console.error('Voice configuration is not verified for v4. Check account access and the existing voice’s v4 fine-tuning in My Voices.');
  process.exitCode = 1;
}
