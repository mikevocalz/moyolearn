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
export declare function diffImages(reference: RgbaImage, candidate: RgbaImage, options?: DiffOptions): DiffResult;
