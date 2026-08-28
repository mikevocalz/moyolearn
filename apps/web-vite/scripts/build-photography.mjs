#!/usr/bin/env node
/**
 * The photography pipeline. Pexels originals → cropped, paper/ink duotoned
 * AVIF + WebP + JPEG in `public/images`, plus the manifest recording where
 * every file came from.
 *
 * This runs BY HAND and its output is committed, exactly like
 * `build-globe-geometry.mjs`. Two reasons it is not wired into `vite build`:
 *
 *  1. `sharp` is present in this workspace only as a hoisted TRANSITIVE
 *     dependency. Putting an undeclared package on the build path is how a
 *     deploy breaks on the first machine whose lockfile resolves one level
 *     differently. Committed artefacts have no such edge.
 *  2. The originals are fetched over the network. A build that reaches the
 *     internet for an asset is a build that fails offline and in CI.
 *
 * THE TREATMENT, AND WHY IT IS BAKED RATHER THAN A CSS FILTER.
 * doc 08 §6 puts every in-product photograph in an ink frame and permits a
 * paper/ink duotone "so photography never breaks the palette". As a runtime
 * `filter:` stack the browser would decode the full-colour image, re-composite
 * it on every paint, and hand a reader whose filters do not apply a picture in
 * a palette this page does not own. Baked, it is just pixels: the file that
 * arrives is already in the palette, costs nothing to paint, and compresses far
 * better than the colour original — two of its three channels are a fixed
 * function of the third, which is most of why these files are as small as they
 * are.
 *
 * The map is a luminance ramp between two real tokens, `moyoPaper` at white and
 * `moyoInk` at black, with a contrast curve applied first. No third colour and
 * no hue: a duotone that invents a tint is a palette `packages/theme/tokens.ts`
 * has never heard of. The two token values are read from the theme at run time
 * rather than typed here, for the same reason the globe pipeline emits token
 * NAMES instead of colours.
 *
 * Usage:
 *   node scripts/build-photography.mjs            fetch (if needed), cut, emit
 *   node scripts/build-photography.mjs --check    fail if any artefact is missing
 *
 * Originals are cached in `data/photography/` and are deliberately NOT
 * committed: they are re-fetchable from the id in the register, and a 2400px
 * colour original per photograph is weight the repo has no use for.
 *
 * SOT: apps/web-vite/src/components/photography.ts (runtime register) ·
 *      apps/web-vite/src/components/photography.provenance.ts (source, casting) ·
 *      docs/pack/08-visual-hierarchy-spacing-spec.md §6 · packages/theme/tokens.ts
 *      https://www.pexels.com/license/
 * SOT-KEYWORDS: web-vite photography pipeline pexels duotone paper ink avif webp
 *               jpeg sharp build-time crop manifest images
 */
// Explicitly imported rather than taken off the global: this file is linted
// with the app's browser-flavoured config, where `Buffer` is not a global.
import { Buffer } from 'node:buffer';
import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHOTOGRAPHY,
  PHOTO_FALLBACK_EXTENSION,
  PHOTO_FORMATS,
} from '../src/components/photography.ts';
import { PHOTOGRAPHY_PROVENANCE } from '../src/components/photography.provenance.ts';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(APP, 'data/photography');
const OUT = join(APP, 'public/images');
const MANIFEST = join(OUT, 'MANIFEST.md');

const check = process.argv.includes('--check');

/*
  Pexels' HTML pages answer a scripted request with 403; its image CDN answers
  200. So the register carries the page URL for a human to verify the licence
  against, and this fetch goes to the CDN. `w=2400` is the largest rendition the
  compressed endpoint serves, and every crop below is expressed against it.
*/
const SOURCE_WIDTH = 2400;
const cdn = (id) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${SOURCE_WIDTH}`;

/*
  Encoder settings. AVIF at 52 and WebP at 74 were picked by measuring, not by
  taste: on a two-tone image both are visually lossless against the source crop
  well below the point where the file stops shrinking. `effort: 6` is the
  slowest AVIF setting that still finishes in seconds on a whole set, and this
  script runs by hand, so the encode time is free.
*/
const ENCODE = {
  avif: { quality: 52, effort: 6, chromaSubsampling: '4:4:4' },
  webp: { quality: 74, effort: 6 },
  jpeg: { quality: 78, mozjpeg: true, chromaSubsampling: '4:4:4' },
};

/*
  The tone curve, applied to luminance before the ramp.

  `CONTRAST` opens the midtones back up: converting to luminance flattens a
  photograph, and a flat duotone on a cream page reads as a faded photocopy
  rather than as print. `SHADOW_LIFT` then holds the darkest pixels a hair off
  `moyoInk` — a photograph that reaches the exact value of the frame around it
  loses its edge, and the frame is the treatment.
*/
const CONTRAST = 1.38;
const SHADOW_LIFT = 0.03;

/** `#RRGGBB` → `[r, g, b]`. The theme stores hex; sharp wants bytes. */
function rgb(hex) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * The two ends of the ramp, read from the theme rather than typed here — the
 * same rule the globe pipeline follows when it emits token names instead of
 * colours. Loaded lazily so `--check`, which only stats files, does not pull a
 * workspace package (and its type-stripping cost) into a lint run.
 */
async function ramp() {
  const { siteColors } = await import('@acme/theme');
  const paper = rgb(siteColors.moyoPaper);
  const ink = rgb(siteColors.moyoInk);
  return { ink, slope: paper.map((channel, i) => (channel - ink[i]) / 255) };
}

function toneMap(value) {
  const x = 0.5 + (value / 255 - 0.5) * CONTRAST;
  return Math.max(0, Math.min(1, SHADOW_LIFT + x * (1 - SHADOW_LIFT)));
}

/**
 * Greyscale → three bands. sharp's `linear()` refuses to expand a one-band
 * image into three ("Band expansion using linear is unsupported"), and joining
 * three copies of the same band through a pipeline costs more code than the
 * loop does. So the ramp is applied to raw bytes, once, here.
 */
async function duotone(sharp, { ink, slope }, source, crop, width) {
  const { data, info } = await sharp(source)
    .extract(crop)
    .resize(width)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = info.width * info.height;
  const out = Buffer.allocUnsafe(pixels * 3);
  for (let i = 0; i < pixels; i += 1) {
    const luminance = toneMap(data[i]) * 255;
    for (let c = 0; c < 3; c += 1) {
      out[i * 3 + c] = Math.round(luminance * slope[c] + ink[c]);
    }
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } });
}

async function original(name) {
  const { pexelsId } = PHOTOGRAPHY_PROVENANCE[name];
  const path = join(CACHE, `${pexelsId}.jpg`);
  if (existsSync(path)) return path;

  mkdirSync(CACHE, { recursive: true });
  const response = await fetch(cdn(pexelsId));
  if (!response.ok) {
    throw new Error(`${name}: Pexels CDN answered ${response.status} for ${pexelsId}`);
  }
  writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  return path;
}

function emitted(name, entry) {
  const files = [];
  for (const width of entry.widths) {
    for (const format of [...PHOTO_FORMATS, PHOTO_FALLBACK_EXTENSION]) {
      files.push(join(OUT, `${name}-${width}.${format}`));
    }
  }
  return files;
}

function kb(path) {
  return `${Math.round(statSync(path).size / 1024)} kB`;
}

function writeManifest(sizes) {
  const lines = [
    '# Photography manifest',
    '',
    'Every photograph that ships on the marketing site, where it came from, why it',
    'was cast, and where it is used. Generated by `scripts/build-photography.mjs`',
    'from `src/components/photography.ts` and `photography.provenance.ts` — edit',
    'those, not this file.',
    '',
    '**Licence.** Every image is [Pexels](https://www.pexels.com/license/): free for',
    'commercial use, no attribution required. Photographer and source URL are',
    'recorded anyway so any pick can be re-verified against the licence.',
    '',
    '**Treatment.** Each file is cropped from the 2400px Pexels rendition and baked',
    'into a `moyoPaper`→`moyoInk` duotone at build time (doc 08 §6), so the palette',
    'is in the pixels and no runtime filter is involved. AVIF and WebP are offered',
    'through `<picture>`; the JPEG is the fallback `src`. Every file sits in the',
    'doc 08 §6 ink frame, full bleed, drawn by the chapter that mounts it.',
    '',
  ];

  for (const [name, entry] of Object.entries(PHOTOGRAPHY)) {
    const source = PHOTOGRAPHY_PROVENANCE[name];
    const { width: cw, height: ch } = entry.crop;
    lines.push(
      `## \`${name}\``,
      '',
      `- **Pexels id:** ${source.pexelsId} · **Photographer:** ${source.photographer}`,
      `- **Source:** ${source.source}`,
      `- **Depicts:** ${source.depicts}`,
      `- **Cast:** ${source.cast}`,
      `- **Used in:** ${source.usedIn}`,
      `- **Alt:** “${entry.alt}” — ${source.altSource}`,
      `- **Crop:** ${cw}×${ch} at (${entry.crop.left}, ${entry.crop.top}) of the ${SOURCE_WIDTH}px rendition`,
      '',
      '| File | Bytes |',
      '| --- | --- |',
    );
    for (const file of emitted(name, entry)) {
      lines.push(`| \`${relative(OUT, file)}\` | ${sizes.get(file)} |`);
    }
    lines.push('');
  }

  writeFileSync(MANIFEST, `${lines.join('\n')}`);
}

async function main() {
  const missing = Object.entries(PHOTOGRAPHY)
    .flatMap(([name, entry]) => emitted(name, entry))
    .filter((file) => !existsSync(file));

  if (check) {
    if (missing.length > 0) {
      console.error(
        `photography: ${missing.length} artefact(s) missing. Run \`node scripts/build-photography.mjs\`.`,
      );
      for (const file of missing) console.error(`  ${relative(APP, file)}`);
      process.exit(1);
    }
    console.log('photography: all artefacts present.');
    return;
  }

  /*
    Imported here and not at the top: this file is read by `--check` on a
    machine that may not have sharp hoisted into it, and a missing optional tool
    should fail with a sentence rather than a resolver stack trace.
  */
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch {
    console.error(
      'photography: `sharp` is not resolvable from this workspace. It is a hoisted\n' +
        'transitive dependency, not a declared one — re-run `pnpm install`, or add it\n' +
        'deliberately before regenerating the artefacts.',
    );
    process.exit(1);
  }

  mkdirSync(OUT, { recursive: true });
  const sizes = new Map();
  const tones = await ramp();

  for (const [name, entry] of Object.entries(PHOTOGRAPHY)) {
    const source = await original(name);
    for (const width of entry.widths) {
      const toned = await duotone(sharp, tones, source, { ...entry.crop }, width);
      for (const [format, extension] of [
        ...PHOTO_FORMATS.map((f) => [f, f]),
        ['jpeg', PHOTO_FALLBACK_EXTENSION],
      ]) {
        const file = join(OUT, `${name}-${width}.${extension}`);
        await toned.clone()[format](ENCODE[format]).toFile(file);
        sizes.set(file, kb(file));
        console.log(`  ${relative(APP, file)}  ${sizes.get(file)}`);
      }
    }
  }

  writeManifest(sizes);
  console.log(`photography: wrote ${relative(APP, MANIFEST)}`);
}

await main();
