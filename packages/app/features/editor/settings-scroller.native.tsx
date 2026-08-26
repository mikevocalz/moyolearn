'use client';
// Gesture Handler's ScrollView, not React Native's: `blocksExternalGesture`
// can only block a handler RNGH knows about, and a plain RN scroller has none —
// which is why the drag lost every vertical gesture to it.
import { ScrollView } from 'react-native-gesture-handler';
import type { SettingsScrollerProps } from './settings-scroller.types.ts';

export function SettingsScroller({
  children,
  ref,
  style,
  showsVerticalScrollIndicator,
}: SettingsScrollerProps) {
  // Same cast as ReorderRow's `blocksExternalGesture(scrollRef as never)`: the
  // ref exists to be read as a handler tag, never as a typed instance.
  return (
    <ScrollView
      ref={ref as never}
      style={style as never}
      showsVerticalScrollIndicator={showsVerticalScrollIndicator}
    >
      {children}
    </ScrollView>
  );
}
