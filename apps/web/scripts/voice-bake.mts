// The deploy-time bake (doc 32 §3 Path B): renders every baked set piece with
// Eleven v3 and uploads it to Bunny under the signed-read regime, so the S4
// scripts are ON the CDN before any crisis moment could ask for them — the
// serving path never live-renders a crisis piece (`bakedServePlan`), which
// makes THIS script the only thing standing between "cache" and "text-only"
// for the hardest audio in the product.
//
// Idempotent: a piece already cached at the current BAKED_VERSION is skipped,
// so re-running on every deploy costs nothing after the first. Run:
//   pnpm --filter web voice:bake
// SOT: docs/pack/32-tutor-voice-tone.md §3 · packages/voice/src/baked.ts · apps/web/lib/voice-baked.ts
// SOT-KEYWORDS: voice bake script deploy eleven v3 baked pieces bunny upload s4 idempotent
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), true, console);

// After env, so the egress and the signer see their keys. `server-only`
// resolves via the react-server condition configured in the script runner.
const { BAKED_PIECE_IDS, BAKED_PIECES, voiceEgress } = await import('@acme/voice');
const { bakedClipCacheState, storeBakedClip } = await import('../lib/voice-baked');

let baked = 0;
let cachedAlready = 0;
let failed = 0;

for (const id of BAKED_PIECE_IDS) {
  const state = await bakedClipCacheState(id);
  if (state === 'unconfigured') {
    console.error(`voice-bake: Bunny or the CDN base URL is not configured — nothing can be stored.`);
    process.exit(1);
  }
  if (state === 'cached') {
    cachedAlready += 1;
    console.log(`  cached   ${id}`);
    continue;
  }

  const clip = await voiceEgress().renderBakedClip(id);
  if (clip.kind === 'text-only') {
    failed += 1;
    console.error(`  FAILED   ${id} — render returned no audio (key/voice configured?)`);
    continue;
  }

  const stored = await storeBakedClip(id, clip.bytes, clip.contentType);
  if (!stored) {
    failed += 1;
    console.error(`  FAILED   ${id} — Bunny upload did not land`);
    continue;
  }
  baked += 1;
  const crisis = BAKED_PIECES[id].crisis ? ' (S4 — now servable in a crisis)' : '';
  console.log(`  baked    ${id} — ${clip.bytes.length} bytes${crisis}`);
}

console.log(`voice-bake: ${baked} rendered, ${cachedAlready} already cached, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
