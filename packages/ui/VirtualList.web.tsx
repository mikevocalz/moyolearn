'use client';
/**
 * PLATFORM FORK — virtualized list on web via @tanstack/react-virtual.
 * The scroll container is a real overflow div (behavioral, like ScrollView);
 * give it a height via className (e.g. "h-96").
 */
import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

export interface VirtualListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  /** Estimated row height in px (rows self-measure after mount). */
  estimatedItemSize?: number;
  /** Scroll container classes — must size the container (e.g. "h-96"). */
  className?: string;
  onEndReached?: () => void;
  /** Default true, matching the platform. */
  showsVerticalScrollIndicator?: boolean;
  /** Start at the bottom and stay there — a chat, not a document. */
  atBottom?: boolean;
  /** Extra room under the last row, in px. */
  bottomInset?: number;
}

export function VirtualList<T>({
  data,
  renderItem,
  keyExtractor,
  estimatedItemSize = 56,
  className,
  onEndReached,
  /* Off by default, matching the native fork: the scrollbar is chrome the
     content already implies, and a list that shows one on web but not on the
     phone is two products. Opt in where position genuinely needs reporting. */
  showsVerticalScrollIndicator = false,
  atBottom = false,
  bottomInset = 0,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const endFiredAt = useRef(-1);
  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer returns unmemoizable functions; React Compiler skipping is expected here.
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    /*
      MEASUREMENTS FOLLOW THE ITEM, NOT ITS POSITION.

      Without this the virtualizer caches self-measured heights against the
      INDEX, which is correct only for a list that grows at the end. The tutor
      thread does not: resuming a session replaces the whole array at once, so
      index 2 stops being the short text bubble it measured and becomes a tall
      one carrying an audio player. The old height is then applied to the new
      row and every row after it is laid out at the wrong offset — bubbles drew
      on top of each other.

      `keyExtractor` was already being passed for React's benefit and the
      virtualizer was never told about it, so the two disagreed about what a row
      was. This is a kit-wide fix: any list whose data is replaced rather than
      appended to had the same bug waiting.
    */
    getItemKey: keyExtractor
      ? (index) => {
          const item = data[index];
          return item === undefined ? index : keyExtractor(item, index);
        }
      : undefined,
    overscan: 8,
  });
  const items = virtualizer.getVirtualItems();

  const lastVisible = items[items.length - 1]?.index ?? -1;
  useEffect(() => {
    if (!onEndReached) return;
    if (lastVisible >= data.length - 1 && endFiredAt.current !== data.length) {
      endFiredAt.current = data.length;
      onEndReached();
    }
  }, [lastVisible, data.length, onEndReached]);

  /*
    Follow the tail. A streaming turn appends to the last row, so scrolling on
    a length change alone would miss every frame of the sentence being written.

    IT ALSO HAS TO RE-PIN WHEN THE ROWS MEASURE. This ran on `data` alone and
    left the thread 1743 px above the bottom on a 7761 px conversation, every
    time. `useVirtualizer` starts every row at `estimatedItemSize` and remeasures
    after mount, so the total height GROWS after the scroll has been set — and a
    chat bubble is several times 56 px. The scroll was correct for the estimated
    height and stale for the real one. `getTotalSize()` is the value that
    changes when measurement lands, so it belongs in the dependencies.

    AND IT MUST NOT FIGHT A READER. `TutorThread` took auto-follow out entirely
    because pinning on every frame of a streaming turn made it impossible to
    scroll back — which is exactly when a child wants to re-read what she said.
    Following only while they are ALREADY near the bottom is what the native
    fork does (`maintainScrollAtEndThreshold`), and it keeps both: the newest
    turn stays in view, and scrolling up stops the list chasing you.
  */
  const totalSize = virtualizer.getTotalSize();
  const following = useRef(true);
  /*
    THE PIN MUST NOT BE MISTAKEN FOR THE READER SCROLLING.

    `onScroll` fires for a programmatic scroll exactly as it does for a finger,
    and rows are measuring while the pin happens. If one lands between the
    assignment and the event, the handler reads a height that has already grown,
    sees a large gap, and latches `following` off — permanently, because nothing
    scrolls back to clear it. Measured: the thread sat 2033 px above the bottom
    of a 5683 px conversation, while a manual scroll to the end then tracked
    4000 px of growth perfectly. The follow was never broken; this guard was
    switching it off.
  */
  const pinning = useRef(false);
  useEffect(() => {
    if (!atBottom) return;
    const element = parentRef.current;
    if (!element) return;
    if (!following.current) return;
    pinning.current = true;
    element.scrollTop = element.scrollHeight;
    const frame = requestAnimationFrame(() => {
      pinning.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [atBottom, data, totalSize]);

  return (
    <div
      ref={parentRef}
      onScroll={(event) => {
        /*
          A fifth of the viewport of slack, matching the native fork's 0.2.
          Tighter than that and the momentum tail of a flick reads as "scrolled
          away"; looser and a deliberate scroll back still gets yanked.
        */
        if (pinning.current) return;
        const element = event.currentTarget;
        const slack = element.clientHeight * 0.2;
        following.current = element.scrollHeight - element.clientHeight - element.scrollTop <= slack;
      }}
      className={`overflow-y-auto ${atBottom ? 'flex flex-col justify-end' : ''} ${className ?? ''}`}
      /*
        Geometry and platform affordance, not appearance — the same exception
        the transforms below take. There is no token for a scrollbar's presence
        and inventing a utility class for one would put a raw value in the
        theme; `scrollbarWidth` is the standard property and Firefox/Chromium
        both honour it.
      */
      style={showsVerticalScrollIndicator ? undefined : { scrollbarWidth: 'none' }}
    >
      {/*
        A chat opens at its newest message. `justify-end` is what pins a SHORT
        thread to the bottom — with a taller container than content, a document
        starts at the top and a conversation does not.
      */}
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
          paddingBottom: bottomInset || undefined,
          marginTop: atBottom ? 'auto' : undefined,
        }}
      >
        {items.map((vi) => {
          const item = data[vi.index] as T;
          return (
            <div
              key={keyExtractor?.(item, vi.index) ?? vi.key}
              data-index={vi.index}
              ref={virtualizer.measureElement}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vi.start}px)` }}
            >
              {renderItem({ item, index: vi.index })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
