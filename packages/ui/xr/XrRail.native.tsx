'use client';
// The control rail: the 2D tray's commands, stood on end beside the paper.
//
// IT IS THE SAME TOOLBAR MODEL, not a spatial one. Pen, highlighter, eraser,
// colour, undo and Ask Natalie are the keys `Whiteboard.tsx` offers, in that
// order, because a child who has used the board on a laptop should not have to
// relearn it in a headset. Two things differ, both for reasons the input
// creates rather than the medium: redo is present (a ray is far easier to
// overshoot than a tap), and clear sits at the bottom behind a gap (a ray that
// slips must not land on "empty the board").
//
// Ornament, not chrome: it hangs beside the paper and never over it, and it is
// placed by `XrPanel` rather than positioning itself. Apple's ornaments are the
// reference — controls related to a window, outside its bounds, keeping their
// relationship to it when it moves.
// SOT: packages/ui/Whiteboard.tsx · packages/ui/xr/spatial-tokens.ts
// SOT-KEYWORDS: xr rail ornament toolbar tools ink undo redo ask clear viro spatial controls

import { useState } from 'react';
import { ViroClickStateTypes, ViroFlexView, ViroText } from '@reactvision/react-viro';
import { XR_MATERIAL, inkMaterial } from './spatial-materials.native.ts';
import { XR_COLOR } from './xr-colors.ts';
import { minHitSize, spatialSpacing } from './spatial-tokens.ts';
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

/** `Whiteboard.tsx`'s `INKS`, same order, same seven. */
const INKS = [
  'black',
  'blue',
  'red',
  'green',
  'yellow',
  'orange',
  'violet',
] as const satisfies readonly WhiteboardInk[];

interface KeyProps {
  label: string;
  size: number;
  material: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}

/**
 * One rail key, with every state the spatial rules require wired.
 *
 * Selection is carried by the material AND by a focus ring AND by the key
 * growing — three signals, because a tool picked out by colour alone is a tool
 * a colour-blind child cannot find, and in a headset a hover highlight is often
 * the only feedback a ray gives.
 */
function RailKey({ label, size, material, selected, disabled, onPress }: KeyProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const surface = disabled
    ? XR_MATERIAL.keyDisabled
    : pressed
      ? XR_MATERIAL.keyPressed
      : selected
        ? XR_MATERIAL.keySelected
        : material;

  return (
    <ViroFlexView
      width={size}
      height={size}
      materials={[surface]}
      /* The ring is the focus state, drawn only when a ray is on the key. */
      style={{
        padding: 0.008,
        flexDirection: 'column',
        justifyContent: 'center',
        borderWidth: hovered && !disabled ? 0.004 : 0,
        borderColor: XR_COLOR.focus,
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
      <ViroText
        text={label}
        style={{
          fontSize: 16,
          color: disabled ? XR_COLOR.onPanelMuted : selected ? XR_COLOR.onKey : XR_COLOR.onPanel,
          textAlign: 'center',
        }}
      />
    </ViroFlexView>
  );
}

export function XrRail({
  width,
  height,
  distanceM,
  handsPrimary,
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
    The key size is the angular floor at this distance, never a chosen number —
    the spatial counterpart of reading a target from the age-band token. The
    rail's own width is the ceiling: a key wider than its rail is a key whose
    hitbox overlaps the paper.
  */
  const key = Math.min(width, minHitSize(distanceM, handsPrimary));

  return (
    <ViroFlexView
      width={width}
      height={height}
      materials={[XR_MATERIAL.rail]}
      style={{
        padding: spatialSpacing.xs,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
      }}
    >
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
        Colour opens a column of ink samples BESIDE the rail rather than over
        the paper — Apple Mail's pencil palette puts its popover above the tray
        for the same reason: a control that covers the work makes a child choose
        between seeing what they are doing and changing how they do it.
      */}
      <RailKey
        label="Ink"
        size={key}
        material={inkMaterial(ink)}
        selected={pickingInk}
        disabled={false}
        onPress={() => setPickingInk(!pickingInk)}
      />
      {pickingInk
        ? INKS.map((id) => (
            <RailKey
              key={id}
              label=""
              size={key * 0.7}
              material={inkMaterial(id)}
              selected={ink === id}
              disabled={false}
              onPress={() => {
                onInk(id);
                setPickingInk(false);
              }}
            />
          ))
        : null}

      <RailKey
        label="Undo"
        size={key}
        material={XR_MATERIAL.key}
        selected={false}
        disabled={!canUndo}
        onPress={onUndo}
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
        label={asking ? 'Sending' : 'Ask'}
        size={key}
        material={XR_MATERIAL.key}
        selected={false}
        disabled={asking}
        onPress={onAsk}
      />

      {/*
        Clear is last, after a gap wide enough that a ray sliding down the rail
        stops at Undo. No confirmation dialog, deliberately and for the same
        reason the 2D tray has none: the engine clears in ONE undoable step and
        undo is on the rail directly above.
      */}
      <ViroFlexView width={width} height={spatialSpacing.sm} materials={[]} />
      <RailKey
        label="Clear"
        size={key * 0.8}
        material={XR_MATERIAL.key}
        selected={false}
        disabled={false}
        onPress={onClear}
      />
    </ViroFlexView>
  );
}
