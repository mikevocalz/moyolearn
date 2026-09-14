'use client';
// The three things every spatial panel in this feature is built out of: a
// label, a plate, and a key.
//
// WHY THERE IS NO FLEX BOX LEFT. Every panel here used to be a `ViroFlexView`
// with `flexDirection`, `justifyContent` and `padding`, and Yoga placed the
// children. That arrangement has two costs and this codebase has paid both. A
// nested flex view cannot carry its own transform — only the outermost one's
// `position`/`rotation`/`scale` is respected — so a control group could never
// be moved relative to the panel holding it. And Yoga's `flexShrink` defaults
// to 0, so a column that overflows its box does not compress and does not
// error: it draws its last children OUTSIDE the slab, which is how the rail
// shipped with Undo and Clear floating in the room beside it.
//
// So a panel is stacked quads at explicit Z offsets with positions in metres,
// which is the construction the Danger Room conference scene
// (`danger-room/src/scenes/ConferenceScene.tsx`) has proven on headset
// hardware: a frame quad at 0, an inset face at `spatialLayer.surface`, content
// at `spatialLayer.content`. `run-layout.ts` does the placement arithmetic and
// is asserted without a device.
//
// THE LABEL TRICK IS THE LOAD-BEARING PART. `ViroText`'s font size is
// point-like, so asking for a metre height directly asks for a 3–9 pt face and
// gets a glyph made of a handful of texels. `XrLabel` lays the text out in a
// box `1 / spatialLabelScale` too large, at that many times the point size, and
// scales the NODE back down — same rendered height, four times the raster. The
// reference scene states it in one line: "keep text INSIDE a physical (meters)
// box by laying it out in a big logical box then scaling the node down".
//
// These are INTERNAL to the native panels — the web fork renders none of them,
// so they get no `.types.ts` companion and no barrel export.
// SOT: packages/ui/xr/spatial-tokens.ts · packages/ui/xr/run-layout.ts
// SOT-KEYWORDS: xr plate label key primitive quad layer stacked viro spatial hover press ring chip

import type { ReactNode } from 'react';
import {
  useAnySourceHover,
  useAnySourcePressed,
  ViroClickStateTypes,
  ViroNode,
  ViroQuad,
  ViroText,
} from '@reactvision/react-viro';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { XR_COLOR } from './xr-colors.ts';
import { runOffsets } from './run-layout.ts';
import {
  spatialLabelFontSize,
  spatialLabelScale,
  spatialLayer,
  spatialSpacing,
  spatialTextHeight,
  type SpatialTypeStep,
} from './spatial-tokens.ts';

/** Metres, in the parent node's frame. */
export type XrPoint = [number, number, number];

/**
 * The inset a key's content sits in, and the width of its outline.
 *
 * Both derived from the smallest spacing tier rather than written as metres:
 * they were `0.008` and `0.004` in the rail, which were the only two raw
 * lengths that file had left. A third and a sixth of `xs` reproduce them to
 * within a hair.
 */
const KEY_INSET = spatialSpacing.xs / 3;
const KEY_RING = spatialSpacing.xs / 6;

export interface XrLabelProps {
  text: string;
  /** The box the glyphs must stay inside, in metres. Not the logical box. */
  width: number;
  height: number;
  step: SpatialTypeStep;
  color: string;
  /**
   * Metres, in the parent's frame. Z defaults to 0 because a label is normally
   * a child of an `XrPlate`, which has already raised its content layer — a
   * second offset here would stack two.
   */
  position?: XrPoint;
  align?: 'left' | 'center';
  wrap?: 'WordWrap' | 'None';
  maxLines?: number;
}

/**
 * One run of text, rendered at four times its point size and scaled back down.
 *
 * `ClipToBounds`, always. The whole reason the box is stated in metres is that
 * a panel's contents are budgeted against its height, and text that silently
 * overflows its allocation makes that budget a lie — the same failure the flex
 * columns had, one layer down.
 */
export function XrLabel({
  text,
  width,
  height,
  step,
  color,
  position = [0, 0, 0],
  align = 'left',
  wrap = 'WordWrap',
  maxLines,
}: XrLabelProps) {
  return (
    <ViroText
      text={text}
      position={position}
      scale={[spatialLabelScale, spatialLabelScale, spatialLabelScale]}
      width={width / spatialLabelScale}
      height={height / spatialLabelScale}
      maxLines={maxLines}
      textClipMode="ClipToBounds"
      textLineBreakMode={wrap}
      style={{
        fontSize: spatialLabelFontSize[step],
        color,
        textAlign: align,
        /* The box is the size of what goes in it and the node is placed by its
           centre, so the glyphs have to be centred in it too — otherwise every
           computed Y in the feature is off by half a line. */
        textAlignVertical: 'center',
      }}
    />
  );
}

/** An outline drawn inside a plate's own edge, in a registered material. */
export interface XrRing {
  material: string;
  width: number;
}

export interface XrPlateProps {
  width: number;
  height: number;
  /** The plate's face. */
  material: string;
  /**
   * A ring makes the plate two quads: the outline at full size, and the face
   * inset by `ring.width` on every edge in front of it. That is what a
   * `borderWidth` used to do inside a flex view, drawn rather than laid out.
   */
  ring?: XrRing;
  position?: XrPoint;
  children?: ReactNode;
}

/** A surface, and whatever sits on it. */
export function XrPlate({
  width,
  height,
  material,
  ring,
  position = [0, 0, 0],
  children,
}: XrPlateProps) {
  return (
    <ViroNode position={position}>
      {ring ? <ViroQuad width={width} height={height} materials={[ring.material]} /> : null}
      <ViroQuad
        position={[0, 0, ring ? spatialLayer.surface : 0]}
        width={ring ? width - ring.width * 2 : width}
        height={ring ? height - ring.width * 2 : height}
        materials={[material]}
      />
      {children ? (
        <ViroNode position={[0, 0, spatialLayer.content]}>{children}</ViroNode>
      ) : null}
    </ViroNode>
  );
}

export interface XrKeyProps {
  label: string;
  width: number;
  height: number;
  /**
   * A colour sample drawn above the label — the ink well and the swatches.
   *
   * The sample is a CHIP INSIDE a normal key rather than the key's own fill,
   * and the reason is measurable: a swatch painted in its ink cannot carry its
   * own name (`#e03131` holds neither label colour above 4.44:1) and cannot
   * show a focus ring (the ring is 1.01–1.33:1 against five of the seven
   * inks). On the key's own fill the name is 16.28:1 and the ring is 4.02:1,
   * for every colour. The chip keeps its outline in the label's colour so it
   * has a boundary whatever the hue — `#f1ac4b` is 1.85:1 against the key.
   */
  chip?: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  position?: XrPoint;
}

/**
 * One pressable key, with every state the spatial rules require wired.
 *
 * SELECTION IS THREE SIGNALS AND ONLY ONE OF THEM IS COLOUR: the fill inverts,
 * the label inverts with it, and a permanent outline is drawn inside the key's
 * own edge. The outline is what satisfies SC 1.4.1 — a child who cannot
 * separate the two fills still sees a key that is ringed and six that are not —
 * and it is the same device the 2D tray uses on its swatches ("Selected is the
 * same dot, ringed harder").
 *
 * HOVER AND PRESS ARE PER-SOURCE, which they were not. Both were a local
 * `useState` off the raw event, and on a headset the renderer fires `onHover`
 * ONCE PER INPUT SOURCE: a second pointer sweeping across an already-hovered
 * key toggles the boolean back off, so a child holding two controllers watched
 * the ring flicker under their own aim. `useAnySourceHover` and
 * `useAnySourcePressed` aggregate the sources and dedupe per source, which is
 * what the renderer ships them for.
 *
 * The press still fires on CLICK_UP rather than on the renderer's completed
 * CLICKED, because that is the contract every caller was already written
 * against — `useAnySourcePressed` drives the FILL and nothing else.
 */
export function XrKey({
  label,
  width,
  height,
  chip,
  selected,
  disabled,
  onPress,
  position = [0, 0, 0],
}: XrKeyProps) {
  const [hovered, onHover] = useAnySourceHover();
  const [pressed, onPressState] = useAnySourcePressed();

  const face = disabled
    ? XR_MATERIAL.keyDisabled
    : pressed
      ? XR_MATERIAL.keyPressed
      : selected
        ? XR_MATERIAL.keySelected
        : XR_MATERIAL.key;

  /*
    THE LABEL FOLLOWS THE FILL. A resting key is the paper's cream and takes the
    dark ink at 16.28:1; a selected key is that ink inverted and takes the light
    one at 19.21:1. A pressed key is a 20% white wash that REPLACES the resting
    material rather than sitting on it, so it composites over the rail to
    `#514F4B` — the dark label was 2.21:1 there and the light one is 8.03:1.
  */
  const onFill = disabled
    ? XR_COLOR.onPanelMuted
    : selected || pressed
      ? XR_COLOR.onKeySelected
      : XR_COLOR.onKey;
  const onFillRing = disabled
    ? XR_MATERIAL.ringMuted
    : selected || pressed
      ? XR_MATERIAL.ringKeySelected
      : XR_MATERIAL.ringKey;

  /*
    One outline does two jobs and the thickness separates them: a hover ring in
    the focus colour while a ray is on the key, and a thinner selection outline
    in the label's own ink the rest of the time. Hover wins when both are true,
    which is correct — the ray's position is the more urgent of the two facts
    and the fill still says which tool is chosen.
  */
  const ring: XrRing | undefined =
    hovered && !disabled
      ? { material: XR_MATERIAL.focusRing, width: KEY_RING * 2 }
      : selected
        ? { material: XR_MATERIAL.ringKeySelected, width: KEY_RING }
        : undefined;

  const box = { width: width - KEY_INSET * 2, height: height - KEY_INSET * 2 };
  /* A chipped key is a sample over a colour NAME, so its label takes the
     caption step — `body` at this width would clip "Purple". */
  const labelStep: SpatialTypeStep = chip ? 'caption' : 'body';
  const labelHeight = chip ? spatialTextHeight.caption : box.height;
  const chipHeight = spatialTextHeight.caption;
  /* Sample over name, centred as one group — what the flex column's
     `justifyContent: 'center'` used to arrange. */
  const offsets = runOffsets(
    chip ? [chipHeight, labelHeight] : [labelHeight],
    box.height,
    0,
    'center',
  );
  const chipY = box.height / 2 - (offsets[0] ?? 0);
  const labelY = box.height / 2 - (chip ? (offsets[1] ?? 0) : (offsets[0] ?? 0));

  return (
    <ViroNode
      position={position}
      onHover={disabled ? undefined : onHover}
      onClickState={
        disabled
          ? undefined
          : (clickState, hitPosition, source) => {
              onPressState(clickState, hitPosition, source);
              if (clickState === ViroClickStateTypes.CLICK_UP) onPress();
            }
      }
    >
      <XrPlate width={width} height={height} material={face} ring={ring}>
        {chip ? (
          <XrPlate
            position={[0, chipY, 0]}
            width={box.width}
            height={chipHeight}
            material={chip}
            ring={{ material: onFillRing, width: KEY_RING }}
          />
        ) : null}
        <XrLabel
          text={label}
          position={[0, labelY, 0]}
          width={box.width}
          height={labelHeight}
          step={labelStep}
          color={onFill}
          align="center"
        />
      </XrPlate>
    </ViroNode>
  );
}
