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
// SOT-KEYWORDS: spatial tokens metres xr whiteboard rail comfort distance type scale hit target band

import { targets } from '@acme/theme';

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
  /**
   * Where the board itself hangs, and the distance every static token below is
   * sized at. Mid `comfortableUI`. A static metre token is only ever correct at
   * one distance, so the distance it was correct at is named rather than left
   * in a comment beside the number.
   */
  board: 1.5,
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
 * A `ViroText` point size, from the glyph height the type token asks for.
 *
 * THE MAPPING IS THE RENDERER'S OWN CONSTANT, not a guess:
 * `static const float kTextPointToWorldScale = 0.01` in
 * `node_modules/@reactvision/react-viro/ios/dist/ViroRenderer/ViroKit.framework/Headers/VROText.h`.
 * The vendor's own sweep scene agrees — `fontSize: 24` at `scale 0.5` sits on
 * rows 0.25 m apart in `examples/visionos-sweep/ViroVisionOSSweep.tsx`, which
 * only reads as type rather than as overlap at 0.12 m a line.
 *
 * This exists because the alternative is what was here: every `ViroText` in the
 * feature picking its own point size (20 / 18 / 16 / 15 / 14 / 13 / 22 / 24),
 * none of which had been converted to metres, and several of which asked for
 * glyphs taller than the panel they were drawn in — `XrQuestionLine` set 20 pt,
 * which is 0.2 m, inside a 0.06 m bar.
 */
const TEXT_POINT_M = 0.01;

/**
 * The point size for each type step — the middle of the token's range, rounded,
 * because iOS truncates the size to an `int` (`VRTText.mm`).
 */
export const spatialFontSize = {
  caption: Math.round((spatialType.caption.min + spatialType.caption.max) / 2 / TEXT_POINT_M),
  body: Math.round((spatialType.body.min + spatialType.body.max) / 2 / TEXT_POINT_M),
  title: Math.round((spatialType.title.min + spatialType.title.max) / 2 / TEXT_POINT_M),
} as const satisfies Record<keyof typeof spatialType, number>;

/** What `spatialFontSize` actually occupies, for anything that must box it. */
export const spatialTextHeight = {
  caption: spatialFontSize.caption * TEXT_POINT_M,
  body: spatialFontSize.body * TEXT_POINT_M,
  title: spatialFontSize.title * TEXT_POINT_M,
} as const satisfies Record<keyof typeof spatialType, number>;

/**
 * The age bands, named exactly as `features/capture/age-band.ts` names them.
 *
 * Declared here rather than imported because `packages/ui` sits under
 * `packages/app` and must not reach up into a feature for a type. The four
 * names are the four `targets` keys in `packages/theme/tokens.ts`, which is the
 * shared source both sides already agree on.
 */
export type SpatialBand = 'young' | 'child' | 'teen' | 'adult';

/** `'72px'` → `72`. The token is a CSS length; the ratio between two is not. */
const targetPx = (token: string): number => Number.parseFloat(token);

/**
 * The smallest thing that can be pointed at, as an angle rather than a size.
 *
 * 4° is the floor the layout system sets, which at the board's working distance
 * is about 0.105 m. Hands get a quarter more than rays do, because a pinch is
 * aimed with a whole arm and lands with more spread than a controller's ray.
 *
 * THE BAND IS THE THIRD TERM AND IT IS NOT OPTIONAL. This is the spatial
 * counterpart of `targets` in `packages/theme/tokens.ts` and it is used the same
 * way: the age band picks the multiplier, nothing hardcodes a size. It was
 * missing, so a K–2 learner got an adult's spatial target while the same child
 * on glass got 72 dp — the one place in the product where the band silently did
 * not arrive. `bandMultiplier` is read off those same `targets` rather than
 * invented here, as each band's ratio to the smallest one, so the two scales
 * cannot drift apart.
 */
export const spatialTarget = {
  minAngleDeg: 4,
  handMultiplier: 1.25,
  bandMultiplier: {
    young: targetPx(targets.young) / targetPx(targets.adult),
    child: targetPx(targets.child) / targetPx(targets.adult),
    teen: targetPx(targets.teen) / targetPx(targets.adult),
    adult: 1,
  } as const satisfies Record<SpatialBand, number>,
} as const;

/**
 * The smallest edge, in metres, that is `minAngleDeg` across at `distance`.
 *
 * Exported rather than inlined because both the rail and the chat panel's
 * action row size their keys from it, and a second copy of the trigonometry is
 * a second answer.
 *
 * It is a FLOOR, and a caller that takes `Math.min` of it and something else has
 * not enforced it — it has replaced it. That is what `XrRail` did with the rail's
 * own width, which is how every control in the feature ended up under 4°.
 */
export function minHitSize(distanceM: number, hands: boolean, band: SpatialBand): number {
  const radians = (spatialTarget.minAngleDeg * Math.PI) / 180;
  const size = 2 * distanceM * Math.tan(radians / 2);
  const reach = hands ? spatialTarget.handMultiplier : 1;
  return size * reach * spatialTarget.bandMultiplier[band];
}

/**
 * The rail width that can actually hold a floor-sized key, in metres.
 *
 * A key is laid out INSIDE the rail's flex box, so the rail has to carry the
 * key plus its own padding on both sides. The two numbers were separate — a
 * `railWidth` token picked by eye and a key clamped to it — and the clamp is
 * what silently shrank the key. One function now answers both: the token below
 * is this function at the design case, and `board-layout` takes this function's
 * answer as the floor it checks the allocated rail against.
 */
export function railWidthFor(distanceM: number, hands: boolean, band: SpatialBand): number {
  return minHitSize(distanceM, hands, band) + spatialSpacing.xs * 2;
}

/**
 * The case every static token below is sized for: a K–2 learner, controllers,
 * at the board's own distance.
 *
 * The BAND is the conservative end because this is a learner surface and the
 * 72 dp floor is the one the product already promises a six-year-old. The INPUT
 * is not: sizing the rail for hands as well would take the composition past the
 * comfort cone for every session, so a hands-primary child gets a rail that
 * genuinely cannot hold their key — and `layoutBoard` reports that rather than
 * shrinking the key to fit.
 */
const DESIGN_KEY_BOX = railWidthFor(spatialDistance.board, false, 'young');

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
  anchor: [0, -0.1, -spatialDistance.board] as const,
  boardWidth: 0.55,
  /**
   * Derived, never picked. It was 0.1 — 3.82° at the board's distance, under
   * the 4° floor before a band multiplier was even applied — and `XrRail` then
   * clamped its keys down to it.
   */
  railWidth: DESIGN_KEY_BOX,
  railGap: spatialSpacing.sm,
  chatWidth: 0.45,
  chatGap: spatialSpacing.md,
  /** How far the chat panel is turned back toward the child, in degrees. */
  chatYawDeg: -40,
  /**
   * Above the paper: the question, at two lines of body type plus padding.
   * Below it: recenter and leave, at one floor-sized key plus the same padding.
   *
   * Both were literals — 0.06 and 0.08 — written once here and again inside
   * `XrOrnaments`, and neither could hold what it was asked to draw: 0.06 m for
   * a 0.2 m glyph, 0.08 m for a key whose short edge has to clear 4°.
   */
  topOrnamentHeight: spatialTextHeight.body * 2 + spatialSpacing.xs * 2,
  bottomOrnamentHeight: DESIGN_KEY_BOX,
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
