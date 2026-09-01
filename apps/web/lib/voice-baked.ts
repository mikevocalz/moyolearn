// The baked-clip resolver — Bunny cache first, render-once second, and for the
// S4 scripts CACHE OR NOTHING (doc 32 §3).
//
// A baked piece is rendered by Eleven v3 exactly once per `BAKED_VERSION` —
// normally by the deploy-time bake (`scripts/voice-bake.mts`), or on first use
// for the non-crisis pieces — and lives on Bunny storage under the same
// signed-read regime as every other private asset (`bunny-token.ts`; the pull
// zone refuses unsigned reads). What this file returns is a SIGNED URL, minted
// per request with the standing one-hour TTL, never the bytes and never an
// unsigned path.
//
// The decision of what a cache miss means is NOT made here — it is
// `bakedServePlan`, pure and regression-tested in `@acme/voice`: a missing
// crisis asset is text-only, because a child in a crisis moment must not wait
// on a TTS API call. This file only supplies the cache probe and the once-only
// render.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · packages/voice/src/baked.ts · apps/web/lib/bunny-token.ts
// SOT-KEYWORDS: baked clip resolver bunny cache render once signed url s4 cache or nothing text only alignment
import 'server-only';
import {
  BAKED_PIECES,
  bakedAlignmentObjectKey,
  bakedObjectKey,
  bakedServePlan,
  voiceEgress,
  type BakedAlignment,
  type BakedPieceId,
} from '@acme/voice';
import type { ResolveBakedClip } from '@acme/app/server';
import { encodeKey } from './bunny-sign';
import { signCdnUrl } from './bunny-token';

/** Same namespace rule as `bunny.repository.ts:mediaPrefix` — the write path defines the read path. */
const mediaPrefix = (): string => (process.env.BUNNY_MEDIA_PREFIX ?? '').replace(/^\/+|\/+$/g, '');

const objectKeyFor = (id: BakedPieceId): string => {
  const prefix = mediaPrefix();
  const key = bakedObjectKey(id);
  return prefix ? `${prefix}/${key}` : key;
};

const alignmentKeyFor = (id: BakedPieceId): string => {
  const prefix = mediaPrefix();
  const key = bakedAlignmentObjectKey(id);
  return prefix ? `${prefix}/${key}` : key;
};

const cdnUrlFor = (key: string): string | null => {
  const cdn = process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL;
  if (!cdn) return null;
  return `${cdn.replace(/\/+$/, '')}/${encodeKey(key)}`;
};

/** Whether the CDN already holds the clip. Probed through the signed read, HEAD only. */
async function cached(url: string): Promise<boolean> {
  try {
    const response = await fetch(signCdnUrl(url), { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    // An unreachable CDN reads as a miss; the plan then renders (ordinary
    // pieces) or goes text-only (crisis), and neither outcome throws at a child.
    return false;
  }
}

/** Reads a cached alignment JSON from the signed CDN. */
async function fetchCachedAlignment(url: string): Promise<BakedAlignment | undefined> {
  try {
    const response = await fetch(signCdnUrl(url), { cache: 'no-store' });
    if (!response.ok) return undefined;
    const data = (await response.json()) as BakedAlignment;
    return data;
  } catch {
    return undefined;
  }
}

/**
 * The cache probe, exported for the bake script: `unconfigured` is distinct
 * from `missing` because the bake must FAIL loudly on a zone it cannot write —
 * a bake that "succeeds" against nothing would leave the S4 branch text-only
 * in production with a green deploy log.
 */
export async function bakedClipCacheState(
  id: BakedPieceId,
): Promise<'cached' | 'missing' | 'unconfigured'> {
  const url = cdnUrlFor(objectKeyFor(id));
  if (url === null || !process.env.BUNNY_STORAGE_ZONE_NAME || !process.env.BUNNY_STORAGE_ACCESS_KEY) {
    return 'unconfigured';
  }
  return (await cached(url)) ? 'cached' : 'missing';
}

/** The once-only upload, exported for the bake script. */
export async function storeBakedClip(
  id: BakedPieceId,
  bytes: Uint8Array,
  contentType: string,
): Promise<boolean> {
  return putClip(objectKeyFor(id), bytes, contentType);
}

/** The once-only alignment upload, exported for the bake script. */
export async function storeBakedAlignment(
  id: BakedPieceId,
  alignment: unknown,
): Promise<boolean> {
  const text = JSON.stringify(alignment);
  const bytes = new TextEncoder().encode(text);
  return putClip(alignmentKeyFor(id), bytes, 'application/json');
}

/**
 * Uploads once, via the Edge Storage API — the zone password is the write
 * credential, exactly as `bunny-delete.ts` uses it for the other direction.
 * Server-to-server, so no presign dance is needed for our own render.
 */
async function putClip(key: string, bytes: Uint8Array, contentType: string): Promise<boolean> {
  const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
  const password = process.env.BUNNY_STORAGE_ACCESS_KEY;
  const region = process.env.BUNNY_STORAGE_REGION ?? 'ny';
  if (!zone || !password) return false;

  try {
    const response = await fetch(`https://${region}.storage.bunnycdn.com/${zone}/${encodeKey(key)}`, {
      method: 'PUT',
      headers: { AccessKey: password, 'content-type': contentType },
      body: bytes as unknown as BodyInit,
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * The resolver the voice service's port names. Outcomes:
 *
 *   { kind: 'url' }       — signed, TTL'd, ready for an <audio> element;
 *   { kind: 'text-only' } — no asset and none may be rendered right now.
 *
 * A successful first-use render is served from the CDN it was just written to,
 * not from memory, so every replay thereafter is the cache path.
 */
export const resolveBakedClip: ResolveBakedClip = async (id) => {
  if (!(id in BAKED_PIECES)) return { kind: 'text-only' };
  const pieceId = id as BakedPieceId;

  const key = objectKeyFor(pieceId);
  const url = cdnUrlFor(key);
  if (url === null) return { kind: 'text-only' };

  const plan = bakedServePlan(pieceId, await cached(url));
  if (plan === 'serve-cache') {
    const alignmentKey = alignmentKeyFor(pieceId);
    const alignmentCdnUrl = cdnUrlFor(alignmentKey);
    const alignment = alignmentCdnUrl ? await fetchCachedAlignment(alignmentCdnUrl) : undefined;
    const alignmentUrl = alignment && alignmentCdnUrl ? signCdnUrl(alignmentCdnUrl) : undefined;
    return { kind: 'url', url: signCdnUrl(url), alignmentUrl, alignment };
  }
  if (plan === 'text-only') return { kind: 'text-only' };

  // render-then-cache: the once-only v3 render for a non-crisis piece.
  const clip = await voiceEgress().renderBakedClip(pieceId);
  if (clip.kind === 'text-only') return { kind: 'text-only' };
  const stored = await putClip(key, clip.bytes, clip.contentType);
  if (!stored) return { kind: 'text-only' };
  const alignmentStored = await storeBakedAlignment(pieceId, clip.alignment);
  const alignmentCdnUrl = cdnUrlFor(alignmentKeyFor(pieceId));
  const alignmentUrl = alignmentStored && alignmentCdnUrl
    ? signCdnUrl(alignmentCdnUrl)
    : undefined;
  return { kind: 'url', url: signCdnUrl(url), alignmentUrl, alignment: clip.alignment };
};
