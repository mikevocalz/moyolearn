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
// Read early: the walk below needs to know which absences are recorded.
const ledgerEntriesEarly = existsSync(resolve(flag('ledger', 'assets/asset-ledger.json')))
  ? (JSON.parse(readFileSync(resolve(flag('ledger', 'assets/asset-ledger.json')), 'utf8')).entries ?? {})
  : {};

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
    /*
      An asset the ledger marks `pending` is absent on purpose and already
      recorded as such, so it is not a build failure — it is the state of the
      repo, stated. Anything else absent still is one.
    */
    if (!ledgerEntriesEarly[asset.id]?.pending) {
      process.stderr.write(`  missing: ${asset.id} (${source ?? 'no source given'})\n`);
      missing += 1;
    }
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

/*
  AUTHORED DATA LIVES IN A LEDGER; THIS SCRIPT MERGES IT AND NEVER WRITES IT.

  A rights record is written by the human who read the terms. A generator cannot
  derive one and must not be trusted to preserve one — and the previous version
  of this file tried to, by reading its own output back and carrying rights
  forward by id. That works right up until someone builds into a fresh path, or
  the output is deleted, or a rename drops an id: the record is gone with no
  diff that explains why.

  So the two halves are separated. `asset-ledger.json` is authored and holds
  `delivery`, `rights` and `supersededBy`. This script derives paths, sizes and
  hashes and merges the ledger on top. The generated file says so at the top.

  It fails rather than guesses in three directions, because each of them is a
  silent data loss in a different disguise: an asset with no ledger entry would
  ship unclassified, a ledger entry with no asset is a record of something that
  no longer exists, and a rebuild that drops a field previously present is the
  original bug wearing a new hat.
*/
const ledgerPath = resolve(flag('ledger', 'assets/asset-ledger.json'));
if (!existsSync(ledgerPath)) {
  process.stderr.write(`\nledger not found at ${ledgerPath} — authored rights live there, refusing to build without it\n`);
  process.exit(1);
}
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
const ledgerEntries = ledger.entries ?? {};
const retiredFields = ledger.retiredFields ?? {};

/** `delivery` decides whether an asset counts against a client budget at all. */
const DELIVERY = new Set(['bundle', 'ondemand', 'pipeline-source', 'server']);

const ledgerProblems = [];
for (const entry of entries) {
  const record = ledgerEntries[entry.id];
  if (!record) {
    ledgerProblems.push(`${entry.id}: no ledger entry — add one to ${flag('ledger', 'assets/asset-ledger.json')} with a delivery class`);
    continue;
  }
  if (!DELIVERY.has(record.delivery)) {
    ledgerProblems.push(`${entry.id}: delivery "${record.delivery}" is not one of ${[...DELIVERY].join(', ')}`);
  }
  Object.assign(entry, record);
}
/*
  A pipeline source is an offline input — a motion corpus, a purchased master —
  and this script never walks it, because no client downloads it. It comes
  through from the ledger with whatever the human recorded, including its hash
  and size, and it must carry those or the record proves nothing.
*/
const walked = new Set(entries.map((e) => e.id));
const pending = [];
const carried = [];
for (const [id, record] of Object.entries(ledgerEntries)) {
  if (walked.has(id)) continue;
  if (record.delivery === 'pipeline-source' || record.delivery === 'server') {
    carried.push({ id, ...record });
    continue;
  }
  /*
    `pending` is an asset the manifest promises and the repo does not contain.
    Nineteen of the twenty are in that state — the GNM and body pipeline that
    would emit them is not here — and a build that simply refuses is a wall
    rather than a gate. Recording it keeps the check meaningful for a NEWLY
    missing file while stating the known gap out loud.
  */
  if (record.pending) {
    pending.push(id);
    carried.push({ id, ...record });
    continue;
  }
  ledgerProblems.push(`${id}: in the ledger but no such asset was found — remove the entry, or mark it pending with a reason`);
}

/*
  THE DROP CHECK. Whatever the previous manifest recorded, this one must still
  record. It is the one guard that catches a class of loss the ledger cannot:
  a field the builder used to emit and silently stopped emitting.
*/
if (existsSync(outPath)) {
  const prior = JSON.parse(readFileSync(outPath, 'utf8'));
  const next = new Map([...entries, ...carried].map((e) => [e.id, e]));
  for (const before of prior.assets ?? []) {
    const after = next.get(before.id);
    if (!after) {
      ledgerProblems.push(`${before.id}: present in the previous manifest and absent from this build`);
      continue;
    }
    for (const key of Object.keys(before)) {
      // A field retired on purpose is declared in the ledger. Without that the
      // check cannot tell a deliberate removal from the loss it exists to catch,
      // and a gate that cannot be satisfied honestly gets satisfied dishonestly.
      if (retiredFields[key]) continue;
      if (after[key] === undefined) {
        ledgerProblems.push(`${before.id}.${key}: recorded before and dropped by this build`);
      }
    }
  }
}

if (ledgerProblems.length > 0) {
  for (const problem of ledgerProblems) process.stderr.write(`  FAIL ${problem}\n`);
  process.exit(1);
}

const manifest = {
  $generated: `DO NOT EDIT — generated by tools/build_asset_manifest.mjs from ${flag('ledger', 'assets/asset-ledger.json')}`,
  version: 1,
  baseUrl,
  assets: [...entries, ...carried],
};

// The generator must produce something its own consumer accepts. This throws on
// a duplicate id, a malformed hash, or a `.glb` that declares embedded images.
validateManifest(manifest);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
process.stdout.write(`\n${entries.length} assets -> ${outPath}\n`);
if (pending.length > 0) {
  process.stdout.write(`  ${pending.length} pending (promised by the manifest, absent from the repo)\n`);
}
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
