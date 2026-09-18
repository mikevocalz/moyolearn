// Quickdraw's stroke records, read defensively.
//
// `ShapeRecord.props` is typed `Record<string, any>` in `@quickdrawjs/core`, so
// the geometry's layout is NOT part of the package's contract. What the
// installed engine writes for a freehand stroke is
// `props: { pts: [[dx, dy, pressure], …], color, size, dash }` with `x`/`y` on
// the record as the stroke's origin — discovered by reading
// `node_modules/@quickdrawjs/react-native/src/board-html.generated.js`, not
// documented anywhere.
//
// That is a coupling a vendor bump can break silently, which is why it lives in
// a file with no renderer in it: it can be asserted. Every field is checked
// before use and a record that does not match is skipped rather than guessed
// at, so the failure mode is a missing stroke a reviewer can see instead of a
// crash in a child's session.
//
// A STROKE'S WEIGHT IS FOUR VENDOR CONSTANTS AND ONLY ONE IS PUBLIC.
// `@quickdrawjs/core` exports `SIZES` from its index. `INK_SIZES`,
// `HIGHLIGHT_SCALE` and `HIGHLIGHT_ALPHA` live in `src/palette.js` and are NOT
// re-exported by `src/index.js`, and the package's `exports` map publishes only
// `.`, `./quickdraw.css` and `./package.json`, so there is no specifier that
// reaches them. They are mirrored below and `stroke-of.test.ts` reads
// `palette.js` as text and asserts the mirror still matches — a vendor bump
// that moves a number fails the test instead of silently re-weighting a child's
// handwriting.
//
// Resolving everything through `SIZES` was wrong in both directions and both
// are visible on the paper. The engine's pressure-ink path fills an outline
// built from `INK_SIZES` (`shapes.js:305`), which is a step heavier than
// `SIZES` at `s` and `m` on purpose — the pencil thins below its nominal size
// and the table compensates — so a default `m` pen came out at 4 page px where
// the 2D board draws 5.2, about 23% thin. And the highlighter draws at
// `SIZES[size] × HIGHLIGHT_SCALE` with `globalAlpha = HIGHLIGHT_ALPHA`
// (`shapes.js:351-356`): an `m` band is 18 page px at 0.55 opacity, not a 4 px
// line at 0.4.
// SOT: node_modules/@quickdrawjs/core/src/palette.js · node_modules/@quickdrawjs/core/src/shapes.js
// SOT-KEYWORDS: quickdraw stroke record parse defensive pts freehand highlight geometry vendor internal ink sizes alpha

import { SIZES } from '@quickdrawjs/core';

/**
 * `@quickdrawjs/core/src/palette.js`, mirrored because it is unreachable.
 *
 * Not a preference and not a tuning: these are the numbers the 2D board is
 * already drawing with, and the whole point of the spatial ink layer is that it
 * is the same document in a second presentation.
 */
const INK_SIZES = { s: 3.4, m: 5.2, l: 6.5, xl: 10 } as const satisfies Record<
  keyof typeof SIZES,
  number
>;
/** Highlighter band width = `SIZES[size] × HIGHLIGHT_SCALE`. */
const HIGHLIGHT_SCALE = 4.5;
/** The alpha the engine multiplies a highlighter band by. */
const HIGHLIGHT_ALPHA = 0.55;

/**
 * The dash ids the engine treats as pressure ink rather than an even width.
 *
 * `shapes.js:333` branches on `p.dash && p.dash !== 'draw'`: anything else —
 * `'draw'`, or a record with no `dash` at all — takes `drawPath`, which is the
 * `INK_SIZES` outline. `'solid'`, `'dashed'` and `'dotted'` take the even
 * `SIZES` centreline. Both are reachable from the 2D tray, so both are read.
 */
const isPressureInk = (dash: unknown): boolean => dash === undefined || dash === 'draw';

/** What this renderer needs from a record, and nothing more. */
export interface StrokeGeometry {
  id: string;
  /** Page-space points, absolute. */
  points: readonly { x: number; y: number }[];
  /** The vendor's colour id, which names the registered ink material. */
  colourId: string;
  /** Page-space stroke width, as the engine's own 2D path would draw it. */
  width: number;
  /**
   * What the engine draws this stroke at — `HIGHLIGHT_ALPHA` for a band, 1 for
   * ink. Resolved here rather than at the renderer so the vendor's numbers all
   * live in one asserted file.
   */
  opacity: number;
  highlight: boolean;
}

/** Three numbers per point: dx, dy, pressure. See `POINT_STRIDE`. */
const POINT_STRIDE = 3;

/**
 * A document record as stroke geometry, or `null` when it is not a stroke.
 *
 * Text, notes, arrows and images are deliberately `null`: the board's tray
 * offers pen, highlighter and eraser only, so anything else in the document
 * came from the web app's fuller tray and has no spatial representation yet.
 * Dropping it silently is wrong, which is why the caller counts what it skipped.
 */
export function strokeOf(id: string, record: unknown): StrokeGeometry | null {
  if (typeof record !== 'object' || record === null) return null;
  const shape = record as { typeName?: unknown; type?: unknown; x?: unknown; y?: unknown; props?: unknown };
  if (shape.typeName !== 'shape') return null;
  if (shape.type !== 'draw' && shape.type !== 'highlight') return null;
  if (typeof shape.x !== 'number' || typeof shape.y !== 'number') return null;
  if (typeof shape.props !== 'object' || shape.props === null) return null;

  const props = shape.props as {
    pts?: unknown;
    color?: unknown;
    size?: unknown;
    dash?: unknown;
  };
  if (!Array.isArray(props.pts) || props.pts.length === 0) return null;

  /*
    `pts` IS FLAT, NOT A LIST OF TRIPLES, and reading it as triples is why the
    spatial board rendered nothing at all.

    The engine seeds `pts: [0, 0, pressure]` and extends it with
    `.push(h.x - o.x, h.y - o.y, pressure)` — one array of numbers, three per
    point — and every reader inside it strides by three
    (`for (let l = 0; l < o.pts.length; l += 3)`). A previous version here
    iterated the array and asked `Array.isArray(point)` of each element, which
    is false for a number, so every point was skipped, `points` came out empty,
    and `strokeOf` returned `null` for every stroke on the board. Nothing threw
    and nothing logged: the headset simply showed blank paper.

    The tests missed it because their fixture was built from the same wrong
    assumption. `stroke-of.test.ts` now asserts the flat shape against the
    vendor's own source rather than against what this file expected to find.
  */
  const flat = props.pts;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += POINT_STRIDE) {
    const dx = flat[i];
    const dy = flat[i + 1];
    if (typeof dx !== 'number' || typeof dy !== 'number') continue;
    points.push({ x: shape.x + dx, y: shape.y + dy });
  }
  if (points.length === 0) return null;

  const colourId = typeof props.color === 'string' ? props.color : 'black';
  const sizeId = typeof props.size === 'string' ? props.size : 'm';
  const key = (sizeId in SIZES ? sizeId : 'm') as keyof typeof SIZES;
  const highlight = shape.type === 'highlight';

  /*
    THREE WIDTHS, BECAUSE THE ENGINE HAS THREE. A highlighter is a wide band, a
    pressure-ink stroke is the compensated `INK_SIZES` outline, and a styled
    line is the flat `SIZES` centreline. Collapsing them onto `SIZES` is what
    made the headset's ink thin and its highlighter a pencil line.
  */
  const width = highlight
    ? SIZES[key] * HIGHLIGHT_SCALE
    : isPressureInk(props.dash)
      ? INK_SIZES[key]
      : SIZES[key];

  return {
    id,
    points,
    colourId,
    width,
    opacity: highlight ? HIGHLIGHT_ALPHA : 1,
    highlight,
  };
}

