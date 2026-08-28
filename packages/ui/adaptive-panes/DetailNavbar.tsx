'use client';
// Mobbin: https://mobbin.com/screens/9dae9f31-b569-44e1-948b-5dcae49c1e7a (Zillow —
//   detail pane keeps its own title bar beside the list, dismiss on the pane) ·
//   https://mobbin.com/screens/beafa73d-3c43-4ddc-9949-b0b1c2f76d12 (Threads —
//   conversation header owns the detail column, list stays put). Structure only.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ./README.md
// SOT-KEYWORDS: detail navbar back close dismiss size class bar
import { useWindowDimensions } from 'react-native';
import { Text, View } from '../tw';
import { IconButton } from '../IconButton';
import { ChevronLeft, X } from '../icons';
import { isCollapsed, windowSizeClassForWidth } from './constants.ts';

export interface DetailNavbarProps {
  title: string;
  /** Dismisses the detail. Wired to Back on compact, to a close button above it. */
  onDismiss: () => void;
  children?: React.ReactNode;
}

/**
 * The detail pane's bar, whose contents differ by size class.
 *
 * When the pane is presented ALONE — compact, where the split view shows one
 * column at a time — it needs a back affordance, because there is nothing else
 * on screen to return to and the row that opened it is gone. When it sits
 * BESIDE its list, that back arrow would be a lie: the list never went away, so
 * the control is a close button instead.
 *
 * Same component either way rather than two screen variants: the reference
 * project swapped whole subtrees per size class, which remounts on rotation and
 * drops scroll position and selection with it.
 */
export function DetailNavbar({ title, onDismiss, children }: DetailNavbarProps) {
  const { width } = useWindowDimensions();
  const alone = isCollapsed(windowSizeClassForWidth(width));

  return (
    <View className="flex-row items-center gap-element">
      {alone ? (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Back"
          icon={<ChevronLeft className="text-text-muted" />}
          onPress={onDismiss}
        />
      ) : null}

      <Text className="flex-1 text-base font-semibold text-text md:text-lg lg:text-xl">
        {title}
      </Text>

      {children}

      {alone ? null : (
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Close details"
          icon={<X className="text-text-muted" />}
          onPress={onDismiss}
        />
      )}
    </View>
  );
}
