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
// `props.size` resolves through the vendor's own exported `SIZES` map so a
// spatial stroke is the weight its 2D twin is by construction.
// SOT: node_modules/@quickdrawjs/core/types/index.d.ts
// SOT-KEYWORDS: quickdraw stroke record parse defensive pts freehand highlight geometry vendor internal

import { SIZES } from '@quickdrawjs/core';

/** What this renderer needs from a record, and nothing more. */
export interface StrokeGeometry {
  id: string;
  /** Page-space points, absolute. */
  points: readonly { x: number; y: number }[];
  /** The vendor's colour id, which names the registered ink material. */
  colourId: string;
  /** Page-space stroke width. */
  width: number;
  highlight: boolean;
}

const isPointTriple = (value: unknown): value is [number, number, number?] =>
  Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number';

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

  const props = shape.props as { pts?: unknown; color?: unknown; size?: unknown };
  if (!Array.isArray(props.pts) || props.pts.length === 0) return null;

  const points: { x: number; y: number }[] = [];
  for (const point of props.pts) {
    if (!isPointTriple(point)) continue;
    points.push({ x: shape.x + point[0], y: shape.y + point[1] });
  }
  if (points.length === 0) return null;

  const colourId = typeof props.color === 'string' ? props.color : 'black';
  const sizeId = typeof props.size === 'string' ? props.size : 'm';
  const width = SIZES[sizeId as keyof typeof SIZES] ?? SIZES.m;

  return { id, points, colourId, width, highlight: shape.type === 'highlight' };
}

