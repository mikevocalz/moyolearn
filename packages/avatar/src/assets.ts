/**
 * The avatar capability manager — doc 22 §3, §4 row 17.
 *
 * Everything the 3D avatar needs is DOWNLOADED, never bundled: the head
 * container, the SMPL-X body, the conform rig, the lash texture, the baked
 * lines and cavity. Doc 20's law is that a Phase-3 surface may not put 35 MB
 * into the binary, and this file is where that law is enforced rather than
 * merely stated — there is no code path here that reads from the app bundle.
 *
 * WHAT PORTING THIS COST. The reference did `fetch('/gnm/head.bin')` and
 * `GLTFLoader.loadAsync('/smplx.glb')` against `public/`. In React Native there
 * is no origin to be relative to, so every asset resolves through a manifest to
 * an absolute CDN URL, gets downloaded to a file URI by the host app, and the
 * loaders are handed that URI. The host owns the filesystem (expo-file-system,
 * react-native-fs, whatever the app already uses) — this module owns the
 * manifest, the integrity check, the tier filter and the cache policy, and it
 * takes the download as an injected function so it stays testable and stays
 * out of the dependency graph.
 *
 * ── THE `.glb` RULE, WHICH IS A REAL TRAP ───────────────────────────────────
 *
 * A `.glb` with EMBEDDED IMAGES cannot be loaded in React Native: Hermes has no
 * `new Blob([ArrayBuffer])`, and that is exactly how `GLTFLoader` turns an
 * embedded texture into something an image decoder can take. It fails at load,
 * not at build, and it fails only on device — the kind of bug that ships.
 *
 * So: anything textured must ship as split `.gltf` + `.bin` + loose textures.
 * `assertLoadableInReactNative()` below encodes that as a check on the manifest
 * entry rather than as a comment nobody reads. Both of ours are clear —
 * `smplx_female_headless.glb` and `smplx_female.glb` declare zero images, zero
 * textures and zero materials — but the rule binds any asset added later.
 *
 * ── INTEGRITY IS NOT OPTIONAL HERE ──────────────────────────────────────────
 *
 * The head container's identity hash gates the neck-align transform
 * (`neck-align.ts`) and the conform rig; a silently truncated download would
 * not throw, it would produce a head joined to a body at the wrong angle. Every
 * entry carries a sha-256 and `verify` is on by default.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §3, §4 row 17
 * SOT-KEYWORDS: assets cdn manifest download cache integrity sha256 glb gltf hermes blob tier
 */
import { sha256Hex } from './crypto/sha256.ts';
import type { Tier } from './tiers.ts';

/** Which tiers actually need a given asset. `presence-2d` needs none of them. */
export type AssetTier = Exclude<Tier, 'presence-2d'>;

export type AssetKind =
  /** GNMW head container. */
  | 'gnm-head'
  /** SMPL-X body, `.glb` — permitted only while it stays texture-free. */
  | 'body-glb'
  /** Split glTF: the `.gltf` entry point, with siblings resolved beside it. */
  | 'gltf'
  /** A single image. */
  | 'texture'
  /** Baked JSON: lash lines, mouth cavity, conform rig, neck align. */
  | 'json'
  /** Raw binary sidecar (`.bin`, `SCF4`). */
  | 'binary';

export interface AssetEntry {
  id: string;
  kind: AssetKind;
  /** Path relative to the manifest's `baseUrl`. */
  path: string;
  bytes: number;
  sha256: string;
  /** Lowest tier that needs this asset. Omitted means every 3D tier needs it. */
  minTier?: AssetTier;
  /**
   * For `body-glb` and `gltf`: what the asset actually declares. The `.glb`
   * rule is checked against these numbers, so they must come from the exporter,
   * not from someone's memory.
   */
  declares?: { images: number; textures: number; materials: number };
  /** Sibling files a split `.gltf` needs fetched alongside it. */
  siblings?: string[];
}

export interface AssetManifest {
  version: number;
  baseUrl: string;
  assets: AssetEntry[];
}

const TIER_ORDER: readonly AssetTier[] = ['phone', 'tablet', 'studio'];

/** True when `tier` is at or above `minTier`. */
export function tierMeets(tier: AssetTier, minTier: AssetTier | undefined): boolean {
  if (!minTier) return true;
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minTier);
}

/**
 * The rule that only bites on device. A `.glb` may be used ONLY if it declares
 * no images — otherwise `GLTFLoader` will reach for `new Blob([ArrayBuffer])`,
 * which Hermes does not have.
 */
export function assertLoadableInReactNative(entry: AssetEntry): void {
  if (entry.kind !== 'body-glb') return;
  if (!entry.declares) {
    throw new Error(
      `${entry.id}: a .glb entry must declare its image/texture/material counts — ` +
        'the embedded-image check cannot be skipped'
    );
  }
  if (entry.declares.images > 0) {
    throw new Error(
      `${entry.id}: .glb declares ${entry.declares.images} embedded image(s), which cannot be ` +
        'decoded in React Native (Hermes has no Blob over ArrayBuffer). ' +
        'Re-export as split .gltf + .bin + loose textures.'
    );
  }
}

export function validateManifest(manifest: AssetManifest): void {
  if (manifest.version !== 1) {
    throw new Error(`unsupported avatar manifest version ${manifest.version}`);
  }
  const seen = new Set<string>();
  for (const entry of manifest.assets) {
    if (seen.has(entry.id)) throw new Error(`duplicate asset id ${entry.id}`);
    seen.add(entry.id);
    if (!/^[0-9a-f]{64}$/.test(entry.sha256)) {
      throw new Error(`${entry.id}: sha256 must be 64 lowercase hex characters`);
    }
    assertLoadableInReactNative(entry);
  }
}

/** Everything a given tier must have on disk before the stage can be built. */
export function assetsForTier(manifest: AssetManifest, tier: AssetTier): AssetEntry[] {
  return manifest.assets.filter((entry) => tierMeets(tier, entry.minTier));
}

/** Total download for a tier, so the UI can show a real number and not a spinner. */
export function downloadBytesForTier(manifest: AssetManifest, tier: AssetTier): number {
  return assetsForTier(manifest, tier).reduce((sum, entry) => sum + entry.bytes, 0);
}

/**
 * The host app's filesystem, injected. Keeping this an interface is what stops
 * this package depending on `expo-file-system` — the app already has a
 * filesystem and the avatar has no business choosing which one.
 */
export interface AssetHost {
  /** Local file URI for a cached asset, or null when it is not present. */
  cachedUri(id: string): Promise<string | null>;
  /** Downloads `url` and returns the local file URI it was written to. */
  download(url: string, id: string, onProgress?: (fraction: number) => void): Promise<string>;
  /** Reads a cached asset back for hashing / parsing. */
  read(uri: string): Promise<ArrayBuffer>;
  /** Drops a cached asset — used when its hash does not match. */
  evict(id: string): Promise<void>;
}

export interface ResolveOptions {
  /** Off only for a local dev loop against uncommitted assets. Never in CI. */
  verify?: boolean;
  onProgress?: (done: number, total: number) => void;
}

export interface ResolvedAsset {
  entry: AssetEntry;
  uri: string;
  /** True when this run downloaded it rather than finding it cached. */
  fetched: boolean;
}

/**
 * Resolves every asset a tier needs to a local file URI, downloading and
 * verifying what is missing.
 *
 * A hash mismatch EVICTS and retries exactly once. Once, because the common
 * cause is a truncated download and a second attempt fixes it; only once,
 * because the other cause is a stale CDN object, and looping on that is how a
 * client burns a user's data plan in a corner they cannot see.
 */
export async function resolveAssets(
  manifest: AssetManifest,
  tier: AssetTier,
  host: AssetHost,
  options: ResolveOptions = {}
): Promise<ResolvedAsset[]> {
  validateManifest(manifest);
  const verify = options.verify ?? true;
  const wanted = assetsForTier(manifest, tier);
  const resolved: ResolvedAsset[] = [];

  for (let index = 0; index < wanted.length; ++index) {
    const entry = wanted[index] as AssetEntry;
    let uri = await host.cachedUri(entry.id);
    let fetched = false;

    for (let attempt = 0; attempt < 2; ++attempt) {
      if (!uri) {
        uri = await host.download(joinUrl(manifest.baseUrl, entry.path), entry.id);
        fetched = true;
      }
      if (!verify) break;
      const actual = sha256Hex(new Uint8Array(await host.read(uri)));
      if (actual === entry.sha256) break;
      await host.evict(entry.id);
      uri = null;
      if (attempt === 1) {
        throw new Error(
          `${entry.id}: sha256 mismatch after re-download (expected ${entry.sha256}, got ${actual})`
        );
      }
    }

    // Siblings of a split .gltf ride along under derived ids. They are covered
    // by the .gltf's own load, so they are fetched but not returned.
    for (const sibling of entry.siblings ?? []) {
      const siblingId = `${entry.id}:${sibling}`;
      if (!(await host.cachedUri(siblingId))) {
        await host.download(joinUrl(manifest.baseUrl, sibling), siblingId);
      }
    }

    resolved.push({ entry, uri: uri as string, fetched });
    options.onProgress?.(index + 1, wanted.length);
  }

  return resolved;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * The two globals the RN harness must install before ANY three.js loader runs.
 *
 * `fast-text-encoding` because `GLTFLoader` decodes the JSON chunk with
 * `TextDecoder`, and `window.parent = window` because three's loader manager
 * probes it. Both come straight from the reference harness
 * (`react-native-webgpu`'s example app); they are listed here so the app's entry
 * point has one place to copy from rather than three GitHub issues to find.
 */
export const REQUIRED_RN_GLOBALS = Object.freeze([
  "import 'fast-text-encoding'",
  'window.parent = window',
]);
