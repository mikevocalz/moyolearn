'use client';
/**
 * AdaptivePanes — the adaptive list-detail navigator, one renderer on every
 * platform (doc 37 §3.2).
 *
 * Promoted from apps/mobile/src/navigation/split-view (doc 30's category-6
 * rule). The former iOS fork re-exported expo-router's `unstable-split-view`;
 * that renderer is ALPHA (root-layout only, headers locked, iOS only) and doc
 * 37 §3.2 defers it until it exits alpha — so the adaptive implementation,
 * proven on Android and plain RN throughout, now serves iOS, Android and web
 * alike. One behavior to test instead of two. Revisit when SplitView goes
 * beta; the public API here is the adoption seam.
 *
 * It lays out the authored column children plus one detail pane: columns are
 * ordinary JSX, and the detail comes from the `detail` prop when supplied,
 * else from the router's `<Slot />` (native only — see detail-slot forks).
 *
 * SOT: docs/pack/37-onboarding-dual-pane.md §3.2 · ./README.md
 * SOT-KEYWORDS: adaptive panes split view navigator list detail column inspector host
 *               pane toggle collapse expand controls
 */
import { Children, isValidElement, useImperativeHandle, useRef, type ReactNode } from 'react';
import { Freeze } from 'react-freeze';
import { useStore } from 'zustand';
import { View } from '../tw';
import { Aside, Main, Section } from '../primitives';
import { SafeArea } from '../SafeArea';
import { MotionView } from '../motion';
import { isCollapsed, PANE_WIDTH_CLASS } from './constants';
import { resolvePaneVisibility } from './pane-overrides';
import { CollapsiblePane } from './CollapsiblePane';
import { PaneToggle } from './PaneToggle';
import { PANE_WIDTH_DP } from './pane-widths';
import { usePaneOverrideStore } from './pane-overrides.store';
import { useWindowSizeClass } from './use-window-size-class';
import { createAdaptivePanesStore, type AdaptivePanesStore } from './store';
import { AdaptivePanesContext } from './context';
import { useSplitViewBack } from './use-split-view-back';
import { PaneDivider } from './PaneDivider';
import { DetailSlot } from './detail-slot';
import { DEFAULT_PRIMARY_WIDTH } from './resize';
import type { AdaptivePanesProps } from './types';

/**
 * Markers, not renderers. Children are matched by type identity, exactly as
 * expo-router's SplitView filters its columns — so the compound API survives
 * a later swap to the native renderer unchanged.
 */
function AdaptivePanesColumn({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

function AdaptivePanesInspector({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

/**
 * Hairline, not ink. The panes are separated by BACKGROUND VALUE now, and
 * stacking a heavy border on top of that is two devices doing one job — the
 * borders read as division without ranking, which is why the panels had no
 * hierarchy.
 */
const PANE_DIVIDER = 'border-border/15';

/** Entrance travel for a collapsed pane change, in dp. */
const PANE_TRAVEL = 24;

/**
 * Travel for the inspector drawer, in dp. Must clear the pane's own width
 * (w-pane-inspector is 20rem, and metro sets rem:14, so 280) or the drawer
 * would sit half on screen when closed.
 */
const INSPECTOR_TRAVEL = 300;

/**
 * A pane that is on screen renders; a pane that is not stays MOUNTED and stops
 * rendering.
 *
 * `react-freeze` suspends the subtree instead of unmounting it, which is the
 * difference between a collapse and a teardown. Unmounting a hidden pane would
 * throw away its scroll position, its local state, and — on the tutor session —
 * a live WebGPU renderer with a 12MB model resident in it, so re-expanding
 * would rebuild all of it mid-session. Freezing keeps every one of those alive
 * and simply stops React re-rendering them while nobody can see them.
 *
 * WHAT THIS DOES NOT DO, and the two requirements are complementary rather than
 * redundant: it suspends RENDERS ONLY. Effects are not torn down, so a
 * `requestAnimationFrame` loop, an interval, or a poll inside a frozen subtree
 * keeps running — measured on this repo, a frozen face bus went on sampling the
 * audio clock ~130×/s. Freeze preserves the mount; stopping the loop saves the
 * battery. Anything with an imperative loop in it must ALSO be told it is
 * hidden and stop itself (see `TutorAvatar`), and anything that owns audio must
 * live outside the frozen subtree entirely.
 */
function PaneContent({ open, children }: { open: boolean; children: ReactNode }) {
  return <Freeze freeze={!open}>{children}</Freeze>;
}

function AdaptivePanesNavigator({
  children,
  topColumnForCollapsing,
  showInspector,
  detail,
  detailOpen,
  primaryWidthDp,
  paneControls = true,
  ref,
}: AdaptivePanesProps) {
  const sizeClass = useWindowSizeClass();

  // PER-INSTANCE store, held in a ref (the kit's vanilla-store pattern —
  // see ../use-instance-store.ts): each mounted host scopes its own column,
  // width and selection, so tutor Notes and guardian Reports never share a
  // selection. Provided to panes, divider and detail via context below.
  const storeRef = useRef<AdaptivePanesStore | null>(null);
  storeRef.current ??= createAdaptivePanesStore();
  const store = storeRef.current;

  const storedColumn = useStore(store, (state) => state.column);
  const setColumn = useStore(store, (state) => state.setColumn);
  const primaryWidth = useStore(store, (state) => state.primaryWidth);
  const direction = useStore(store, (state) => state.direction);
  const paneOverrides = usePaneOverrideStore((state) => state.overrides);

  const all = Children.toArray(children);
  const columns = all.filter(
    (child) => isValidElement(child) && child.type === AdaptivePanesColumn,
  );
  const inspectors = all.filter(
    (child) => isValidElement(child) && child.type === AdaptivePanesInspector,
  );

  if (columns.length > 2) {
    throw new Error('There can only be two AdaptivePanes.Column in the AdaptivePanes.');
  }

  const columnCount: 1 | 2 = columns.length === 2 ? 2 : 1;
  const collapsed = isCollapsed(sizeClass);

  // The store is the live position; the prop only seeds it, so Back never has
  // to write during render. `supplementary` is clamped away when the two-pane
  // shape has no such column to land on.
  const requested = storedColumn ?? topColumnForCollapsing ?? 'primary';
  const activeColumn =
    requested === 'supplementary' && columnCount === 1 ? 'primary' : requested;

  useSplitViewBack({ collapsed, activeColumn, columnCount, store });

  /**
   * `show(column)` — collapsed: swaps the visible pane. Expanded: no-op on
   * screen, because every pane the size class allows is already tiled; the
   * column is still recorded, so a later collapse lands on the requested pane
   * rather than snapping back to `topColumnForCollapsing`. Requesting
   * `supplementary` in the two-pane shape is clamped to `primary` at render.
   */
  useImperativeHandle(ref, () => ({ show: setColumn }), [setColumn]);

  // Same diagnostics on every platform, so a call site misbehaves identically.
  if (all.length !== columns.length + inspectors.length) {
    console.warn(
      'Only AdaptivePanes.Column and AdaptivePanes.Inspector components are allowed as direct children of AdaptivePanes.',
    );
  }
  if (columns.length + inspectors.length === 0) {
    console.warn('No AdaptivePanes.Column and AdaptivePanes.Inspector found in AdaptivePanes.');
    return detail ?? <DetailSlot />;
  }

  // The detail pane: supplied content wins; the router's <Slot /> is the
  // native default (web has no router slot — detail-slot.web renders null).
  const detailPane = detail ?? <DetailSlot />;

  // The automatic size-class policy, then any manual override the user set for
  // THIS size class. Precedence and the "never show what cannot fit" guard both
  // live in the reducer, so this stays a lookup.
  const resolved = resolvePaneVisibility(sizeClass, columnCount, paneOverrides);
  /*
    A host that owns its detail content's visibility states it, and that answer
    is final — see `detailOpen` in types.ts. It is applied here rather than
    inside `resolvePaneVisibility` because the reducer answers "what does the
    stored preference mean at this size", which is a question about the store;
    this is not a preference at all.

    Rule 6 still holds and is why the guard is repeated: hiding the detail is
    honoured only while some other pane is drawn, so a one-column host cannot
    close its way to an empty screen.
  */
  const visible =
    detailOpen === undefined
      ? resolved
      : {
          ...resolved,
          detail:
            detailOpen || !(resolved.primary || resolved.supplementary || resolved.inspector),
        };
  /*
    MOUNTED WHENEVER THERE IS ONE TO MOUNT — not "whenever the size class allows
    it", which is what this used to say.

    `visible.inspector` was gating the MOUNT, so toggling the inspector off
    destroyed its subtree and toggling it back on built a new one. That is fine
    for a filter panel and fatal for anything holding a renderer or a stream.
    The drawer now always exists once an `Inspector` child is authored; the size
    class and the override decide whether it is slid OPEN, and `PaneContent`
    freezes it while it is not.
  */
  const inspectorPane = inspectors[0] ?? null;
  const inspectorOpen = Boolean(showInspector && inspectorPane && visible.inspector);

  if (collapsed) {
    // Keyed on the column so each pane change remounts and replays the entrance.
    // TRANSFORM-ONLY, never opacity-from-0: if the animation stalls the pane
    // must still be readable rather than an invisible screen.
    return (
      <AdaptivePanesContext value={store}>
        <SafeArea edges={['left', 'right']} className="flex-1">
          <MotionView
            key={activeColumn}
            className="flex-1"
            initial={{ x: direction === 'forward' ? PANE_TRAVEL : -PANE_TRAVEL }}
            animate={{ x: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
          >
            {activeColumn === 'primary' && columns[0] ? (
              <Aside className="flex-1">{columns[0]}</Aside>
            ) : activeColumn === 'supplementary' && columns[1] ? (
              <Section className="flex-1">{columns[1]}</Section>
            ) : (
              <Main className="flex-1">{detailPane}</Main>
            )}
          </MotionView>
        </SafeArea>
      </AdaptivePanesContext>
    );
  }

  /*
    An explicit `primaryWidthDp` REPLACES the rail step, it does not compete
    with it: a host that states a width has told us its leading pane has no
    abbreviated form, so `primaryNarrow` is simply not honoured for it. See the
    prop's own note in types.ts for why that is a property of the CONTENT and
    not of the width.
  */
  const railStep = visible.primaryNarrow && primaryWidthDp === undefined;
  // The narrow rail is a fixed step, not a resizable pane, so a stored width
  // only applies at the full-width steps.
  const resizedWidth = railStep ? null : primaryWidth;
  const openPrimaryWidth = railStep
    ? PANE_WIDTH_DP.primaryNarrow
    : resizedWidth ?? primaryWidthDp ?? PANE_WIDTH_DP.primary;

  /*
    WHICH PANE ABSORBS THE WINDOW. Normally the detail pane, which is why the
    leading panes are all a fixed token width. Hide the detail — the tutor
    session's "Natalie" control does exactly that — and something else has to,
    or the panes sit at their widths with a band of empty background beside
    them. Trailing-most visible pane wins, so the content stays where the reader
    left it and only the last column grows.
  */
  const fillPane: 'detail' | 'supplementary' | 'primary' = visible.detail
    ? 'detail'
    : visible.supplementary && columns[1]
      ? 'supplementary'
      : 'primary';

  return (
    <AdaptivePanesContext value={store}>
      <SafeArea edges={['left', 'right']} className="flex-1">
        <View className="flex-1 flex-row">
          {/*
            Panes stay MOUNTED and animate to zero width rather than unmounting.
            A conditional mount is a hard cut: the pane vanishes in one frame and
            the detail pane snaps to its new size. Keeping them mounted also
            preserves each pane's scroll position and local state across a
            collapse, which the brief requires.
          */}
          {columns[0] ? (
            <>
              <CollapsiblePane
                open={visible.primary}
                width={openPrimaryWidth}
                fill={fillPane === 'primary'}
              >
                <Aside className="flex-1">
                  <PaneContent open={visible.primary}>{columns[0]}</PaneContent>
                </Aside>
              </CollapsiblePane>
              {visible.primary ? (
                <PaneDivider width={resizedWidth ?? primaryWidthDp ?? DEFAULT_PRIMARY_WIDTH} />
              ) : null}
            </>
          ) : null}

          {columns[1] ? (
            <CollapsiblePane
              open={visible.supplementary}
              width={PANE_WIDTH_DP.supplementary}
              fill={fillPane === 'supplementary'}
              className={visible.supplementary ? `border-r ${PANE_DIVIDER}` : undefined}
            >
              <Section className="flex-1">
                <PaneContent open={visible.supplementary}>{columns[1]}</PaneContent>
              </Section>
            </CollapsiblePane>
          ) : null}

          {/*
            THE DETAIL PANE IS LAST IN THE ROW, AND THAT IS ITS STACKING.

            Nothing here sets a z-index. On Android a sibling paints in tree
            order, so the last child of the row is already above the panes
            before it — and the panes before it are inside `CollapsiblePane`,
            which clips (`overflow-hidden`), so a tall or overflowing child in a
            leading pane cannot paint across this one. React Native does not
            clip children by default, and a pane that overflowed its neighbour
            is exactly the bug a z-index would have papered over instead of
            fixed. If something ever does paint over this pane, the clip on the
            offender is the fix, not a number here.

            `flex-1` only while it is visible: a hidden detail must contribute
            no width, and `w-0` beside a `flex-1` sibling is what makes the
            neighbours take the space back.
          */}
          <Main className={visible.detail ? 'flex-1' : 'w-0'}>
            {/*
              THE PANE CONTROLS, FINALLY ON SCREEN.

              `PaneToggle` has existed since this layout was promoted out of
              `apps/mobile` — doc 37 §3.2 names "explicit expand/collapse
              controls" as part of what was being promoted, and `pane-overrides`
              has carried their whole precedence policy (with tests) the entire
              time. Nothing ever rendered one. The panes could be collapsed by
              resizing the window and by no other means, which is why they read
              as missing: they were built, exported, tested, and never mounted.

              They belong to the HOST, not to a screen's detail content. The
              first attempt put them in `DetailNavbar`, which every pane host
              already draws — but that bar only exists once a row is selected,
              so the controls vanished exactly when a user most wants to widen
              an empty detail pane. Here they are part of the layout itself and
              are present whenever a pane can be collapsed at all.

              No fill, no border, no divider: this is a control row, not a
              second bar, and the panes' own surfaces are untouched. Each toggle
              renders `null` in any size class that cannot show its pane, so at
              `medium` this is one button and at `compact` (which returns
              earlier) it does not exist.
            */}
            {paneControls ? (
              <View className="flex-row items-center gap-element px-inset py-1">
                <PaneToggle pane="primary" columnCount={columnCount} />
                {columnCount === 2 ? (
                  <PaneToggle pane="supplementary" columnCount={columnCount} />
                ) : null}
                {inspectorPane ? <PaneToggle pane="inspector" columnCount={columnCount} /> : null}
              </View>
            ) : null}
            <PaneContent open={visible.detail}>{detailPane}</PaneContent>
          </Main>
        </View>

        {/*
          The inspector is a DRAWER, not a fourth column. It overlays the trailing
          edge of the detail pane rather than taking width from it — a tiled
          inspector squeezes the primary content every time it is shown, which is
          the wrong trade for a secondary surface. This also matches UIKit, where
          the inspector is presented over the secondary column rather than tiled
          beside it.
        */}
        {/*
          Legend Motion (never moti) drives the drawer. It stays MOUNTED and
          animates between open and closed instead of being unmounted by
          AnimatePresence — the exit transition did not run reliably through the
          kit's css-wrapped MotionView, which left the panel stuck on screen.
          TRANSFORM-ONLY, never opacity-from-0, so a stalled animation still
          leaves a readable panel. pointerEvents is dropped while closed so the
          parked drawer cannot swallow taps meant for the grid.
        */}
        {inspectorPane ? (
          <MotionView
            pointerEvents={inspectorOpen ? 'auto' : 'none'}
            aria-hidden={!inspectorOpen}
            className={`absolute bottom-0 right-0 top-0 ${PANE_WIDTH_CLASS.inspector} border-l ${PANE_DIVIDER} bg-surface shadow-overlay`}
            animate={{ x: inspectorOpen ? 0 : INSPECTOR_TRAVEL }}
            transition={{ type: 'spring', damping: 32, stiffness: 140, mass: 1.1 }}
          >
            <Aside className="flex-1">
              <PaneContent open={inspectorOpen}>{inspectorPane}</PaneContent>
            </Aside>
          </MotionView>
        ) : null}
      </SafeArea>
    </AdaptivePanesContext>
  );
}

export const AdaptivePanes = Object.assign(AdaptivePanesNavigator, {
  Column: AdaptivePanesColumn,
  Inspector: AdaptivePanesInspector,
});

export type {
  AdaptivePanesProps,
  AdaptivePanesCommands,
  SplitNavigableColumn,
} from './types';
export { useAdaptivePaneSelection, useAdaptivePanesStore } from './context';
export {
  createAdaptivePanesStore,
  type AdaptivePanesState,
  type AdaptivePanesStore,
} from './store';
export { useWindowSizeClass, windowSizeClassForWidth } from './use-window-size-class';
export {
  WINDOW_SIZE_CLASS_MIN_WIDTH_DP,
  isCollapsed,
  type WindowSizeClass,
} from './constants';

// Pane chrome — composable pieces the host arranges, exported for direct use
// by feature screens and Storybook.
export { CollapsiblePane, type CollapsiblePaneProps } from './CollapsiblePane';
export { DetailNavbar, type DetailNavbarProps } from './DetailNavbar';
export { PaneDivider, type PaneDividerProps } from './PaneDivider';
export { PaneListHeader, type PaneListHeaderProps } from './PaneListHeader';
export { PaneSearchBar, type PaneSearchBarProps } from './PaneSearchBar';
export { PaneToggle, type PaneToggleProps } from './PaneToggle';
export { SidebarSection, type SidebarSectionProps } from './SidebarSection';
export { SwipeableRow, type SwipeableRowProps, ACTION_WIDTH } from './SwipeableRow';
export { usePaneVisibility } from './use-pane-visibility';
export { useStickyHeader, type StickyHeader } from './use-sticky-header';
export { usePaneSearch, usePaneSearchStore } from './pane-search.store';
export { usePaneOverrideStore } from './pane-overrides.store';
