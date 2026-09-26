'use client';
// The control tray: the rail's toolbar model turned horizontal, hung under
// the paper like a classroom board's ledge.
//
// IT IS THE SAME TOOLBAR MODEL AS THE RAIL AND THE 2D TRAY — pen, highlighter,
// eraser, colour, undo and Ask, in `Whiteboard.tsx`'s order, drawn in words
// because a drawn word is the only accessible name this renderer has. Two
// things differ for the same reasons the rail already names: redo is present
// because a ray overshoots far more easily than a tap, and Clear sits at the
// far corner behind a gap so a ray that slips cannot empty the board.
//
// TWO ROWS OF FOUR, because floor-sized keys are the floor. `minHitSize` at
// the board's distance and the `young` band is 0.17143 m; eight controls in
// one row is 1.46 m of keys under a 0.9 m panel — the same overflow the rail
// solved with two columns, stood on its side. `boardTrayGrid` in
// `spatial-tokens.ts` carries the arithmetic.
//
// WHICH ROW HOLDS THE PENS follows the rail's argument vertically: a ray that
// slips off the paper's bottom edge crosses the TOP row first, so the top row
// is the pens — pressing one by accident costs a child nothing. Ask, Redo,
// Undo and Clear are in the row below, away from the overshoot, with Clear at
// the far right corner behind a `lead` length in the run — a gap that exists
// precisely so a slipping ray lands on nothing. Undo sits directly beside it,
// which is the entire argument for Clear needing no confirmation: the engine
// clears in one undoable step and the undo is the next key over.
//
// Ornament, not chrome: it hangs below the paper and never over it, and the
// caller places the whole node. See `XrRail.native.tsx` for the upright
// original and `XrPlate.native.tsx` for the stacked-quad construction.
// SOT: packages/ui/Whiteboard.tsx · packages/ui/xr/XrRail.native.tsx · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr board tray toolbar bottom row tools ink undo redo ask clear horizontal spatial controls

import { useState } from 'react';
import { ViroNode } from '@reactvision/react-viro';
import { XR_MATERIAL, inkMaterial } from './spatial-materials.native.ts';
import { XrKey, XrPlate } from './XrPlate.native.tsx';
import { runOffsets } from './run-layout.ts';
import { BOARD_INKS, BOARD_TOOLS, inkLabel } from './board-controls.ts';
import {
  boardTrayGrid,
  boardTrayHeight,
  minHitSize,
  spatialSpacing,
} from './spatial-tokens.ts';
import type { XrBoardTrayProps } from './XrBoardTray.types.ts';

/** One key in a tray row, plus any gap that must precede it. */
interface TrayEntry {
  id: string;
  label: string;
  chip?: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Metres of empty run before this key — rendered as nothing. */
  lead?: number;
}

/**
 * A row's keys, each with the X its centre sits at inside the plate.
 *
 * The gaps go into the RUN rather than being rendered — the same rule as the
 * rail's `columnOf`, along X instead of Y: a spacer drawn between keys is a
 * spacer that can take a ray.
 */
function rowOf(
  entries: readonly TrayEntry[],
  size: number,
  box: number,
): { entry: TrayEntry; x: number }[] {
  const run: number[] = [];
  const at: number[] = [];
  for (const entry of entries) {
    if (entry.lead !== undefined) run.push(entry.lead);
    at.push(run.length);
    run.push(size);
  }
  const offsets = runOffsets(run, box, 0, 'center');
  return entries.map((entry, index) => ({
    entry,
    x: -box / 2 + (offsets[at[index] ?? 0] ?? 0),
  }));
}

export function XrBoardTray({
  width,
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
}: XrBoardTrayProps) {
  const [pickingInk, setPickingInk] = useState(false);

  /*
    The key size is the angular floor at this distance and for this band, never
    a chosen number — the same rule as the rail. The tray gives to hold it:
    the slab widens until the two rows fit rather than letting the keys shrink
    under their own floor.
  */
  const key = minHitSize(distanceM, handsPrimary, band);
  const columns = boardTrayGrid.columns;
  const trayWidth = Math.max(width, key * columns + spatialSpacing.xs * (columns + 1));
  const height = boardTrayHeight(distanceM, handsPrimary, band);
  const box = trayWidth - spatialSpacing.xs * 2;
  /* Row centres: the top row rides nearer the paper, the action row below it. */
  const rowY = runOffsets(
    [key, key],
    height - spatialSpacing.xs * 2,
    spatialSpacing.xs,
    'start',
  );
  const topRowY = height / 2 - (rowY[0] ?? 0);
  const bottomRowY = height / 2 - (rowY[1] ?? 0);

  const toolRow: TrayEntry[] = [
    ...BOARD_TOOLS.map((entry) => ({
      id: entry.id,
      label: entry.glyph,
      selected: tool === entry.id,
      onPress: () => onTool(entry.id),
    })),
    /* The colour well carries its colour's name, not the word "Ink" — drawn is
       the only form of accessible name this renderer has. */
    {
      id: 'ink',
      label: inkLabel(ink),
      chip: inkMaterial(ink),
      selected: pickingInk,
      onPress: () => setPickingInk(!pickingInk),
    },
  ];

  const actionRow: TrayEntry[] = [
    { id: 'ask', label: asking ? 'Sending' : 'Ask', disabled: asking, onPress: onAsk },
    { id: 'redo', label: 'Redo', disabled: !canRedo, onPress: onRedo },
    { id: 'undo', label: 'Undo', disabled: !canUndo, onPress: onUndo },
    /* The separator before Clear is a LENGTH IN THE RUN, never an invisible
       sibling: a spacer drawn between the keys is a spacer that can take a
       ray, and the gap exists precisely so a slipping ray lands on nothing. */
    { id: 'clear', label: 'Clear', disabled: false, onPress: onClear, lead: spatialSpacing.xs },
  ];

  /* The palette is a SIBLING SLAB below the tray — seven full-size swatches in
     one row, opening away from the paper rather than into it. */
  const paletteWidth = key * BOARD_INKS.length + spatialSpacing.xs * (BOARD_INKS.length + 1);
  const paletteHeight = key + spatialSpacing.xs * 2;
  const paletteX = runOffsets(
    Array.from({ length: BOARD_INKS.length }, () => key),
    paletteWidth - spatialSpacing.xs * 2,
    spatialSpacing.xs,
    'center',
  );

  return (
    <ViroNode>
      <XrPlate width={trayWidth} height={height} material={XR_MATERIAL.rail}>
        {[...rowOf(toolRow, key, box), ...rowOf(actionRow, key, box)].map(({ entry, x }, index) => (
          <XrKey
            key={entry.id}
            label={entry.label}
            width={key}
            height={key}
            chip={entry.chip}
            selected={entry.selected ?? false}
            disabled={entry.disabled ?? false}
            onPress={entry.onPress}
            position={[x, index < toolRow.length ? topRowY : bottomRowY, 0]}
          />
        ))}
      </XrPlate>

      {pickingInk ? (
        <XrPlate
          position={[0, -(height / 2 + spatialSpacing.sm + paletteHeight / 2), 0]}
          width={paletteWidth}
          height={paletteHeight}
          material={XR_MATERIAL.rail}
        >
          {BOARD_INKS.map((entry, index) => (
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
              position={[-paletteWidth / 2 + spatialSpacing.xs + (paletteX[index] ?? 0), 0, 0]}
            />
          ))}
        </XrPlate>
      ) : null}
    </ViroNode>
  );
}
