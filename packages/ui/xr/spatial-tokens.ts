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
// picked here. What IS picked here is the board's own geometry, because 16:8
// landscape paper is not in anyone's design system — it is the shape of the
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

/**
 * The factor a label's node is scaled down by, and the reason it exists.
 *
 * A `ViroText`'s point size is POINT-LIKE: the renderer rasterises glyphs at
 * that size and then maps them onto the world through `kTextPointToWorldScale`.
 * Asking for the metre height directly — which is what `spatialFontSize` is —
 * therefore asks for a 3, 5 or 9 pt face, and a 3 pt face is a handful of
 * texels per glyph however close a child leans in.
 *
 * So a label is laid out in a box `1 / spatialLabelScale` times too large, at
 * `1 / spatialLabelScale` times the point size, and the NODE is scaled back
 * down. The rendered glyph height is identical — `spatialTextHeight` below is
 * still what a step occupies — and the raster is four times finer.
 *
 * 0.25 is the Danger Room conference scene's own factor, which is the only
 * version of this idiom proven on headset hardware in this codebase.
 */
export const spatialLabelScale = 0.25;

/**
 * The point size a label is actually laid out at, before its node is scaled.
 *
 * Whole numbers at every step, which is not luck: `spatialLabelScale` is a
 * reciprocal power of two, so dividing an integer point size by it cannot
 * produce a fraction for iOS's `int` truncation to lose.
 */
export const spatialLabelFontSize = {
  caption: spatialFontSize.caption / spatialLabelScale,
  body: spatialFontSize.body / spatialLabelScale,
  title: spatialFontSize.title / spatialLabelScale,
} as const satisfies Record<keyof typeof spatialType, number>;

/** The three type steps, named once so a label can take one as a prop. */
export type SpatialTypeStep = keyof typeof spatialType;

/**
 * How far one layer of a plate stands off the one behind it, in metres.
 *
 * A plate is stacked quads, not a flex box, so "in front of" is a Z offset and
 * nothing else decides it. Both steps are the Danger Room conference scene's,
 * which is the composition proven to draw on headset hardware: an inset face at
 * 0.004 over its frame, and content at 0.012 over that. They are far enough
 * apart that no two quads z-fight at the board's distance and close enough that
 * the stack still reads as one object.
 *
 * Nested plates compose these rather than needing deeper steps — a chip inside
 * a key sits on the key's own content layer and carries its two from there.
 */
export const spatialLayer = { surface: 0.004, content: 0.012 } as const;

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
 * How the rail's controls are arranged, and the one number that decides it.
 *
 * A KEY'S HEIGHT IS THE BINDING CONSTRAINT AND THE RAIL IS AS TALL AS THE
 * PAPER. At the `young` band a floor-sized key is 0.17143 m and the rail's
 * content box is 0.72 m, so a single column holds FOUR controls and no
 * argument about layout can produce a fifth. The rail declares eight — the
 * three pens, the ink well, undo, redo, ask and clear — which is why its
 * content measured 1.4714 m in a 0.72 m box, 2.0× closed and 3.7× with the ink
 * picker stacked below it (`05-handoff.md` §2.6, `07-critique.md` §5). Yoga's
 * default `flexShrink` is 0, so Undo and Clear were simply drawn outside the
 * slab — which is what makes Clear unsafe, because its whole defence is that
 * Undo is on the rail directly above it.
 *
 * Two columns of four is the arrangement that fits, and it is the only one: a
 * third column is 0.61 m of slab beside a 0.55 m board, and paginating hides
 * Undo while a child is picking a colour. `rows` counts the tallest column, not
 * the keys — one xs separator sits above Clear and is counted by
 * `railContentHeight`.
 */
export const railGrid = { columns: 2, rows: 4, separators: 1 } as const;

/**
 * The rail width that can actually hold `columns` floor-sized keys, in metres.
 *
 * A key is laid out INSIDE the rail's flex box, so the rail has to carry its
 * keys plus one `xs` of padding at each edge and between each pair. The two
 * numbers were separate — a `railWidth` token picked by eye and a key clamped
 * to it — and the clamp is what silently shrank the key. One function now
 * answers both: the token below is this function at the design case, and
 * `board-layout` takes this function's answer as the floor it checks the
 * allocated rail against.
 *
 * `columns` defaults to the grid the rail actually draws, so a caller that
 * wants "the narrowest rail that can hold a reachable key" gets the answer for
 * the rail that exists rather than for a one-column rail nobody renders. Pass
 * `1` for anything that boxes a single key — the placement row does.
 */
export function railWidthFor(
  distanceM: number,
  hands: boolean,
  band: SpatialBand,
  columns: number = railGrid.columns,
): number {
  return minHitSize(distanceM, hands, band) * columns + spatialSpacing.xs * (columns + 1);
}

/**
 * What the rail's tallest column comes to, in metres, excluding its padding.
 *
 * Exported so the fit is a red test rather than a paragraph: a ninth key or a
 * wider separator has to move this past the box the rail is given, and
 * `spatial-tokens.test.ts` measures it against the paper's own height. The
 * separator above Clear is `xs` because `xs` is the largest tier that fits —
 * four keys leave 0.0344 m of the 0.72 m box, and `sm` needs 0.05.
 */
export function railContentHeight(distanceM: number, hands: boolean, band: SpatialBand): number {
  return (
    minHitSize(distanceM, hands, band) * railGrid.rows + spatialSpacing.xs * railGrid.separators
  );
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
const DESIGN_KEY_BOX = railWidthFor(spatialDistance.board, false, 'young', 1);

/**
 * The whiteboard composition, in metres.
 *
 * `boardWidth` 0.6 at 1.5 m spans 22.6° × 11.4° — inside the ±30° comfort cone
 * in both axes, which is the whole reason it is not simply as large as the room
 * allows. A board that fills the view is a board a child has to turn their head
 * to read the bottom of, for an hour, while doing arithmetic.
 *
 * THE WIDTH IS WHAT THE COMPOSITION HAS LEFT, not a round number. The rail sits
 * at `-(w/2 + railGap + railWidth)` and Natalie at `+(w/2 + chatGap + chatWidth)`,
 * so a 0.6 m board puts the rail's outer edge 27.1° off centre and hers 29.5° —
 * both inside the cone, and 0.65 would put her outside it.
 */
export const boardComposition = {
  /**
   * How far below the child's eye line the anchor sits, in metres.
   *
   * IT IS A DROP AND NO LONGER A POSITION. `anchor` was
   * `[0, -0.1, -spatialDistance.board]`, which reads as "in front of the child,
   * a little below their eyes" and is only that if the scene's origin is their
   * head. A PICO's runtime references the origin to the FLOOR, so those numbers
   * put the whole composition 10 cm off the ground — measured on device: the
   * board, the rail and Natalie were at the child's feet.
   *
   * `placeInFrontOf` builds the placement from the head pose the renderer
   * reports instead, and this is the only part of it that was ever a design
   * decision. See `board-placement.ts` for why a constant eye height would have
   * been a second bug rather than a fix.
   */
  anchorDrop: 0.1,
  /**
   * A standing child's eye height above the floor, in metres.
   *
   * THE ONE NUMBER THAT MAKES A FLOOR-REFERENCED RUNTIME SAFE BEFORE A HEAD
   * POSE ARRIVES. On a PICO the world origin is the FLOOR, so a board authored
   * at y = -anchorDrop sits BELOW the ground until the camera reports where the
   * head actually is. This is the height the board opens at in the meantime —
   * a K–2 child's standing eye level, deliberately low so a taller user finds
   * the board a touch below their eyes rather than a shorter one craning up.
   * The head pose replaces it the instant one settles; this is only the floor
   * this composition can never fall through.
   */
  standingEyeHeight: 1.3,
  boardWidth: 0.6,
  /**
   * Derived, never picked. It was 0.1 — 3.82° at the board's distance, under
   * the 4° floor before a band multiplier was even applied — and `XrRail` then
   * clamped its keys down to it.
   *
   * Two columns now (`railGrid`), which is what makes the rail's eight controls
   * fit its own height. It widens the slab from 0.22143 m to 0.41786 m — 15.9°
   * at the board's distance, putting the rail's outer edge 26.3° off centre:
   * inside the ±30° cone, and nearer it than the chat panel already sits on the
   * other side. The paper does not move: `layoutBoard` takes the rail out of the
   * width budget before it sizes the board, and the rail is placed by its own
   * extent, so the extra width goes AWAY from the paper and never across
   * `railGap`.
   */
  railWidth: railWidthFor(spatialDistance.board, false, 'young'),
  railGap: spatialSpacing.sm,
  chatWidth: 0.45,
  chatGap: spatialSpacing.md,
  /** How far the chat panel is turned back toward the child, in degrees. */
  chatYawDeg: -40,
  /**
   * The control rail's toe-in and forward lift — its place on the arc.
   *
   * The MIRROR of `chatYawDeg`: the chat sits on the right wing turned -40°
   * toward the child, the rail on the left wing turned +40° toward the child,
   * so the two flank the paper as equal toed-in surfaces instead of the rail
   * lying flat in the board's plane. `railLift` pulls it the same distance off
   * that plane the companion uses, so no two user-facing surfaces are coplanar.
   */
  railYawDeg: 40,
  railLift: spatialSpacing.md * 2,
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
 * result is mapped onto the 16:8 surface, so it decides whether a fraction bar
 * reads at 1.5 m and nothing else. 16:8 exactly, so the mapping is a scale and
 * never a stretch — an anisotropic fit would make a child's handwriting lean.
 *
 * IT IS ALSO THE PAGE'S CSS SIZE, which is what makes it the one number to
 * change if the live board costs too much per frame: `board-texture` sizes the
 * texture at this × the display density and draws it through a software canvas,
 * the pointer injection scales rays by it, and the polyline fallback maps page
 * coordinates through it. All three move together because all three read this.
 */
export const boardSurfacePixels = { width: 1920, height: 960 } as const;

/**
 * The paper's own stack, in metres, from the surface outwards.
 *
 * Three things share the paper's plane and the order between them is the whole
 * behaviour: the ENGINE'S RASTER is the board itself — every mark the engine
 * can draw, including the text, notes, arrows and images this renderer has no
 * primitive for — so it sits on the paper and covers it. LIVE INK is the
 * polylines for strokes the raster has not caught up with yet, a hair in front
 * so a stroke under the child's hand is never hidden by the picture behind it.
 * The pointer quad (`XrPanel`'s `POINTER_STANDOFF`, 0.002) stands in front of
 * both, so a ray meets the surface that answers it first.
 *
 * The steps are small deliberately — a tenth of `spatialLayer.surface` — because
 * these are coplanar-by-intent layers of ONE sheet, not the stacked quads of a
 * plate. They only have to beat Z-fighting at the board's working distance.
 */
export const boardLayer = { raster: 0.0005, ink: 0.001 } as const;
