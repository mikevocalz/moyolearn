// Publish immutable audio before its alignment manifest. Readers see one
// complete generation even when bakes race or an upload fails.
// SOT: docs/pack/32-tutor-voice-tone.md; packages/voice/src/baked.ts
// SOT-KEYWORDS: baked voice v4 cache manifest audio alignment digest s4
import 'server-only';
import { createHash } from 'node:crypto';
import {
  bakedBundlePrefix, bakedManifestSchema, bakedServePlan, isBakedPieceId, voiceEgress,
  type BakedAlignment, type BakedManifest, type BakedPieceId,
} from '@acme/voice';
import type { ResolveBakedClip } from '@acme/app/server';
import { encodeKey } from './bunny-sign';
import { signCdnUrl } from './bunny-token';

const prefixFor = (id: BakedPieceId): string | null => {
  const key = bakedBundlePrefix(id);
  if (!key) return null;
  const prefix = (process.env.BUNNY_MEDIA_PREFIX ?? '').replace(/^\/+|\/+$/g, '');
  return prefix ? `${prefix}/${key}` : key;
};
const cdnUrlFor = (key: string): string | null => {
  const cdn = process.env.NEXT_PUBLIC_BUNNY_CDN_BASE_URL;
  return cdn ? `${cdn.replace(/\/+$/, '')}/${encodeKey(key)}` : null;
};

async function readBundle(prefix: string): Promise<BakedManifest | null> {
  const url = cdnUrlFor(`${prefix}/manifest.json`);
  if (!url) return null;
  try {
    const response = await fetch(signCdnUrl(url), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) { await response.body?.cancel(); return null; }
    const parsed = bakedManifestSchema.safeParse(await response.json());
    if (!parsed.success) return null;
    const audioUrl = cdnUrlFor(`${prefix}/${parsed.data.audioDigest}.mp3`);
    if (!audioUrl) return null;
    const audio = await fetch(signCdnUrl(audioUrl), { method: 'HEAD', cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return audio.ok ? parsed.data : null;
  } catch { return null; }
}

export async function bakedClipCacheState(id: BakedPieceId): Promise<'cached' | 'missing' | 'unconfigured'> {
  const prefix = prefixFor(id);
  if (!prefix || !cdnUrlFor(prefix) || !process.env.BUNNY_STORAGE_ZONE_NAME || !process.env.BUNNY_STORAGE_ACCESS_KEY) return 'unconfigured';
  return await readBundle(prefix) ? 'cached' : 'missing';
}

/** Manifest is the commit point. Alignment and audio are from the same render. */
export async function storeBakedClip(id: BakedPieceId, bytes: Uint8Array, contentType: string, alignment: BakedAlignment): Promise<BakedManifest | null> {
  const prefix = prefixFor(id);
  if (!prefix || !bytes.length) return null;
  const manifest = bakedManifestSchema.safeParse({ audioDigest: createHash('sha256').update(bytes).digest('hex'), alignment });
  if (!manifest.success) return null;
  if (!await putClip(`${prefix}/${manifest.data.audioDigest}.mp3`, bytes, contentType)) return null;
  if (!await putClip(`${prefix}/manifest.json`, new TextEncoder().encode(JSON.stringify(manifest.data)), 'application/json')) return null;
  return manifest.data;
}

async function putClip(key: string, bytes: Uint8Array, contentType: string): Promise<boolean> {
  const zone = process.env.BUNNY_STORAGE_ZONE_NAME;
  const password = process.env.BUNNY_STORAGE_ACCESS_KEY;
  const region = process.env.BUNNY_STORAGE_REGION ?? 'ny';
  if (!zone || !password) return false;
  try {
    const response = await fetch(`https://${region}.storage.bunnycdn.com/${zone}/${encodeKey(key)}`, {
      method: 'PUT', headers: { AccessKey: password, 'content-type': contentType },
      body: new Uint8Array(bytes), signal: AbortSignal.timeout(30_000),
    });
    await response.body?.cancel();
    return response.ok;
  } catch { return false; }
}

export const resolveBakedClip: ResolveBakedClip = async (id) => {
  if (!isBakedPieceId(id)) return { kind: 'text-only' };
  const prefix = prefixFor(id);
  if (!prefix || !cdnUrlFor(prefix)) return { kind: 'text-only' };
  let bundle = await readBundle(prefix);
  const plan = bakedServePlan(id, bundle !== null);
  if (plan === 'text-only') return { kind: 'text-only' };
  if (plan === 'render-then-cache') {
    const clip = await voiceEgress().renderBakedClip(id);
    if (clip.kind === 'text-only') return { kind: 'text-only' };
    bundle = await storeBakedClip(id, clip.bytes, clip.contentType, clip.alignment);
  }
  if (!bundle) return { kind: 'text-only' };
  const url = cdnUrlFor(`${prefix}/${bundle.audioDigest}.mp3`);
  return url ? { kind: 'url', url: signCdnUrl(url), alignment: bundle.alignment } : { kind: 'text-only' };
};
