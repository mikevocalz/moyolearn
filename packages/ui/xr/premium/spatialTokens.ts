// Spatial design tokens — meters, head-relative frame (user head = origin,
// forward = -Z). From the ViroReact spatial-layout-system. Never inline magic
// numbers; derive from these with a comment.

export const spatialSpacing = {
  xs: 0.025, // inline separation (icon ↔ label)
  sm: 0.05, // related controls (button row gap)
  md: 0.1, // groups (card ↔ card)
  lg: 0.2, // sections (header ↔ body)
  xl: 0.35, // major regions (panel ↔ panel)
} as const;

export const panelSize = {
  compactCard: { width: 0.45, height: 0.28 },
  standardCard: { width: 0.7, height: 0.42 },
  widePanel: { width: 1.7, height: 0.9 },
  theaterPanel: { width: 2.4, height: 1.35 }, // 16:9
} as const;

export const distance = {
  nearInteraction: { min: 0.45, max: 0.8 },
  comfortableUI: { min: 1.25, max: 2.0 },
  cinematic: { min: 2.5, max: 4.0 },
  environmentScale: { min: 5.0, max: 50.0 },
} as const;

export const typeScale = {
  caption: { min: 0.025, max: 0.035 },
  body: { min: 0.04, max: 0.055 },
  title: { min: 0.07, max: 0.11 },
  hero: { min: 0.14, max: 0.28 },
} as const;

export const materialToken = {
  softCard: 'softCard',
  glassPanel: 'glassPanel',
  holographicPanel: 'holographicPanel',
  solidPanel: 'solidPanel',
  backplateTextWash: 'backplateTextWash',
  focusRing: 'focusRing',
  disabledSurface: 'disabledSurface',
  dangerSurface: 'dangerSurface',
  successSurface: 'successSurface',
  pressedFlash: 'pressedFlash',
} as const;

// Scene-composition ZONES — head-relative snap slots on a COMFORT ARC.
//
// v2 (2026-07-30): the old side slots sat at z=-1.15 m — closer than the centre
// panel (-1.5) and INSIDE distance.comfortableUI.min (1.25), so panels crowded
// the user ("way too close") and the arc bent the wrong way (sides nearer than
// centre). Now all three sit on ONE cylinder of radius ARC_RADIUS around the
// head, so nothing is nearer than the comfortable reading band:
//
//     x =  R·sin(azimuth)      z = -R·cos(azimuth)      yaw = azimuth (faces you)
//
// left  → -AZ  (panel),  centre → 0,  right → +AZ  (model). Azimuth is the
// off-centre turn; yaw rotates each panel back to face the head (its own -Z
// points at the origin). A hair of toe-in (TOE) over the exact facing angle
// makes the side panels wrap the user instead of reading flat/edge-on.
export type PanelSlot = 'left' | 'center' | 'right';

export const SLOT_ORDER: PanelSlot[] = ['left', 'center', 'right'];

// Far end of distance.comfortableUI (1.25–2.0 m): pushed out because the prior
// layout read too close. One knob — raise to move the whole arc away.
const ARC_RADIUS = 1.9;
const AZIMUTH_DEG = 30; // MODEL (right) turn from dead-ahead
// Panel (left) sits FURTHER out than the model: the wide reading panel would
// otherwise crowd the centre buttons. Bigger azimuth = more to the left + more
// slant, opening a clear gap for the middle zone. Spacing knob — raise to push
// the panel further left, lower to bring it in.
const PANEL_AZIMUTH_DEG = 44;
const TOE_DEG = 3; // extra inward face so sides wrap, not slab sideways
const SLOT_Y = -0.1; // just below eye level

const rad = (d: number) => (d * Math.PI) / 180;
const onArc = (
  azimuthDeg: number,
): { position: [number, number, number]; yaw: number } => ({
  position: [
    ARC_RADIUS * Math.sin(rad(azimuthDeg)),
    SLOT_Y,
    -ARC_RADIUS * Math.cos(rad(azimuthDeg)),
  ],
  // Face the head: -Z→origin needs yaw = -azimuth; add toe-in toward centre.
  yaw: -azimuthDeg - Math.sign(azimuthDeg) * TOE_DEG,
});

export const SLOTS: Record<
  PanelSlot,
  { position: [number, number, number]; yaw: number }
> = {
  left: onArc(-PANEL_AZIMUTH_DEG),
  center: onArc(0),
  right: onArc(AZIMUTH_DEG),
};
