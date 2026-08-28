// SOT-KEYWORDS: swipeable row swipe delete gesture reanimated stories list actions
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, Text, View } from '@acme/ui/tw';
// The NATIVE fork, explicitly: the anchor resolves to the static web fork
// (no gesture), but Gesture Handler and Reanimated both run under Vite's
// react-native-web build, so the story can demonstrate the actual swipe.
import { SwipeableRow } from './SwipeableRow.native';

const meta = { title: 'Interaction/SwipeableRow' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * SwipeableRow needs its width as a NUMBER — the gesture interpolates towards
 * it, and a percentage cannot be interpolated. So rather than hardcode one, the
 * container measures itself and passes the real width down; the row then fills
 * whatever the viewport gives it and follows the Storybook viewport presets.
 */
function useMeasuredWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.round(e.nativeEvent.layout.width);
    setWidth((prev) => (prev === next ? prev : next));
  };
  return { width, onLayout };
}

function Row({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="gap-element border-b border-border/30 bg-surface-raised p-inset">
      <Text className="text-label text-text">{title}</Text>
      <Text className="text-caption text-text-muted">{subtitle}</Text>
    </View>
  );
}

/** Destructive action behind the row — redpen, because this marks a thing, not a child. */
function DeleteAction({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Delete"
      className="h-full min-h-target-adult items-center justify-center bg-redpen px-6"
    >
      <Text className="text-label text-on-danger">Delete</Text>
    </Pressable>
  );
}

export const TrailingDelete: Story = {
  render: function Trailing() {
    const { width, onLayout } = useMeasuredWidth();
    // Story-local demo state.
    const [rows, setRows] = useState([
      { id: '1', title: 'Amina O.', subtitle: 'Fractions · 09:00' },
      { id: '2', title: 'Daniel K.', subtitle: 'Long division · 10:00' },
      { id: '3', title: 'Priya R.', subtitle: 'Place value · 11:15' },
    ]);
    const remove = (id: string) => setRows((r) => r.filter((x) => x.id !== id));
    return (
      <View className="w-full gap-stack bg-surface p-inset">
        <Text className="text-caption text-text-muted">
          Drag a row left to reveal Delete; a full swipe commits.
        </Text>
        <View onLayout={onLayout} className="w-full overflow-hidden border-2 border-border">
          {width > 0 && rows.map((row) => (
            <SwipeableRow
              key={row.id}
              rowWidth={width}
              onCommit={() => remove(row.id)}
              actions={<DeleteAction onPress={() => remove(row.id)} />}
            >
              <Row title={row.title} subtitle={row.subtitle} />
            </SwipeableRow>
          ))}
        </View>
        {rows.length === 0 ? (
          <Text className="text-caption text-text-muted">All rows removed — reload the story to reset.</Text>
        ) : null}
      </View>
    );
  },
};

/** Leading side, for a non-destructive action revealed from the left. */
export const LeadingAction: Story = {
  render: function Leading() {
    const { width, onLayout } = useMeasuredWidth();
    return (
    <View className="w-full bg-surface p-inset">
      <View onLayout={onLayout} className="w-full overflow-hidden border-2 border-border">
        {width > 0 && (
        <SwipeableRow
          rowWidth={width}
          side="leading"
          onCommit={() => {}}
          actions={
            <View className="h-full min-h-target-adult items-center justify-center bg-grade px-6">
              <Text className="text-label text-on-primary">Done</Text>
            </View>
          }
        >
          <Row title="Tomás L." subtitle="Word problems · 13:30" />
        </SwipeableRow>
        )}
      </View>
    </View>
    );
  },
};
