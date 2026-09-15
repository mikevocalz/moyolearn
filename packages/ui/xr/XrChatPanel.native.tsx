'use client';
// The tutor conversation, beside the board — the same session, presented in
// space.
//
// IT IS NOT A SECOND CHAT. The rows are `useTutorStore`'s messages and the live
// turn is the last of them, exactly as `TutorThread` draws them in 2D: one
// session, one voice, one transcript. Entering the headset must not replay
// Natalie's opening or start a second stream, so nothing here owns state — it
// renders what it is handed.
//
// WHY NOT `TutorThread` ITSELF. It is a `LegendList`, and a React Native list
// cannot mount inside a Viro scene. So the composition is rebuilt from Viro
// primitives.
//
// IT SCROLLS NOW — the poke-xr `PremiumXRMediaPanel` mechanism, not a squeezed
// window. The transcript is a run of fixed-height rows; `visibleRows` of them
// show at once and a right-edge scrollbar (a channel, up/down arrows and a
// thumb sized by `visibleRows / rows.length`) walks through the rest. It pins
// to the newest turn as messages arrive, the way every chat does, and only
// holds position when the child has scrolled up to read something older. This
// replaces the earlier "fit every turn into whatever height is left" squeeze,
// which shrank a long conversation to one clipped line each. The window is
// caller-supplied still for the count above it (`earlierCount`), but a turn in
// `rows` is now reachable rather than compressed.
//
// EVERY FIXED BLOCK DECLARES ITS OWN HEIGHT. The header, notices and action
// keys are laid out in metres above and below the scrolling transcript; the
// transcript takes the band between them.
//
// NATALIE'S BODY IS NOT HERE. Her 3D avatar is a react-native-webgpu surface
// (ADR-111) and it is not ported into the Viro scene by this feature; the panel
// carries her name, status and assurance line — the `TutorPresence` rail's
// information — and nothing pretends to be her.
// SOT: packages/ui/TutorThread.tsx · packages/ui/TutorPresence.tsx · packages/ui/xr/XrPlate.native.tsx
// SOT-KEYWORDS: xr chat panel tutor thread conversation live turn status viro spatial companion

import { useEffect, useRef, useState } from 'react';
import { ViroNode, ViroQuad } from '@reactvision/react-viro';
import { XR_MATERIAL } from './spatial-materials.native.ts';
import { XR_COLOR } from './xr-colors.ts';
import { XrKey, XrLabel, XrPlate } from './XrPlate.native.tsx';
import { extentOf, runOffsets } from './run-layout.ts';
import {
  minHitSize,
  spatialSpacing,
  spatialTextHeight,
  type SpatialTypeStep,
} from './spatial-tokens.ts';
/* Props live outside this file so the web fork can name them without naming
   Viro — the `XrPanel.types.ts` arrangement, for the same reason. */
import type { XrChatPanelProps } from './XrChatPanel.types.ts';

/**
 * How many lines each fixed block is allocated.
 *
 * They are ALLOCATIONS, not guesses about the copy: a block is clipped to what
 * it declares (`XrLabel` always clips), so a line count that is too small
 * truncates a sentence and one that is too large steals room from the
 * transcript. The assurance and the skipped-records notice keep the `maxLines`
 * they already shipped with; the header takes two because "Natalie · Listening"
 * at the title step is wider than a 0.45 m panel on one line.
 */
const LINES = { header: 2, assurance: 2, earlier: 2, skipped: 3 } as const;

/** Lines a single transcript row is given. A row is a turn; long turns clip. */
const ROW_LINES = 3;

/** The scrollbar's own geometry, in metres — the poke-xr rail, MoyoLearn-toned. */
const RAIL = {
  /** The channel's width, and the gap between it and the transcript. */
  width: spatialSpacing.sm,
  gap: spatialSpacing.xs,
  /** The shortest a thumb may get, so a long transcript still leaves it grabbable. */
  thumbMin: spatialSpacing.md,
} as const;

/** A run of text in the panel's single column. */
interface TextBlock {
  kind: 'text';
  id: string;
  text: string;
  step: SpatialTypeStep;
  color: string;
  lines: number;
  /** True for a scrolling transcript row — it yields width to the rail lane. */
  inBand?: boolean;
}

/** The live turn's own action, as a key rather than as text. */
interface KeyBlock {
  kind: 'key';
  id: string;
  label: string;
  onPress: () => void;
}

type ChatBlock = TextBlock | KeyBlock;

export function XrChatPanel({
  width,
  height,
  distanceM,
  handsPrimary,
  band,
  tutorName,
  status,
  assurance,
  rows,
  earlierCount,
  skippedCount,
  actions,
  inputLocked,
}: XrChatPanelProps) {
  const action = minHitSize(distanceM, handsPrimary, band);
  const box = { width: width - spatialSpacing.xs * 2, height: height - spatialSpacing.xs * 2 };

  /* Her name and what she is doing, which is the whole header. */
  const header: TextBlock[] = [
    {
      kind: 'text',
      id: 'header',
      text: `${tutorName} · ${status}`,
      step: 'title',
      color: XR_COLOR.onPanel,
      lines: LINES.header,
    },
    {
      kind: 'text',
      id: 'assurance',
      text: assurance,
      step: 'caption',
      color: XR_COLOR.onPanelMuted,
      lines: LINES.assurance,
    },
  ];

  const notices: TextBlock[] = [];
  if (earlierCount > 0) {
    notices.push({
      kind: 'text',
      id: 'earlier',
      text: `${earlierCount} earlier ${earlierCount === 1 ? 'message' : 'messages'} on the normal screen`,
      step: 'caption',
      color: XR_COLOR.onPanelMuted,
      lines: LINES.earlier,
    });
  }
  /*
    WHAT THE HEADSET COULD NOT DRAW, SAID OUT LOUD.

    The spatial board renders freehand and highlighter and nothing else, so a
    typed note or an arrow made on the web app is simply absent here. Until
    this line, nothing marked the gap and nothing counted it: the board looked
    complete and was not, which is a child concluding their work was deleted.

    The wording is `04-copy.md` §5.2 verbatim and both of its constraints are
    load-bearing. It says the work is STILL THERE, because the fear is deletion
    and not display. And it does not name the tools — "text, notes, arrows and
    images" is a list a K–2 reader will not finish, and knowing which primitive
    failed to render helps nobody.

    Under the earlier-messages line and in the muted ink, per §5.2's placement
    note: not on the paper, which is the working surface, and not as a dialog,
    which would block a child from their board over something they cannot act
    on.
  */
  if (skippedCount > 0) {
    notices.push({
      kind: 'text',
      id: 'skipped',
      text:
        skippedCount === 1
          ? "1 thing you added on the computer isn't shown here. It's still on your board."
          : `${skippedCount} things you added on the computer aren't shown here. They're still on your board.`,
      step: 'caption',
      color: XR_COLOR.onPanelMuted,
      lines: LINES.skipped,
    });
  }

  /*
    Locked states render nothing pressable at all, which is what `inputDisabled`
    means on the 2D composer — a child in a `crisis` state is not offered a
    button.
  */
  const keys: KeyBlock[] =
    inputLocked || !actions
      ? []
      : actions.map((entry) => ({
          kind: 'key',
          id: entry.id,
          label: entry.label,
          onPress: entry.onPress,
        }));

  const heightOf = (block: ChatBlock): number =>
    block.kind === 'key' ? action : spatialTextHeight[block.step] * block.lines;

  /*
    The fixed furniture sits above (header, notices) and below (action keys) the
    scrolling band. Her status, the assurance line and the two honesty notices
    are the things a child cannot recover by scrolling, so they never scroll.
  */
  const above: TextBlock[] = [...header, ...notices];
  const aboveH = extentOf(above.map(heightOf), 0);
  const keysH = extentOf(keys.map(heightOf), 0);
  /* The transcript's band: whatever the fixed furniture leaves. */
  const rowStep = spatialTextHeight.body * ROW_LINES;
  const bandH = Math.max(rowStep, box.height - aboveH - keysH);
  const visibleRows = Math.max(1, Math.floor(bandH / rowStep));
  const maxScroll = Math.max(0, rows.length - visibleRows);

  /*
    SCROLL POSITION, PINNED TO THE NEWEST TURN. Chat reads bottom-up: the
    default is the end of the transcript, and it follows new turns down UNLESS
    the child has scrolled up to read something older — the `pinned` ref is what
    tells those two apart, so an arriving message never yanks a child off the
    line they were reading.
  */
  const [scrollTop, setScrollTop] = useState(maxScroll);
  const pinned = useRef(true);
  const lastCount = useRef(rows.length);
  useEffect(() => {
    if (rows.length !== lastCount.current) {
      lastCount.current = rows.length;
      if (pinned.current) setScrollTop(maxScroll);
    }
    if (scrollTop > maxScroll) setScrollTop(maxScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length, maxScroll]);

  const scrollBy = (delta: number) => {
    setScrollTop((from) => {
      const next = Math.min(maxScroll, Math.max(0, from + delta));
      pinned.current = next >= maxScroll;
      return next;
    });
  };

  const clampedTop = Math.min(scrollTop, maxScroll);
  const windowRows = rows.slice(clampedTop, clampedTop + visibleRows);
  const scrollable = rows.length > visibleRows;

  const transcript: TextBlock[] = windowRows.map((row) => ({
    kind: 'text',
    id: row.id,
    /*
      The attachment is named inside the turn that carried it, never lifted out
      of it — the rule `TutorThread` and `MessageBubble` already agreed on, kept
      here so the two presentations tell the same story about what the child
      sent.
    */
    text: row.attachments
      ? `${row.role === 'tutor' ? tutorName : 'You'}: ${row.text} (${row.attachments} attached)`
      : `${row.role === 'tutor' ? tutorName : 'You'}: ${row.text}`,
    step: 'body',
    color: row.role === 'tutor' ? XR_COLOR.onPanel : XR_COLOR.onPanelMuted,
    lines: ROW_LINES,
    inBand: true,
  }));

  const blocks: ChatBlock[] = [...above, ...transcript, ...keys];
  const offsets = runOffsets(blocks.map(heightOf), box.height, 0, 'start');

  /*
    The transcript column narrows to leave the rail its lane when there is
    something to scroll — otherwise the text runs the full width.
  */
  const railLane = scrollable ? RAIL.width + RAIL.gap : 0;
  const textWidth = box.width - railLane;

  /* Rail geometry, in the panel's own frame. The track spans the band; the
     arrows cap it; the thumb is sized by how much of the transcript shows. */
  const bandTop = box.height / 2 - aboveH;
  const trackH = Math.max(0, bandH - action * 2);
  const ratio = rows.length === 0 ? 1 : Math.min(1, visibleRows / rows.length);
  const thumbH = Math.max(RAIL.thumbMin, Math.min(trackH, trackH * ratio));
  const travel = Math.max(0, trackH - thumbH);
  const progress = maxScroll === 0 ? 0 : clampedTop / maxScroll;
  const railX = box.width / 2 - RAIL.width / 2;
  const trackTop = bandTop - action;
  const thumbY = trackTop - thumbH / 2 - progress * travel;

  return (
    <XrPlate width={width} height={height} material={XR_MATERIAL.card}>
      {blocks.map((block, index) => {
        const y = box.height / 2 - (offsets[index] ?? 0);
        return block.kind === 'key' ? (
          <XrKey
            key={block.id}
            label={block.label}
            /* Wider than the floor for the label, and never shorter than it:
               `action × 0.6` was 2.40°, the same one-axis miss the placement
               keys made. A target is the smaller of its two edges. */
            width={Math.min(box.width, action * 2.4)}
            height={action}
            selected={false}
            disabled={false}
            onPress={block.onPress}
            position={[0, y, 0]}
          />
        ) : (
          <XrLabel
            key={block.id}
            text={block.text}
            width={block.inBand ? textWidth : box.width}
            height={spatialTextHeight[block.step] * block.lines}
            step={block.step}
            color={block.color}
            maxLines={block.lines}
            position={[block.inBand ? -railLane / 2 : 0, y, 0]}
          />
        );
      })}

      {/*
        THE SCROLLBAR — the poke-xr rail, in MoyoLearn's ink. A muted channel,
        an accent thumb, and two arrow keys that step one turn at a time.
        Present only when there is more transcript than fits; a child holding a
        pencil steps with the arrows rather than a precise thumb drag, which is
        why the arrows are floor-sized keys and the thumb is an indicator.
      */}
      {scrollable ? (
        <ViroNode position={[railX, bandTop - bandH / 2, spatialSpacing.xs]}>
          <ViroQuad
            width={RAIL.width}
            height={trackH}
            materials={[XR_MATERIAL.keyDisabled]}
            ignoreEventHandling
          />
          <XrKey
            label="▲"
            width={RAIL.width}
            height={action}
            selected={false}
            disabled={clampedTop <= 0}
            onPress={() => scrollBy(-1)}
            position={[0, bandH / 2 - action / 2, spatialSpacing.xs]}
          />
          <XrKey
            label="▼"
            width={RAIL.width}
            height={action}
            selected={false}
            disabled={clampedTop >= maxScroll}
            onPress={() => scrollBy(1)}
            position={[0, -(bandH / 2 - action / 2), spatialSpacing.xs]}
          />
          <ViroQuad
            width={RAIL.width * 0.6}
            height={thumbH}
            materials={[XR_MATERIAL.focusRing]}
            ignoreEventHandling
            position={[0, thumbY - (bandTop - bandH / 2), spatialSpacing.xs * 1.5]}
          />
        </ViroNode>
      ) : null}
    </XrPlate>
  );
}
