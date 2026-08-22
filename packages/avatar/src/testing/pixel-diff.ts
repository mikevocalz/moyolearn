/**
 * Perceptual pixel diff — doc 22 §8, the measuring half of the golden gate.
 *
 * The reference used `pixelmatch` at a 0.4 % budget. This is the same
 * algorithm — Yee's perceptual metric in YIQ, with the antialiasing heuristic —
 * reimplemented rather than depended on, for the same reason as `png.ts`: the
 * package runs in Node, in CI and (the capture half) on a device, and the
 * golden threshold is a number this repo owns.
 *
 * WHY A PERCEPTUAL METRIC AND NOT `!==`. Two runs of the same scene on the same
 * GPU are not bit-identical: rasterisation order, FMA contraction, and the
 * driver's own tone-mapping LUT all move the last bit. A strict comparison
 * would fail every run and the gate would be turned off within a week, which is
 * the real failure mode of a strict gate. YIQ weighting also means the metric
 * disagrees with a human in the right direction: it is far more sensitive to
 * luminance than to chroma, so a shifted highlight trips it and a 1/255 hue
 * drift in the sclera does not.
 *
 * ANTIALIASING DETECTION matters more here than in a typical web snapshot: the
 * groom is 250 braids of one-pixel ribbons and the lashes are alpha cutouts, so
 * a half-pixel camera difference lights up thousands of edge pixels that no
 * reviewer would call a regression. `includeAA: false` (the default) excludes a
 * pixel when it looks like an antialiased edge in EITHER image.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §8
 * SOT-KEYWORDS: pixel diff pixelmatch golden yiq perceptual antialiasing threshold budget
 */
import type { RgbaImage } from './png.ts';

export interface DiffOptions {
  /** Per-pixel colour distance, 0-1. `pixelmatch`'s default is 0.1. */
  threshold?: number;
  /** Count antialiased edge pixels as differences. Default false — see header. */
  includeAA?: boolean;
  /** Paint the diff image over a faded copy of the reference. Default true. */
  diffMask?: boolean;
}

export interface DiffResult {
  /** Pixels that differ beyond `threshold` and are not antialiasing. */
  diffPixels: number;
  /** `diffPixels / (width * height)`. Compare this against the budget. */
  fraction: number;
  /** Pixels excluded because they looked like an antialiased edge. */
  antialiased: number;
  /** Red where different, yellow where antialiasing was excluded. */
  image: RgbaImage;
}

const MAX_YIQ_DELTA = 35215; // the maximum possible squared YIQ distance

function rgb2y(r: number, g: number, b: number) {
  return r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
}
function rgb2i(r: number, g: number, b: number) {
  return r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
}
function rgb2q(r: number, g: number, b: number) {
  return r * 0.21147017 - g * 0.52261711 + b * 0.31114694;
}

/** Blend onto white, the way a viewer's screen would. */
function blend(c: number, a: number) {
  return 255 + (c - 255) * a;
}

function at(data: Uint8Array, position: number) {
  const a = (data[position + 3] as number) / 255;
  return {
    r: blend(data[position] as number, a),
    g: blend(data[position + 1] as number, a),
    b: blend(data[position + 2] as number, a),
  };
}

/** Signed colour delta: positive means `b` is brighter. */
function colorDelta(
  a: Uint8Array,
  b: Uint8Array,
  pa: number,
  pb: number,
  yOnly = false
): number {
  if (
    a[pa] === b[pb] &&
    a[pa + 1] === b[pb + 1] &&
    a[pa + 2] === b[pb + 2] &&
    a[pa + 3] === b[pb + 3]
  ) {
    return 0;
  }
  const x = at(a, pa);
  const y = at(b, pb);
  const dy = rgb2y(x.r, x.g, x.b) - rgb2y(y.r, y.g, y.b);
  if (yOnly) return dy;
  const di = rgb2i(x.r, x.g, x.b) - rgb2i(y.r, y.g, y.b);
  const dq = rgb2q(x.r, x.g, x.b) - rgb2q(y.r, y.g, y.b);
  const delta = 0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq;
  return dy > 0 ? -delta : delta;
}

/**
 * Yee's heuristic: a pixel is antialiasing if it is the darkest or brightest
 * of its 8 neighbours by luminance and has at most two identical neighbours,
 * AND the same is not true in the other image.
 */
function isAntialiased(
  image: Uint8Array,
  x1: number,
  y1: number,
  width: number,
  height: number,
  other: Uint8Array
): boolean {
  const x0 = Math.max(x1 - 1, 0);
  const y0 = Math.max(y1 - 1, 0);
  const x2 = Math.min(x1 + 1, width - 1);
  const y2 = Math.min(y1 + 1, height - 1);
  const position = (y1 * width + x1) * 4;
  let zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;
  let min = 0;
  let max = 0;
  let minX = -1;
  let minY = -1;
  let maxX = -1;
  let maxY = -1;

  for (let x = x0; x <= x2; ++x) {
    for (let y = y0; y <= y2; ++y) {
      if (x === x1 && y === y1) continue;
      const delta = colorDelta(image, image, position, (y * width + x) * 4, true);
      if (delta === 0) {
        if (++zeroes > 2) return false;
      } else if (delta < min) {
        min = delta;
        minX = x;
        minY = y;
      } else if (delta > max) {
        max = delta;
        maxX = x;
        maxY = y;
      }
    }
  }
  if (min === 0 || max === 0) return false;

  return (
    (hasManySiblings(image, minX, minY, width, height) &&
      hasManySiblings(other, minX, minY, width, height)) ||
    (hasManySiblings(image, maxX, maxY, width, height) &&
      hasManySiblings(other, maxX, maxY, width, height))
  );
}

function hasManySiblings(
  image: Uint8Array,
  x1: number,
  y1: number,
  width: number,
  height: number
): boolean {
  const x0 = Math.max(x1 - 1, 0);
  const y0 = Math.max(y1 - 1, 0);
  const x2 = Math.min(x1 + 1, width - 1);
  const y2 = Math.min(y1 + 1, height - 1);
  const position = (y1 * width + x1) * 4;
  let zeroes = x1 === x0 || x1 === x2 || y1 === y0 || y1 === y2 ? 1 : 0;

  for (let x = x0; x <= x2; ++x) {
    for (let y = y0; y <= y2; ++y) {
      if (x === x1 && y === y1) continue;
      const p = (y * width + x) * 4;
      if (
        image[position] === image[p] &&
        image[position + 1] === image[p + 1] &&
        image[position + 2] === image[p + 2] &&
        image[position + 3] === image[p + 3]
      ) {
        if (++zeroes > 2) return true;
      }
    }
  }
  return false;
}

export function diffImages(
  reference: RgbaImage,
  candidate: RgbaImage,
  options: DiffOptions = {}
): DiffResult {
  if (reference.width !== candidate.width || reference.height !== candidate.height) {
    throw new Error(
      `diffImages: size mismatch — reference ${reference.width}x${reference.height}, ` +
        `candidate ${candidate.width}x${candidate.height}. ` +
        'A golden captured at a different DPR is not comparable; recapture, do not resize.'
    );
  }

  const threshold = options.threshold ?? 0.1;
  const includeAA = options.includeAA ?? false;
  const diffMask = options.diffMask ?? true;
  const { width, height } = reference;
  const out = new Uint8Array(width * height * 4);
  const maxDelta = MAX_YIQ_DELTA * threshold * threshold;

  let diffPixels = 0;
  let antialiased = 0;

  for (let y = 0; y < height; ++y) {
    for (let x = 0; x < width; ++x) {
      const position = (y * width + x) * 4;
      const delta = colorDelta(reference.data, candidate.data, position, position);

      if (Math.abs(delta) > maxDelta) {
        if (
          !includeAA &&
          (isAntialiased(reference.data, x, y, width, height, candidate.data) ||
            isAntialiased(candidate.data, x, y, width, height, reference.data))
        ) {
          antialiased += 1;
          // Yellow: "this moved, and it is an edge" — usually a camera nudge.
          out[position] = 255;
          out[position + 1] = 255;
          out[position + 2] = 0;
          out[position + 3] = 255;
        } else {
          diffPixels += 1;
          out[position] = 255;
          out[position + 1] = 0;
          out[position + 2] = 0;
          out[position + 3] = 255;
        }
      } else if (diffMask) {
        // Faded reference underneath, so a reviewer can see WHERE on the face.
        const grey = rgb2y(
          blend(reference.data[position] as number, (reference.data[position + 3] as number) / 255),
          blend(reference.data[position + 1] as number, (reference.data[position + 3] as number) / 255),
          blend(reference.data[position + 2] as number, (reference.data[position + 3] as number) / 255)
        );
        const value = 255 + (grey - 255) * 0.1;
        out[position] = value;
        out[position + 1] = value;
        out[position + 2] = value;
        out[position + 3] = 255;
      }
    }
  }

  return {
    diffPixels,
    fraction: diffPixels / (width * height),
    antialiased,
    image: { width, height, data: out },
  };
}
