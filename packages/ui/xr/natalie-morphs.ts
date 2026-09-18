// Her face, in the one shape ViroCore takes it in.
//
// The 2D stage writes 52 ARKit weights straight onto a three.js mesh every
// frame. The spatial one cannot: `Viro3DObject` takes `morphTargets` as a PROP,
// so every weight that changes is a bridge crossing, and 52 of them at 60 Hz is
// 3 120 property writes a second for a face that is mostly still. This is the
// filter that makes the same performance affordable — and it is pure, so what
// it drops is a test rather than a thing to notice in a headset.
//
// TWO RULES, AND THE SECOND ONE IS THE SUBTLE HALF.
//
//  1. A weight under the noise floor is not sent. The face bus emits exact
//     zeros for most shapes on most frames; a `browDownLeft` of 0.004 is not
//     visible at 1.5 m and costs the same as one that is.
//  2. A shape that WAS sent and is now under the floor is sent as an explicit
//     zero, once. Dropping it instead leaves the last non-zero weight standing
//     on the model — the renderer holds what it was last told — so a blink
//     would open and never close, and a viseme would freeze her mid-word.
//     `previous` is what makes the difference between the two cases knowable.
// SOT: packages/ui/xr/XrNatalie.native.tsx · packages/avatar/src/face-bus.ts
// SOT-KEYWORDS: natalie xr morph targets arkit shapes face weights filter viro 3d object bridge

/** A weight map, as `@acme/avatar` emits it: shape name to 0..1. */
export type NatalieShape = Readonly<Record<string, number>>;

/** One entry of `Viro3DObject`'s `morphTargets` prop. */
export interface NatalieMorph {
  target: string;
  weight: number;
}

/**
 * Below this a weight is not worth a bridge crossing.
 *
 * 1/255 — the step an 8-bit channel could show. It is deliberately not tuned to
 * "what looks the same": a floor chosen by eye is a floor that quietly swallows
 * the low end of a real expression, and the point of this number is only to
 * drop weights that could not be drawn at all.
 */
export const MORPH_FLOOR = 1 / 255;

/**
 * The weights to send this frame, given what was sent last.
 *
 * Returns a NEW array only when something changed; when nothing did it returns
 * `previous` itself, so a caller can use identity to skip a render entirely —
 * which is what a still face costs here: nothing.
 */
export function natalieMorphs(
  shape: NatalieShape,
  previous: readonly NatalieMorph[],
): readonly NatalieMorph[] {
  const next: NatalieMorph[] = [];
  const sent = new Set<string>();

  for (const [target, raw] of Object.entries(shape)) {
    if (!Number.isFinite(raw)) continue;
    const weight = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    if (weight < MORPH_FLOOR) continue;
    next.push({ target, weight });
    sent.add(target);
  }

  /* The shapes that were up and are not any more, released once each. */
  for (const entry of previous) {
    if (entry.weight === 0 || sent.has(entry.target)) continue;
    next.push({ target: entry.target, weight: 0 });
  }

  return sameWeights(previous, next) ? previous : next;
}

/** Order-independent, because the caller's order is the object's key order. */
function sameWeights(a: readonly NatalieMorph[], b: readonly NatalieMorph[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Map(a.map((entry) => [entry.target, entry.weight]));
  for (const entry of b) {
    if (seen.get(entry.target) !== entry.weight) return false;
  }
  return true;
}
