import type { ReactNode, RefObject } from 'react';
import type { ScrollViewProps } from 'react-native';

export interface SettingsScrollerProps extends ScrollViewProps {
  children?: ReactNode;
  /**
   * Handed to the row drag's `blocksExternalGesture`. Native only — it has to
   * point at a scroller Gesture Handler knows about, which is the entire reason
   * this module is forked. The web fork accepts it and ignores it.
   */
  ref?: RefObject<unknown>;
}

/** The screen's scrolling ancestor, per platform. */
export type SettingsScroller = (props: SettingsScrollerProps) => ReactNode;
