// The spatial scale, in metres — the same job `packages/theme/tokens.ts` does
// for the 2D app, for the one surface where a pixel means nothing.
//
// WHY THE UNIT CHANGES AND THE DISCIPLINE DOES NOT. A dp is a promise about a
// screen a child is holding; in a headset there is no screen, so every size is
// an angle and every angle depends on how far away the thing is. A rail button
// specified in dp is a rail button that is correct at one distance and
// unpressable at every other. So these are metres, and the distances they are
// legible at are part of the token rather than a note beside it.
//
// The values come from the ViroReact spatial layout system's token set
// (`spatialSpacing`, `panelSize`, `distance`, `typeScale`) rather than being
// picked here. What IS picked here is the board's own geometry, because 5:7
// portrait paper is not in anyone's design system — it is the shape of the
// homework this app exists for.
// SOT: packages/ui/xr/board-layout.ts · packages/theme/tokens.ts
// SOT-KEYWORDS: spatial tokens metres xr whiteboard rail comfort distance type scale hit target

/** Separation between things. The 2D `gap-*` tiers, in metres. */
export const spatialSpacing = {
  xs: 0.025,
  sm: 0.05,
  md: 0.1,
  lg: 0.2,
  xl: 0.35,
} as const;

/**
 * Where content lives relative to the head, which is `[0,0,0]` facing `-Z`.
 *
 * Nothing goes inside `nearInteraction.min`: a panel closer than that is inside
 * the space a child moves their hands through, and it makes them lean back from
 * their own homework.
 */
export const spatialDistance = {
  nearInteraction: { min: 0.45, max: 0.8 },
  comfortableUI: { min: 1.25, max: 2.0 },
} as const;

/**
 * Rendered glyph height. `body` is the floor for anything a child has to READ —
 * a hint, a tutor's sentence — as opposed to glance at.
 */
export const spatialType = {
  caption: { min: 0.025, max: 0.035 },
  body: { min: 0.04, max: 0.055 },
  title: { min: 0.07, max: 0.11 },
} as const;

/**
 * The smallest thing that can be pointed at, as an angle rather than a size.
 *
 * 4° is the floor the layout system sets, which at the board's working distance
 * is about 0.105 m. Hands get a quarter more than rays do, because a pinch is
 * aimed with a whole arm and lands with more spread than a controller's ray.
 *
 * This is the spatial counterpart of `targets` in `packages/theme/tokens.ts`,
 * and it is used the same way: the age band picks the multiplier, nothing
 * hardcodes a size.
 */
export const spatialTarget = {
  minAngleDeg: 4,
  handMultiplier: 1.25,
} as const;

/**
 * The smallest edge, in metres, that is `minAngleDeg` across at `distance`.
 *
 * Exported rather than inlined because both the rail and the chat panel's
 * action row size their keys from it, and a second copy of the trigonometry is
 * a second answer.
 */
export function minHitSize(distanceM: number, hands: boolean): number {
  const radians = (spatialTarget.minAngleDeg * Math.PI) / 180;
  const size = 2 * distanceM * Math.tan(radians / 2);
  return hands ? size * spatialTarget.handMultiplier : size;
}

/**
 * The whiteboard composition, in metres.
 *
 * `boardWidth` 0.55 at 1.5 m spans roughly 21° × 29° with the rail and the chat
 * beside it — inside the ±30° comfort cone in both axes, which is the whole
 * reason it is not simply as large as the room allows. A board that fills the
 * view is a board a child has to turn their head to read the bottom of, for an
 * hour, while doing arithmetic.
 */
export const boardComposition = {
  /** Board + rail + chat sit on this anchor, dropped below the eye line. */
  anchor: [0, -0.1, -1.5] as const,
  boardWidth: 0.55,
  railWidth: 0.1,
  railGap: spatialSpacing.sm,
  chatWidth: 0.45,
  chatGap: spatialSpacing.md,
  /** How far the chat panel is turned back toward the child, in degrees. */
  chatYawDeg: -40,
  /** Above the paper: the question. Below it: move, recenter, fit, exit. */
  topOrnamentHeight: 0.06,
  bottomOrnamentHeight: 0.08,
  ornamentGap: spatialSpacing.sm,
} as const;

/**
 * The pixel size of the board's own client space.
 *
 * It is a resolution, not a layout: the engine draws at this size and the
 * result is mapped onto the 5:7 surface, so it decides whether a fraction bar
 * reads at 1.5 m and nothing else. 5:7 exactly, so the mapping is a scale and
 * never a stretch — an anisotropic fit would make a child's handwriting lean.
 */
export const boardSurfacePixels = { width: 1400, height: 1960 } as const;
