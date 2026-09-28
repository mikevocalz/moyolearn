// The baked set pieces — doc 32 §3 Path B, enumerated.
//
// v4 audio and its timing are published together in a manifest. Each generation
// has an immutable audio digest, and each voice/recipe has a distinct namespace.
// Failed publication leaves the preceding complete generation intact.
//
// The S4 entries are `S4_SCRIPTS` ITSELF — imported, not copied, so the audio
// is rendered from the exact frozen, human-written strings doc 31 §3.2
// publishes, and a wording change to the protocol changes the bake key with
// it. `crisis: true` is what `bakedServePlan` reads to enforce the hardest
// rule on this path: A CRISIS MOMENT MUST NOT WAIT ON A TTS API CALL. If the
// cached asset is missing, the answer is text-only — never a live render, on
// that path, ever. The regression test drives that branch.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · packages/safety/src/crisis.ts · docs/pack/31 §3.2
// SOT-KEYWORDS: baked set pieces eleven v3 s4 scripts frozen cached bunny never live render crisis greetings celebrations serve plan
import { S4_SCRIPTS } from '@acme/safety';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { TONE_PALETTE, TONE_PALETTE_VERSION, voiceTagsFor, type ToneKey } from './tones.ts';
import { voiceRegistry, VOICE_OUTPUT_FORMAT, type VoiceRegistry } from './registry.ts';
import { alignmentSchema } from './schemas.ts';

/** Bumped when any piece's text, tone, or voice identity changes, so a stale cache cannot serve the old wording. */
export const BAKED_VERSION = 4;

export interface BakedPiece {
  readonly text: string;
  readonly tone: ToneKey;
  /** True = S4 path: serve the cache or serve nothing. Never render live. */
  readonly crisis: boolean;
}

export const BAKED_PIECES = Object.freeze({
  's4-young': { text: S4_SCRIPTS.young, tone: 'safety-serious', crisis: true },
  's4-older': { text: S4_SCRIPTS.older, tone: 'safety-serious', crisis: true },
  'greeting-first': {
    text: 'Hi, I’m Natalie! Show me what you’re working on, and we’ll figure it out together.',
    tone: 'warm-open',
    crisis: false,
  },
  'greeting-return': {
    text: 'Welcome back! Want to pick up where we left off?',
    tone: 'warm-open',
    crisis: false,
  },
  'celebrate-big': {
    text: 'You did it! That one was all you. I’m really proud of the work you just put in.',
    tone: 'celebrate-big',
    crisis: false,
  },
  'marketing-hint': {
    text: 'Try looking for the part that matches what the question is asking.',
    tone: 'warm-open',
    crisis: false,
  },
  'marketing-explain': {
    text: 'Another way to think about it: start with what you already know.',
    tone: 'warm-open',
    crisis: false,
  },
  'marketing-got-it': {
    text: 'Nice work — that kind of thinking is what makes it stick.',
    tone: 'celebrate-big',
    crisis: false,
  },
} as const satisfies Record<string, BakedPiece>);

export type BakedPieceId = keyof typeof BAKED_PIECES;

export const BAKED_PIECE_IDS = Object.freeze(Object.keys(BAKED_PIECES)) as readonly BakedPieceId[];

export const isBakedPieceId = (value: string): value is BakedPieceId => Object.hasOwn(BAKED_PIECES, value);

/** Includes the actual licensed asset and synthesis recipe, never a generic
 * version-only key that could replay a previous voice after configuration changes. */
export function bakedBundlePrefix(id: BakedPieceId, registry: VoiceRegistry | null = voiceRegistry()): string | null {
  if (!registry) return null;
  const fingerprint = createHash('sha256').update(JSON.stringify({
    registry, palette: TONE_PALETTE, paletteVersion: TONE_PALETTE_VERSION,
    piece: BAKED_PIECES[id], tags: voiceTagsFor(BAKED_PIECES[id].tone, id === 's4-young' ? 'k-2' : '6-8'),
    format: VOICE_OUTPUT_FORMAT, version: BAKED_VERSION,
  })).digest('hex');
  return `voice/baked/v${BAKED_VERSION}/${fingerprint}/${id}`;
}

export const bakedManifestSchema = z.object({
  audioDigest: z.string().regex(/^[a-f0-9]{64}$/),
  alignment: alignmentSchema,
});
export type BakedManifest = z.infer<typeof bakedManifestSchema>;

export type BakedServePlan = 'serve-cache' | 'render-then-cache' | 'text-only';

/**
 * The serving decision, pure so the S4 rule is testable without a CDN:
 *
 *   cached                 -> serve it (every piece);
 *   missing, ordinary      -> render once now, cache, serve;
 *   missing, crisis        -> TEXT-ONLY. The child in a crisis moment is owed
 *                             the words immediately; audio that requires a
 *                             vendor round-trip right then is audio we don't
 *                             play. The bake job (deploy time) is what makes
 *                             this branch unreachable in practice — this is
 *                             the floor under it.
 */
export function bakedServePlan(id: BakedPieceId, cached: boolean): BakedServePlan {
  if (cached) return 'serve-cache';
  return BAKED_PIECES[id].crisis ? 'text-only' : 'render-then-cache';
}
