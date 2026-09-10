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
  WhiteboardDiff,
  WhiteboardDiffSource,
  WhiteboardHandle,
  WhiteboardInk,
  WhiteboardSnapshot,
  WhiteboardTool,
} from './whiteboard.types.ts';

export type {
  WhiteboardDiff,
  WhiteboardDiffSource,
  WhiteboardHandle,
  WhiteboardInk,
  WhiteboardSnapshot,
  WhiteboardTool,
};

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
  /**
   * Every change, with its source. The screen folds these into the board's
   * document; the board itself keeps no history of its own.
   */
  onChange?: (diff: WhiteboardDiff, source: WhiteboardDiffSource) => void;
  /** The engine will accept work. Nothing sent before this arrives lands. */
  onReady?: () => void;
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

/**
 * Height only, for controls that take their width from a flex row. The band's
 * target is honoured in the dimension that is free; the other is bounded by the
 * column and clears the WCAG floor.
 */
/**
 * The keyboard ring, one constant for the whole tray.
 *
 * Every control here was keyboard-reachable and invisibly so — twelve
 * Pressables, no `focus-visible` on any of them, which is WCAG 2.1 SC 2.4.7
 * (AA) failing on a surface a child may drive entirely by tab. Copied verbatim
 * from `Button.tsx` rather than reinvented: a second focus treatment in the kit
 * is a second thing to keep in sync, and the ring colour is the one
 * `check-contrast.mjs` already gates.
 */
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-offset-2';

const TARGET_HEIGHT: Record<NonNullable<WhiteboardProps['size']>, string> = {
  sm: 'min-h-target-adult',
  md: 'min-h-target-adult',
  lg: 'min-h-target-teen',
  xl: 'min-h-target-child',
};

/**
 * The folded row's cell: the band's height, the WCAG floor's width.
 *
 * SEVEN CONTROLS DO NOT FIT AT THE BAND'S WIDTH, and no arrangement of them
 * makes them. Three pens, a colour, undo, clear and the ask at the 3–5 band's
 * 56dp are 392dp of keys against a tray that measures 356 in the work pane, so
 * the row wrapped onto a second line — and a second line of chrome under a
 * canvas is paid for in board.
 *
 * So the WIDTH gives and the height does not. 44dp is WCAG 2.2 SC 2.5.8's AA
 * floor and every band clears it; the finger still lands on 44×56, or 44×72 at
 * K–2, which is a larger target than the phone keyboard these children already
 * use. The same trade the swatch strip makes, for the same reason, stated in
 * the same place.
 */
const TARGET_FOLDED: Record<NonNullable<WhiteboardProps['size']>, string> = {
  sm: 'min-h-target-adult min-w-target-adult',
  md: 'min-h-target-adult min-w-target-adult',
  lg: 'min-h-target-teen min-w-target-adult',
  xl: 'min-h-target-child min-w-target-adult',
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
 * Seven of Quickdraw's twelve. Enough that choosing one is a choice — a default
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
  { id: 'yellow', label: 'Yellow', swatch: 'bg-board-yellow' },
  { id: 'orange', label: 'Orange', swatch: 'bg-board-orange' },
  { id: 'violet', label: 'Purple', swatch: 'bg-board-violet' },
] as const satisfies readonly { id: WhiteboardInk; label: string; swatch: string }[];

export const Whiteboard = forwardRef<WhiteboardHandle, WhiteboardProps>(function Whiteboard(
  { snapshot, size = 'md', onAsk, asking = false, onChange, onReady, className },
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
    applyDiff: (diff) => board.current?.applyDiff(diff),
    loadSnapshot: (next) => board.current?.loadSnapshot(next),
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

  /*
    `hasMarks` turns on for the LEARNER's hand only. A restored board and a
    collaborator's stroke both arrive as `remote`, and neither is this child
    having started — "Ask Natalie" asks about YOUR working, and a board that
    enabled it because a document loaded would be offering to send someone
    else's.
  */
  const handleChange = useCallback(
    (diff: WhiteboardDiff, source: WhiteboardDiffSource) => {
      if (source === 'user') {
        setHasMarks(true);
        setEmptyNotice(false);
      }
      onChange?.(diff, source);
    },
    [onChange],
  );

  /*
    The full row keeps square, band-sized keys; the folded one narrows them to
    the floor so all seven stay on one line. `compact` is the same measurement
    that drops the ask's label — one decision, read twice.
  */
  const key = compact ? TARGET_FOLDED[size] : TOOL_KEY[size];
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
      {/*
        `relative flex-1` around the sheet, so the swatch strip below can anchor
        to the BOARD's bottom edge rather than the component's — which would put
        it over the tray it was opened from.
      */}
      <View className="relative flex-1">
        <LearningCanvas padded={false}>
          <WhiteboardBoard
            ref={board}
            snapshot={snapshot}
            onChange={handleChange}
            onReady={onReady}
          />
        </LearningCanvas>

      {/*
        THE SWATCH STRIP FLOATS OVER THE PAPER. It used to sit in the column as
        a sibling, so opening it PUSHED THE BOARD UP — the canvas resized, the
        engine reflowed, and a child mid-problem watched their working jump. A
        control that moves the thing it is about to act on is the wrong control.

        Absolute, over the bottom of the board, above the tray it belongs to.
        This is also where Craft, Freeform and Apple's markup put theirs: the
        tray floats ON the canvas, it does not take a slice out of the layout.
      */}
      <AnimatePresence>
        {pickingInk ? (
        <MotionView
          key="swatches"
          role="radiogroup"
          aria-label="Pen color"
          /*
            ONE ROW, AND THE CHIPS FLEX TO FILL IT. Seven fixed keys at the K–2
            target come to 464dp against a 388dp pane, so a fixed size could only
            have wrapped or clipped. `flex-1` divides the row instead: every chip
            keeps the band's target as its HEIGHT and takes an equal share of the
            width — ~45dp in the work pane, which clears WCAG 2.2's 44 floor for
            every band. A trade made in one dimension, deliberately, to keep the
            colours readable as one palette rather than as a grid.

            NO GAP AND NO SIDE PADDING between them, which is what buys the
            width back: with `gap-element` and an inset the chips measured 34dp,
            under the WCAG 2.2 floor. Butted together they are ~51dp each and
            there are no dead strips between them either — a miss between two
            colours now picks one instead of nothing. The dots do the visual
            separating; the cells do not need to.

            `isolate` so the strip's own stacking is local, and `shadow-overlay`
            because it is a floating surface rather than a panel in the flow.
          */
          className="absolute inset-x-inset-tight bottom-inset-tight isolate flex-row items-center overflow-hidden rounded-control border-2 border-strong bg-surface-raised py-inset-field shadow-overlay"
          /*
            A SHORTER, FLATTER MOVE than the spring it replaces. The spring
            overshot and settled while a child was already reaching for a
            colour, which is what made it feel wrong — and half of that
            wrongness was the layout reflowing underneath it, which the overlay
            above has now removed. 140ms, ease-out, opacity and one small rise:
            entering motion decelerates and never bounces (craft R12).
          */
          initial={animated ? { opacity: 0, translateY: 6 } : undefined}
          animate={animated ? { opacity: 1, translateY: 0 } : undefined}
          exit={animated ? { opacity: 0, translateY: 6 } : undefined}
          transition={{ type: 'timing', duration: 140, easing: 'easeOut' }}
        >
          {INKS.map((entry) => (
            <Pressable
              key={entry.id}
              onPress={() => chooseInk(entry.id)}
              aria-label={entry.label}
              role="radio"
              aria-checked={ink === entry.id}
              // No fill on selection: `bg-surface-sunken` already means
              // "this disclosure is open" on the colour well below, and one
              // token carrying two meanings in one tray is how a tray stops
              // being readable. The ring is the cue, as the comment below says.
              className={`${TARGET_HEIGHT[size]} ${FOCUS} flex-1 items-center justify-center rounded-control`}
            >
              {/*
                The chip carries the selection, not a tick: a check mark on a
                colour hides the colour it is about. Selected is the same dot,
                ringed harder.
              */}
              <View
                className={`h-7 w-7 rounded-full ${
                  ink === entry.id ? 'border-4' : 'border-2'
                } border-strong ${entry.swatch}`}
              />
            </Pressable>
          ))}
        </MotionView>
        ) : null}
      </AnimatePresence>
      </View>

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
        /*
          `inset-hair` when folded — 4px, all round. The row had none on the
          sides at all, so the outermost key sat against the border; anything
          thicker is a key's worth of width in a tray that has exactly enough
          for seven. It does not move with the dial because nothing is being
          grouped by it.
        */
        className={`flex-row items-center justify-between rounded-control border-2 border-strong bg-surface-raised ${
          compact ? 'p-inset-hair' : 'flex-wrap gap-element px-inset-tight py-inset-field'
        }`}
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
        <View className={`flex-row items-center ${compact ? '' : 'gap-element'}`}>
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
            className={`${key} ${FOCUS} items-center justify-center ${
              tool === id ? 'bg-text' : ''
            }`}
          >
            {/*
              `text-inverse`, not `text-surface`: check-contrast.mjs gates the
              inverse/text pair in both schemes and does not gate surface/text,
              so the second is a contrast nobody is checking.
            */}
            <Icon size={20} className={tool === id ? 'text-inverse' : 'text-text'} />
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

          Swatches rather than the seven colour NAMES a menu would have listed:
          the user's words were "controls on whiteboard has no colors", and a
          list that says "Red" is still a list about colour rather than colour.
        */}
        <Pressable
          onPress={() => setPickingInk((open) => !open)}
          aria-label={`Pen color: ${currentInk.label}`}
          aria-expanded={pickingInk}
          className={`${key} ${FOCUS} items-center justify-center rounded-control ${
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
        <View className={`flex-row items-center ${compact ? '' : 'gap-element'}`}>
        {/*
          DIRECT KEYS AT EVERY WIDTH. They used to fold into a `⋯` menu in the
          pane, and the pane is where the board actually lives — so the two
          controls a child reaches for after a mistake were the two that were
          hardest to reach, behind a dropdown that opened off the bottom of the
          column. They are two more cells on the one row instead, and every
          control on this surface is one press.

          Quieter ink than the pens: they are what you press when you have
          STOPPED drawing, and a tray where everything shouts has no hierarchy.
        */}
        <Pressable
          onPress={undo}
          aria-label="Undo"
          className={`${key} ${FOCUS} items-center justify-center rounded-control`}
        >
          <Undo2 size={20} className="text-text-muted" />
        </Pressable>
        <Pressable
          onPress={clear}
          aria-label="Clear the board"
          className={`${key} ${FOCUS} items-center justify-center rounded-control`}
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
              /*
                A margin the other keys do not get, because this key carries
                something they do not: `shadow-card` is a 4px offset slab, so
                the shadow lands exactly ON the tray's 4px inset and the button
                reads as jammed against the border. The margin is the shadow's
                width — it gives the slab the room the border already gives
                everything flat.
              */
              /*
                THE SAME KEY AT BOTH WIDTHS. It used to be `bg-primary` with
                `opacity-50` when disabled, while the wide form is a
                `highlighter` Button — one action wearing two accents and two
                disabled treatments, decided by how much room the tray had.
                Button.tsx rejects opacity-alone by name: a 50%-opacity yellow
                key on a white sheet still looks like a yellow key, so a
                disabled ask invited a tap that did nothing and explained
                nothing. Dropping the shadow is what says "not yet" in this
                language, and the shadow is also the thing the margin above
                exists for.
              */
              className={`${key} ${FOCUS} mr-inset-hair items-center justify-center rounded-control border-2 ${
                !hasMarks || asking
                  ? 'border-border bg-surface-sunken shadow-none'
                  : 'border-strong bg-highlighter shadow-card'
              }`}
            >
              <Sparkles size={20} className={!hasMarks || asking ? 'text-text-muted' : 'text-on-highlighter'} />
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
          Write your work on the board, then ask again.
        </Text>
      ) : null}
    </View>
  );
});
