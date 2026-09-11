import type { Tier } from './tiers.ts';
/** Which tiers actually need a given asset. `presence-2d` needs none of them. */
export type AssetTier = Exclude<Tier, 'presence-2d'>;
export type AssetKind = 
/** GNMW head container. */
'gnm-head'
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
    declares?: {
        images: number;
        textures: number;
        materials: number;
    };
    /** Sibling files a split `.gltf` needs fetched alongside it. */
    siblings?: string[];
    /**
     * False for an asset that is RECORDED here but never downloaded by a client.
     *
     * The rights gate reads this manifest and nothing else, so anything whose
     * provenance has to be provable must appear in it — including the motion
     * corpora we mine for timing statistics, which are hundreds of megabytes and
     * belong to the build machine, not to a child's data plan. Without this flag
     * the only way to record such a source is to put it on a download tier, and
     * `assetsForTier` would then hand it to `resolveAssets`.
     *
     * For these entries `path` is relative to `packages/avatar/assets/`, not to
     * `baseUrl` — there is no CDN object behind them.
     */
    runtime?: boolean;
    /**
     * Where the bytes came from and what may be done with them.
     *
     * REQUIRED at the ledger gate, optional at the type so the manifest stays
     * readable by code that only wants to fetch — `tooling/check-asset-ledger.mjs`
     * is what refuses an unrecorded asset, and it runs in the lint chain.
     *
     * A rights record is not paperwork: it is how you prove an asset is yours to
     * ship, and the question always arrives long after whoever acquired it has
     * forgotten the terms. The licence DOCUMENT never lives in this repository —
     * `evidence` is a reference to it, held wherever invoices are held.
     */
    rights?: AssetRights;
}
export interface AssetRights {
    /** Vendor name, commission, or `authored` for something generated in-repo. */
    source: string;
    /** Licence type plus a reference id — "Humano Studio Standard #12345". */
    license: string;
    /**
     * What the terms actually permit, separately. Embedding an asset in a build
     * and redistributing its source are different permissions, and a public
     * repository is a redistribution channel whether or not it was meant as one.
     */
    permits: {
        embed: boolean;
        distributeSource: boolean;
        modify: boolean;
    };
    /** ISO date. */
    acquiredOn: string;
    /** Points at the invoice or licence document, which stays OUT of this repo. */
    evidence: string;
    /** Who read the terms. */
    checkedBy: string;
}
export interface AssetManifest {
    version: number;
    baseUrl: string;
    assets: AssetEntry[];
}
/** True when `tier` is at or above `minTier`. */
export declare function tierMeets(tier: AssetTier, minTier: AssetTier | undefined): boolean;
/**
 * The rule that only bites on device. A `.glb` may be used ONLY if it declares
 * no images — otherwise `GLTFLoader` will reach for `new Blob([ArrayBuffer])`,
 * which Hermes does not have.
 */
export declare function assertLoadableInReactNative(entry: AssetEntry): void;
export declare function validateManifest(manifest: AssetManifest): void;
/** Everything a given tier must have on disk before the stage can be built. */
export declare function assetsForTier(manifest: AssetManifest, tier: AssetTier): AssetEntry[];
/** Total download for a tier, so the UI can show a real number and not a spinner. */
export declare function downloadBytesForTier(manifest: AssetManifest, tier: AssetTier): number;
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
export declare function resolveAssets(manifest: AssetManifest, tier: AssetTier, host: AssetHost, options?: ResolveOptions): Promise<ResolvedAsset[]>;
/**
 * The two globals the RN harness must install before ANY three.js loader runs.
 *
 * `fast-text-encoding` because `GLTFLoader` decodes the JSON chunk with
 * `TextDecoder`, and `window.parent = window` because three's loader manager
 * probes it. Both come straight from the reference harness
 * (`react-native-webgpu`'s example app); they are listed here so the app's entry
 * point has one place to copy from rather than three GitHub issues to find.
 */
export declare const REQUIRED_RN_GLOBALS: readonly string[];
