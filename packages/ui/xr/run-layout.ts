// Where a run of things sits inside a box, when nothing measures it for you.
//
// THE FLEX BOX IS GONE, SO THE ARITHMETIC IS HERE. The spatial panels used to
// be `ViroFlexView`s and Yoga placed their children; they are stacked quads
// now, positioned in metres, which is the composition the Danger Room
// conference scene proved on headset hardware. That trade is deliberate — a
// quad carries its own transform and a nested flex view does not — and its one
// cost is that "the second key, below the first" becomes a number somebody has
// to get right.
//
// It is one function rather than a line in each of the four panels, and it is
// in a file with no renderer so the numbers can be asserted without a headset.
// Yoga's silent failure is the reason: `flexShrink` defaults to 0, so a column
// that overflowed its box simply drew its last children OUTSIDE the slab, which
// is how the rail shipped with Undo and Clear floating off the panel. `extentOf`
// is what lets a caller — and `run-layout.test.ts` — ask first.
//
// THE SIGN LIVES AT THE CALL SITE. Offsets come back as a distance from the
// box's START edge, never as a coordinate, because which way a run grows is a
// fact about the axis and not about the run: a column starts at the top and
// grows toward -Y, a row starts at the left and grows toward +X. A caller
// writes `boxHeight / 2 - offset` or `-boxWidth / 2 + offset` and the direction
// is visible in the line that depends on it.
// SOT: packages/ui/xr/XrPlate.native.tsx · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr run layout column row offsets stack metres no viro flex replacement

/** Where a run sits in a box that is longer than it is. */
export type RunJustify = 'start' | 'center';

/** What a run of `sizes` separated by `gap` occupies along its axis. */
export function extentOf(sizes: readonly number[], gap: number): number {
  if (sizes.length === 0) return 0;
  let total = gap * (sizes.length - 1);
  for (const size of sizes) total += size;
  return total;
}

/**
 * The distance from the box's start edge to each item's CENTRE, in order.
 *
 * A run longer than its box is not clamped and not an error here — it returns
 * offsets that reach past the far edge, which is exactly what the caller needs
 * to see. Clamping would reproduce the flex behaviour this file exists to
 * replace: content quietly drawn where it does not belong.
 */
export function runOffsets(
  sizes: readonly number[],
  extent: number,
  gap: number,
  justify: RunJustify,
): number[] {
  let cursor = justify === 'center' ? (extent - extentOf(sizes, gap)) / 2 : 0;
  const centres: number[] = [];
  for (const size of sizes) {
    centres.push(cursor + size / 2);
    cursor += size + gap;
  }
  return centres;
}
