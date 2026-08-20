'use client';
import { ScrollView } from '@acme/ui/tw';
import type { SettingsScrollerProps } from './settings-scroller.types.ts';

/**
 * Web fork — the kit's scroller, and no Gesture Handler in the bundle.
 *
 * Same call as `reorder-row.web`: react-native-gesture-handler is native-only
 * source that Next lists in neither `transpilePackages` nor an alias, so
 * importing its ScrollView here would drag RNGH (and, through it, Reanimated
 * and raw react-native/Libraries Flow files) into the web graph and break the
 * build. Nothing is lost — `blocksExternalGesture` and the ref it needs only
 * exist to settle a gesture race the web fork of the row never starts, so both
 * are accepted and dropped rather than making the call site branch.
 */
export function SettingsScroller({ children, ref, ...props }: SettingsScrollerProps) {
  void ref;
  return <ScrollView {...props}>{children}</ScrollView>;
}
