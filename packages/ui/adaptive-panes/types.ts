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
  /**
   * Host-owned visibility for the detail pane, overriding the resolved policy.
   *
   * Normally the detail pane's visibility is the size class plus whatever
   * `PaneToggle` wrote into `pane-overrides` — a layout preference, stored per
   * size class, shared by every pane surface. That is the right owner when the
   * pane is a place things are shown IN.
   *
   * It is the wrong owner when the pane's content is itself a piece of app
   * state a learner has already chosen. The tutor session is the case: whether
   * Natalie is revealed is her presence (`TutorPresencePreference`), persisted
   * per learner, defaulted to collapsed, and expressed on the phone as a rail
   * she can open. Routed through the pane store it would have become a second,
   * size-class-scoped copy of the same fact, and the two would disagree the
   * first time a learner unfolded the device.
   *
   * Supplied, this wins outright — including over an override that says show —
   * because the host is stating a fact about its own content, not a preference.
   * Omitted, nothing changes.
   */
  detailOpen?: boolean;
  /**
   * Explicit width for the primary pane, in dp, replacing the `w-pane-primary`
   * token — and, with it, the narrow RAIL STEP the automatic policy takes at
   * `medium`/`expanded`.
   *
   * The rail step is a LIST affordance: a sidebar of icons with its labels
   * truncated away is still navigable, which is why the policy prefers it to
   * dropping the pane. A pane holding a conversation has no rail form — at
   * 224dp a composer and a message bubble are unusable rather than
   * abbreviated — so a host whose leading pane is not a list states its width
   * here and opts out of the step. It still seeds only the DEFAULT: the
   * divider's resize (and `PRIMARY_WIDTH_MIN`/`MAX`) continue to govern.
   *
   * Omitted — which is every adult pane surface — nothing changes.
   */
  primaryWidthDp?: number;
  /**
   * Whether the host draws its OWN row of `PaneToggle`s above the detail pane.
   * Defaults to true, which is where every pane surface gets its controls.
   *
   * A host sets it false only when the controls are mounted somewhere better
   * for that screen — the tutor session puts them in `SessionToolbar`, because
   * an immersive session has one bar and a second control row underneath it
   * would be a second bar. Two mount sites for one control would be a second
   * mechanism; this is the same `PaneToggle` reading the same overrides, moved.
   */
  paneControls?: boolean;
  ref?: Ref<AdaptivePanesCommands>;
}
