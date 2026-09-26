// Shared panel-local geometry for the Rive-framed board — ONE contentRect that
// drives the Viro quad, the input plane, the texture placement and the Rive
// window, because a second copy of any of those numbers is a seam a child can
// fall through with a stylus.
//
// Two spaces, one source of truth:
//
//   - ARTBOARD units (0..1024 x 0..780) — what probes/rive-panel/rive/scene.rml
//     authors in. The RML is generated against these numbers; change them here
//     and the RML is stale.
//   - PANEL-LOCAL METERS — the carrier ViroNode's space; the Rive quad and the
//     board quad/input plane all hang off the same parent so a drag moves them
//     as one rigid body.
//
// The palette never overlaps the contentRect: `paletteOpen` swaps the toolbar
// band (TOOLS row ⇄ INKS row) in place inside the Rive artboard, so a swatch
// pop-over can never be geometrically occluded by the board input plane and
// there is nothing to arbitrate — the strip is either tools or inks, whole.
//
// SOT: this file is the contract for `BoardChrome` artboard authors AND for
// XrBoardChromePanel; the numbers exist here once.
// SOT-KEYWORDS: xr rive board chrome layout content rect toolbar palette artboard meters shared geometry

/** Artboard-space unit size of the BoardChrome artboard. */
export const CHROME_ARTBOARD = { width: 1024, height: 780 } as const;

/** Title band: Moyo brand text left, Ask Natalie... lives in the toolbar. */
export const TITLE_BAND = { x: 0, y: 0, w: 1024, h: 36 } as const;

/** Toolbar band — tools row or inks row, never both (paletteOpen swaps it). */
export const TOOLBAR_BAND = { x: 0, y: 36, w: 1024, h: 104 } as const;

/** The Quickdraw window — input plane and live texture cover exactly this. */
export const CONTENT_BAND = { x: 0, y: 140, w: 1024, h: 640 } as const;

/** Tools-row hit rect per control id, in artboard units, left to right. */
export const TOOL_ROW = {
  pen: { x: 12, y: 44, w: 104, h: 88 },
  highlighter: { x: 128, y: 44, w: 104, h: 88 },
  eraser: { x: 244, y: 44, w: 104, h: 88 },
  inkWell: { x: 368, y: 44, w: 96, h: 88 },
  undo: { x: 484, y: 44, w: 104, h: 88 },
  redo: { x: 600, y: 44, w: 104, h: 88 },
  clear: { x: 724, y: 44, w: 104, h: 88 },
  askNatalie: { x: 848, y: 44, w: 164, h: 88 },
} as const;

/** Inks-row (paletteOpen=true): 7 swatches + a close key, same band. */
export const INK_ROW = {
  swatchPitch: 124, // x = 12 + i * 124
  swatch: { y: 44, w: 104, h: 88 },
  close: { x: 880, y: 44, w: 132, h: 88 },
} as const;

/** Panel width in meters — XR panels are meter-scaled; 1024u → this. */
export const PANEL_WIDTH_M = 1.2;
export const PANEL_HEIGHT_M = (CHROME_ARTBOARD.height / CHROME_ARTBOARD.width) * PANEL_WIDTH_M;

/** Meters per artboard unit. */
export const CHROME_SCALE = PANEL_WIDTH_M / CHROME_ARTBOARD.width;

export type ArtboardRect = { x: number; y: number; w: number; h: number };
export type PanelRect = { x: number; y: number; width: number; height: number };

/**
 * Artboard rect → panel-local metres. Rive artboard y grows DOWN; the carrier
 * node y grows UP with the panel centre at the origin — so y flips here and
 * nowhere else.
 */
export const artboardToPanel = (r: ArtboardRect): PanelRect => ({
  x: r.x * CHROME_SCALE - PANEL_WIDTH_M / 2,
  y: PANEL_HEIGHT_M / 2 - (r.y + r.h) * CHROME_SCALE,
  width: r.w * CHROME_SCALE,
  height: r.h * CHROME_SCALE,
});

/** Panel-local centre of an artboard rect. */
export const artboardCenter = (r: ArtboardRect): [number, number, number] => {
  const p = artboardToPanel(r);
  return [p.x + p.width / 2, p.y + p.height / 2, 0];
};

/** The board's live quad + input plane live here, in carrier-local metres. */
export const CONTENT_RECT_PANEL = artboardToPanel(CONTENT_BAND);

/**
 * The content rect's centre in WORLD space: carrier ∘ slot ∘ rectCentre.
 *
 * The carrier is the dragged node — its pose changes on release, which is the
 * same moment a persisted offset lands in the store and the anchor recomputes.
 * Yaw composes additively because the only rotations this composition ever
 * carries are about Y — the same contract `xrSurfaceLocal` states in
 * surface-drag.ts, not a new one.
 */
export function contentAnchorWorld(
  slot: { position: readonly [number, number, number]; yaw: number },
  carrier: { position: readonly [number, number, number]; yawDeg: number },
  rect: ArtboardRect = CONTENT_BAND,
): { position: [number, number, number]; yawDeg: number } {
  const slotWorld = {
    position: add3(carrier.position, rotateY([slot.position[0], slot.position[1], slot.position[2]], carrier.yawDeg)),
    yawDeg: carrier.yawDeg + slot.yaw,
  };
  const local = artboardCenter(rect);
  const rotated = rotateY(local, slotWorld.yawDeg);
  return { position: add3(slotWorld.position, rotated), yawDeg: slotWorld.yawDeg };
}

const add3 = (a: readonly number[], b: readonly number[]): [number, number, number] =>
  [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];

/* `xrRotateY` duplicated as a local helper rather than imported: this file is
   read by BOTH platform barrels (pure data for web previews) and world-slot.ts
   is clean of viro too — but the dependency direction stays layout → nothing.
   The formula is the same forward rotation surface-drag.ts states. */
function rotateY(v: readonly [number, number, number], yawDeg: number): [number, number, number] {
  const t = (yawDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return [v[0] * cos + v[2] * sin, v[1], -v[0] * sin + v[2] * cos];
}
