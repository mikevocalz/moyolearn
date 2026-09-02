'use client';
/**
 * PLATFORM FORK — native: ReorderRow's long-press pan generalized to two axes.
 *
 * The seam, kept exactly (A-repo-audit · J §4):
 *  - the HANDLE owns the gesture, not the card — the card face stays tappable;
 *  - the drag drives Reanimated shared values on the UI thread; nothing is
 *    written per frame;
 *  - the move commits ONCE on release: the raw translation crosses to JS in a
 *    single `runOnJS`, `resolveDrop` turns it into (column, index), and
 *    `onMove` fires — or nothing does, when the card lands where it started;
 *  - haptics on lift, exactly as ReorderRow.
 *
 * Layout is one column per horizontal PAGE (paged scroll): the pager's page
 * width doubles as the column pitch, so dragging past half a page commits the
 * card one column over — the 2-D analogue of ReorderRow's half-row threshold.
 * Both scrollers are Gesture Handler's, because `blocksExternalGesture` can
 * only block a handler RNGH knows about (the settings-scroller lesson).
 *
 * Known trade, on purpose: a cross-column drop resolves the index against the
 * destination's unscrolled card stack — the destination page is off screen
 * mid-drag, so its scroll offset cannot participate. The clamp keeps the drop
 * legal; a finer position is one more in-column drag away.
 *
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4 · packages/app/features/editor/reorder-row.native.tsx
 * SOT-KEYWORDS: stage board native kanban long press pan reanimated pager single commit
 */
import { createRef, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Gesture, GestureDetector, ScrollView as GestureScrollView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { View } from '../tw';
import { haptics } from '../haptics';
import { GripVertical } from '../icons';
import { useReducedMotion } from '../motion';
import { resolveDrop } from './geometry';
import { droppedAnnouncement } from './announcements';
import {
  CARD_HANDLE_CLASS,
  CARD_SHELL_CLASS,
  StageBoardLiveRegion,
  StageColumnFrame,
} from './StageColumn';
import type { StageBoardCard, StageBoardProps } from './types';

/** Long-press before the pan wins, so a flick over a card still pages/scrolls. */
const LIFT_MS = 180;
/** Snap-home travel time; zero under Reduce Motion so the settle is a cut. */
const SETTLE_MS = 140;

interface NativeStageCardProps {
  label: string;
  top: number;
  cardPitch: number;
  reduceMotion: boolean;
  pagerRef: RefObject<null>;
  columnScrollRef: RefObject<null>;
  /** Receives the total release translation, exactly once. */
  onDrop: (dx: number, dy: number) => void;
  children: ReactNode;
}

function NativeStageCard({
  label,
  top,
  cardPitch,
  reduceMotion,
  pagerRef,
  columnScrollRef,
  onDrop,
  children,
}: NativeStageCardProps) {
  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const lifted = useSharedValue(false);

  // Memoised: Gesture Handler v2 re-attaches the recogniser whenever the
  // gesture object identity changes, and an un-memoised pan tears itself down
  // mid-drag (the EventDrag lesson).
  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activateAfterLongPress(LIFT_MS)
        // Both scroll ancestors must be blocked once the drag activates, or
        // the pager claims every horizontal move and the column scroller every
        // vertical one — the same cast ReorderRow documents: the refs exist to
        // be read as handler tags, never as typed instances.
        .blocksExternalGesture(pagerRef as never, columnScrollRef as never)
        .onStart(() => {
          lifted.value = true;
          runOnJS(haptics.selection)();
        })
        .onUpdate((event) => {
          // Follow the finger continuously; the snap belongs on release.
          offsetX.value = event.translationX;
          offsetY.value = event.translationY;
        })
        .onEnd(() => {
          const dx = offsetX.value;
          const dy = offsetY.value;
          lifted.value = false;
          // Snap home first; the board re-renders in the new order underneath.
          offsetX.value = withTiming(0, { duration: reduceMotion ? 0 : SETTLE_MS });
          offsetY.value = withTiming(0, { duration: reduceMotion ? 0 : SETTLE_MS });
          runOnJS(onDrop)(dx, dy);
        }),
    [pagerRef, columnScrollRef, reduceMotion, onDrop, offsetX, offsetY, lifted],
  );

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
    // Lifting above the neighbours is what makes the drag legible.
    zIndex: lifted.value ? 10 : 0,
    opacity: lifted.value ? 0.95 : 1,
  }));

  return (
    <Animated.View
      style={[style, { position: 'absolute', top, left: 0, right: 0, height: cardPitch }]}
    >
      <View className={CARD_SHELL_CLASS}>
        <GestureDetector gesture={pan}>
          <View aria-label={`Move ${label}`} className={CARD_HANDLE_CLASS}>
            <GripVertical size={18} className="text-text-muted" />
          </View>
        </GestureDetector>
        <View className="flex-1">{children}</View>
      </View>
    </Animated.View>
  );
}

export function StageBoard<T extends StageBoardCard = StageBoardCard>({
  columns,
  cards,
  renderCard,
  onMove,
  cardPitch,
  density = 'cool',
  className,
}: StageBoardProps<T>) {
  const [boardWidth, setBoardWidth] = useState(0);
  const [announced, setAnnounced] = useState('');
  const reduceMotion = useReducedMotion();

  const pagerRef = useRef(null);
  // Per-column scroller refs, keyed by id. Built in useMemo rather than held
  // in a ref-of-refs: the map is only ever handed to Gesture Handler as
  // handler tags, and a render-time `.current` read is what the refs lint
  // rightly rejects.
  const columnScrollRefs = useMemo(
    () => new Map<string, RefObject<null>>(columns.map((column) => [column.id, createRef()])),
    [columns],
  );
  const scrollRefFor = (id: string): RefObject<null> => columnScrollRefs.get(id) ?? createRef();

  const columnCards = useMemo(() => {
    const byColumn = new Map<string, T[]>(columns.map((column) => [column.id, []]));
    for (const card of cards) byColumn.get(card.columnId)?.push(card);
    return columns.map((column) => byColumn.get(column.id) ?? []);
  }, [columns, cards]);
  const columnLengths = columnCards.map((list) => list.length);

  const dropCard = (card: T, fromColumn: number, fromIndex: number, dx: number, dy: number) => {
    const target = resolveDrop({
      fromColumn,
      fromIndex,
      dx,
      dy,
      // One column per page makes the page width the column pitch.
      columnPitch: boardWidth,
      cardPitch,
      columnLengths,
    });
    if (target.column === fromColumn && target.index === fromIndex) return;
    const from = columns[fromColumn];
    const to = columns[target.column];
    if (!from || !to) return;
    onMove(card.id, from.id, to.id, target.index);
    setAnnounced(droppedAnnouncement(card.label, to.title, target.index + 1));
  };

  return (
    <View
      onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setBoardWidth((prev) => (prev === next ? prev : next));
      }}
      className={`flex-1${className ? ` ${className}` : ''}`}
    >
      {/* Pages need a measured width; the first frame renders nothing rather
          than a mis-paged guess. */}
      {boardWidth > 0 ? (
        <GestureScrollView
          ref={pagerRef as never}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
        >
          {columns.map((column, columnIndex) => {
            const list = columnCards[columnIndex] ?? [];
            return (
              <View key={column.id} style={{ width: boardWidth }} className="p-inset-tight">
                <StageColumnFrame
                  title={column.title}
                  tone={column.tone}
                  count={column.count ?? list.length}
                  density={density}
                >
                  <GestureScrollView
                    ref={scrollRefFor(column.id) as never}
                    showsVerticalScrollIndicator={false}
                  >
                    {/* Fixed-pitch stack (the ReorderRow layout): one pitch of
                        height even when empty, so an empty stage still reads
                        as a lane a card can land in. */}
                    <View style={{ height: Math.max(list.length, 1) * cardPitch }}>
                      {list.map((card, index) => (
                        <NativeStageCard
                          key={card.id}
                          label={card.label}
                          top={index * cardPitch}
                          cardPitch={cardPitch}
                          reduceMotion={reduceMotion}
                          pagerRef={pagerRef}
                          columnScrollRef={scrollRefFor(column.id)}
                          onDrop={(dx, dy) => dropCard(card, columnIndex, index, dx, dy)}
                        >
                          {renderCard(card)}
                        </NativeStageCard>
                      ))}
                    </View>
                  </GestureScrollView>
                </StageColumnFrame>
              </View>
            );
          })}
        </GestureScrollView>
      ) : null}
      <StageBoardLiveRegion message={announced} />
    </View>
  );
}
