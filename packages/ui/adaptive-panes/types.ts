import type { ReactNode, Ref } from 'react';

/**
 * Public types for AdaptivePanes.
 *
 * INLINED, no longer derived from expo-router's `SplitHostProps`: doc 37 §3.2
 * defers the `unstable-split-view` renderer until it exits alpha, so this
 * module must not import it — a type-only import still couples the kit's
 * public surface to an alpha package apps/web does not install. The three
 * shapes below are the (stable) subset the adaptive implementation honours;
 * when the native renderer is adopted behind this same API, compatibility is
 * re-checked against these names, not inherited silently.
 *
 * SOT: docs/pack/37-onboarding-dual-pane.md §3.2
 * SOT-KEYWORDS: adaptive panes types column commands props split view
 */

/** The navigable columns, leading to trailing. `secondary` is the detail. */
export type SplitNavigableColumn = 'primary' | 'supplementary' | 'secondary';

/** Imperative surface exposed on the host's ref. */
export interface AdaptivePanesCommands {
  /**
   * Bring a column on top. Collapsed: swaps the visible pane. Expanded:
   * visual no-op (everything the size class allows is already tiled), but the
   * column is recorded so a later collapse lands there.
   */
  show: (column: SplitNavigableColumn) => void;
}

export interface AdaptivePanesProps {
  /** `AdaptivePanes.Column` (up to two) and `AdaptivePanes.Inspector` children. */
  children?: ReactNode;
  /** Which pane is visible once collapsed. Defaults to the leading column. */
  topColumnForCollapsing?: SplitNavigableColumn;
  /** Rendered as a trailing drawer where width allows; no layout space below that. */
  showInspector?: boolean;
  /**
   * Detail pane content — the escape hatch that makes the host storyable and
   * usable outside an expo-router route. When omitted, the native detail slot
   * renders the router's `<Slot />`; on web there is no router slot, so a
   * host without `detail` renders an empty detail pane.
   */
  detail?: ReactNode;
  ref?: Ref<AdaptivePanesCommands>;
}
