/**
 * Builds the avatar asset manifest — doc 22 §3, §4 row 17, §10.6.
 *
 * `src/assets.ts` is the capability manager: it resolves every asset a tier
 * needs to a local file URI, verifies a sha-256, and enforces the `.glb`
 * embedded-image rule. Until now it had **nothing to point at** — a resolver
 * with no manifest is a well-tested no-op.
 *
 * This walks the real, baked artefacts, hashes them, assigns each one a minimum
 * tier, and emits the manifest `resolveAssets()` consumes. It then runs the
 * output back through `validateManifest()`, because a manifest generator that
 * cannot produce a manifest its own consumer accepts is worse than no generator.
 *
 * ── THE `.glb` DECLARATIONS ARE MEASURED, NOT ASSERTED ──────────────────────
 *
 * `assertLoadableInReactNative()` refuses a `.glb` that declares embedded
 * images, AND refuses one that declares nothing — because "I did not measure
 * it" is not "it has none". So this parses the glTF JSON chunk out of each
 * `.glb` and counts `images`, `textures` and `materials` for real. If someone
 * re-exports a textured body, the count changes here and the manifest build
 * fails, on the commit that did it, rather than on a device three weeks later.
 *
 * Usage:
 *   node tools/build_asset_manifest.mjs --src <public dir> --runtime <rebaked container> \
 *        [--base-url https://cdn…] [--out assets/avatar-manifest.json]
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §3, §4 row 17, §6.3
 * SOT-KEYWORDS: asset manifest cdn sha256 tier glb images build capability manager
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validateManifest, assetsForTier, downloadBytesForTier } from '../src/assets.ts';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};

const srcDir = resolve(flag('src', 'public'));
const runtimeContainer = resolve(flag('runtime', 'dist/gnm_head_runtime.bin'));
const lashPng = flag('lash', null);
const baseUrl = flag('base-url', 'https://cdn.example/avatar/v1');
const outPath = resolve(flag('out', 'assets/avatar-manifest.json'));

/**
 * Every artefact the runtime can ask for, with the tier that first needs it.
 *
 * `minTier` is the interesting column and it is a product decision, not a
 * technical one: the phone tier pays for the head, the body, the seam and the
 * face-driving data, and nothing else. Lashes, brow strands and the mouth
 * cavity are grooming detail that is invisible at phone framing and cost real
 * megabytes on a family data plan (doc 22 §3).
 */
const ASSETS = [
  { id: 'gnm-head', kind: 'gnm-head', file: null, path: 'gnm/gnm_head_runtime.bin' },
  { id: 'arkit-map', kind: 'json', file: 'gnm/arkit-map.json' },
  { id: 'identity', kind: 'json', file: 'gnm/identity.json' },
  { id: 'expression-names', kind: 'json', file: 'gnm/expression-names.json' },
  { id: 'body-headless', kind: 'body-glb', file: 'body/smplx_female_headless.glb' },
  { id: 'body-manifest', kind: 'json', file: 'body/smplx-manifest.json' },
  { id: 'neck-align', kind: 'json', file: 'body/neck-align.json' },
  { id: 'skirt-ring', kind: 'json', file: 'body/skirt-ring.json' },
  { id: 'skirt-conform-rig', kind: 'binary', file: 'gnm/skirt-conform.bin' },
  { id: 'skirt-conform-meta', kind: 'json', file: 'gnm/skirt-conform.json' },
  { id: 'uv', kind: 'binary', file: 'gnm/uv.bin' },

  // Tablet and up: grooming and surface detail.
  { id: 'skin-aux', kind: 'binary', file: 'gnm/skin-aux.bin', minTier: 'tablet' },
  { id: 'skin-aux-meta', kind: 'json', file: 'gnm/skin-aux.json', minTier: 'tablet' },
  { id: 'eye-aux', kind: 'json', file: 'gnm/eye-aux.json', minTier: 'tablet' },
  { id: 'mouth-cavity', kind: 'json', file: 'gnm/mouth-cavity.json', minTier: 'tablet' },
  { id: 'lash-lines', kind: 'json', file: 'gnm/lash-lines.json', minTier: 'tablet' },
  { id: 'lash-strands', kind: 'texture', file: null, path: 'gnm/lash-strands.png', minTier: 'tablet' },
  { id: 'brow-strands', kind: 'binary', file: 'gnm/brow-strands.bin', minTier: 'tablet' },
  { id: 'brow-strands-meta', kind: 'json', file: 'gnm/brow-strands.json', minTier: 'tablet' },
];

/** Counts what a `.glb` actually declares, by parsing its JSON chunk. */
function inspectGlb(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546c67) throw new Error('not a .glb (bad magic)');
  const chunkLength = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== 0x4e4f534a) throw new Error('.glb first chunk is not JSON');
  const json = JSON.parse(new TextDecoder().decode(buffer.subarray(20, 20 + chunkLength)));
  return {
    images: (json.images ?? []).length,
    textures: (json.textures ?? []).length,
    materials: (json.materials ?? []).length,
  };
}

const entries = [];
let missing = 0;

for (const asset of ASSETS) {
  // `file` null means the artefact is produced by one of our own bake tools
  // rather than copied out of the reference's `public/`.
  const source =
    asset.file === null
      ? asset.id === 'gnm-head'
        ? runtimeContainer
        : asset.id === 'lash-strands'
          ? lashPng
          : null
      : join(srcDir, asset.file);

  if (!source || !existsSync(source)) {
    process.stderr.write(`  missing: ${asset.id} (${source ?? 'no source given'})\n`);
    missing += 1;
    continue;
  }

  const bytes = readFileSync(source);
  const entry = {
    id: asset.id,
    kind: asset.kind,
    path: asset.path ?? asset.file,
    bytes: statSync(source).size,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  if (asset.minTier) entry.minTier = asset.minTier;
  if (asset.kind === 'body-glb') entry.declares = inspectGlb(bytes);
  entries.push(entry);
}

const manifest = { version: 1, baseUrl, assets: entries };

// The generator must produce something its own consumer accepts. This throws on
// a duplicate id, a malformed hash, or a `.glb` that declares embedded images.
validateManifest(manifest);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
process.stdout.write(`\n${entries.length} assets -> ${outPath}\n`);
for (const tier of ['phone', 'tablet', 'studio']) {
  const count = assetsForTier(manifest, tier).length;
  process.stdout.write(
    `  ${tier.padEnd(7)} ${String(count).padStart(2)} assets  ${mb(downloadBytesForTier(manifest, tier))}\n`
  );
}
for (const entry of entries.filter((e) => e.declares)) {
  process.stdout.write(
    `  ${entry.id}: ${entry.declares.images} images, ${entry.declares.textures} textures, ` +
      `${entry.declares.materials} materials — ${entry.declares.images === 0 ? 'safe as .glb' : 'MUST be split'}\n`
  );
}
if (missing) {
  process.stderr.write(`\n${missing} asset(s) missing — manifest is incomplete.\n`);
  process.exit(1);
}
