'use client';
/**
 * PLATFORM FORK — web: pointer-based DnD plus a keyboard move, NO gesture libs.
 *
 * Same call as reorder-row.web / event-drag.web: react-native-gesture-handler
 * and Reanimated stay out of the Next bundle, which lists neither in
 * `transpilePackages` and has no GestureHandlerRootView. The drag here is raw
 * pointer events — window-level move/up listeners attached for the life of one
 * drag — and the ReorderRow commit discipline holds unchanged: nothing is
 * written per move, `onMove` fires once on release.
 *
 * Re-render budget, since the browser has no UI thread to hide on:
 *  - the followed-finger transform is state LOCAL to the dragged card; its
 *    `children` arrive as a prop, so the card face never re-renders mid-drag;
 *  - the board itself re-renders only when the pending drop target crosses a
 *    column/index boundary (guarded in the setState updater), which is what
 *    paints the drop-target highlight.
 *
 * Keyboard move (J §4: a drag-only board fails WCAG): the handle is a real
 * <button>. Enter/Space picks the card up, arrows walk the pending target
 * across columns and positions, Enter drops (the single commit), Escape
 * cancels — every step spoken through the polite live region.
 *
 * SOT: docs/design/overhaul-v2/J-component-plan.md §4 · packages/app/features/editor/reorder-row.web.tsx
 * SOT-KEYWORDS: stage board web kanban pointer drag keyboard move live region single commit
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { View, Pressable, ScrollView } from '../tw';
import { GripVertical } from '../icons';
import {
  maxIndexFor,
  resolveDrop,
  stepTarget,
  type DropTarget,
  type StepDirection,
} from './geometry';
import {
  canceledAnnouncement,
  droppedAnnouncement,
  overAnnouncement,
  pickedUpAnnouncement,
} from './announcements';
import {
  CARD_HANDLE_CLASS,
  CARD_SHELL_CLASS,
  StageBoardLiveRegion,
  StageColumnFrame,
} from './StageColumn';
import type { StageBoardCard, StageBoardProps } from './types';

/** Pointer travel before a press becomes a drag, so a click stays a click. */
const DRAG_SLOP = 6;

const KEY_DIRECTION: Record<string, StepDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

interface DragSession {
  cardId: string;
  label: string;
  fromColumn: number;
  fromIndex: number;
  toColumn: number;
  toIndex: number;
  mode: 'pointer' | 'keyboard';
}

interface WebStageCardProps {
  label: string;
  top: number;
  cardPitch: number;
  lifted: boolean;
  onLift: () => void;
  onDragMove: (dx: number, dy: number) => void;
  onDrop: (dx: number, dy: number) => void;
  onDragCancel: () => void;
  /** Returns true when the key was consumed, so the page doesn't also scroll. */
  onKey: (key: string) => boolean;
  children: ReactNode;
}

function WebStageCard({
  label,
  top,
  cardPitch,
  lifted,
  onLift,
  onDragMove,
  onDrop,
  onDragCancel,
  onKey,
  children,
}: WebStageCardProps) {
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const session = useRef<{
    startX: number;
    startY: number;
    active: boolean;
    detach: () => void;
  } | null>(null);

  // A drag orphaned by unmount (the optimistic write re-rendered the board)
  // must not leave window listeners behind.
  useEffect(() => () => session.current?.detach(), []);

  const beginPointer = (startX: number, startY: number) => {
    if (session.current) return;

    const move = (event: PointerEvent) => {
      const current = session.current;
      if (!current) return;
      const dx = event.clientX - current.startX;
      const dy = event.clientY - current.startY;
      if (!current.active) {
        if (Math.abs(dx) + Math.abs(dy) < DRAG_SLOP) return;
        current.active = true;
        onLift();
      }
      setOffset({ x: dx, y: dy });
      onDragMove(dx, dy);
    };

    const finish = (event: PointerEvent) => {
      const current = session.current;
      if (!current) return;
      current.detach();
      session.current = null;
      setOffset(null);
      if (current.active) onDrop(event.clientX - current.startX, event.clientY - current.startY);
    };

    const cancel = () => {
      const current = session.current;
      if (!current) return;
      current.detach();
      session.current = null;
      setOffset(null);
      if (current.active) onDragCancel();
    };

    const detach = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancel);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancel);
    session.current = { startX, startY, active: false, detach };
  };

  return (
    <View
      style={{
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height: cardPitch,
        transform: offset
          ? [{ translateX: offset.x }, { translateY: offset.y }]
          : undefined,
        zIndex: lifted ? 10 : 0,
        opacity: lifted ? 0.95 : 1,
      }}
    >
      <View className={CARD_SHELL_CLASS}>
        {/* The wrapper takes the pointer (ViewProps carries onPointerDown; the
            button inside bubbles to it); touchAction none keeps a touch
            pointer dragging instead of scrolling the column. */}
        <View
          onPointerDown={(event) =>
            beginPointer(event.nativeEvent.clientX, event.nativeEvent.clientY)
          }
          style={{ touchAction: 'none', userSelect: 'none' }}
        >
          <Pressable
            aria-label={`Move ${label}`}
            onKeyDown={(event) => {
              if (onKey(event.key)) event.preventDefault();
            }}
            className={`h-full ${CARD_HANDLE_CLASS}`}
          >
            <GripVertical size={18} className="text-text-muted" />
          </Pressable>
        </View>
        <View className="flex-1">{children}</View>
      </View>
    </View>
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
  const [drag, setDrag] = useState<DragSession | null>(null);
  const [announced, setAnnounced] = useState('');
  // Measured per column so the pitch is real layout, not a guessed constant;
  // read only on boundary checks and on release, never stored in state.
  const columnLayout = useRef<{ x: number; width: number }[]>([]);

  const columnCards = useMemo(() => {
    const byColumn = new Map<string, T[]>(columns.map((column) => [column.id, []]));
    for (const card of cards) byColumn.get(card.columnId)?.push(card);
    return columns.map((column) => byColumn.get(column.id) ?? []);
  }, [columns, cards]);
  const columnLengths = columnCards.map((list) => list.length);

  const columnPitch = () => {
    const [first, second] = columnLayout.current;
    if (first && second) return Math.max(1, second.x - first.x);
    return Math.max(1, first?.width ?? 1);
  };

  const commitTarget = (
    card: T,
    fromColumn: number,
    fromIndex: number,
    target: DropTarget,
  ) => {
    setDrag(null);
    const from = columns[fromColumn];
    const to = columns[target.column];
    if (!from || !to) return;
    if (target.column === fromColumn && target.index === fromIndex) {
      // Landed where it started: no write, but the release is still spoken.
      setAnnounced(droppedAnnouncement(card.label, from.title, fromIndex + 1));
      return;
    }
    onMove(card.id, from.id, to.id, target.index);
    setAnnounced(droppedAnnouncement(card.label, to.title, target.index + 1));
  };

  const liftPointer = (card: T, fromColumn: number, fromIndex: number) => {
    setDrag({
      cardId: card.id,
      label: card.label,
      fromColumn,
      fromIndex,
      toColumn: fromColumn,
      toIndex: fromIndex,
      mode: 'pointer',
    });
    setAnnounced(pickedUpAnnouncement(card.label, columns[fromColumn]?.title ?? ''));
  };

  const trackPointer = (dx: number, dy: number) => {
    setDrag((current) => {
      if (!current || current.mode !== 'pointer') return current;
      const target = resolveDrop({
        fromColumn: current.fromColumn,
        fromIndex: current.fromIndex,
        dx,
        dy,
        columnPitch: columnPitch(),
        cardPitch,
        columnLengths,
      });
      // Same reference back = React bails out: the board only re-renders when
      // the pending target actually crosses a boundary.
      if (target.column === current.toColumn && target.index === current.toIndex) return current;
      return { ...current, toColumn: target.column, toIndex: target.index };
    });
  };

  const dropPointer = (card: T, fromColumn: number, fromIndex: number, dx: number, dy: number) => {
    commitTarget(
      card,
      fromColumn,
      fromIndex,
      resolveDrop({
        fromColumn,
        fromIndex,
        dx,
        dy,
        columnPitch: columnPitch(),
        cardPitch,
        columnLengths,
      }),
    );
  };

  const cancelPointer = (card: T) => {
    setDrag(null);
    setAnnounced(canceledAnnouncement(card.label));
  };

  const keyAction = (card: T, columnIndex: number, index: number, key: string): boolean => {
    const grabbedHere = drag !== null && drag.mode === 'keyboard' && drag.cardId === card.id;
    if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
      if (drag === null) {
        setDrag({
          cardId: card.id,
          label: card.label,
          fromColumn: columnIndex,
          fromIndex: index,
          toColumn: columnIndex,
          toIndex: index,
          mode: 'keyboard',
        });
        setAnnounced(pickedUpAnnouncement(card.label, columns[columnIndex]?.title ?? ''));
        return true;
      }
      if (grabbedHere) {
        commitTarget(card, drag.fromColumn, drag.fromIndex, {
          column: drag.toColumn,
          index: drag.toIndex,
        });
        return true;
      }
      return false;
    }
    if (!grabbedHere || drag === null) return false;
    if (key === 'Escape') {
      setDrag(null);
      setAnnounced(canceledAnnouncement(card.label));
      return true;
    }
    const direction = KEY_DIRECTION[key];
    if (direction === undefined) return false;
    const next = stepTarget(
      { column: drag.toColumn, index: drag.toIndex },
      direction,
      drag.fromColumn,
      columnLengths,
    );
    setDrag({ ...drag, toColumn: next.column, toIndex: next.index });
    setAnnounced(
      overAnnouncement(
        card.label,
        columns[next.column]?.title ?? '',
        next.index + 1,
        maxIndexFor(next.column, drag.fromColumn, columnLengths) + 1,
      ),
    );
    return true;
  };

  return (
    <View className={`flex-1${className ? ` ${className}` : ''}`}>
      {/* Overflowing pipelines scroll sideways; each lane keeps its width. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-1"
        contentContainerClassName="flex-row items-stretch gap-group p-inset-tight"
      >
        {columns.map((column, columnIndex) => {
          const list = columnCards[columnIndex] ?? [];
          return (
            <View
              key={column.id}
              className="w-72 flex-none"
              onLayout={(event) => {
                columnLayout.current[columnIndex] = {
                  x: event.nativeEvent.layout.x,
                  width: event.nativeEvent.layout.width,
                };
              }}
            >
              <StageColumnFrame
                title={column.title}
                tone={column.tone}
                count={column.count ?? list.length}
                density={density}
                active={drag !== null && drag.toColumn === columnIndex}
              >
                {/* Fixed-pitch stack; one pitch even when empty, so an empty
                    stage still reads as a lane a card can land in. */}
                <View style={{ height: Math.max(list.length, 1) * cardPitch }}>
                  {list.map((card, index) => (
                    <WebStageCard
                      key={card.id}
                      label={card.label}
                      top={index * cardPitch}
                      cardPitch={cardPitch}
                      lifted={drag?.cardId === card.id}
                      onLift={() => liftPointer(card, columnIndex, index)}
                      onDragMove={trackPointer}
                      onDrop={(dx, dy) => dropPointer(card, columnIndex, index, dx, dy)}
                      onDragCancel={() => cancelPointer(card)}
                      onKey={(key) => keyAction(card, columnIndex, index, key)}
                    >
                      {renderCard(card)}
                    </WebStageCard>
                  ))}
                </View>
              </StageColumnFrame>
            </View>
          );
        })}
      </ScrollView>
      <StageBoardLiveRegion message={announced} />
    </View>
  );
}
