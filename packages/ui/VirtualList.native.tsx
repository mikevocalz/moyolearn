'use client';
/**
 * PLATFORM FORK — recycling list on native via @legendapp/list.
 */
import { LegendList } from '@legendapp/list/react-native';
import { View } from './primitives';

export interface VirtualListProps<T> {
  data: T[];
  renderItem: (info: { item: T; index: number }) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  /** Estimated row height in px. */
  estimatedItemSize?: number;
  /** Container classes — must size the container (e.g. "h-96" or "flex-1"). */
  className?: string;
  onEndReached?: () => void;
  /** Default true, matching the platform. */
  showsVerticalScrollIndicator?: boolean;
  /**
   * Start at the BOTTOM and stay there — a chat, not a document.
   *
   * LegendList's `alignItemsAtEnd` also pins a short thread to the bottom, so
   * a two-message conversation sits above the composer instead of floating at
   * the top of an empty column. `maintainScrollAtEnd` is what keeps a streaming
   * turn in view; `maintainVisibleContentPosition` stops older messages
   * jumping when one above the viewport grows.
   */
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
  /* Off by DEFAULT across the product. The bar is a desktop affordance: on
     touch it appears mid-scroll, overlays content at the trailing edge, and
     tells a child nothing they did not already learn from the content moving.
     A caller can still opt in where position genuinely needs reporting. */
  showsVerticalScrollIndicator = false,
  atBottom = false,
  bottomInset = 0,
}: VirtualListProps<T>) {
  return (
    <View className={className}>
      <LegendList
        data={data}
        renderItem={({ item, index }: { item: T; index: number }) => <>{renderItem({ item, index })}</>}
        keyExtractor={keyExtractor}
        estimatedItemSize={estimatedItemSize}
        onEndReached={onEndReached}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        /*
          ANDROID NEEDS TO BE TOLD. A scroll view nested inside another one gets
          no touches on Android unless it opts in — the inner list reports
          itself as scrollable, its content genuinely overflows, and a drag does
          nothing at all, which is the exact symptom the tutor thread showed on
          device while web (which has no such rule) scrolled correctly. iOS
          ignores the prop, so this is a one-line platform truth rather than a
          fork.
        */
        nestedScrollEnabled
        recycleItems
        alignItemsAtEnd={atBottom}
        maintainScrollAtEnd={atBottom}
        maintainScrollAtEndThreshold={0.2}
        maintainVisibleContentPosition={atBottom}
        contentContainerStyle={bottomInset > 0 ? { paddingBottom: bottomInset } : undefined}
        style={{ flex: 1 }}
      />
    </View>
  );
}
