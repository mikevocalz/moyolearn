'use client';
import { useWindowDimensions } from 'react-native';
import { tv } from './tv';
import { BottomSheet as ExpoBottomSheet } from '@expo/ui';
import { Pressable, ScrollView, Text, View } from './primitives';

// Expo UI's universal sheet: vaul on web (real drag physics), SwiftUI /
// Material sheets on native. Two snap points — 55% and 85%, never full
// screen — driven by dragging the grabber.
const SNAP_POINTS = [{ fraction: 0.55 }, { fraction: 0.85 }];

const sheet = tv({
  slots: {
    content: 'h-full w-full flex-1 rounded-t-sheet bg-surface-raised px-4 pb-6',
    header: 'mb-3 flex-row items-center justify-between gap-stack',
    title: 'flex-1 font-display text-xl font-semibold text-text',
    close: 'rounded-md bg-surface-sunken p-2 active:opacity-70',
  },
});

export interface SheetSurfaceProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  onClose?: () => void;
}

/**
 * The presentational sheet surface — exported separately so it can render
 * inline (e.g. in Storybook) without the sheet portal.
 */
export function SheetSurface({ title, children, className, onClose }: SheetSurfaceProps) {
  const s = sheet();
  return (
    <View role="dialog" aria-label={title} className={s.content({ className })}>
      <View className={s.header()}>
        <Text className={s.title()}>{title ?? ''}</Text>
        {onClose ? (
          <Pressable onPress={onClose} accessibilityLabel="Close" role="button" className={s.close()}>
            <Text className="text-base leading-none text-text">✕</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="pb-2"
      >
        {children}
      </ScrollView>
    </View>
  );
}

export interface BottomSheetProps extends SheetSurfaceProps {
  open: boolean;
  onClose: () => void;
}

export function BottomSheet({ open, onClose, ...surfaceProps }: BottomSheetProps) {
  /*
    The sheet's own width, in pixels, applied to the hosted subtree.

    Not a style preference — a measurement fix. Expo UI's sheet is a native
    container (Compose on Android, SwiftUI on iOS) and it measures the React
    Native subtree it hosts with UNBOUNDED width, so yoga falls back to the
    content's intrinsic size: every sheet in the app rendered as a ~70pt column
    pinned to the left edge, with the title wrapped one character per line and
    rows clipped. `w-full` cannot fix it — a percentage resolves against a
    parent width that does not exist — so the width has to arrive as a real
    number. `useWindowDimensions` (not a cached `Dimensions.get`) because it
    re-renders on rotation and on Android multi-window resize, which a sheet
    open across a fold or a rotation will do.

    It sits here rather than on `SheetSurface` deliberately: hosts that render
    the surface inline (stories, pane hosts) are inside a normal RN tree that
    already has a definite width, and must NOT be forced to the whole window.
  */
  const { width } = useWindowDimensions();
  return (
    <ExpoBottomSheet isPresented={open} onDismiss={onClose} snapPoints={SNAP_POINTS}>
      <View style={{ width }} className="flex-1">
        <SheetSurface {...surfaceProps} onClose={onClose} />
      </View>
    </ExpoBottomSheet>
  );
}
