import type { ReactNode, RefObject } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

export interface SettingsScrollerProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
  /**
   * Handed to the row drag's `blocksExternalGesture`. Native only — it has to
   * point at a scroller Gesture Handler knows about, which is the entire reason
   * this module is forked. The web fork accepts it and ignores it.
   */
  ref?: RefObject<unknown>;
}

/** The screen's scrolling ancestor, per platform. */
export type SettingsScroller = (props: SettingsScrollerProps) => ReactNode;
