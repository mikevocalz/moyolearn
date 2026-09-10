import type { ReactNode } from 'react';

export interface MenuAction {
  id: string;
  title: string;
  /** Rendered in red and, on iOS, flagged to the system as destructive. */
  destructive?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** The control the menu is anchored to. */
  children: ReactNode;
  actions: readonly MenuAction[];
  onAction: (id: string) => void;
  /** Heading shown at the top of the menu. */
  title?: string;
  /**
   * Which way the panel opens, on web. Native draws a system sheet and ignores
   * it.
   *
   * `down` is the default and right for a trigger in a header or a table row.
   * `up` is for a trigger that sits against the bottom of its container — the
   * composer's attach key is one, and anchored downward its panel opened
   * straight off the bottom of the window, so the actions were rendered and
   * unreachable.
   */
  placement?: 'down' | 'up';
  className?: string;
}
