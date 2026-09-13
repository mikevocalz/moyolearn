'use client';
// The control rail: the 2D tray's commands, stood on end beside the paper.
//
// IT IS THE SAME TOOLBAR MODEL, not a spatial one. Pen, highlighter, eraser,
// colour, undo and Ask Natalie are the keys `Whiteboard.tsx` offers, in that
// order, because a child who has used the board on a laptop should not have to
// relearn it in a headset. Two things differ, both for reasons the input
// creates rather than the medium: redo is present (a ray is far easier to
// overshoot than a tap), and clear sits at the far corner behind a gap (a ray
// that slips must not land on "empty the board").
//
// TWO COLUMNS, BECAUSE ONE COLUMN HOLDS FOUR KEYS. The rail is as tall as the
// paper and a floor-sized key at the `young` band is 0.17143 m, so a single
// column has room for four controls and the rail declares eight. It used to
// draw all eight anyway — 1.4714 m of content in a 0.72 m box, and 2.6714 m
// with the ink picker stacked below it — so Undo and Clear were rendered
// outside the slab entirely. `railGrid` in `spatial-tokens.ts` carries the
// arithmetic and `spatial-tokens.test.ts` holds it.
//
// Ornament, not chrome: it hangs beside the paper and never over it, and it is
// placed by `XrPanel` rather than positioning itself. Apple's ornaments are the
// reference — controls related to a window, outside its bounds, keeping their
// relationship to it when it moves.
// SOT: packages/ui/Whiteboard.tsx · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr rail ornament toolbar tools ink undo redo ask clear viro spatial controls

import { Fragment, useState, type ReactNode } from 'react';
import { ViroClickStateTypes, ViroFlexView, ViroNode, ViroText } from '@reactvision/react-viro';
import { XR_MATERIAL, inkMaterial } from './spatial-materials.native.ts';
import { XR_COLOR } from './xr-colors.ts';
import {
  boardComposition,
  minHitSize,
  railGrid,
  railWidthFor,
  spatialFontSize,
  spatialSpacing,
  spatialTextHeight,
} from './spatial-tokens.ts';
import type { WhiteboardInk, WhiteboardTool } from '../whiteboard.types.ts';
/* Props live outside this file so the web fork can name them without naming
   Viro — the `XrPanel.types.ts` arrangement, for the same reason. */
import type { XrRailProps } from './XrRail.types.ts';

/** The three tools `WhiteboardTool` permits — no shapes, text, lasso or notes. */
const TOOLS = [
  { id: 'draw', glyph: 'Pen' },
  { id: 'highlight', glyph: 'Mark' },
  { id: 'eraser', glyph: 'Erase' },
] as const satisfies readonly { id: WhiteboardTool; glyph: string }[];

/**
 * `Whiteboard.tsx`'s `INKS` — same order, same seven, and THE SAME WORDS.
 *
 * The labels are the ones the 2D tray already puts in `aria-label`, copied
 * rather than imported because `INKS` is private to that component and this
 * package's web fork must not resolve a native file to reach it. "Purple" for
 * `violet` is the 2D copy's own choice and is kept: a child hears one name for
 * a colour in this product, not two.
 *
 * They were not here at all — the swatches rendered `label=""`, seven controls
 * whose only difference was their fill. That is SC 1.4.1 Use of Colour at Level
 * A (`06-a11y.md` F3) and it is not repairable with an accessibility label,
 * because `ViroText` and `ViroFlexView` expose none: in this scene the only
 * accessible name a control can have is the one it draws.
 */
const INKS = [
  { id: 'black', label: 'Black' },
  { id: 'blue', label: 'Blue' },
  { id: 'red', label: 'Red' },
  { id: 'green', label: 'Green' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'orange', label: 'Orange' },
  { id: 'violet', label: 'Purple' },
] as const satisfies readonly { id: WhiteboardInk; label: string }[];

/** The current ink's word, for the well that opens the palette. */
const inkLabel = (id: WhiteboardInk): string =>
  INKS.find((entry) => entry.id === id)?.label ?? INKS[0].label;

/**
 * The inset a key's content sits in, and the width of its outline.
 *
 * Both derived from the smallest spacing tier rather than written as metres:
 * they were `0.008` and `0.004`, which are the only two raw lengths the file
 * had left. A third and a sixth of `xs` reproduce them to within a hair.
 */
const KEY_INSET = spatialSpacing.xs / 3;
const KEY_RING = spatialSpacing.xs / 6;

interface KeyProps {
  label: string;
  size: number;
  material: string;
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
}

/**
 * One rail key, with every state the spatial rules require wired.
 *
 * SELECTION IS THREE SIGNALS AND ONLY ONE OF THEM IS COLOUR: the fill inverts,
 * the label inverts with it, and a permanent outline is drawn inside the key's
 * own edge. The outline is what satisfies SC 1.4.1 — a child who cannot
 * separate the two fills still sees a key that is ringed and six that are not —
 * and it is the same device the 2D tray uses on its swatches ("Selected is the
 * same dot, ringed harder"). This comment used to claim the key grew, which it
 * never did, while all three colour states resolved to `palette.ink[100]`.
 */
function RailKey({ label, size, material, chip, selected, disabled, onPress }: KeyProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const surface = disabled
    ? XR_MATERIAL.keyDisabled
    : pressed
      ? XR_MATERIAL.keyPressed
      : selected
        ? XR_MATERIAL.keySelected
        : material;

  /*
    THE LABEL FOLLOWS THE FILL. A resting key is the paper's cream and takes the
    dark ink at 16.28:1; a selected key is that ink inverted and takes the light
    one at 19.21:1. A pressed key is a 20% white wash that REPLACES the resting
    material rather than sitting on it, so it composites over the rail to
    `#514F4B` — the dark label was 2.21:1 there and the light one is 8.03:1.
    The rule was written in this file and was a no-op, because both fills were
    the same colour.
  */
  const onFill = disabled
    ? XR_COLOR.onPanelMuted
    : selected || pressed
      ? XR_COLOR.onKeySelected
      : XR_COLOR.onKey;

  return (
    <ViroFlexView
      width={size}
      height={size}
      materials={[surface]}
      /*
        One border does two jobs and the thickness separates them: a hover ring
        in the focus colour while a ray is on the key, and a thinner selection
        outline in the label's own ink the rest of the time. Hover wins when
        both are true, which is correct — the ray's position is the more urgent
        of the two facts and the fill still says which tool is chosen.
      */
      style={{
        padding: KEY_INSET,
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: hovered && !disabled ? KEY_RING * 2 : selected ? KEY_RING : 0,
        borderColor: hovered && !disabled ? XR_COLOR.focus : XR_COLOR.onKeySelected,
      }}
      onHover={disabled ? undefined : (isHovering) => setHovered(isHovering)}
      onClickState={
        disabled
          ? undefined
          : (clickState) => {
              if (clickState === ViroClickStateTypes.CLICK_DOWN) setPressed(true);
              else if (clickState === ViroClickStateTypes.CLICK_UP) {
                setPressed(false);
                onPress();
              }
            }
      }
    >
      {chip ? (
        <ViroFlexView
          width={size - KEY_INSET * 2}
          height={spatialTextHeight.caption}
          materials={[chip]}
          style={{ borderWidth: KEY_RING, borderColor: onFill }}
        />
      ) : null}
      <ViroText
        text={label}
        style={{
          /* A chipped key carries a colour name under its sample, so it takes
             the caption step — `body` at this width would clip "Purple". */
          fontSize: chip ? spatialFontSize.caption : spatialFontSize.body,
          color: onFill,
          textAlign: 'center',
        }}
      />
    </ViroFlexView>
  );
}

/** One column of the rail's grid, or of the palette's. */
function KeyColumn({
  width,
  height,
  children,
}: {
  width: number;
  height: number;
  children: ReactNode;
}) {
  return (
    <ViroFlexView
      width={width}
      height={height}
      materials={[]}
      style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center' }}
    >
      {children}
    </ViroFlexView>
  );
}

export function XrRail({
  width,
  height,
  distanceM,
  handsPrimary,
  band,
  tool,
  ink,
  canUndo,
  canRedo,
  asking,
  onTool,
  onInk,
  onUndo,
  onRedo,
  onAsk,
  onClear,
}: XrRailProps) {
  const [pickingInk, setPickingInk] = useState(false);

  /*
    The key size is the angular floor at this distance and for this band, never
    a chosen number — the spatial counterpart of reading a target from the
    age-band token.

    IT IS NOT CLAMPED TO THE RAIL, and that clamp is the bug this file shipped
    with. `Math.min(width, minHitSize(…))` reads as "never wider than the rail"
    and behaves as "never LARGER THAN THE FLOOR either", because `railWidth` was
    0.1 m against a floor of 0.105 m: every key in the feature was 3.82° or
    less, and the ink swatches and Clear multiplied down from there. A floor a
    caller can take the minimum of is not a floor.

    So the key holds and the RAIL gives. The rail draws itself wide enough to
    hold its grid inside its own padding, capped at one gap on each side so the
    widening can never reach across `railGap` and cover the paper. Past that cap
    the rail genuinely cannot hold a reachable key at this distance, and
    `layoutBoard` says so (`miss: 'rail-below-target'`) rather than this file
    quietly shrinking a six-year-old's controls to fit.
  */
  const key = minHitSize(distanceM, handsPrimary, band);
  const railWidth = Math.min(
    Math.max(width, railWidthFor(distanceM, handsPrimary, band)),
    width + boardComposition.railGap * 2,
  );
  /* The box inside the slab's padding — what the two columns have to fit. */
  const box = height - spatialSpacing.xs * 2;

  /*
    The palette is a SIBLING SLAB, not seven more keys in the column, and that
    is the whole of the overflow fix on the open side: the rail's own height is
    the same whether it is open or shut. Seven full-size swatches stacked below
    Clear came to 2.6714 m in a 0.72 m box — they did not open beside anything,
    they opened into the room.

    It opens AWAY FROM THE PAPER, on the far side of the rail, which is what
    this file's Mobbin reference has always described: Apple Mail's pencil
    palette puts its popover clear of the page, because a control that covers
    the work makes a child choose between seeing what they are doing and
    changing how they do it. Its far edge reaches 38.9° off centre while it is
    open — outside the ±30° cone the composition is sized to, and a deliberate
    trade: transient peripheral content a child glances at is the case the cone
    exempts, and the alternative was Undo and Clear rendered off the slab.
  */
  const paletteColumns = Math.ceil(INKS.length / railGrid.rows);
  const paletteWidth = key * paletteColumns + spatialSpacing.xs * (paletteColumns + 1);
  const paletteHeight = key * railGrid.rows + spatialSpacing.xs * 2;

  return (
    <ViroNode>
      <ViroFlexView
        width={railWidth}
        height={height}
        materials={[XR_MATERIAL.rail]}
        style={{
          padding: spatialSpacing.xs,
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'flex-start',
        }}
      >
        {/*
          THE OUTER COLUMN IS THE ONE THAT CAN COST SOMETHING. A ray that slips
          off the left edge of the paper crosses the inner column first, so the
          inner column is the pens — pressing one of those by accident costs a
          child nothing. Undo, Redo, Ask and Clear are out here, away from the
          overshoot.

          Clear is last, after a gap wide enough that a ray sliding down the
          column stops at Undo — WHICH IS STILL DIRECTLY ABOVE IT, deliberately,
          because that adjacency is the entire argument for Clear having no
          confirmation dialog: the engine clears in one undoable step and the
          undo is the next key up. The gap is `xs` rather than the `md` it was,
          for the reason the grid exists — four keys leave 0.0344 m of the box
          and `sm` needs 0.05. What replaced the lost separation is distance of
          a different kind: Clear is now the furthest control in the rail from
          the paper a child is drawing on.

          HARDER TO HIT BY ACCIDENT IS SEPARATION, NOT A SMALLER TARGET. It was
          `key × 0.8` — 3.06° — which makes the most destructive control on the
          rail the hardest one to hit ON PURPOSE too, and a child who misses
          Clear twice hits it on the third try anyway.
        */}
        <KeyColumn width={key} height={box}>
          <RailKey
            label={asking ? 'Sending' : 'Ask'}
            size={key}
            material={XR_MATERIAL.key}
            selected={false}
            disabled={asking}
            onPress={onAsk}
          />
          <RailKey
            label="Redo"
            size={key}
            material={XR_MATERIAL.key}
            selected={false}
            disabled={!canRedo}
            onPress={onRedo}
          />
          <RailKey
            label="Undo"
            size={key}
            material={XR_MATERIAL.key}
            selected={false}
            disabled={!canUndo}
            onPress={onUndo}
          />
          <ViroFlexView width={key} height={spatialSpacing.xs} materials={[]} />
          <RailKey
            label="Clear"
            size={key}
            material={XR_MATERIAL.key}
            selected={false}
            disabled={false}
            onPress={onClear}
          />
        </KeyColumn>

        <ViroFlexView width={spatialSpacing.xs} height={box} materials={[]} />

        <KeyColumn width={key} height={box}>
          {TOOLS.map((entry) => (
            <RailKey
              key={entry.id}
              label={entry.glyph}
              size={key}
              material={XR_MATERIAL.key}
              selected={tool === entry.id}
              disabled={false}
              onPress={() => onTool(entry.id)}
            />
          ))}
          {/*
            The colour well says which colour it is holding, in the word the 2D
            tray uses for it — the `aria-label="Pen color: Blue"` the child on a
            laptop gets, drawn, because drawn is the only form of it this
            renderer has. It was a key labelled "Ink" whose fill was the current
            colour, so the one fact it carried was the one a colour-blind child
            could not read.
          */}
          <RailKey
            label={inkLabel(ink)}
            size={key}
            material={XR_MATERIAL.key}
            chip={inkMaterial(ink)}
            selected={pickingInk}
            disabled={false}
            onPress={() => setPickingInk(!pickingInk)}
          />
        </KeyColumn>
      </ViroFlexView>

      {pickingInk ? (
        <ViroFlexView
          position={[-(railWidth / 2 + boardComposition.railGap + paletteWidth / 2), 0, 0]}
          width={paletteWidth}
          height={paletteHeight}
          materials={[XR_MATERIAL.rail]}
          style={{
            padding: spatialSpacing.xs,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'flex-start',
          }}
        >
          {Array.from({ length: paletteColumns }, (_, column) => (
            /* The spacer rides with the column rather than being interleaved by
               index, so the gap count can never come apart from the column
               count — the same reason the rail draws its own between the two. */
            <Fragment key={column}>
              {column > 0 ? (
                <ViroFlexView
                  width={spatialSpacing.xs}
                  height={paletteHeight - spatialSpacing.xs * 2}
                  materials={[]}
                />
              ) : null}
              <KeyColumn width={key} height={paletteHeight - spatialSpacing.xs * 2}>
                {INKS.slice(column * railGrid.rows, (column + 1) * railGrid.rows).map((entry) => (
                  <RailKey
                    key={entry.id}
                    label={entry.label}
                    size={key}
                    material={XR_MATERIAL.key}
                    chip={inkMaterial(entry.id)}
                    selected={ink === entry.id}
                    disabled={false}
                    onPress={() => {
                      onInk(entry.id);
                      setPickingInk(false);
                    }}
                  />
                ))}
              </KeyColumn>
            </Fragment>
          ))}
        </ViroFlexView>
      ) : null}
    </ViroNode>
  );
}
