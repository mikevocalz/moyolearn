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
// primitives and the WINDOW is deliberately small — the last few turns, because
// a spatial transcript a child has to scroll with a ray while holding a pencil
// is a transcript they will not read.
//
// EVERY BLOCK DECLARES ITS OWN HEIGHT, which a flex column never made anyone
// do. The panel is stacked quads now (`XrPlate.native.tsx`), so the run of
// blocks is laid out in metres and the transcript's share of the panel is
// whatever the fixed blocks leave — the rows then take as many lines as that
// share holds, floored at one. No turn is dropped and none is reordered; the
// only thing that gives is how much of a long message is shown, which the
// `maxLines={6}` this file already carried was doing arbitrarily.
//
// NATALIE'S BODY IS NOT HERE. Her 3D avatar is a react-native-webgpu surface
// (ADR-111) and it is not ported into the Viro scene by this feature; the panel
// carries her name, status and assurance line — the `TutorPresence` rail's
// information — and nothing pretends to be her.
// SOT: packages/ui/TutorThread.tsx · packages/ui/TutorPresence.tsx · packages/ui/xr/XrPlate.native.tsx
// SOT-KEYWORDS: xr chat panel tutor thread conversation live turn status viro spatial companion

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

/** What `maxLines={6}` meant before the rows had a measured share to fit in. */
const ROW_LINES_MAX = 6;

/** A run of text in the panel's single column. */
interface TextBlock {
  kind: 'text';
  id: string;
  text: string;
  step: SpatialTypeStep;
  color: string;
  lines: number;
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
    The transcript takes what the fixed blocks leave, and nothing about that is
    negotiable in the other direction: her status, the assurance line and the
    two honesty notices are the things a child cannot recover by scrolling.
  */
  const fixed = [...header, ...notices, ...keys];
  const budget = box.height - extentOf(fixed.map(heightOf), 0);
  const rowLines =
    rows.length === 0
      ? 0
      : Math.max(
          1,
          Math.min(ROW_LINES_MAX, Math.floor(budget / rows.length / spatialTextHeight.body)),
        );

  const transcript: TextBlock[] = rows.map((row) => ({
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
    lines: rowLines,
  }));

  const blocks: ChatBlock[] = [...header, ...notices, ...transcript, ...keys];
  const offsets = runOffsets(blocks.map(heightOf), box.height, 0, 'start');

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
            width={box.width}
            height={spatialTextHeight[block.step] * block.lines}
            step={block.step}
            color={block.color}
            maxLines={block.lines}
            position={[0, y, 0]}
          />
        );
      })}
    </XrPlate>
  );
}
