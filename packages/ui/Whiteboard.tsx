'use client';
// Whiteboard — the drawing surface plus the controls that drive it, sized to
// the age band and to the space it was actually given.
//
// WHY IT EXISTS: doc 23 §5's second column is "LearningCanvas (equation /
// whiteboard)", and until now `LearningCanvas` was a bordered box with nothing
// inside it — `docs/design/reset/00-repo-baseline.md:34` calls that out and says
// to build the renderer INSIDE it rather than beside it. This is that renderer,
// mounted where the doc puts it, so the `Manipulative` backlog entry does not
// become a rival component.
//
// THE ROW MEASURES ITSELF, NOT THE WINDOW — the same decision `Composer` made
// for the same reason, and this file follows that idiom rather than inventing a
// second one. The window is the wrong ruler here twice over: the board renders
// both inside a ~300dp work pane in the three-pane session AND full-width when
// a phone opens it, at identical window widths; and the pane is resizable, so
// its width changes with a drag that the window never sees.
//
// Mobbin: https://mobbin.com/screens/abec2826-f574-4cbd-b6d9-a8d5e3210394
// (Claude — conversation left, sketch pane right, the board's own controls as a
// tray floating on the canvas rather than as page chrome) ·
// https://mobbin.com/screens/bffbe166-34a2-49ae-8f1d-587a518b3d03 (Freeform) ·
// https://mobbin.com/screens/fc331c59-afb1-410b-b70a-35d2c48d3eeb (Craft — the
// tray sits at the BOTTOM so the paper stays under the hand, and undo/redo live
// away from the pens) · https://mobbin.com/screens/4021c94f-160e-4295-a368-5f97fa78b9fa
// (Brave — the narrow form: tools stay out, everything else folds). Structure only.
// SOT: docs/pack/23-tutorstage-handoff.md §5 · docs/design/reset/00-repo-baseline.md:34
// SOT-KEYWORDS: whiteboard learning canvas drawing board controls responsive pane compact expanded age band

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { targets } from '@acme/theme';
import { Button } from './Button';
import { LearningCanvas } from './LearningCanvas';
import { AnimatePresence, MotionView, useReducedMotion } from './motion';
import { Brush, Eraser, Highlighter, Sparkles, Trash2, Undo2 } from './icons';
import { View, Pressable, Text } from './primitives';
import { WhiteboardBoard } from './whiteboard-board';
import type {
  WhiteboardHandle,
  WhiteboardInk,
  WhiteboardSnapshot,
  WhiteboardTool,
} from './whiteboard.types.ts';

export type { WhiteboardHandle, WhiteboardInk, WhiteboardSnapshot, WhiteboardTool };

export interface WhiteboardProps {
  /** A board the learner already started. Read once, at mount. */
  snapshot?: WhiteboardSnapshot;
  /**
   * Touch target comes from the age band, never a hardcoded size (CLAUDE.md
   * §UI). `buttonSizeForBand` produces it; a K–2 learner gets 72dp keys here
   * exactly as they do on the composer.
   */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Hand the board to the tutor. Receives the PNG data URL, or `null` when
   * there is nothing drawn — the caller says so in words rather than sending
   * the tutor a picture of blank paper.
   *
   * Omit it and the action is not drawn at all: an unwired affordance is
   * invisible here for the reason the composer already gives — a child who
   * presses something and gets nothing learns the app is broken.
   */
  onAsk?: (png: string | null) => void;
  /** True while the tutor is being asked, so the action can say so. */
  asking?: boolean;
  /** Fires on the learner's first mark, and on every one after it. */
  onLearnerEdit?: () => void;
  className?: string;
}

/**
 * Below this width the row folds. Derived rather than pinned, because the
 * threshold is a function of the band: five keys at the band's own target, the
 * gaps between them, and the labelled action they have to share the row with.
 *
 * `ASK_LABEL_DP` is "Ask Natalie" set at `text-body` with the button's own
 * padding and icon — rounded up, so the label never ends up one character from
 * clipping.
 *
 * WHERE THAT PUTS EACH SURFACE, measured rather than reasoned about: the tray
 * in the work pane is 254dp at a 1280px window (`pane-supplementary` is 21rem,
 * and the pane's inset and the divider take the rest). The threshold is 450 at
 * the adult band and 510 at K–2, so THE PANE ALWAYS FOLDS, at every band. The
 * full row belongs to the sheet on a tablet and to a landscape phone.
 *
 * That is the intended answer rather than a miss — a 254dp column is not a
 * place to spell out an action, and the folded row loses no capability. It is
 * also why the row wraps as well as folds: at K–2 even the folded five keys
 * come to 360dp, which is wider than the column, and wrapping is what keeps the
 * ask on screen instead of clipped off the trailing edge.
 */
const ASK_LABEL_DP = 150;
/*
  The HOT dial's values, because this surface is hot (`Dial temperature="hot"`
  wraps the whole session): `gap-element` is 0.75rem and `px-inset-tight` is
  1rem a side. Measured in the browser rather than assumed — the first pass had
  8 and 16 here, the cool-dial numbers, and understated the threshold by 64dp.
*/
const GAP_DP = 12;
const ROW_PADDING_DP = 32;
/*
  Pen, highlighter, eraser, colour, undo, clear — the ask is counted separately
  because at this width it carries a label rather than a key.
*/
const KEYS_IN_FULL_ROW = 6;

const TARGET_DP: Record<NonNullable<WhiteboardProps['size']>, number> = {
  sm: Number.parseInt(targets.adult, 10),
  md: Number.parseInt(targets.adult, 10),
  lg: Number.parseInt(targets.teen, 10),
  xl: Number.parseInt(targets.child, 10),
};

const TOOL_KEY: Record<NonNullable<WhiteboardProps['size']>, string> = {
  sm: 'min-h-target-adult min-w-target-adult',
  md: 'min-h-target-adult min-w-target-adult',
  lg: 'min-h-target-teen min-w-target-teen',
  xl: 'min-h-target-child min-w-target-child',
};

const TOOLS: readonly { id: WhiteboardTool; label: string; Icon: typeof Brush }[] = [
  { id: 'draw', label: 'Pen', Icon: Brush },
  { id: 'highlight', label: 'Highlighter', Icon: Highlighter },
  { id: 'eraser', label: 'Eraser', Icon: Eraser },
];

/**
 * The pens, named the way a child names them.
 *
 * Six of Quickdraw's twelve. Enough that choosing one is a choice — a default
 * to work in, a red to correct in, a green that reads as "this bit is right" —
 * and few enough that picking a colour is not a detour from the problem.
 *
 * `swatch` is a token whose value is the engine's own stroke hex, so the dot on
 * the control is the colour the pen actually draws (see the `board-*` block in
 * tokens.ts). `id` is the vendor's `ColorId` and travels straight to
 * `setStyle('color', …)`.
 */
const INKS = [
  { id: 'black', label: 'Black', swatch: 'bg-board-black' },
  { id: 'blue', label: 'Blue', swatch: 'bg-board-blue' },
  { id: 'red', label: 'Red', swatch: 'bg-board-red' },
  { id: 'green', label: 'Green', swatch: 'bg-board-green' },
  { id: 'orange', label: 'Orange', swatch: 'bg-board-orange' },
  { id: 'violet', label: 'Purple', swatch: 'bg-board-violet' },
] as const satisfies readonly { id: WhiteboardInk; label: string; swatch: string }[];

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(
  { snapshot, size = 'md', onAsk, asking = false, onLearnerEdit, className },
  ref,
) {
  const board = useRef<WhiteboardHandle>(null);
  const [tool, setTool] = useState<WhiteboardTool>('draw');
  const [ink, setInk] = useState<WhiteboardInk>('black');
  /*
    Whether the learner has made a mark, and it is the only thing gating the
    ask. NOT derived from a snapshot count: the native fork's handle is an async
    bridge with no synchronous view of the document, and a control whose enabled
    state waits on a round trip flickers.

    It stays true after an erase-everything, which is deliberate — `exportPng`
    answers `null` for an empty board and `handleAsk` says so. Two mechanisms
    because they answer different questions: "has this child started" (a
    control's state) and "is there anything on the paper right now" (a fact only
    the engine knows).
  */
  const [pickingInk, setPickingInk] = useState(false);
  const [hasMarks, setHasMarks] = useState(false);
  const [emptyNotice, setEmptyNotice] = useState(false);

  useImperativeHandle(ref, () => ({
    exportPng: async () => (await board.current?.exportPng()) ?? null,
    getSnapshot: async () => (await board.current?.getSnapshot()) ?? null,
    setTool: (next) => {
      setTool(next);
      board.current?.setTool(next);
    },
    setInk: (next) => {
      setInk(next);
      board.current?.setInk(next);
    },
    undo: () => board.current?.undo(),
    clear: () => board.current?.clear(),
  }));

  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const measureRow = useCallback((event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  }, []);

  const target = TARGET_DP[size];
  const fullRowDp =
    KEYS_IN_FULL_ROW * target + (KEYS_IN_FULL_ROW - 1) * GAP_DP + ASK_LABEL_DP + ROW_PADDING_DP;
  /*
    `null` until the first layout, and the wide form is what renders in the
    meantime — the same first-paint choice `Composer` documents, because the
    wide form is the one that never hides a capability.
  */
  const compact = rowWidth !== null && rowWidth < fullRowDp;

  const chooseTool = useCallback((next: WhiteboardTool) => {
    setTool(next);
    board.current?.setTool(next);
  }, []);

  /*
    Choosing a colour also picks the pen back up. A child who has just erased
    something and then reaches for red means "write in red" — leaving them on
    the eraser would have them wipe the board with a colour selected, which is
    the kind of dead press that teaches a child the app is broken. The eraser
    has no colour of its own, so there is nothing to lose by leaving it.
  */
  const chooseInk = useCallback(
    (next: WhiteboardInk) => {
      setInk(next);
      board.current?.setInk(next);
      setPickingInk(false);
      if (tool === 'eraser') chooseTool('draw');
    },
    [tool, chooseTool],
  );

  const undo = useCallback(() => {
    setEmptyNotice(false);
    board.current?.undo();
  }, []);

  /*
    Clear runs without a confirm, and that is the undo working, not a corner
    cut: Quickdraw empties the board in ONE undoable step, so the way back is
    the key already sitting next to it. A modal between a child and their own
    scratch paper is friction that teaches them not to use the paper.
  */
  const clear = useCallback(() => {
    setEmptyNotice(false);
    board.current?.clear();
  }, []);

  const handleAsk = useCallback(async () => {
    const png = (await board.current?.exportPng()) ?? null;
    setEmptyNotice(png === null);
    onAsk?.(png);
  }, [onAsk]);

  const handleEdit = useCallback(() => {
    setHasMarks(true);
    setEmptyNotice(false);
    onLearnerEdit?.();
  }, [onLearnerEdit]);

  const key = TOOL_KEY[size];
  const askLabel = 'Ask Natalie';
  /*
    Reduce Motion is a RENDER MODE here, not a shorter duration — the same rule
    the responsive spec §4 states for the avatar. Off, the strip appears and
    disappears with no transform at all rather than a fast one, because a
    vestibular-sensitive learner asked for no movement, not less of it.
  */
  const animated = !useReducedMotion();
  // `black` is in the roster, so this never falls through; the `??` is here
  // because an index signature cannot say so and a crash in a control row is
  // not a thing to leave to a `!`.
  const currentInk = INKS.find((entry) => entry.id === ink) ?? INKS[0];

  return (
    <View className={`flex-1 gap-stack ${className ?? ''}`}>
      {/*
        The board takes the room. `LearningCanvas` is the bordered sheet doc 23
        §5 names, and this is the first thing ever mounted inside it — its own
        `flex-1` is what gives the engine a box to size its canvas against.
      */}
      <LearningCanvas padded={false}>
        <WhiteboardBoard ref={board} snapshot={snapshot} onLearnerEdit={handleEdit} />
      </LearningCanvas>

      {/*
        THE SWATCH STRIP, and it is only here while it is being used.

        Above the tray rather than below it, because the tray is already against
        the bottom of the column — the same constraint that ruled out a dropdown.
        Six chips at the age band's target, so a K–2 learner's colours are as
        pressable as their pens.
      */}
      <AnimatePresence>
        {pickingInk ? (
        <MotionView
          key="swatches"
          role="radiogroup"
          aria-label="Pen colour"
          /*
            IT COMES OUT OF THE TRAY AND GOES BACK INTO IT.

            `y: 8` is the whole idea: the strip starts a few dp DOWN, behind the
            tray it was opened from, and rises into place — so the movement says
            where the colours came from instead of announcing a new panel. Scale
            carries the rest; height is never animated, because a JS-driven
            layout property would drop frames on the same device the board is
            being drawn on.

            `AnimatePresence` is what buys the EXIT. Mounted on a boolean the
            strip vanished in one frame, which reads as the app losing it rather
            than the child closing it — the same asymmetry `MotionView` fixes for
            Natalie's pane in `TutorStage`.

            One spring, low overshoot: this is a control surface a child is about
            to press, and a strip still settling under a finger is a mis-tap.
          */
          initial={animated ? { opacity: 0, scale: 0.96, y: 8 } : undefined}
          animate={animated ? { opacity: 1, scale: 1, y: 0 } : undefined}
          exit={animated ? { opacity: 0, scale: 0.96, y: 8 } : undefined}
          transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          className="flex-row flex-wrap items-center justify-center gap-element rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field"
        >
          {INKS.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => chooseInk(entry.id)}
              aria-label={entry.label}
              role="radio"
              aria-checked={ink === entry.id}
              className={`${key} items-center justify-center rounded-control ${
                ink === entry.id ? 'bg-surface-sunken' : ''
              }`}
            >
              {/*
                The chip carries the selection, not a tick: a check mark on a
                colour hides the colour it is about. Selected is the same dot,
                grown and ringed harder, and the growth is animated so the
                choice lands as a movement the eye follows rather than a
                repaint it has to spot.
              */}
              <MotionView
                animate={animated ? { scale: ink === entry.id ? 1.15 : 1 } : undefined}
                transition={{ type: 'spring', damping: 20, stiffness: 320 }}
                className={`h-7 w-7 rounded-full ${
                  ink === entry.id ? 'border-[3px]' : 'border-2'
                } border-strong ${entry.swatch}`}
              />
            </Pressable>
          ))}
        </MotionView>
        ) : null}
      </AnimatePresence>

      {/*
        THE TRAY SITS UNDER THE PAPER. Craft, Freeform and Apple's own markup
        all put it there, and the reason is the hand: controls above the canvas
        are the ones a right-handed child covers while writing.
      */}
      <View
        onLayout={measureRow}
        /*
          WRAPS AS WELL AS FOLDS, and it needs both. Folding is the width
          decision — undo and clear go behind one key — and it is enough at the
          adult band, where even the folded row is four 44dp keys. It is NOT
          enough at K–2: four 72dp keys plus their gaps is 312dp against a
          336dp pane minus its inset, so the last one would have been clipped
          off the trailing edge. Wrapping is what stops a big-target learner
          losing the control the whole surface exists for; `justify-between`
          keeps the pens and the actions apart on the line while they share one.
        */
        className="flex-row flex-wrap items-center justify-between gap-element rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field"
      >
        {/*
          THREE GROUPS, THREE WEIGHTS — not one row of identical squares.

          The first pass drew five keys of the same size, shape and border, and
          a tray where every control looks equally important has no hierarchy at
          all: a child scanning it has to read five icons to find the one that
          sends their work. What is here instead reads at squint distance —
          a segmented block of pens, a round colour well among the squares, two
          quiet ghosts, and one loud action.

          The pens never fold. They are what the surface IS; a board whose
          drawing tools are behind a menu is a menu, not a board. What folds is
          the pair that only matter after something has gone wrong.
        */}
        <View className="flex-row items-center gap-element">
        {/* One segmented block, three positions — a single control with a
            selected state, not three buttons that happen to be adjacent. */}
        <View
          role="radiogroup"
          aria-label="Drawing tool"
          className="flex-row items-center overflow-hidden rounded-control border-2 border-strong bg-surface"
        >
        {TOOLS.map(({ id, label, Icon }) => (
          <Pressable
            key={id}
            onPress={() => chooseTool(id)}
            aria-label={label}
            role="radio"
            aria-checked={tool === id}
            /*
              SELECTED IS INVERTED INK, NOT THE ACCENT. It was `bg-highlighter`,
              which put a teal tile next to the yellow ask — two accents in one
              tray on a screen whose rule is one (CLAUDE.md §UI), and it dressed
              a MODE as the primary action. `TutorStage` makes the same call
              about Natalie's mark: the highlighter treatment belongs to the
              thing you press to make something happen. A pressed key is the
              page's own ink turned inside out.
            */
            className={`${key} items-center justify-center ${
              tool === id ? 'bg-text' : ''
            }`}
          >
            <Icon size={20} className={tool === id ? 'text-surface' : 'text-text'} />
          </Pressable>
        ))}
        </View>

        {/*
          THE COLOUR WELL — round, because it is the one control here that is
          not a mode or an action but a SAMPLE, and a circle of ink among square
          keys says that without a label. It shows what the pen will draw, which
          is the only honest way to offer a colour; a palette icon would make a
          child open it to find out.

          IT IS NOT A DROPDOWN, and that was measured rather than preferred. The
          tray sits at the BOTTOM of its column, so a menu panel anchored under
          its trigger opened straight off the bottom edge of the pane — the
          colours were there and unreachable. An inline strip grows upward into
          the tray's own wrap, inside the same box, with nothing to clip it.

          Swatches rather than the six colour NAMES a menu would have listed:
          the user's words were "controls on whiteboard has no colors", and a
          list that says "Red" is still a list about colour rather than colour.
        */}
        <Pressable
          onPress={() => setPickingInk((open) => !open)}
          aria-label={`Pen colour: ${currentInk.label}`}
          aria-expanded={pickingInk}
          className={`${key} items-center justify-center rounded-control ${
            pickingInk ? 'border-2 border-strong bg-surface-sunken' : ''
          }`}
        >
          {/* `key` on the ink, so the dot RE-ENTERS when the colour changes —
              a plain style swap is a repaint the eye does not register, and
              this control's whole job is to report which pen is in hand. */}
          <MotionView
            key={currentInk.id}
            initial={animated ? { scale: 0.7 } : undefined}
            animate={animated ? { scale: 1 } : undefined}
            transition={{ type: 'spring', damping: 16, stiffness: 340 }}
            className={`h-7 w-7 rounded-full border-2 border-strong ${currentInk.swatch}`}
          />
        </Pressable>
        </View>

        {/* Fix-it and ask travel together: they are the two things you reach
            for when you have STOPPED drawing, so they wrap as one group rather
            than leaving the ask stranded on a line of its own. */}
        <View className="flex-row items-center gap-element">
        {/*
          DIRECT KEYS AT EVERY WIDTH. They used to fold into a `⋯` menu in the
          pane, and the pane is where the board actually lives — so the two
          controls a child reaches for after a mistake were the two that were
          hardest to reach, behind a dropdown that opened off the bottom of the
          column. Two keys wrap onto the tray's second line instead, which the
          row is already built to do, and every control on this surface is one
          press.

          Quieter ink than the pens: they are what you press when you have
          STOPPED drawing, and a tray where everything shouts has no hierarchy.
        */}
        <Pressable
          onPress={undo}
          aria-label="Undo"
          className={`${key} items-center justify-center rounded-control`}
        >
          <Undo2 size={20} className="text-text-muted" />
        </Pressable>
        <Pressable
          onPress={clear}
          aria-label="Clear the board"
          className={`${key} items-center justify-center rounded-control`}
        >
          <Trash2 size={20} className="text-text-muted" />
        </Pressable>

        {onAsk ? (
          compact ? (
            <Pressable
              onPress={handleAsk}
              disabled={!hasMarks || asking}
              aria-label={askLabel}
              aria-disabled={!hasMarks || asking}
              className={`${key} items-center justify-center rounded-control border-2 border-strong bg-primary shadow-card ${
                !hasMarks || asking ? 'opacity-50' : ''
              }`}
            >
              <Sparkles size={20} className="text-on-primary" />
            </Pressable>
          ) : (
            <Button
              title={asking ? 'Asking…' : askLabel}
              variant="highlighter"
              size={size}
              disabled={!hasMarks || asking}
              onPress={handleAsk}
              aria-label={askLabel}
            />
          )
        ) : null}
        </View>
      </View>

      {/*
        The one thing the board can be honest about that the control cannot: a
        child who drew, erased it all, and pressed ask. `hasMarks` is still
        true — they DID start — so the key is live and this says why nothing
        went. Cleared by the next mark.
      */}
      {emptyNotice ? (
        <Text className="font-sans text-caption text-text-muted" role="status">
          There&apos;s nothing on the board yet — write your working and ask again.
        </Text>
      ) : null}
    </View>
  );
});
