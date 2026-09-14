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
// IT IS STACKED QUADS, NOT A FLEX BOX. The slab is an `XrPlate` and every key
// is placed by `runOffsets` in metres — the construction from the Danger Room
// conference scene. Yoga is what let the overflow above happen silently in the
// first place (`flexShrink` is 0, so the last children were simply drawn off
// the slab), and a nested flex view could never have carried its own transform
// anyway. See `XrPlate.native.tsx`.
//
// Ornament, not chrome: it hangs beside the paper and never over it, and it is
// placed by `XrPanel` rather than positioning itself. Apple's ornaments are the
// reference — controls related to a window, outside its bounds, keeping their
// relationship to it when it moves.
// SOT: packages/ui/Whiteboard.tsx · packages/ui/xr/spatial-tokens.ts · packages/ui/xr/XrPlate.native.tsx
// SOT-KEYWORDS: xr rail ornament toolbar tools ink undo redo ask clear viro spatial controls

import { useState } from 'react';
import { ViroNode } from '@reactvision/react-viro';
import { XR_MATERIAL, inkMaterial } from './spatial-materials.native.ts';
import { XrKey, XrPlate } from './XrPlate.native.tsx';
import { runOffsets } from './run-layout.ts';
import {
  boardComposition,
  minHitSize,
  railGrid,
  railWidthFor,
  spatialSpacing,
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
 * because `ViroText` exposes none: in this scene the only accessible name a
 * control can have is the one it draws.
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

/** One key in a rail column, plus any gap that must precede it. */
interface RailEntry {
  id: string;
  label: string;
  chip?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Metres of empty run above this key. */
  lead?: number;
}

/**
 * A column's keys, each with the Y its centre sits at.
 *
 * The gaps go into the RUN rather than being rendered, so `extentOf` measures
 * what the column actually occupies and `spatial-tokens.test.ts`'s fit check
 * stays true of the thing that draws. The column runs top-down, which is why
 * the offset is subtracted from the top edge.
 */
function columnOf(
  entries: readonly RailEntry[],
  size: number,
  box: number,
): { entry: RailEntry; y: number }[] {
  const run: number[] = [];
  const at: number[] = [];
  for (const entry of entries) {
    if (entry.lead !== undefined) run.push(entry.lead);
    at.push(run.length);
    run.push(size);
  }
  const offsets = runOffsets(run, box, 0, 'start');
  return entries.map((entry, index) => ({
    entry,
    y: box / 2 - (offsets[at[index] ?? 0] ?? 0),
  }));
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
    THE OUTER COLUMN IS THE ONE THAT CAN COST SOMETHING. A ray that slips off
    the left edge of the paper crosses the inner column first, so the inner
    column is the pens — pressing one of those by accident costs a child
    nothing. Undo, Redo, Ask and Clear are out here, away from the overshoot,
    and the rail hangs to the LEFT of the paper, so the outer column is the one
    at lower X.

    Clear is last, after a gap wide enough that a ray sliding down the column
    stops at Undo — WHICH IS STILL DIRECTLY ABOVE IT, deliberately, because that
    adjacency is the entire argument for Clear having no confirmation dialog:
    the engine clears in one undoable step and the undo is the next key up. The
    gap is `xs` rather than the `md` it was, for the reason the grid exists —
    four keys leave 0.0344 m of the box and `sm` needs 0.05. What replaced the
    lost separation is distance of a different kind: Clear is now the furthest
    control in the rail from the paper a child is drawing on.

    HARDER TO HIT BY ACCIDENT IS SEPARATION, NOT A SMALLER TARGET. It was
    `key × 0.8` — 3.06° — which makes the most destructive control on the rail
    the hardest one to hit ON PURPOSE too, and a child who misses Clear twice
    hits it on the third try anyway.
  */
  const outerColumn: RailEntry[] = [
    { id: 'ask', label: asking ? 'Sending' : 'Ask', disabled: asking, onPress: onAsk },
    { id: 'redo', label: 'Redo', disabled: !canRedo, onPress: onRedo },
    { id: 'undo', label: 'Undo', disabled: !canUndo, onPress: onUndo },
    /* The separator above Clear is a LENGTH IN THE RUN, never an invisible
       sibling view: a spacer drawn between the keys is a spacer that can take
       a ray, and the gap exists precisely so a slipping ray lands on nothing. */
    { id: 'clear', label: 'Clear', disabled: false, onPress: onClear, lead: spatialSpacing.xs },
  ];

  const innerColumn: RailEntry[] = [
    ...TOOLS.map((entry) => ({
      id: entry.id,
      label: entry.glyph,
      selected: tool === entry.id,
      onPress: () => onTool(entry.id),
    })),
    /*
      The colour well says which colour it is holding, in the word the 2D tray
      uses for it — the `aria-label="Pen color: Blue"` the child on a laptop
      gets, drawn, because drawn is the only form of it this renderer has. It
      was a key labelled "Ink" whose fill was the current colour, so the one
      fact it carried was the one a colour-blind child could not read.
    */
    {
      id: 'ink',
      label: inkLabel(ink),
      chip: inkMaterial(ink),
      selected: pickingInk,
      onPress: () => setPickingInk(!pickingInk),
    },
  ];

  const outer = columnOf(outerColumn, key, box);
  const inner = columnOf(innerColumn, key, box);

  /* Two columns of floor-sized keys, centred in whatever width the rail took. */
  const columnX = runOffsets([key, key], railWidth, spatialSpacing.xs, 'center');

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
  const paletteBox = paletteHeight - spatialSpacing.xs * 2;
  const paletteX = runOffsets(
    Array.from({ length: paletteColumns }, () => key),
    paletteWidth,
    spatialSpacing.xs,
    'center',
  );
  const paletteY = runOffsets(
    Array.from({ length: railGrid.rows }, () => key),
    paletteBox,
    0,
    'start',
  );

  return (
    <ViroNode>
      <XrPlate width={railWidth} height={height} material={XR_MATERIAL.rail}>
        {outer.map(({ entry, y }) => (
          <XrKey
            key={entry.id}
            label={entry.label}
            width={key}
            height={key}
            chip={entry.chip}
            selected={entry.selected ?? false}
            disabled={entry.disabled ?? false}
            onPress={entry.onPress}
            position={[-railWidth / 2 + (columnX[0] ?? 0), y, 0]}
          />
        ))}

        {inner.map(({ entry, y }) => (
          <XrKey
            key={entry.id}
            label={entry.label}
            width={key}
            height={key}
            chip={entry.chip}
            selected={entry.selected ?? false}
            disabled={entry.disabled ?? false}
            onPress={entry.onPress}
            position={[-railWidth / 2 + (columnX[1] ?? 0), y, 0]}
          />
        ))}
      </XrPlate>

      {pickingInk ? (
        <XrPlate
          position={[-(railWidth / 2 + boardComposition.railGap + paletteWidth / 2), 0, 0]}
          width={paletteWidth}
          height={paletteHeight}
          material={XR_MATERIAL.rail}
        >
          {INKS.map((entry, index) => (
            <XrKey
              key={entry.id}
              label={entry.label}
              width={key}
              height={key}
              chip={inkMaterial(entry.id)}
              selected={ink === entry.id}
              disabled={false}
              onPress={() => {
                onInk(entry.id);
                setPickingInk(false);
              }}
              position={[
                -paletteWidth / 2 + (paletteX[Math.floor(index / railGrid.rows)] ?? 0),
                paletteBox / 2 - (paletteY[index % railGrid.rows] ?? 0),
                0,
              ]}
            />
          ))}
        </XrPlate>
      ) : null}
    </ViroNode>
  );
}
