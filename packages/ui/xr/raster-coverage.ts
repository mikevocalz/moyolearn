// Which records the live ink layer still owes a polyline, given a raster.
//
// The spatial paper draws the board twice on purpose: the engine's raster shows
// everything the document holds, and `XrBoardInk` draws the strokes the raster
// is too old to contain. Deciding which those are is one set difference, and it
// is here rather than in either renderer because it is the only part of the
// arrangement that can be wrong in a way a test can catch.
//
// THE ANSWER IS AN IDENTITY WHEN THERE IS NOTHING TO REMOVE. A new object every
// render would re-run `XrBoardInk`'s `useMemo` on every frame of a drag, which
// walks the whole document. So a store with nothing covered comes back as
// itself, not as a copy of itself.
// SOT: packages/ui/xr/XrBoardRaster.native.tsx · packages/ui/xr/XrBoardInk.native.tsx
// SOT-KEYWORDS: xr raster coverage set difference live ink records uncovered identity

/**
 * The records to draw live, i.e. those the raster does not already show.
 *
 * `covered` is the set of record ids that EXISTED WHEN THE RASTER WAS ASKED FOR
 * — not when it arrived. The engine may have drawn a mark or two more into the
 * picture in between, and those are then drawn twice; that overlap is chosen
 * over the alternative, which is a mark in neither layer. See the seam note on
 * `XrBoardRaster`.
 *
 * `null` means no raster is on the paper yet, and every record is owed a
 * polyline — the behaviour the board had before it was textured at all.
 */
export function uncoveredRecords(
  store: Readonly<Record<string, unknown>>,
  covered: ReadonlySet<string> | null,
): Readonly<Record<string, unknown>> {
  if (covered === null || covered.size === 0) return store;
  const rest: Record<string, unknown> = {};
  let removed = 0;
  for (const [id, record] of Object.entries(store)) {
    if (covered.has(id)) removed += 1;
    else rest[id] = record;
  }
  return removed === 0 ? store : rest;
}
