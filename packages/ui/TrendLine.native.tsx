'use client';
// PLATFORM FORK — the trend line on native, via react-native-graph.
//
// Doc 27 §2: react-native-graph is the scalpel, not the toolbox. Its whole
// install list (reanimated + gesture-handler + @shopify/react-native-skia) was
// already in this app, so it adds no native dependency, and it buys the one
// thing a hand-drawn path cannot — a 120fps Skia scrub gesture over the series.
// Bars, pies and real axes are NOT its job; those go to Victory Native.
// SOT: docs/pack/27-reporting-charts-spec.md §2
// SOT-KEYWORDS: trendline chart native skia react-native-graph scrub line
import { LineGraph } from 'react-native-graph';
import { Text, View } from './primitives';
import { isSuppressed } from './DataTable';
import type { TrendLineProps } from './TrendLine.types';

export function TrendLine({
  data,
  title,
  format = (v) => String(v),
  height = 160,
  className,
}: TrendLineProps) {
  /*
    react-native-graph takes one continuous series and has no concept of a hole,
    so suppressed points are DROPPED rather than zero-filled, and the count is
    reported underneath. Interpolating across them would draw a confident trend
    through data nobody is allowed to see (doc 27 §4).
  */
  const points = data
    .map((p, index) => ({ p, index }))
    .filter(({ p }) => !isSuppressed(p.value))
    .map(({ p, index }) => ({
      date: new Date(2026, 0, index + 1),
      value: (p.value as { value: number }).value,
    }));

  const suppressedCount = data.length - points.length;
  const lastValue = points[points.length - 1]?.value ?? null;

  return (
    <View className={`gap-element ${className ?? ''}`}>
      <View className="flex-row items-baseline justify-between gap-element">
        <Text className="text-label text-text-muted">{title}</Text>
        {lastValue !== null ? (
          <Text className="font-mono text-data-lg text-text">{format(lastValue)}</Text>
        ) : null}
      </View>

      {points.length > 1 ? (
        <LineGraph
          points={points}
          animated
          enablePanGesture
          color="#2952D9"
          style={{ height }}
        />
      ) : null}

      <View className="flex-row items-center justify-between gap-element">
        <Text className="text-caption text-text-muted">{data[0]?.label}</Text>
        {suppressedCount > 0 ? (
          <Text className="text-caption text-text-muted">
            {suppressedCount} not shown (small group)
          </Text>
        ) : null}
        <Text className="text-caption text-text-muted">{data[data.length - 1]?.label}</Text>
      </View>
    </View>
  );
}
