/**
 * Bakes the eyelash strand texture to a PNG — doc 22 §4 row 13.
 *
 * THE PROBLEM. The reference painted this texture at startup with
 * `document.createElement('canvas')` and 120 `quadraticCurveTo` strokes. React
 * Native has no DOM canvas, so that line is a hard blocker for the port.
 *
 * THE OBVIOUS FIX IS THE WRONG ONE. Reaching for a canvas polyfill (or Skia)
 * would keep the paint at runtime, which means the texture is now a function of
 * whichever rasteriser shipped in whichever version of that polyfill on that
 * platform — three rasterisers, three subtly different fringes, and a golden set
 * that can never go green on all of them at once. The paint was already
 * deterministic (`mulberry32(1337)`), so the honest move is to bake it ONCE,
 * offline, and ship the bytes.
 *
 * WHY THIS FILE HAS ITS OWN RASTERISER. Baking through `node-canvas` would just
 * move the same problem to CI: the output would then depend on the Cairo build
 * on the machine that ran the bake. The rasteriser below is ~100 lines of
 * dependency-free arithmetic, so `node tools/bake_lash_texture.mjs` produces the
 * same bytes on a laptop, in CI, and on a colleague's machine five years from
 * now. That is the whole point — the checked-in `sha256` in the manifest is only
 * meaningful if the bake is reproducible.
 *
 * FIDELITY. Canvas strokes a path by filling the set of points within
 * `lineWidth / 2` of it; with `lineCap: 'round'` that set is exactly the union
 * of round-capped segments, i.e. a distance field. So flattening the quadratic
 * into segments and thresholding the distance IS the canvas model, not an
 * approximation of it — the only deliberate divergences are:
 *   - 4x4 box supersampling instead of the browser's analytic coverage;
 *   - gradient stops interpolated in straight (non-premultiplied) RGBA. The
 *     only stop pair where that differs is 0 -> 0.7, where the colours are 5
 *     units apart out of 255.
 * Neither is visible at 256x128 through an `alphaTest: 0.35` cutout, and both
 * are now OUR definition rather than a browser's.
 *
 * Usage:  node tools/bake_lash_texture.ts [outDir]   (Node strips the types)
 * Emits:  lash-strands.png  +  lash-strands.json (manifest w/ sha256)
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 13
 * SOT-KEYWORDS: lashes lash texture bake png deterministic canvas polyfill rasteriser
 */
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const WIDTH = 256;
export const HEIGHT = 128;
export const STRAND_COUNT = 120;
export const SEED = 1337;
/** Curve flattening. 24 segments over ~124 px is well under a pixel of chord error. */
const SEGMENTS = 24;
/** Supersampling factor per axis. */
const SS = 4;

/** The reference's PRNG, ported exactly. Every constant matters. */
export function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The 120 strands, drawn in the reference's exact order and with its exact
 * `rand()` call sequence. The ORDER OF THE CALLS IS THE SPEC: move one `rand()`
 * and every strand after it changes.
 */
export interface Strand {
  x0: number;
  tilt: number;
  yTop: number;
  alpha: number;
  lineWidth: number;
}

export function planStrands(): Strand[] {
  const rand = mulberry32(SEED);
  const strands: Strand[] = [];
  for (let i = 0; i < STRAND_COUNT; ++i) {
    const x0 = rand() * WIDTH;
    const tilt = (rand() - 0.5) * 16;
    // flipY: canvas top = ribbon tip, so this is where the strand tapers out.
    const yTop = 4 + rand() * 22;
    const alpha = 0.7 + rand() * 0.3;
    const lineWidth = 1.1 + rand() * 1.5;
    strands.push({ x0, tilt, yTop, alpha, lineWidth });
  }
  return strands;
}

/** Straight-alpha gradient lookup, matching the reference's three stops. */
function gradientAt(t: number, alpha: number): [number, number, number, number] {
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  if (u <= 0.7) {
    const k = u / 0.7;
    return [
      32 + (25 - 32) * k,
      21 + (16 - 21) * k,
      14 + (10 - 14) * k,
      alpha + (alpha * 0.85 - alpha) * k,
    ];
  }
  const k = (u - 0.7) / 0.3;
  return [25, 16, 10, alpha * 0.85 * (1 - k)];
}

/** Squared distance from p to segment ab, plus the clamped parameter along it. */
function segmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lengthSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + dx * t - px;
  const cy = ay + dy * t - py;
  return cx * cx + cy * cy;
}

export function paint(): Uint8Array {
  // Straight (non-premultiplied) RGBA accumulator, source-over per strand —
  // the same compositing order the canvas performed.
  const rgba = new Float64Array(WIDTH * HEIGHT * 4);

  for (const { x0, tilt, yTop, alpha, lineWidth } of planStrands()) {
    // moveTo(x0, 128); quadraticCurveTo(x0 + tilt*0.3, 70, x0 + tilt, yTop)
    const p0x = x0;
    const p0y = HEIGHT;
    const p1x = x0 + tilt * 0.3;
    const p1y = 70;
    const p2x = x0 + tilt;
    const p2y = yTop;
    // Flattened once per strand, as a flat pair array — the inner loop runs
    // ~80 million times, so this is not the place for tuple allocation.
    const points = new Float64Array((SEGMENTS + 1) * 2);
    for (let i = 0; i <= SEGMENTS; ++i) {
      const s = i / SEGMENTS;
      const m = 1 - s;
      points[i * 2] = m * m * p0x + 2 * m * s * p1x + s * s * p2x;
      points[i * 2 + 1] = m * m * p0y + 2 * m * s * p1y + s * s * p2y;
    }

    // The gradient axis is p0 -> p2 (createLinearGradient's two endpoints),
    // NOT arc length along the curve. Canvas projects each pixel onto it.
    const gx = p2x - p0x;
    const gy = p2y - p0y;
    const gLenSq = gx * gx + gy * gy;

    const radius = lineWidth / 2;
    const minX = Math.max(0, Math.floor(Math.min(x0, x0 + tilt) - radius - 2));
    const maxX = Math.min(WIDTH - 1, Math.ceil(Math.max(x0, x0 + tilt) + radius + 2));
    const minY = Math.max(0, Math.floor(yTop - radius - 2));
    const maxY = HEIGHT - 1;

    for (let y = minY; y <= maxY; ++y) {
      for (let x = minX; x <= maxX; ++x) {
        let coverage = 0;
        let tSum = 0;
        for (let sy = 0; sy < SS; ++sy) {
          for (let sx = 0; sx < SS; ++sx) {
            const px = x + (sx + 0.5) / SS;
            const py = y + (sy + 0.5) / SS;
            let best = Infinity;
            for (let i = 0; i < SEGMENTS; ++i) {
              const d = segmentDistanceSq(
                px,
                py,
                points[i * 2] as number,
                points[i * 2 + 1] as number,
                points[i * 2 + 2] as number,
                points[i * 2 + 3] as number
              );
              if (d < best) best = d;
            }
            if (best <= radius * radius) {
              coverage += 1;
              tSum += gLenSq > 0 ? ((px - p0x) * gx + (py - p0y) * gy) / gLenSq : 0;
            }
          }
        }
        if (coverage === 0) continue;

        const [r, g, b, a] = gradientAt(tSum / coverage, alpha);
        const srcA = (a * coverage) / (SS * SS);
        if (srcA <= 0) continue;

        const o = (y * WIDTH + x) * 4;
        const dstA = rgba[o + 3] as number;
        const outA = srcA + dstA * (1 - srcA);
        if (outA <= 0) continue;
        // source-over in straight alpha
        rgba[o] = (r * srcA + (rgba[o] as number) * dstA * (1 - srcA)) / outA;
        rgba[o + 1] = (g * srcA + (rgba[o + 1] as number) * dstA * (1 - srcA)) / outA;
        rgba[o + 2] = (b * srcA + (rgba[o + 2] as number) * dstA * (1 - srcA)) / outA;
        rgba[o + 3] = outA;
      }
    }
  }

  const clamp255 = (v: number) => Math.round(Math.min(255, Math.max(0, v)));
  const out = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let i = 0; i < WIDTH * HEIGHT; ++i) {
    out[i * 4] = clamp255(rgba[i * 4] as number);
    out[i * 4 + 1] = clamp255(rgba[i * 4 + 1] as number);
    out[i * 4 + 2] = clamp255(rgba[i * 4 + 2] as number);
    out[i * 4 + 3] = clamp255((rgba[i * 4 + 3] as number) * 255);
  }
  return out;
}

/* ---------------------------------------------------------------- PNG ---- */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; ++n) {
    let c = n;
    for (let k = 0; k < 8; ++k) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = -1;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] as number) ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/**
 * Minimal RGBA8 PNG. Filter type 0 on every row and `level: 9` deflate, both
 * fixed — a "smarter" filter heuristic would make the bytes depend on the zlib
 * build, which is exactly what we are avoiding.
 */
export function encodePng(rgba: Uint8Array, width: number, height: number): Buffer {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; ++y) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* --------------------------------------------------------------- main ---- */

export interface LashTextureManifest {
  name: string;
  width: number;
  height: number;
  seed: number;
  strands: number;
  supersample: number;
  segments: number;
  colorSpace: string;
  sha256: string;
}

export function bake(): { png: Buffer; manifest: LashTextureManifest } {
  const png = encodePng(paint(), WIDTH, HEIGHT);
  return {
    png,
    manifest: {
      name: 'lash-strands',
      width: WIDTH,
      height: HEIGHT,
      seed: SEED,
      strands: STRAND_COUNT,
      supersample: SS,
      segments: SEGMENTS,
      colorSpace: 'srgb',
      // Consumed by the CDN capability manager and asserted in CI: if a change
      // to this file moves a single pixel, this hash moves and the golden set
      // must be re-approved deliberately.
      sha256: createHash('sha256').update(png).digest('hex'),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outDir = process.argv[2] ?? 'dist/gnm';
  mkdirSync(outDir, { recursive: true });
  const { png, manifest } = bake();
  writeFileSync(join(outDir, 'lash-strands.png'), png);
  writeFileSync(join(outDir, 'lash-strands.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(
    `lash-strands.png  ${png.length} bytes  sha256 ${manifest.sha256}\n`
  );
}
