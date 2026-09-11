#!/usr/bin/env node
/*
  Master -> phone-tier derivative, deterministically, with the rig proven
  intact at the end. Run from packages/avatar:

    node ../../.claude/skills/asset-optimize/scripts/optimize-avatar.mjs \
      assets/natalie-phone/natalie.gltf /tmp/deriv-out

  THE ORDER IS LOAD-BEARING. `quantize` alone DENSIFIES every sparse morph
  accessor — measured on this asset it tripled the file to 42.48 MB while its
  own log printed "Removed Skin (1)" about a skin that survived. `sparse`
  afterwards re-encodes the deltas and lands at a fifth of the master. The
  tool's size report and prune log are not rig truth; the fingerprint is.

  TEXTURES GO TO PLATFORM CODECS, NOT KTX2, and that is a measured decision
  (ADR-116). The budget problem is download bytes: ASTC's win is VRAM, its
  KTX2 file is BIGGER than a WebP of the same image, and the native runtime is
  Hermes with no WebAssembly for a Basis transcoder. Both baseColor maps carry
  real alpha (the body is authored alphaMode MASK — lashes and brows live in
  its texture), so JPEG is out and WebP-with-alpha is the codec every target
  platform decodes natively. Measured: 1740 KB of PNG -> 303 KB of WebP.

  Measured result on natalie-phone: 13.07 MB -> 3.63 MB, fingerprint clean,
  the one IBM diff proven to be the shared quantization transform.
*/
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
// Resolved from the REPO, not from this file: the skill lives three levels
// under .claude, and a relative specifier here counted from the wrong root.
const repo = resolve(fileURLToPath(import.meta.url), '../../../../..');
const sharp = (await import(join(repo, 'node_modules/sharp/dist/index.mjs'))).default;
import { diff, fingerprint } from './rig-fingerprint.mjs';

const [, , masterArg, outArg] = process.argv;
if (!masterArg || !outArg) {
  console.error('usage: optimize-avatar.mjs <master.gltf> <outDir>');
  process.exit(1);
}
const master = resolve(masterArg);
const outDir = resolve(outArg);
mkdirSync(outDir, { recursive: true });

const cli = (args) =>
  execFileSync('npx', ['-y', '@gltf-transform/cli@4', ...args], {
    env: { ...process.env, npm_config_cache: '/tmp/npmcache' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

const before = fingerprint(master);

// Geometry: quantize (KHR_mesh_quantization, no decoder), then re-sparsify.
const mid = join(outDir, '_quantized.gltf');
const geometry = join(outDir, basename(master));
cli(['quantize', master, mid]);
/*
  `--vertex-layout separate` IS A RENDER-CORRECTNESS FLAG HERE, not a
  preference. The default interleaved write puts non-normalized JOINTS_0 (u16)
  in the same buffer as the normalized quantized attributes, and three's WebGPU
  backend widens a non-normalized u16 backing to u32 FOR THE WHOLE BUFFER — so
  the normalized TEXCOORD sharing it asks the GPU for `unorm32x2`, a format
  that does not exist, and createRenderPipeline rejects the character at first
  render. Separate views give every attribute its own backing, so nothing is
  widened by a neighbour. This is the third appearance of the same widening
  bug on this asset; the first two were the master's authored COLOR_0.
*/
cli(['sparse', '--vertex-layout', 'separate', mid, geometry]);

// Textures: the two alpha-carrying PNGs become WebP; JPEGs pass through.
const sourceDir = dirname(master);
const gltf = JSON.parse(readFileSync(geometry, 'utf8'));
for (const image of gltf.images ?? []) {
  const source = join(sourceDir, image.uri);
  if (/\.png$/i.test(image.uri)) {
    const uri = image.uri.replace(/\.png$/i, '.webp');
    await sharp(source).webp({ quality: 85, alphaQuality: 90 }).toFile(join(outDir, uri));
    // gltf-transform copied the source PNG in alongside its output; once the
    // reference moves to the WebP the copy is an orphan that pads the bundle.
    rmSync(join(outDir, image.uri), { force: true });
    image.uri = uri;
    if (image.mimeType) image.mimeType = 'image/webp';
  } else {
    copyFileSync(source, join(outDir, basename(image.uri)));
  }
}
writeFileSync(geometry, `${JSON.stringify(gltf)}\n`);

// The gate. A broken rig makes the whole run a failure, whatever the bytes say.
const problems = diff(before, fingerprint(geometry));
if (problems.length > 0) {
  for (const p of problems) console.error(`  BROKEN ${p}`);
  process.exit(1);
}

// The intermediate is scaffolding, not deliverable.
rmSync(mid, { force: true });
rmSync(mid.replace(/\.gltf$/, '.bin'), { force: true });

let total = 0;
for (const f of readdirSync(outDir)) {
  if (f.startsWith('_')) continue;
  total += statSync(join(outDir, f)).size;
}
console.log(`rig intact · ${(total / 1024 / 1024).toFixed(2)} MB phone bundle at ${outDir}`);
