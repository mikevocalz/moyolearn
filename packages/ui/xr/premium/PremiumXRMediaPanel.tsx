// PremiumXRMediaPanel.tsx — v7
// ---------------------------------------------------------------------------
// Spatial Layout System — component #11
//
// Mobbin indexes no XR apps, so every reference below is a 2D mobile media
// player. They are cited for the transport / scrubber / metadata-readout
// structure this panel carries over from 2D media players, and for nothing
// else — no style crossed over, per docs 02/08.
// Mobbin: https://mobbin.com/screens/7fec70c2-d269-4ae4-951b-5dd5fa127b98 (the whole vertical order: header bar with a dismiss at one end and one action at the other, media plate full-bleed directly beneath it, then title, then scrubber, then the control row) ·
//         https://mobbin.com/screens/6cb0a8f6-977e-4b9a-b137-04bc8f4b9d24 (metadata readout block sits immediately above the scrubber, position markers at the track's two ends, primary control centred with equal-weight slots flanking it) ·
//         https://mobbin.com/screens/b99fa29d-edb0-4ecc-ae7a-22ea84fa66ae (an unavailable control holds its slot dimmed instead of vanishing, so the control row never reflows as state changes) ·
//         https://mobbin.com/screens/2070ec46-5424-4a50-acf2-9f5f90d39b79 (rail runs the full length of one edge with a proportional thumb as the position marker and the total at its end, controls pushed to the edges so the plate stays unobstructed)
//
// v7 changes, all four from direct feedback. I still can't see your render —
// these are described as what the code DOES, not how it looks.
//
//   1. PLATE IS FULL-BLEED. The readout column floated inside a 0.05m card
//      inset plus its own 0.014m pad plus a 0.006m bevel ring — three stacked
//      margins, which is the padding you're seeing. The art column and the
//      data plate now run edge-to-edge: from directly under the header bar to
//      the card's bottom edge, and out to the card's left and right edges.
//      The only remaining inset is TEXT_INSET (0.028m) between the plate edge
//      and the type, because type touching a panel edge reads as broken.
//      Turn it down to taste — it is one token.
//
//   2. TITLE HAS A REAL TOP MARGIN. It sat high because the box was 2× the
//      glyph and vertical centring inside a loose box is unpredictable on this
//      fork. Two fixes: LINE_BOX drops from 2.0 to 1.25 so the box hugs the
//      line (safe now — textClipMode is "None" everywhere, so a tight box can
//      no longer drop a line), and the title is positioned from the BAR TOP
//      by an explicit token rather than centred and nudged:
//
//          titleY = barTop - TITLE_TOP_MARGIN - titleBoxH / 2
//
//      TITLE_TOP_MARGIN is the gap between the top of the red bar and the top
//      of the title's box, in meters. Raise it, the title drops. That's it.
//
//   3. SLOT TILT IS AN EXPLICIT TABLE. v6 derived yaw with atan2 from the slot
//      position, which is only correct if your SLOTS z-convention matches my
//      assumption — and I can't read that file. v7 uses the SIGN OF X only:
//      x < 0 → left slot → tilts toward you; x > 0 → right → mirrored;
//      x ≈ 0 → centre → 0°, flat on. Two knobs: TILT_DEG for how much, and
//      TILT_SIGN — if left and right come out swapped on device, set it to -1
//      and you're done. No other file involved.
//
//   4. READOUT IS WHITE WITH BLACK TEXT. Scrollbar palette untouched — dark
//      channel, dark page zones, yellow thumb, dark chips. On the white plate
//      the banding is black at 4% (not a rule — no horizontal lines, that's
//      what made it read as ruled paper) and emphasis rows are heavier black
//      with a dark accent tick in the margin.
//
// Still unread on my side: ./spatialTokens (SLOTS, panelSize, spatialSpacing)
// and ./ViroIcon. SLOTS especially — it drives placement, snapping, and the
// tilt table's x-sign lookup.
//
// Project note: poke-xr no-useState rule — all render-driving state lives in
// ONE per-instance vanilla store; refs stay refs.
// ---------------------------------------------------------------------------

import React, { useEffect, useMemo, useRef } from 'react';
import {
  ViroAnimations,
  ViroButton,
  ViroImage,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroText,
} from '@reactvision/react-viro';
import './materials';
import { XrRoundedQuad } from '../XrRoundedQuad.native.tsx';
import { XrKey } from '../XrPlate.native.tsx';
import { spatialCorners } from '../spatial-tokens.ts';
import { BOARD_ASPECT } from '../board-layout.ts';
import { inkMaterial } from '../spatial-materials.native.ts';
import type { WhiteboardInk } from '../../whiteboard.types.ts';
import { ViroIcon } from './ViroIcon';
import { type ButtonFaceId } from './button-faces/faces';
import { useInstanceStore, useStore } from './use-instance-store';
import { panelSize, spatialSpacing, SLOTS, type PanelSlot } from './spatialTokens';

type ViroAnimationDict = Parameters<typeof ViroAnimations.registerAnimations>[0];
type Vec3 = [number, number, number];

// ═══════════════════════════════════════════════════════════════════════════
// PALETTE + LOCAL MATERIALS
// ═══════════════════════════════════════════════════════════════════════════
export const PALETTE = {
  // Readout plate — white ground, black type.
  screen: '#FFFFFF',
  screenEdge: '#0B0D0B',
  band: '#000000', // alternating row banding, used at ~4% opacity
  ink: '#101210', // primary value type
  inkStrong: '#000000', // emphasis rows
  inkDim: '#636963', // labels
  mark: '#17150F', // emphasis accent tick (reads on white)

  // Scrollbar — unchanged from v6, per request.
  railChannel: '#242A26',
  railZone: '#2E352F',
  railZoneHot: '#3C453D',
  thumb: '#FFCB05',
  thumbHot: '#FFE066',
  chip: '#2A312C',
  chipHot: '#FFCB05',

  divider: '#3A423C',
  disabled: '#3A403B',
  debug: '#FF00AA',
} as const;

ViroMaterials.createMaterials({
  pxrmpScreen: { diffuseColor: PALETTE.screen, lightingModel: 'Constant' },
  pxrmpScreenEdge: { diffuseColor: PALETTE.screenEdge, lightingModel: 'Constant' },
  pxrmpBand: { diffuseColor: PALETTE.band, lightingModel: 'Constant' },
  pxrmpMark: { diffuseColor: PALETTE.mark, lightingModel: 'Constant' },
  pxrmpRailChannel: { diffuseColor: PALETTE.railChannel, lightingModel: 'Constant' },
  pxrmpRailZone: { diffuseColor: PALETTE.railZone, lightingModel: 'Constant' },
  pxrmpRailZoneHot: { diffuseColor: PALETTE.railZoneHot, lightingModel: 'Constant' },
  pxrmpThumb: { diffuseColor: PALETTE.thumb, lightingModel: 'Constant' },
  pxrmpThumbHot: { diffuseColor: PALETTE.thumbHot, lightingModel: 'Constant' },
  pxrmpChip: { diffuseColor: PALETTE.chip, lightingModel: 'Constant' },
  pxrmpChipHot: { diffuseColor: PALETTE.chipHot, lightingModel: 'Constant' },
  pxrmpDivider: { diffuseColor: PALETTE.divider, lightingModel: 'Constant' },
  pxrmpDisabled: { diffuseColor: PALETTE.disabled, lightingModel: 'Constant' },
  pxrmpDebug: { diffuseColor: PALETTE.debug, lightingModel: 'Constant' },
  // Invisible hit surface (repo standard: additive black + no depth write) —
  // renders NOTHING but still hit-tests. Fronts icon/text stacks: this fork
  // ignores ignoreEventHandling on ViroImage/ViroText, so an icon ON a chip
  // eats the chip's clicks (dead close ✕ / chevrons) unless a hit quad sits
  // in front of the whole stack.
  pxrmpHit: {
    diffuseColor: '#000000',
    lightingModel: 'Constant',
    blendMode: 'Add',
    writesToDepthBuffer: false,
  },
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
const TEXT_PT_PER_M = 150;
const pt = (glyphMeters: number) => Math.max(5, Math.round(glyphMeters * TEXT_PT_PER_M));

/** Tight now (was 2.0). Safe because textClipMode is "None" everywhere — the
 *  box is a POSITIONING frame, not a clipping frame, so a snug box can't drop
 *  a line. A snug box also makes vertical placement predictable. */
const LINE_BOX = 1.25;
const textBox = (glyphMeters: number) => glyphMeters * LINE_BOX;
const fitGlyph = (desiredGlyph: number, containerH: number) =>
  Math.min(desiredGlyph, containerH / LINE_BOX);

// ── Crisp text ─────────────────────────────────────────────────────────────
// ViroText rasterizes at `fontSize` pt into a texture; TEXT_PT_PER_M maps our
// world sizes to 5–11 pt, which upscales into mush at panel distance ("text
// barely visible / not crisp"). Render the texture CRISP× denser and counter-
// scale the node — identical world size, sharp glyphs.
// 3, not 4: 4× meant 16× the text-texture fill; under panel+model+passthrough
// load the compositor dropped the right eye's resolution (the "pixelated right
// eye"). 3× (9× texels) still renders crisp at panel distance.
const CRISP = 3;
function CrispText(props: React.ComponentProps<typeof ViroText>) {
  const { position, width, height, style, ...rest } = props;
  return (
    <ViroNode position={position} scale={[1 / CRISP, 1 / CRISP, 1 / CRISP]}>
      <ViroText
        {...rest}
        position={[0, 0, 0]}
        width={(typeof width === 'number' ? width : 1) * CRISP}
        height={(typeof height === 'number' ? height : 1) * CRISP}
        style={{ ...style, fontSize: (typeof style?.fontSize === 'number' ? style.fontSize : 12) * CRISP }}
      />
    </ViroNode>
  );
}

const AVG_ADVANCE = 0.58;
const clampText = (text: string, maxWidth: number, glyph: number) => {
  const max = Math.max(1, Math.floor(maxWidth / (glyph * AVG_ADVANCE)));
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 3))}...`;
};

const GLYPH = {
  title: 0.07,
  lead: 0.048,
  body: 0.04,
  label: 0.031,
} as const;

type FontWeight = '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
const FONT: { family?: string; weightBold?: FontWeight; weightRegular?: FontWeight } = {
  family: undefined,
  weightBold: '700',
  weightRegular: '400',
};

/* MoyoLearn ships no PokemonSolid; the app's own face is the default. This and
   TITLE_COLOR are the only two tokens changed from the poke-xr original. */
const TITLE_FONT: string | undefined = undefined;
const TITLE_COLOR = '#F6F3E8';
/** Gap between the TOP of the red bar and the TOP of the title box, in meters.
 *  This is the only control for title vertical placement. Raise → title drops. */
const TITLE_TOP_MARGIN = 0.072;

// ═══════════════════════════════════════════════════════════════════════════
// LAYOUT TOKENS (meters, head-relative)
// ═══════════════════════════════════════════════════════════════════════════
export const SIZES = {
  /* The two side sizes are added for MoyoLearn's three-panel arc: a wide
     centre needs narrower flanks or the composition leaves the comfort cone.
     Same token source as the originals (`panelSize`), so nothing is invented. */
  compactCard: panelSize.compactCard, // 0.45 × 0.28
  standardCard: panelSize.standardCard, // 0.70 × 0.42
  /* 9:16 portrait — the shape a tool list and a conversation actually want,
     and what the flanks of MoyoLearn's arc are. */
  portraitCard: { width: 0.62, height: 1.1 },
  toolsCard: { width: 0.9, height: 1.42 },
  /* The board: wide enough to write across, at the arc's radius. */
  boardPanel: { width: 0.9 + spatialCorners.panel * 2, height: 0.9 * BOARD_ASPECT.h / BOARD_ASPECT.w + 0.16 + spatialCorners.panel * 2 },
  widePanel: panelSize.widePanel, // 1.70 × 0.90
  theaterPanel: panelSize.theaterPanel, // 2.40 × 1.35
} as const;

const HAIR = spatialSpacing.xs; // 0.025

export const HEADER_H = 0.16;
const HEADER_PAD = 0.04; // left inset for the title, right inset for the chip
const CLOSE = 0.11;

/** The ONLY inset inside the readout plate. Everything else is full-bleed. */
const TEXT_INSET = 0.028;

const ROW_H = 0.072;
const ROW_GAP = 0.006;

const DEFAULT_RAIL_W = 0.075;
const DEFAULT_ARROW_H = 0.1;
const THUMB_MIN = 0.07;
const HAIRLINE = 0.004;

const Z = {
  ring: -0.002,
  backing: 0.0,
  plate: 0.004,
  header: 0.004,
  art: 0.004,
  band: 0.006,
  rule: 0.008,
  railChannel: 0.008,
  railZone: 0.01,
  headerInk: 0.012,
  rowInk: 0.014,
  chip: 0.012,
  railThumb: 0.014,
  debug: 0.002,
} as const;

/**
 * Where the media fills a panel, in the panel's own frame.
 *
 * THE SURFACE A CHILD DRAWS ON IS THIS RECTANGLE, and only this component knows
 * where it is — the header steals `HEADER_H` off the top, so the body's centre
 * is NOT the panel's centre. `XrBoardSurface` puts its pointer quad here rather
 * than recomputing it, because a pointer plane that disagrees with the art by
 * the header's half-height is ink that lands 8 cm above the child's aim.
 *
 * Only meaningful at `mediaFraction={1}` — the full-bleed board — which is the
 * one configuration anything draws on.
 */
export function panelMediaArea(size: keyof typeof SIZES): {
  width: number;
  height: number;
  /** Offset from the panel's centre, along its own +Y. */
  centerY: number;
  /** The art plane's depth along the panel's own +Z. */
  z: number;
} {
  const { width, height } = SIZES[size];
  const inset = size === 'boardPanel' ? spatialCorners.panel : 0;
  return { width: width - inset * 2, height: height - HEADER_H - inset * 2, centerY: -HEADER_H / 2, z: Z.art };
}


// ═══════════════════════════════════════════════════════════════════════════
// SLOT TILT — explicit, one knob to flip
// ═══════════════════════════════════════════════════════════════════════════
/** How far a side slot turns toward the user, in degrees. */
const TILT_DEG = 26;
/** If left and right come out swapped on device, set this to -1. Nothing else
 *  needs to change — the sign propagates to both sides and leaves centre flat. */
const TILT_SIGN = 1;
/** Slots within this distance of x=0 are treated as centre → 0°, flat on. */
const CENTRE_EPS = 0.02;

const slotYaw = (s: PanelSlot): number => {
  const x = (SLOTS[s].position as Vec3)[0];
  if (Math.abs(x) < CENTRE_EPS) return 0;
  return TILT_SIGN * (x < 0 ? TILT_DEG : -TILT_DEG);
};

// ═══════════════════════════════════════════════════════════════════════════
// MOTION
// ═══════════════════════════════════════════════════════════════════════════
const MOTION = {
  feedback: 140,
  feedbackOut: 200,
  swapOut: 110,
  swapIn: 240,
  rise: 300,
  settle: 150,
  exit: 240,
  reducedOut: 160,

  layerHeader: 40,
  layerArt: 110,
  layerRows: 170,
  rowStep: 45,
  railTail: 60,
  layerDur: 260,

  lift: 0.05,
  depth: 0.07,
  hoverLean: 0.012,
  rowSlide: 0.014,
  swapShift: 0.014, // content displacement during a scroll swap — must stay
  //                   under the top row's headroom (bodyH/2 - TEXT_INSET -
  //                   ROW_H/2 - ROW_H/2), or a shifted row slides off the
  //                   plate and renders over passthrough with no ground.
  exitDrop: 0.03,
  exitDepth: 0.05,
  layerDrop: 0.016,

  enterFrom: 0.93,
  overshoot: 1.015,
  exitTo: 0.95,
  ringFrom: 0.99,
} as const;

const USE_COMPOSITE = true;

const compositeDefs = {
  pxrmpArm: {
    properties: {
      opacity: 0,
      positionY: -MOTION.lift,
      positionZ: -MOTION.depth,
      scaleX: MOTION.enterFrom,
      scaleY: MOTION.enterFrom,
      scaleZ: MOTION.enterFrom,
    },
    duration: 1,
  },
  pxrmpRise: {
    properties: {
      opacity: 1,
      positionY: 0,
      positionZ: 0,
      scaleX: MOTION.overshoot,
      scaleY: MOTION.overshoot,
      scaleZ: MOTION.overshoot,
    },
    easing: 'PowerDecel',
    duration: MOTION.rise,
  },
  pxrmpSettleScale: {
    properties: { scaleX: 1, scaleY: 1, scaleZ: 1 },
    easing: 'EaseInEaseOut',
    duration: MOTION.settle,
  },
  pxrmpInComposite: [['pxrmpArm'], ['pxrmpRise'], ['pxrmpSettleScale']],
  pxrmpLayerArm: { properties: { opacity: 0, positionY: -MOTION.layerDrop }, duration: 1 },
  pxrmpLayerRise: {
    properties: { opacity: 1, positionY: 0 },
    easing: 'PowerDecel',
    duration: MOTION.layerDur,
  },
  pxrmpLayerComposite: [['pxrmpLayerArm'], ['pxrmpLayerRise']],
  pxrmpRowArm: { properties: { opacity: 0, positionX: -MOTION.rowSlide }, duration: 1 },
  pxrmpRowRise: {
    properties: { opacity: 1, positionX: 0 },
    easing: 'PowerDecel',
    duration: 240,
  },
  pxrmpRowComposite: [['pxrmpRowArm'], ['pxrmpRowRise']],
  pxrmpSwapArmBelow: { properties: { opacity: 0, positionY: -MOTION.swapShift }, duration: 1 },
  pxrmpSwapArmAbove: { properties: { opacity: 0, positionY: MOTION.swapShift }, duration: 1 },
  pxrmpSwapSettle: {
    properties: { opacity: 1, positionY: 0 },
    easing: 'PowerDecel',
    duration: MOTION.swapIn,
  },
  pxrmpSwapInUpComposite: [['pxrmpSwapArmBelow'], ['pxrmpSwapSettle']],
  pxrmpSwapInDownComposite: [['pxrmpSwapArmAbove'], ['pxrmpSwapSettle']],
};

ViroAnimations.registerAnimations({
  pxrmpInSimple: {
    properties: { opacity: 1, positionY: 0, positionZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 },
    easing: 'PowerDecel',
    duration: MOTION.rise + MOTION.settle,
  },
  pxrmpOut: {
    properties: {
      opacity: 0,
      positionY: -MOTION.exitDrop,
      positionZ: -MOTION.exitDepth,
      scaleX: MOTION.exitTo,
      scaleY: MOTION.exitTo,
      scaleZ: MOTION.exitTo,
    },
    easing: 'EaseIn',
    duration: MOTION.exit,
  },
  pxrmpOutReduced: { properties: { opacity: 0 }, easing: 'EaseIn', duration: MOTION.reducedOut },
  pxrmpLayerSimple: {
    properties: { opacity: 1, positionY: 0 },
    easing: 'PowerDecel',
    duration: MOTION.layerDur,
  },
  pxrmpRowSimple: {
    properties: { opacity: 1, positionX: 0 },
    easing: 'PowerDecel',
    duration: 240,
  },
  pxrmpSwapOutUp: {
    properties: { opacity: 0, positionY: MOTION.swapShift },
    easing: 'EaseIn',
    duration: MOTION.swapOut,
  },
  pxrmpSwapOutDown: {
    properties: { opacity: 0, positionY: -MOTION.swapShift },
    easing: 'EaseIn',
    duration: MOTION.swapOut,
  },
  pxrmpSwapOutFade: { properties: { opacity: 0 }, easing: 'EaseIn', duration: 100 },
  pxrmpSwapInSimple: {
    properties: { opacity: 1, positionY: 0 },
    easing: 'PowerDecel',
    duration: MOTION.swapIn,
  },
  pxrmpRingIn: {
    properties: { opacity: 1, scaleX: 1, scaleY: 1, scaleZ: 1 },
    easing: 'EaseOut',
    duration: MOTION.feedback,
  },
  pxrmpRingOut: {
    properties: {
      opacity: 0,
      scaleX: MOTION.ringFrom,
      scaleY: MOTION.ringFrom,
      scaleZ: MOTION.ringFrom,
    },
    easing: 'EaseIn',
    duration: MOTION.feedbackOut,
  },
  pxrmpLiftIn: { properties: { positionZ: MOTION.hoverLean }, easing: 'EaseOut', duration: 180 },
  pxrmpLiftOut: { properties: { positionZ: 0 }, easing: 'EaseInEaseOut', duration: 220 },
  ...(USE_COMPOSITE ? compositeDefs : {}),
} as unknown as ViroAnimationDict);

const ANIM = {
  presenceIn: USE_COMPOSITE ? 'pxrmpInComposite' : 'pxrmpInSimple',
  layerIn: USE_COMPOSITE ? 'pxrmpLayerComposite' : 'pxrmpLayerSimple',
  rowIn: USE_COMPOSITE ? 'pxrmpRowComposite' : 'pxrmpRowSimple',
  swapInUp: USE_COMPOSITE ? 'pxrmpSwapInUpComposite' : 'pxrmpSwapInSimple',
  swapInDown: USE_COMPOSITE ? 'pxrmpSwapInDownComposite' : 'pxrmpSwapInSimple',
} as const;

let pxrmpInstanceCounter = 0;

// ═══════════════════════════════════════════════════════════════════════════
// PROPS
// ═══════════════════════════════════════════════════════════════════════════
export type MediaPanelRow = {
  id: string;
  text: string;
  label?: string;
  emphasis?: boolean;
  /**
   * Makes the row a BUTTON rather than a readout.
   *
   * poke-xr's rows were pure data — a Pokedex stat has nothing to press. A tool
   * list is the opposite: every line is an action. A row with `onPress` gets a
   * hit quad across its width, in FRONT of the type, because this fork ignores
   * `ignoreEventHandling` on ViroText and text over a target eats that target's
   * clicks — the same reason the close button and chevrons carry their own.
   */
  onPress?: () => void;
  /** Draws the row as chosen — the tool currently in the child's hand. */
  active?: boolean;
  disabled?: boolean;
  /**
   * Renders the row as a real {@linkcode ViroButton} spanning the row.
   *
   * The face supplies the plate and the glyph for all three states; the LABEL
   * is a {@linkcode ViroText} node drawn over it, so copy can change without a
   * PNG rebuild. Omit `text` on a button whose face IS the content — the colour
   * selector's swatch — and no label is drawn.
   */
  face?: ButtonFaceId;
  /** A swatch drawn instead of a face — the ink colour the child is using. */
  swatchColor?: string;
};

type ImageSource = { uri: string } | number;

export type MediaPanelTransition =
  | 'enter-start'
  | 'enter-end'
  | 'exit-start'
  | 'exit-end'
  | 'scroll'
  | 'snap';

type Props = {
  title: string;
  imageSource: ImageSource;
  rows: MediaPanelRow[];
  size?: keyof typeof SIZES;
  mediaFraction?: number;
  initialSlot?: PanelSlot;
  slot?: PanelSlot;
  onSlotChange?: (slot: PanelSlot) => void;
  sideScale?: number;
  snapOnRelease?: boolean;
  draggable?: boolean;
  dragType?: 'FixedDistance' | 'FixedDistanceOrigin' | 'FixedToWorld';
  disabled?: boolean;
  mediaMaterial?: string;
  controlSize?: number;
  animate?: boolean;
  reduceMotion?: boolean;
  debug?: boolean;
  alwaysShowRail?: boolean;
  /** Use SLOTS[s].yaw instead of the TILT table. Default false. */
  useSlotYaw?: boolean;
  /**
   * Place the panel in WORLD space instead of at its head-relative slot.
   *
   * `SLOTS` is authored around an origin that IS the head. On a floor-
   * referenced runtime (PICO) that assumption puts the whole arc at the user's
   * feet, and re-parenting the panel under a head node is not an option for a
   * scene whose sibling surfaces do world-space ray maths. So the caller may
   * hand in the already-resolved world pose; drag, snap-back and the slot
   * scale all keep working against it.
   */
  worldPlacement?: { position: [number, number, number]; yaw: number };
  scrollOnSwipe?: boolean;
  closeSources?: {
    source: ImageSource;
    hoverSource?: ImageSource;
    clickSource?: ImageSource;
  };
  onTransition?: (event: MediaPanelTransition) => void;
  onClose?: () => void;
};

type RailHot = 'none' | 'thumb' | 'pageUp' | 'pageDown' | 'up' | 'down';

type PanelState = {
  internalSlot: PanelSlot;
  snapRunning: boolean;
  closing: boolean;
  hovered: boolean;
  revealed: boolean;
  closeHot: boolean;
  scrollTop: number;
  railHot: RailHot;
  /** Accumulated grab-handle drag, added to the slot position (world-space). */
  dragOffset: Vec3;
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export const PremiumXRMediaPanel: React.FC<Props> = ({
  title,
  imageSource,
  rows,
  size = 'widePanel',
  mediaFraction = 0.4,
  initialSlot = 'center',
  slot: slotProp,
  onSlotChange,
  sideScale = 0.72,
  snapOnRelease = true,
  draggable = true,
  dragType = 'FixedDistance',
  disabled = false,
  mediaMaterial,
  controlSize,
  animate = true,
  reduceMotion = false,
  debug = false,
  alwaysShowRail = false,
  useSlotYaw = false,
  worldPlacement,
  scrollOnSwipe = true,
  closeSources,
  onTransition,
  onClose,
}) => {
  const { width: w, height: h } = SIZES[size];
  const RAIL_W = controlSize ?? DEFAULT_RAIL_W;
  const ARROW_H = controlSize ?? DEFAULT_ARROW_H;

  // ── Header ──────────────────────────────────────────────────────────────
  const headerCenterY = h / 2 - HEADER_H / 2;
  const barTopY = h / 2;

  const titleBoxH = textBox(GLYPH.title);
  const titleGlyph = fitGlyph(GLYPH.title, titleBoxH);
  const titleW = w - 2 * HEADER_PAD - (onClose ? CLOSE + HAIR : 0);
  const titleCenterX = -w / 2 + HEADER_PAD + titleW / 2;
  const closeCenterX = w / 2 - HEADER_PAD - CLOSE / 2;
  // Positioned from the BAR TOP, not centred — see TITLE_TOP_MARGIN.
  const titleY = barTopY - TITLE_TOP_MARGIN - titleBoxH / 2;
  const titleText = clampText(title ?? '', titleW, titleGlyph);

  // ── Body: two full-bleed columns, no floating margins ───────────────────
  const bodyH = h - HEADER_H;
  const bodyCenterY = -HEADER_H / 2; // = ((h/2 - HEADER_H) + (-h/2)) / 2

/*
    THE CLAMP OPENS AT BOTH ENDS, and MoyoLearn needs both. poke-xr always had
    art beside a readout, so 0.25–0.6 was the honest range. Here the tool and
    conversation panels are pure lists (0 → no art column, the plate takes the
    full width) and the BOARD panel is pure media (1 → the child's paper fills
    the body, no plate). Anything between still behaves exactly as before.
  */
  const paperInset = size === 'boardPanel' && mediaFraction === 1 ? spatialCorners.panel : 0;
  const artW = Math.min(1, Math.max(0, mediaFraction)) * w - paperInset * 2;
  const artH = bodyH - paperInset * 2;
  const hasArt = artW > 0.001;
  /* At mediaFraction 1 the plate is zero-width and simply draws nothing —
     no guard needed for it, only for the seam BETWEEN the two columns. */
  const hasPlate = mediaFraction < 1 && w - artW > 0.001;
  const artCenterX = -w / 2 + paperInset + artW / 2;

  const plateW = w - artW;
  const plateCenterX = w / 2 - plateW / 2;
  const seamX = -w / 2 + artW;

  const hasControls = rows.some((row) => typeof row.onPress === 'function');
  const rowHeight = controlSize ?? ROW_H;
  const rowStep = rowHeight + ROW_GAP;
  const rowsAreaH = bodyH - 2 * TEXT_INSET;
  const visibleRows = Math.max(1, Math.floor((rowsAreaH + ROW_GAP) / rowStep));
  const scrollable = alwaysShowRail || rows.length > visibleRows;

  const railGutter = scrollable ? RAIL_W : 0;
  const textColW = plateW - 2 * TEXT_INSET - railGutter;
  const textColCenterX = plateCenterX - plateW / 2 + TEXT_INSET + textColW / 2;
  const railCenterX = plateCenterX + plateW / 2 - RAIL_W / 2;

  const labelW = textColW * 0.36;
  const labelCenterX = -textColW / 2 + labelW / 2;
  const accentW = 0.005;

  const rowBoxH = ROW_H * 0.9;
  const leadGlyph = fitGlyph(GLYPH.lead, rowBoxH);
  const bodyGlyph = fitGlyph(GLYPH.body, rowBoxH);
  const labelGlyph = fitGlyph(GLYPH.label, rowBoxH);

  // ── Per-instance state (no useState) ────────────────────────────────────
  const instanceId = useMemo(() => ++pxrmpInstanceCounter, []);
  const snapAnimName = (s: PanelSlot) => `pxrmp${instanceId}_${s}`;

  const store = useInstanceStore<PanelState>(() => ({
    internalSlot: slotProp ?? initialSlot,
    snapRunning: false,
    closing: false,
    hovered: false,
    revealed: !animate,
    closeHot: false,
    scrollTop: 0,
    railHot: 'none',
    dragOffset: [0, 0, 0],
  }));
  const internalSlot = useStore(store, (s) => s.internalSlot);
  const snapRunning = useStore(store, (s) => s.snapRunning);
  const closing = useStore(store, (s) => s.closing);
  const hovered = useStore(store, (s) => s.hovered);
  const revealed = useStore(store, (s) => s.revealed);
  const closeHot = useStore(store, (s) => s.closeHot);
  const scrollTop = useStore(store, (s) => s.scrollTop);
  const railHot = useStore(store, (s) => s.railHot);
  const dragOffset = useStore(store, (s) => s.dragOffset);

  const activeSlot = slotProp ?? internalSlot;
  const mountPose = useRef(SLOTS[slotProp ?? initialSlot]).current;

  // Rotation + scale are authoritative PROPS off the active slot, never
  // animation targets — a slot change re-angles instantly and correctly.
  const activeYaw = useSlotYaw ? SLOTS[activeSlot].yaw : slotYaw(activeSlot);
  const activeScale: Vec3 =
    activeSlot === 'center' ? [1, 1, 1] : [sideScale, sideScale, sideScale];

  const delay = reduceMotion
    ? { header: 0, art: 0, rows: 0, rail: 0 }
    : {
        header: MOTION.layerHeader,
        art: MOTION.layerArt,
        rows: MOTION.layerRows,
        rail: MOTION.layerRows + visibleRows * MOTION.rowStep + MOTION.railTail,
      };

  // ── REVEAL WATCHDOG ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!animate) return;
    onTransition?.('enter-start');
    const budget = delay.rail + MOTION.rise + MOTION.settle + 250;
    const t = setTimeout(() => store.setState({ revealed: true }), budget);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!debug && !__DEV__) return;
    console.log(
      '[PXRMediaPanel]',
      JSON.stringify({
        rows: rows.length,
        visibleRows,
        scrollable,
        slot: activeSlot,
        slotX: (SLOTS[activeSlot].position as Vec3)[0],
        yawTable: SLOTS[activeSlot].yaw,
        yawUsed: activeYaw,
        titleY: +titleY.toFixed(4),
        barTopY: +barTopY.toFixed(4),
        titleFontSize: pt(titleGlyph),
        plateW: +plateW.toFixed(3),
        textColW: +textColW.toFixed(3),
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, title, activeSlot]);

  // Snap tween carries POSITION + SCALE only. rotateY stays out so it cannot
  // fight the rotation prop.
  useEffect(() => {
    const defs: ViroAnimationDict = {};
    (Object.keys(SLOTS) as PanelSlot[]).forEach((s) => {
      const target = SLOTS[s];
      const k = s === 'center' ? 1 : sideScale;
      defs[snapAnimName(s)] = {
        properties: {
          positionX: target.position[0],
          positionY: target.position[1],
          positionZ: target.position[2],
          scaleX: k,
          scaleY: k,
          scaleZ: k,
        },
        easing: 'EaseInEaseOut',
        duration: 340,
      };
    });
    ViroAnimations.registerAnimations(defs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sideScale, instanceId]);

  const goToSlot = (next: PanelSlot) => {
    if (next !== activeSlot) {
      if (slotProp === undefined) store.setState({ internalSlot: next });
      onSlotChange?.(next);
    }
    onTransition?.('snap');
    // Snap targets the raw slot position — clear any grab-drag offset so the
    // panel lands ON the slot, not slot+offset.
    store.setState({ snapRunning: true, dragOffset: [0, 0, 0] });
  };

  // ── Grab-handle drag (header bar) ────────────────────────────────────────
  // dragType "Gizmo" (fork extension, decax9-verified): reports drag positions
  // WITHOUT natively moving the handle node, so the header stays glued to the
  // card while JS applies the delta to the panel ROOT. This is the drag-sink
  // pattern — native drag on the root itself swallowed all child input, and
  // native drag on a child ripped that child out of the card.
  const dragLast = useRef<Vec3 | null>(null);
  const onGrabDrag = (pos: number[]) => {
    if (__DEV__) console.log('[panel] onGrabDrag', JSON.stringify(pos));
    if (disabled || !draggable) return;
    const p: Vec3 = [pos[0] ?? 0, pos[1] ?? 0, pos[2] ?? 0];
    if (!dragLast.current) {
      dragLast.current = p;
      return;
    }
    const d = dragLast.current;
    const off = store.getState().dragOffset;
    store.setState({
      dragOffset: [off[0] + p[0] - d[0], off[1] + p[1] - d[1], off[2] + p[2] - d[2]],
    });
    dragLast.current = p;
  };

  useEffect(() => {
    if (slotProp !== undefined) store.setState({ snapRunning: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotProp]);

  // ── Drag → release → snap ───────────────────────────────────────────────
  const draggedSinceDown = useRef(false);
  const lastDragPos = useRef<Vec3 | null>(null);

  const nearestSlot = (p: Vec3): PanelSlot => {
    let best: PanelSlot = activeSlot;
    let bestD = Infinity;
    (Object.keys(SLOTS) as PanelSlot[]).forEach((s) => {
      const q = SLOTS[s].position;
      const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    });
    return best;
  };

  const handleClickState = (state: number) => {
    if (disabled) return;
    if (state === 1) {
      draggedSinceDown.current = false;
      store.setState({ snapRunning: false });
    } else if (state === 2) {
      if (draggedSinceDown.current && lastDragPos.current) {
        if (snapOnRelease) goToSlot(nearestSlot(lastDragPos.current));
        draggedSinceDown.current = false;
      }
    }
  };

  // ── Scroll ──────────────────────────────────────────────────────────────
  const maxScroll = Math.max(0, rows.length - visibleRows);
  const atTop = scrollTop <= 0;
  const atEnd = scrollTop >= maxScroll;

  // Scroll is a DIRECT commit — no swap animation. The prior out/in opacity
  // tween committed `scrollTop` inside its `onFinish`; on this Viro fork the
  // tween silently no-ops, so onFinish never fired: the phase stuck (scroll
  // appeared dead — B/D), the carrier was stranded at partial opacity (faded
  // text — C), and each remount flipped the row background opacity 0↔1 (scroll
  // flicker — E). A native node tree needs no cross-fade to scroll: commit and
  // re-slice the window. One deletion closes B, C, D-truncation, and E.
  const scrollBy = (delta: number) => {
    if (disabled || maxScroll === 0) return;
    const from = store.getState().scrollTop;
    const next = Math.min(maxScroll, Math.max(0, from + delta));
    if (next === from) return;
    store.setState({ scrollTop: next });
    onTransition?.('scroll');
  };

  useEffect(() => {
    const current = store.getState().scrollTop;
    if (current > maxScroll) store.setState({ scrollTop: maxScroll });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, visibleRows]);

  const windowRows = rows.slice(scrollTop, scrollTop + visibleRows);

  // Rail geometry — local to the rail node, which is centred on the body.
  const trackH = bodyH - 2 * ARROW_H;
  const trackTopLocal = bodyH / 2 - ARROW_H;
  const ratio = maxScroll === 0 ? 1 : visibleRows / Math.max(1, rows.length);
  const thumbH = Math.max(THUMB_MIN, Math.min(trackH, trackH * ratio));
  const travel = Math.max(0, trackH - thumbH);
  const progress = maxScroll === 0 ? 0 : scrollTop / maxScroll;
  const thumbCenterLocal = trackTopLocal - thumbH / 2 - progress * travel;
  const gapAbove = trackTopLocal - (thumbCenterLocal + thumbH / 2);
  const gapBelow = thumbCenterLocal - thumbH / 2 - (trackTopLocal - trackH);

  const closedRef = useRef(false);
  const finishClose = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onTransition?.('exit-end');
    onClose?.();
  };
  const requestClose = () => {
    if (store.getState().closing) return;
    if (__DEV__) console.log('[PXRMediaPanel] close clicked');
    onTransition?.('exit-start');
    if (!animate) {
      finishClose();
      return;
    }
    store.setState({ closing: true });
    // CLOSE WATCHDOG — same rationale as the reveal watchdog: this fork drops
    // animation onFinish sometimes (documented at the scroll fix above), which
    // left the ✕ setting `closing` and then... nothing. Guarantee the unmount.
    setTimeout(finishClose, MOTION.exit + 150);
  };

  // ── Fail-visible layer builder ──────────────────────────────────────────
  // NEVER arm with prop opacity 0: on this Viro fork a node mounted at prop
  // opacity 0 is HIT-CULLED FOREVER (the tween raises the visual, not the
  // prop) — it's why the close chip and the whole scroll rail read as dead.
  // Entrance is position-only; the registered anims may still tween opacity
  // 1→1, which is harmless.
  const layerProps = (delayMs: number) => {
    if (revealed || !animate) return { position: [0, 0, 0] as Vec3, opacity: 1 };
    return {
      position: [0, -MOTION.layerDrop, 0] as Vec3,
      opacity: 1,
      animation: {
        name: reduceMotion ? 'pxrmpLayerSimple' : ANIM.layerIn,
        run: !closing,
        delay: delayMs,
        interruptible: true,
      },
    };
  };

  const presenceProps = closing
    ? {
        position: [0, 0, 0] as Vec3,
        scale: [1, 1, 1] as Vec3,
        opacity: 1,
        animation: {
          name: reduceMotion ? 'pxrmpOutReduced' : 'pxrmpOut',
          run: true,
          interruptible: true,
          onFinish: finishClose,
        },
      }
    : revealed || !animate
      ? { position: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3, opacity: 1 }
      : {
          position: [0, -MOTION.lift, -MOTION.depth] as Vec3,
          scale: [MOTION.enterFrom, MOTION.enterFrom, MOTION.enterFrom] as Vec3,
          // opacity 1, not 0 — prop opacity 0 hit-culls the whole panel forever
          opacity: 1,
          animation: {
            name: reduceMotion ? 'pxrmpLayerSimple' : ANIM.presenceIn,
            run: true,
            interruptible: true,
            onFinish: () => {
              store.setState({ revealed: true });
              onTransition?.('enter-end');
            },
          },
        };

  return (
    <ViroNode
      position={[
        (worldPlacement?.position[0] ?? mountPose.position[0]) + dragOffset[0],
        (worldPlacement?.position[1] ?? mountPose.position[1]) + dragOffset[1],
        (worldPlacement?.position[2] ?? mountPose.position[2]) + dragOffset[2],
      ]}
      rotation={[0, worldPlacement?.yaw ?? activeYaw, 0]}
      scale={activeScale}
      animation={{
        name: snapAnimName(activeSlot),
        run: snapRunning,
        interruptible: true,
        onFinish: () => store.setState({ snapRunning: false }),
      }}
    >
      <ViroNode {...presenceProps}>
        <ViroNode
          position={[0, 0, 0]}
          // WHOLE-PANEL grab: on-device VROInput showed the ray drifts off any
          // small grab quad when grip is squeezed (hitNode=undefined), and drag-
          // start has no hover-hysteresis fallback — so a tiny handle never caught
          // a drag. Making this wrapper (which contains every panel quad) the
          // draggable node means a grip ANYWHERE on the panel walks up to it. Gizmo
          // = report-only (doesn't move the node, so the lift animation still owns
          // position); onGrabDrag applies the delta to the panel root. Trigger
          // clicks on close/chevrons still fire — they're closer OnClick handlers,
          // and drag only starts on the grip source (dragEligible), not the trigger.
          dragType={'Gizmo' as never}
          onDrag={draggable ? onGrabDrag : undefined}
          onClickState={(state: number) => {
            if (state === 2) {
              dragLast.current = null;
              if (snapOnRelease && store.getState().dragOffset.some((v) => v !== 0)) {
                const base = SLOTS[activeSlot].position as Vec3;
                const off = store.getState().dragOffset;
                goToSlot(nearestSlot([base[0] + off[0], base[1] + off[1], base[2] + off[2]]));
              }
            }
          }}
          animation={{
            name: hovered && !disabled ? 'pxrmpLiftIn' : 'pxrmpLiftOut',
            run: animate && !reduceMotion,
            interruptible: true,
          }}
        >
          {/* Card backing — only visible as a 1px seam now that both columns
              are full-bleed. Kept as the drag surface. */}
          {/* renderingOrder discipline (negative = drawn first): grounds render
              BEFORE the transparent text quads. Without it the sorter sometimes
              drew text first; its transparent texels wrote depth and CARVED
              holes in the plate — the white flickering to passthrough. */}
          {/* Hover/click-state live on the BACKING QUAD, not the panel root: a
              draggable/handling ANCESTOR captured every child's input on this
              fork — close/chevrons/track all read as dead. Panel DRAG is
              disabled entirely: Viro drag moves the DRAGGED NODE itself, so
              drag-on-the-quad ripped the white backing out of the card, and
              drag-on-the-root swallowed all child input. Slots don't need it.
              ponytail: re-add via a dedicated grab handle if panel drag ever
              matters. */}
          <XrRoundedQuad
            width={w}
            height={h}
            position={[0, 0, Z.backing]}
            materials={[disabled ? 'disabledSurface' : 'solidPanel']}
            renderingOrder={-10}
            onClickState={handleClickState}
            onHover={(isHovering: boolean) => !disabled && store.setState({ hovered: isHovering })}
          />

          <ViroNode
            opacity={0}
            scale={[MOTION.ringFrom, MOTION.ringFrom, MOTION.ringFrom]}
            animation={{
              name: hovered && !disabled ? 'pxrmpRingIn' : 'pxrmpRingOut',
              run: true,
              interruptible: true,
            }}
          >
            <ViroQuad
              width={w + 0.014}
              height={h + 0.014}
              position={[0, 0, Z.ring]}
              materials={['focusRing']}
              ignoreEventHandling
            />
          </ViroNode>

          {/* ═══ HEADER ═══════════════════════════════════════════════ */}
          <ViroNode {...layerProps(delay.header)}>
            {/* Visual header bar — full width, INERT. Drag lives on the handle
                quad below, scoped to the title area so it never sits behind the
                close button and eats its click (that competition was why close
                read as dead — the full-width grab node caught the trigger). */}
            <XrRoundedQuad
              roundBottom={false}
              width={w}
              height={HEADER_H}
              position={[0, headerCenterY, Z.header]}
              materials={['softCard']}
              ignoreEventHandling
              renderingOrder={-8}
            />
            {/* GRAB HANDLE — TITLE AREA ONLY (left of the close button). Invisible
                hit quad placed IN FRONT of the title text (this fork lets ViroText
                eat clicks). Gizmo drag reports positions without moving the node;
                onGrabDrag applies the delta to the panel root. */}
            <ViroNode
              dragType={'Gizmo' as never}
              onDrag={draggable ? onGrabDrag : undefined}
              onClickState={(state: number) => {
                if (__DEV__) console.log('[panel] grab clickState', state);
                if (state === 2) {
                  dragLast.current = null;
                  if (snapOnRelease && store.getState().dragOffset.some((v) => v !== 0)) {
                    const base = SLOTS[activeSlot].position as Vec3;
                    const off = store.getState().dragOffset;
                    goToSlot(
                      nearestSlot([base[0] + off[0], base[1] + off[1], base[2] + off[2]]),
                    );
                  }
                }
              }}
            >
              <ViroQuad
                width={titleW}
                height={HEADER_H}
                position={[titleCenterX, headerCenterY, 0.02]}
                materials={['pxrmpHit']}
              />
            </ViroNode>
            <ViroQuad
              width={w}
              height={HAIRLINE}
              position={[0, headerCenterY - HEADER_H / 2, Z.rule]}
              materials={['pxrmpDivider']}
              ignoreEventHandling
              renderingOrder={-6}
            />

            {/* Title — anchored TITLE_TOP_MARGIN below the top of the bar.
                Black outline (native VROTextOuterStroke) + tracked letters for the
                arcade wordmark look. Width is in CRISP-scaled units (CrispText
                renders at CRISP× then counter-scales), so both are ×CRISP. */}
            <CrispText
              text={titleText}
              position={[titleCenterX, titleY, Z.headerInk]}
              width={titleW}
              height={titleBoxH}
              textLineBreakMode="None"
              textClipMode="None"
              style={{
                ...(TITLE_FONT ? { fontFamily: TITLE_FONT } : {}),
                fontSize: pt(titleGlyph),
                color: TITLE_COLOR,
                letterSpacing: 0,
                textAlign: 'left',
                textAlignVertical: 'center',
              }}
              ignoreEventHandling
            />

            {onClose ? <ViroNode position={[closeCenterX, headerCenterY, Z.chip]}>
              {closeSources ? (
                <ViroButton
                  source={closeSources.source}
                  hoverSource={closeSources.hoverSource ?? closeSources.source}
                  clickSource={
                    closeSources.clickSource ?? closeSources.hoverSource ?? closeSources.source
                  }
                  width={CLOSE}
                  height={CLOSE}
                  onClick={requestClose}
                />
              ) : (
                <ViroNode
                  onHover={(hit: boolean) => !disabled && store.setState({ closeHot: hit })}
                  // onClickState (fire on ClickUp=2), NOT onClick: the fork's
                  // composite Clicked event needs the ray on the SAME node at both
                  // press and release — trivial on the wide grab handle, but the
                  // ✕ is 0.11 m, so a hair of drift during the trigger pull killed
                  // it (why close read as dead while drag worked). ClickUp only
                  // needs release on the node; the oversized hit quad below gives
                  // the drift margin.
                  onClickState={(state: number) => {
                    if (__DEV__) console.log('[panel] close clickState', state);
                    if (state === 2 && !disabled) requestClose();
                  }}
                >
                  <ViroQuad
                    width={CLOSE}
                    height={CLOSE}
                    materials={[
                      disabled ? 'pxrmpDisabled' : closeHot ? 'pxrmpChipHot' : 'pxrmpChip',
                    ]}
                  />
                  <ViroIcon
                    name="x"
                    size={CLOSE * 0.62}
                    color={disabled ? 'muted' : closeHot ? 'ink' : 'white'}
                    position={[0, 0, 0.006]}
                  />
                  {/* invisible hit surface IN FRONT of the icon, oversized for
                      aim/drift tolerance — see pxrmpHit */}
                  <ViroQuad width={CLOSE * 2.4} height={CLOSE * 2.4} position={[0, 0, 0.02]} materials={['pxrmpHit']} />
                </ViroNode>
              )}
            </ViroNode> : null}
          </ViroNode>

          {/* ═══ ART — full bleed, header bottom to card bottom ═══════ */}
          {hasArt ? (
          <ViroNode {...layerProps(delay.art)}>
            <ViroQuad
              width={artW}
              height={artH}
              position={[artCenterX, bodyCenterY, Z.plate]}
              materials={['solidPanel']}
              ignoreEventHandling
              renderingOrder={-8}
            />
            {mediaMaterial ? (
              <ViroQuad width={artW} height={artH}
                position={[artCenterX, bodyCenterY, Z.art]}
                materials={[mediaMaterial]} ignoreEventHandling renderingOrder={-7} />
            ) : <ViroImage
              source={imageSource}
              width={artW}
              height={artH}
              position={[artCenterX, bodyCenterY, Z.art]}
              resizeMode="ScaleToFill"
              imageClipMode="ClipToBounds"
              mipmap
              ignoreEventHandling
              renderingOrder={-7}
            />}
            {/* The seam only exists where the two columns actually meet. */}
            {hasPlate ? (
              <ViroQuad
                width={HAIRLINE}
                height={artH}
                position={[seamX, bodyCenterY, Z.rule]}
                materials={['pxrmpDivider']}
                ignoreEventHandling
                renderingOrder={-6}
              />
            ) : null}
          </ViroNode>
          ) : null}

          {/* ═══ READOUT PLATE — white, full bleed ════════════════════ */}
          {hasPlate ? <ViroNode position={[plateCenterX, bodyCenterY, 0]}>
            {maxScroll > 0 && scrollOnSwipe && !disabled && !hasControls ? (
              <ViroNode
                onSwipe={(state: number) => {
                  if (state === 1) scrollBy(visibleRows);
                  else if (state === 2) scrollBy(-visibleRows);
                }}
                // Thumbstick scroll while pointing at the content: the fork
                // surfaces stick motion as onScroll (Viro3DPoint; Y = stick Y
                // in ~[-1, 1] per tick).
                onScroll={(scrollPos: [number, number, number]) => {
                  const dy = scrollPos?.[1] ?? 0;
                  if (dy > 0.25) scrollBy(-1);
                  else if (dy < -0.25) scrollBy(1);
                }}
              >
                <ViroQuad
                  width={plateW}
                  height={bodyH}
                  position={[0, 0, Z.plate]}
                  materials={['pxrmpScreen']}
                  renderingOrder={-8}
                />
              </ViroNode>
            ) : (
              <XrRoundedQuad
                roundTop={false}
                width={plateW}
                height={bodyH}
                position={[0, 0, Z.plate]}
                materials={['pxrmpScreen']}
                ignoreEventHandling
                renderingOrder={-8}
              />
            )}
          </ViroNode> : null}

          {/* ═══ ROWS — direct window (no swap carrier) ═══════════════
              Rows render at a static opacity of 1. The scroll no longer fades
              a carrier in/out; `windowRows` is re-sliced on each `scrollTop`
              commit and the nodes re-render with the new content. This is what
              removed the stranded-translucent text and the 0↔1 flicker. */}
          {/* Thumbstick/swipe SCROLL CATCHER — an invisible hit quad IN FRONT of
              the rows (this fork lets ViroText eat events, so onScroll on the
              plate BEHIND the text never fired → "scroll wheel stopped"). Sized
              to the TEXT column only, so it never covers the rail (chevrons stay
              untouched). */}
          {maxScroll > 0 && scrollOnSwipe && !disabled && !hasControls ? (
            // onScroll/onSwipe live ON the quad, not a wrapper node — this fork
            // routes thumbstick scroll only to the HIT node itself (no ancestor
            // bubbling for scroll), which is why the wrapped version was dead.
            <ViroQuad
              width={textColW}
              height={bodyH}
              position={[textColCenterX, bodyCenterY, 0.03]}
              materials={['pxrmpHit']}
              onSwipe={(state: number) => {
                if (state === 1) scrollBy(visibleRows);
                else if (state === 2) scrollBy(-visibleRows);
              }}
              onScroll={(scrollPos: [number, number, number]) => {
                const dy = scrollPos?.[1] ?? 0;
                if (dy > 0.25) scrollBy(-1);
                else if (dy < -0.25) scrollBy(1);
              }}
            />
          ) : null}
          <ViroNode position={[0, 0, 0]} opacity={1}>
            {windowRows.map((row, i) => {
              const y = bodyCenterY + bodyH / 2 - TEXT_INSET - rowHeight / 2 - i * rowStep;
              const hasLabel = !!row.label;
              const valueW = hasLabel ? textColW - labelW - HAIR : textColW;
              const valueCenterX = textColCenterX + textColW / 2 - valueW / 2;
              const glyph = row.emphasis ? leadGlyph : bodyGlyph;
              const banded = i % 2 === 1;

              /* A row with an action is a target; one without is a readout. */
              const pressable = typeof row.onPress === 'function';

              const rest = revealed || !animate;
              // Same rule as layerProps: never arm at prop opacity 0 (hit-cull
              // + stranded-translucent-text risk on this fork). Slide-in only.
              const rowNodeProps = rest
                ? { position: [0, y, 0] as Vec3, opacity: 1 }
                : {
                    position: [-MOTION.rowSlide, y, 0] as Vec3,
                    opacity: 1,
                    animation: {
                      name: reduceMotion ? 'pxrmpRowSimple' : ANIM.rowIn,
                      run: !closing,
                      delay: delay.rows + i * MOTION.rowStep,
                      interruptible: true,
                    },
                  };

              if (pressable) return (
                <XrKey key={row.id} label={row.text}
                  position={[textColCenterX, y, Z.rowInk]}
                  width={textColW} height={rowHeight}
                  selected={row.active ?? false} disabled={disabled || !!row.disabled}
                  chip={row.swatchColor ? inkMaterial(row.swatchColor as WhiteboardInk) : undefined}
                  onPress={() => row.onPress?.()} />
              );
              return (
                <ViroNode key={row.id} {...rowNodeProps}>
                  {/* Alternating band, black at 4% on white. No horizontal
                      rules anywhere — that is what read as ruled paper. */}
                  {banded && (
                    <ViroNode opacity={0.04}>
                      <ViroQuad
                        width={textColW + 2 * TEXT_INSET}
                        height={ROW_H}
                        position={[textColCenterX, 0, Z.band]}
                        materials={['pxrmpBand']}
                        ignoreEventHandling
                        renderingOrder={-6}
                      />
                    </ViroNode>
                  )}

                  {row.emphasis && (
                    <ViroQuad
                      width={accentW}
                      height={ROW_H * 0.66}
                      position={[textColCenterX - textColW / 2 - TEXT_INSET / 2, 0, Z.rowInk]}
                      materials={['pxrmpMark']}
                      ignoreEventHandling
                    />
                  )}

                  {hasLabel && (
                    <CrispText
                      text={clampText(row.label!, labelW, labelGlyph)}
                      position={[textColCenterX + labelCenterX, 0, Z.rowInk]}
                      width={labelW}
                      height={rowBoxH}
                      textLineBreakMode="None"
                      textClipMode="None"
                      style={{
                        ...(FONT.family ? { fontFamily: FONT.family } : {}),
                        fontSize: pt(labelGlyph),
                        color: PALETTE.inkDim,
                        ...(FONT.weightBold ? { fontWeight: FONT.weightBold } : {}),
                        textAlign: 'left',
                        textAlignVertical: 'center',
                      }}
                      ignoreEventHandling
                    />
                  )}

                  <CrispText
                    text={clampText(row.text, valueW, glyph)}
                    position={[valueCenterX, 0, Z.rowInk]}
                    width={valueW}
                    height={rowBoxH}
                    textLineBreakMode="None"
                    textClipMode="None"
                    style={{
                      ...(FONT.family ? { fontFamily: FONT.family } : {}),
                      fontSize: pt(glyph),
                      color: row.emphasis ? PALETTE.inkStrong : PALETTE.ink,
                      ...(row.emphasis
                        ? FONT.weightBold
                          ? { fontWeight: FONT.weightBold }
                          : {}
                        : FONT.weightRegular
                          ? { fontWeight: FONT.weightRegular }
                          : {}),
                      textAlign: 'left',
                      textAlignVertical: 'center',
                    }}
                    ignoreEventHandling
                  />

                </ViroNode>
              );
            })}
          </ViroNode>

          {/* ═══ SCROLL RAIL — colours unchanged, every part visible ══ */}
          {scrollable && (
            <ViroNode position={[railCenterX, bodyCenterY, 0]}>
              <ViroNode {...layerProps(delay.rail)}>
                <ViroQuad
                  width={RAIL_W}
                  height={bodyH}
                  position={[0, 0, Z.railChannel]}
                  materials={['pxrmpRailChannel']}
                  ignoreEventHandling
                />

                {gapAbove > 0.002 && (
                  <ViroNode
                    position={[0, trackTopLocal - gapAbove / 2, Z.railZone]}
                    onHover={(hit: boolean) => store.setState({ railHot: hit ? 'pageUp' : 'none' })}
                    onClick={() => scrollBy(-visibleRows)}
                  >
                    <ViroQuad
                      width={RAIL_W}
                      height={gapAbove}
                      materials={[railHot === 'pageUp' ? 'pxrmpRailZoneHot' : 'pxrmpRailZone']}
                    />
                  </ViroNode>
                )}
                {gapBelow > 0.002 && (
                  <ViroNode
                    position={[0, trackTopLocal - trackH + gapBelow / 2, Z.railZone]}
                    onHover={(hit: boolean) =>
                      store.setState({ railHot: hit ? 'pageDown' : 'none' })
                    }
                    onClick={() => scrollBy(visibleRows)}
                  >
                    <ViroQuad
                      width={RAIL_W}
                      height={gapBelow}
                      materials={[railHot === 'pageDown' ? 'pxrmpRailZoneHot' : 'pxrmpRailZone']}
                    />
                  </ViroNode>
                )}

                <ViroQuad
                  width={RAIL_W - 0.014}
                  height={thumbH}
                  position={[0, thumbCenterLocal, Z.railThumb]}
                  materials={[railHot === 'thumb' ? 'pxrmpThumbHot' : 'pxrmpThumb']}
                  ignoreEventHandling
                />

                {(['up', 'down'] as const).map((dir) => {
                  const isUp = dir === 'up';
                  const y = isUp ? bodyH / 2 - ARROW_H / 2 : -bodyH / 2 + ARROW_H / 2;
                  const off = disabled || (isUp ? atTop : atEnd);
                  const hot = railHot === dir;
                  return (
                    <ViroNode
                      key={dir}
                      position={[0, y, Z.railZone]}
                      onHover={(hit: boolean) => store.setState({ railHot: hit ? dir : 'none' })}
                      onClick={() => !off && scrollBy(isUp ? -1 : 1)}
                    >
                      <ViroQuad
                        width={RAIL_W}
                        height={ARROW_H}
                        materials={[off ? 'pxrmpDisabled' : hot ? 'pxrmpChipHot' : 'pxrmpChip']}
                      />
                      <ViroIcon
                        name={isUp ? 'chevron-up' : 'chevron-down'}
                        size={ARROW_H * 0.6}
                        color={off ? 'muted' : hot ? 'ink' : 'white'}
                        position={[0, 0, 0.006]}
                      />
                      {/* invisible hit surface IN FRONT of the icon — see pxrmpHit */}
                      <ViroQuad width={RAIL_W} height={ARROW_H} position={[0, 0, 0.02]} materials={['pxrmpHit']} />
                    </ViroNode>
                  );
                })}
              </ViroNode>
            </ViroNode>
          )}

          {debug && (
            <ViroNode opacity={0.25}>
              <ViroQuad
                width={titleW}
                height={titleBoxH}
                position={[titleCenterX, titleY, Z.debug]}
                materials={['pxrmpDebug']}
                ignoreEventHandling
              />
              <ViroQuad
                width={textColW}
                height={bodyH}
                position={[textColCenterX, bodyCenterY, Z.debug]}
                materials={['pxrmpDebug']}
                ignoreEventHandling
              />
            </ViroNode>
          )}
        </ViroNode>
      </ViroNode>
    </ViroNode>
  );
};