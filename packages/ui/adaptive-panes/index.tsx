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
import { Children, createContext, isValidElement, type ElementRef, type ReactNode, useContext, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { Freeze } from 'react-freeze';
import { I18nManager, View as NativeView, type LayoutChangeEvent, useColorScheme, useWindowDimensions } from 'react-native';
import { useStore } from 'zustand';
// Concrete color for the row's painted ground — see the comment at the row.
import { semantic } from '@acme/theme';
import { View } from '../tw';
import { Aside, Main, Section } from '../primitives';
import { SafeArea } from '../SafeArea';
import { MotionView } from '../motion';
import { isCollapsed } from './constants';
import { resolvePaneVisibility } from './pane-overrides';
import { CollapsiblePane } from './CollapsiblePane';
import { PaneToggle } from './PaneToggle';
import { PANE_WIDTH_DP } from './pane-widths';
import { usePaneOverrideStore } from './pane-overrides.store';
import { clearPaneControls, publishPaneControls, usePaneControlsStore } from './pane-controls.store';
import { usePaneRouteKey } from './use-pane-route-key';
import { useWindowSizeClass } from './use-window-size-class';
import { createAdaptivePanesStore, type AdaptivePanesStore } from './store';
import { AdaptivePanesContext } from './context';
import { useSplitViewBack } from './use-split-view-back';
import { PaneDivider } from './PaneDivider';
import { usePaneEdges } from './pane-edges';
import { useFoldLayouts } from './use-fold-layout';
import {
  foldLayoutsIntersectingRow,
  resolveTrailingInspectorLayout,
  resolveVerticalFoldPanePlan,
  resolveVerticalMultiFoldPanePlan,
} from './fold-layout';
import { DetailSlot } from './detail-slot';
import {
  DEFAULT_PRIMARY_WIDTH,
  DETAIL_ROW_SHARE_MIN,
  PRIMARY_ROW_SHARE_MIN,
  PRIMARY_WIDTH_MIN,
} from './resize';
import type { AdaptivePanesProps, SplitNavigableColumn } from './types';

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
/**
 * Whether the pane this content sits in is open. Default true outside a pane.
 *
 * A GPU canvas must not draw while its pane is shut. Measured on the iPhone
 * Duo: Natalie's stage kept calling `getCurrentTexture` through a hide — the
 * frame counter never paused, `getNativeSurface()` read undefined mid-hide —
 * and after the show the same Metal view (same pointer) presented nothing
 * again. Freeze alone does not stop a render loop that three drives; the
 * stage's `active` gate does, and this is how it learns the pane is shut.
 */
export const PaneOpenContext = createContext(true);
export function usePaneOpen(): boolean {
  return useContext(PaneOpenContext);
}

function PaneContent({ open, children }: { open: boolean; children: ReactNode }) {
  /*
    FROZEN ONE COMMIT AFTER IT CLOSES, not in the same one. Freezing in the
    closing commit suspends the subtree before it can render the close: the
    stage below never received `active: false` — Metro showed no toggle line
    while its frame counter ran straight through the hide — so it kept
    drawing into a pane that was gone. The effect lands the closed state
    first, then freezes what already stopped.
  */
  const [frozen, setFrozen] = useState(!open);
  useEffect(() => {
    // The cascading render this rule warns about is the mechanism: the second
    // commit is what freezes a subtree that has already rendered its close.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFrozen(!open);
  }, [open]);
  return (
    <PaneOpenContext value={open}>
      <Freeze freeze={frozen}>{children}</Freeze>
    </PaneOpenContext>
  );
}

function AdaptivePanesNavigator({
  children,
  topColumnForCollapsing,
  showInspector,
  detail,
  detailOpen,
  primaryWidthDp,
  supplementaryWidthDp,
  paneControls = true,
  ref,
}: AdaptivePanesProps) {
  const sizeClass = useWindowSizeClass();
  // Only the first frame's fallback for a collapsed pane's width — the row's
  // own measurement replaces it as soon as there is one. See `collapsedWidth`.
  const { width: windowWidth } = useWindowDimensions();

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
  const paneOverrides = usePaneOverrideStore((state) => state.overrides);

  /*
    THE COLLAPSED PANE IS AS WIDE AS THE ROW, and it has to be measured rather
    than assumed. `CollapsiblePane` animates 0 → its stated width and only then
    hands over to `grow`, so a collapsed pane given its token width would open
    to a 320 dp column and jump to full width a frame later. Measuring the row
    means the animation targets the real number and the handoff is invisible.

    Declared up here with the other hooks, not beside the row it measures: the
    early returns below it are why — a hook after one of those runs in a
    different order on the render that takes it.

    The window is the fallback for the first frame only, and a fallback rather
    than the answer: a host does not necessarily span the window — one can sit
    beside a rail or inside a sheet — and a pane wider than its row would
    overflow rather than fit.
  */
  const [rowGeometry, setRowGeometry] = useState<{
    width: number | null;
    windowX: number | null;
  }>({ width: null, windowX: null });
  const rowRef = useRef<ElementRef<typeof NativeView> | null>(null);
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const rowWidth = rowGeometry.width;
  const paneEdges = usePaneEdges();
  const windowFoldLayouts = useFoldLayouts(rowGeometry.windowX);
  const foldLayouts = foldLayoutsIntersectingRow(windowFoldLayouts, rowWidth);
  const primaryFoldLayout = foldLayouts[0] ?? null;

  const all = Children.toArray(children);
  const columns = all.filter(
    (child) => isValidElement(child) && child.type === AdaptivePanesColumn,
  );
  const inspectors = all.filter(
    (child) => isValidElement(child) && child.type === AdaptivePanesInspector,
  );
  const inspectorPane = inspectors[0] ?? null;

  if (columns.length > 2) {
    throw new Error('There can only be two AdaptivePanes.Column in the AdaptivePanes.');
  }

  const columnCount: 1 | 2 = columns.length === 2 ? 2 : 1;
  const collapsed = isCollapsed(sizeClass);

  // The store is the live position; the prop only seeds it, so Back never has
  // to write during render. `supplementary` is clamped away when the two-pane
  // shape has no such column to land on.
  const requested = storedColumn ?? topColumnForCollapsing ?? 'primary';
  const activeColumn: SplitNavigableColumn =
    requested === 'supplementary' && columnCount === 1
      ? 'primary'
      : requested === 'primary' && !columns[0]
        ? 'secondary'
        : requested;

  useSplitViewBack({ collapsed, activeColumn, columnCount, store });

  /**
   * `show(column)` — collapsed: swaps the visible pane. Expanded: no-op on
   * screen, because every pane the size class allows is already tiled; the
   * column is still recorded, so a later collapse lands on the requested pane
   * rather than snapping back to `topColumnForCollapsing`. Requesting
   * `supplementary` in the two-pane shape is clamped to `primary` at render.
   */
  useImperativeHandle(ref, () => ({ show: setColumn }), [setColumn]);

  /*
    THE TOGGLE ROW'S CHROME LIVES IN THE SHELL HEADER when one is mounted.
    `paneControls` still decides WHETHER this host exposes toggles; WHERE they
    render is decided by `headerConsumers` — ShellHeader registers itself and
    draws the same `PaneToggle`s from this registration, so a host under a
    navigator header gets one row in the bar instead of a second row inside
    the pane. No consumer (web pages, Storybook) keeps the in-pane row exactly
    as before.

    Publishing runs on EVERY render, deliberately unmemoized, keyed by the
    host screen's own `route.key` — never the global pathname, which belongs
    to whatever is focused and would republish wrongly the moment a blurred
    (mounted, possibly frozen) host re-rendered. The key belongs to the
    screen instance, so it cannot drift: the header shows the controls only
    on that screen's bar, a refocused screen's entry is still sitting in the
    map untouched, and an unmount cleanup keyed to the same `route.key` can
    never retract a different host's registration.

    A host with NO route (Storybook, overlays — the fork returns null) has no
    header that could ever claim its controls, so it keeps its in-pane row even
    while a consumer exists.

    These hooks sit above the empty-children early return on purpose — a hook
    after it would run in a different order on the render that takes it.
    `headerConsumers` is subscribed unconditionally for the same reason; the
    `routeKey` guard only gates whether the subscription's value is used.
  */
  const controlsOwner = useId();
  const routeKey = usePaneRouteKey();
  const headerConsumers = usePaneControlsStore((state) => state.headerConsumers > 0);
  const headerConsumer = routeKey !== null && headerConsumers;
  useEffect(() => {
    if (paneControls && !collapsed && routeKey !== null) {
      publishPaneControls(routeKey, {
        owner: controlsOwner,
        columnCount,
        inspector: Boolean(showInspector && inspectorPane),
      });
    } else if (routeKey !== null) {
      clearPaneControls(routeKey, controlsOwner);
    }
  });
  useEffect(
    () => () => {
      if (routeKey !== null) clearPaneControls(routeKey, controlsOwner);
    },
    [routeKey, controlsOwner],
  );

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
  const expandedVisible =
    detailOpen === undefined
      ? resolved
      : {
          ...resolved,
          detail:
            detailOpen || !(resolved.primary || resolved.supplementary || resolved.inspector),
        };
  /*
    COLLAPSED IS THE SAME TREE WITH DIFFERENT NUMBERS, and that is the whole
    point of this block.

    There used to be a second `return` above this one: collapsed rendered its
    pane at `SafeArea > MotionView > Aside`, expanded renders it at
    `SafeArea > View > CollapsiblePane > Aside > PaneContent`. React keeps state
    by tree POSITION and type, so crossing 600 dp put every pane somewhere new
    and rebuilt it — measured in `docs/verification/adaptive-panes/
    remount-audit-2026-09-16.md`: three panes holding drafts of 3, 4 and 5 came
    back from one resize holding 0, 0 and 0. The pane that was visible on BOTH
    sides of the change lost its draft too, which is the tell that this was
    never about panes disappearing.

    So there is one tree now, and the size class only decides which panes are
    open and how wide. A collapsed host opens exactly one — no policy, no
    overrides: the host said which column, and the window has room for that one.
  */
  const visible = collapsed
    ? {
        primary: activeColumn === 'primary',
        supplementary: activeColumn === 'supplementary',
        detail: activeColumn === 'secondary',
        inspector: false,
        primaryNarrow: false,
      }
    : expandedVisible;
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
  const inspectorOpen = Boolean(showInspector && inspectorPane && visible.inspector);

  /*
    An explicit `primaryWidthDp` REPLACES the rail step, it does not compete
    with it: a host that states a width has told us its leading pane has no
    abbreviated form, so `primaryNarrow` is simply not honoured for it. See the
    prop's own note in types.ts for why that is a property of the CONTENT and
    not of the width.
  */
  const railStep = visible.primaryNarrow && primaryWidthDp === undefined;

  const collapsedWidth = rowWidth ?? windowWidth;
  // The narrow rail is a fixed step, not a resizable pane, so a stored width
  // only applies at the full-width steps.
  const resizedWidth = railStep ? null : primaryWidth;
  const wantedPrimaryWidth = railStep
    ? PANE_WIDTH_DP.primaryNarrow
    : resizedWidth ?? primaryWidthDp ?? PANE_WIDTH_DP.primary;
  const wantedSupplementaryWidth = supplementaryWidthDp ?? PANE_WIDTH_DP.supplementary;
  /*
    BOUNDED BY THE ROW, not only by the divider's own clamp. `PRIMARY_WIDTH_MAX`
    is 420 whatever the window is, so on a row too narrow for three token
    widths a dragged primary took its 420, the supplementary its 294, and the
    fill pane got whatever was left: on the iPhone Duo's inner display (867 dp
    inside the insets) that was ~150 dp of Natalie beside the status column.
    The Surface Duo's wider row hid the same rule. So the primary may not push
    the fill pane below its own collapse width; a host that has not measured
    its row yet keeps the wanted width for that first frame. Only the trailing
    fill pane is defended — it is the one that absorbs the difference — and
    its floor is the larger of its collapse width and 30% of the row.

    AND NEVER UNDER 40% OF THE ROW. The product owner's floor for the
    leading column: on the Duo's inner display the defence above would have
    squeezed the conversation to 200 dp beside two 294 dp panes, and 40% of
    867 is 347. When the two floors disagree the third wins and the fill
    pane gives up the difference — it is the pane built to absorb it.
  */
  // The trailing pane's floor is its ROW SHARE, not its token: the token is
  // what it collapses through, the share is what it may never drop under.
  const detailFloor = visible.detail && rowWidth !== null ? rowWidth * DETAIL_ROW_SHARE_MIN : 0;
  const openPrimaryWidth =
    rowWidth === null || railStep || !visible.primary
      ? wantedPrimaryWidth
      : Math.max(
          PRIMARY_WIDTH_MIN,
          rowWidth * PRIMARY_ROW_SHARE_MIN,
          Math.min(
            wantedPrimaryWidth,
            rowWidth -
              (visible.supplementary && columns[1] ? wantedSupplementaryWidth : 0) -
              detailFloor,
          ),
        );
  /*
    THE MIDDLE PANE GIVES, not the trailing one. With the leading pane at 40%
    and the trailing at 30% there is 30% left for the supplementary, and on
    the Duo's 867 dp row that is 260 against a 294 token — the token loses.
    Measured before this: 347 + 294 left Natalie 226, under her floor. It
    keeps PRIMARY_WIDTH_MIN as its own floor so a very narrow row degrades
    to three narrow panes rather than one that vanished.
  */
  const openSupplementaryWidth =
    rowWidth === null || !visible.detail || !visible.primary
      ? wantedSupplementaryWidth
      : Math.max(
          PRIMARY_WIDTH_MIN,
          Math.min(wantedSupplementaryWidth, rowWidth - openPrimaryWidth - detailFloor),
        );

  /*
    A SEPARATING VERTICAL HINGE IS A LAYOUT BOUNDARY, not another breakpoint.

    Window-size classes still decide WHICH panes are allowed. Native fold
    geometry only decides WHERE an already-visible pane boundary lands. That
    distinction keeps a folded phone, split-screen window and ordinary tablet
    on the same policy while preventing a pane from straddling a physical
    hinge.

    The pure planner never hides content. It first tries to keep primary +
    supplementary together on the leading physical region with detail on the
    trailing region. If that cannot fit, it can put primary on the first region
    and supplementary + detail on the second. If neither is usable we preserve
    the width-class layout rather than choosing product content here.
  */
  const multiFoldPlan = collapsed
    ? null
    : resolveVerticalMultiFoldPanePlan({
        folds: foldLayouts,
        rowWidth,
        primaryVisible: Boolean(columns[0] && visible.primary),
        supplementaryVisible: Boolean(columns[1] && visible.supplementary),
        detailVisible: visible.detail,
        primaryWidth: openPrimaryWidth,
        supplementaryWidth: openSupplementaryWidth,
        detailMinWidth: Math.max(PRIMARY_WIDTH_MIN, detailFloor),
        paneMinWidth: PRIMARY_WIDTH_MIN,
      });

  const foldPlan = multiFoldPlan
    ? null
    : resolveVerticalFoldPanePlan({
        fold: collapsed ? null : primaryFoldLayout,
        rowWidth,
        primaryVisible: Boolean(columns[0] && visible.primary),
        supplementaryVisible: Boolean(columns[1] && visible.supplementary),
        detailVisible: visible.detail,
        primaryWidth: openPrimaryWidth,
        supplementaryWidth: openSupplementaryWidth,
        detailMinWidth: Math.max(PRIMARY_WIDTH_MIN, detailFloor),
        paneMinWidth: PRIMARY_WIDTH_MIN,
      });

  const effectivePrimaryWidth =
    multiFoldPlan?.primaryWidth ?? foldPlan?.primaryWidth ?? openPrimaryWidth;
  const effectiveSupplementaryWidth =
    multiFoldPlan?.supplementaryWidth ??
    foldPlan?.supplementaryWidth ??
    openSupplementaryWidth;

  const gapAfterPrimary =
    multiFoldPlan?.gapAfterPrimary ??
    (foldPlan?.splitAfter === 'primary' ? foldPlan.gapWidth : 0);
  const gapAfterSupplementary =
    multiFoldPlan?.gapAfterSupplementary ??
    (foldPlan?.splitAfter === 'supplementary' ? foldPlan.gapWidth : 0);

  /*
    SPLITVIEW.INSPECTOR PARITY ON ANDROID.

    Expo Router's native inspector is an overlay that slides in from the
    logical trailing edge; it is not a fourth tiled column. Keep that exact
    contract here. On a separating vertical fold, cap the drawer to the
    physical trailing region so an open inspector cannot cover the hinge or
    spill onto the other display. RTL flips both the edge and slide direction.
  */
  const inspectorLayout = resolveTrailingInspectorLayout({
    folds: collapsed ? [] : foldLayouts,
    rowWidth,
    preferredWidth: PANE_WIDTH_DP.inspector,
    isRTL: I18nManager.isRTL,
  });

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
      <SafeArea edges={paneEdges} className="flex-1">
        <NativeView
          ref={rowRef}
          /*
            The row must own a painted ground. Panes are transparent — hosts
            don't set a bg — so nothing painted the window: on Android the
            LIGHT windowBackground bled through and dark-mode ink sat on it
            washed out. `surface` resolved in JS because NativeView is the
            raw View (rowRef needs measureInWindow); the className engine
            only wraps ../tw primitives.
          */
          style={{
            flex: 1,
            flexDirection: 'row',
            backgroundColor: semantic.surface[scheme],
          }}
          /*
            Measured at EVERY width, not only while collapsed. The stored width
            is what the next collapse opens the pane to; measuring only in the
            compact band meant a host that was resized while expanded (a Duo
            unfold, Split View, a rail appearing) collapsed to the width it had
            last seen when compact — stale by exactly the change that mattered.

            The native fold rectangle is WINDOW-relative, so width alone is not
            enough. A pane host can sit beside a rail or inside another
            horizontally offset container. measureInWindow gives this row's
            actual window origin; until that value is known we deliberately
            disable hinge snapping instead of applying window coordinates to
            row-local layout math.
          */
          onLayout={(event: LayoutChangeEvent) => {
            const laid = event.nativeEvent.layout.width;
            const commitGeometry = (windowX: number | null) => {
              setRowGeometry((current) => {
                const width =
                  current.width !== null && Math.abs(laid - current.width) <= 1
                    ? current.width
                    : laid;
                const sameWindowX =
                  (current.windowX === null && windowX === null) ||
                  (current.windowX !== null &&
                    windowX !== null &&
                    Math.abs(windowX - current.windowX) <= 1);

                return width === current.width && sameWindowX
                  ? current
                  : { width, windowX };
              });
            };

            // Publish width immediately, but clear any stale absolute origin.
            // The second commit below re-enables fold snapping with the fresh
            // row-local coordinate conversion.
            commitGeometry(null);
            rowRef.current?.measureInWindow((windowX) => {
              commitGeometry(windowX);
            });
          }}
        >
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
                width={collapsed ? collapsedWidth : effectivePrimaryWidth}
                fill={fillPane === 'primary'}
              >
                <Aside className="flex-1">
                  <PaneContent open={visible.primary}>{columns[0]}</PaneContent>
                </Aside>
              </CollapsiblePane>
              {/* No divider collapsed: there is nothing on the other side of
                  it to drag against, and a grab handle on the screen edge is a
                  control that cannot do anything. */}
              {!collapsed && visible.primary && gapAfterPrimary === 0 ? (
                <PaneDivider width={effectivePrimaryWidth} />
              ) : null}
              {!collapsed && gapAfterPrimary > 0 ? (
                <View
                  style={{ width: gapAfterPrimary }}
                  pointerEvents="none"
                  aria-hidden
                />
              ) : null}
            </>
          ) : null}

          {columns[1] ? (
            <CollapsiblePane
              open={visible.supplementary}
              width={
                collapsed ? collapsedWidth : effectiveSupplementaryWidth
              }
              fill={fillPane === 'supplementary'}
              className={
                !collapsed &&
                visible.supplementary &&
                gapAfterSupplementary === 0
                  ? `border-r ${PANE_DIVIDER}`
                  : undefined
              }
            >
              <Section className="flex-1">
                <PaneContent open={visible.supplementary}>{columns[1]}</PaneContent>
              </Section>
            </CollapsiblePane>
          ) : null}
          {!collapsed && gapAfterSupplementary > 0 ? (
            <View
              style={{ width: gapAfterSupplementary }}
              pointerEvents="none"
              aria-hidden
            />
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
          {/*
            IT COLLAPSES LIKE THE OTHERS, because it is the same component.

            This was `flex-1` / `w-0` — a class swap, so the trailing pane
            appeared and vanished in one frame while every other pane animated
            its width. On the tutor session that is the pane holding Natalie,
            and "Show Natalie" snapping open next to a Homework toggle that
            slides was the tell.

            `CollapsiblePane` is what the leading panes already use: an animated
            width, on its own node, with the neighbours reflowing frame by frame
            as it moves. `fill` keeps it absorbing the window while open —
            growing from the token rather than `flex-1`, which would discard the
            width it collapses along.

            THE 3D NOTE, kept because it will come up: the canvas in this pane
            is NOT resized across the collapse — `CollapsiblePane` clips over
            an inner view that holds the measured width, so the surface keeps
            its size while the clip moves. The subtree is also frozen while
            shut (`PaneContent`), so a hidden renderer is not drawing at all.
          */}
          <CollapsiblePane
            open={visible.detail}
            width={collapsed ? collapsedWidth : PANE_WIDTH_DP.detail}
            fill={fillPane === 'detail'}
          >
            <Main className="flex-1">
            {/*
              THE ROW STAYS, ONLY ITS BUTTONS GO. Collapsed, the toggles have
              nothing to toggle — one pane is the whole window and hiding it
              would empty the screen — and under a mounted header consumer they
              live in the shell header instead (see the registration above) —
              but this element cannot be the thing that disappears.

              Measured: with `{paneControls && !collapsed ? <View/> : null}`
              here, the detail pane below it remounted on every collapse and
              lost its state, while the two column panes kept theirs. A sibling
              that becomes `null` does not reliably hold its slot — somewhere in
              the landmark wrapper the children are normalised and the nulls
              drop out, which shifts `PaneContent` up an index and makes it a
              different position to React. Keeping an empty `View` here keeps
              the index, and the detail pane's draft survives the resize.
            */}
            {paneControls ? (
              <View
                className={
                  collapsed || headerConsumer
                    ? undefined
                    : 'flex-row items-center justify-end gap-element px-inset py-1'
                }
              >
                {collapsed || headerConsumer ? null : (
                  <>
                    <PaneToggle pane="primary" columnCount={columnCount} />
                    {columnCount === 2 ? (
                      <PaneToggle pane="supplementary" columnCount={columnCount} />
                    ) : null}
                    {showInspector && inspectorPane ? (
                      <PaneToggle pane="inspector" columnCount={columnCount} />
                    ) : null}
                  </>
                )}
              </View>
            ) : null}
            <PaneContent open={visible.detail}>{detailPane}</PaneContent>
            </Main>
          </CollapsiblePane>
        </NativeView>

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
            className={`absolute bottom-0 top-0 ${
              inspectorLayout.edge === 'right' ? 'border-l' : 'border-r'
            } ${PANE_DIVIDER} bg-surface shadow-overlay`}
            style={{
              width: inspectorLayout.width,
              ...(inspectorLayout.edge === 'right' ? { right: 0 } : { left: 0 }),
            }}
            animate={{ x: inspectorOpen ? 0 : inspectorLayout.closedX }}
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
export {
  foldLayoutFromRegions,
  foldLayoutsFromRegions,
  foldLayoutsIntersectingRow,
  resolveTrailingInspectorLayout,
  resolveVerticalFoldPanePlan,
  resolveVerticalMultiFoldPanePlan,
  type FoldLayout,
  type FoldPosture,
  type TrailingInspectorLayout,
  type TrailingInspectorLayoutInput,
  type VerticalFoldPanePlan,
  type VerticalFoldPanePlanInput,
  type VerticalMultiFoldPanePlan,
  type VerticalMultiFoldPanePlanInput,
} from './fold-layout';

// Pane chrome — composable pieces the host arranges, exported for direct use
// by feature screens and Storybook.
export { CollapsiblePane, type CollapsiblePaneProps } from './CollapsiblePane';
export { DetailNavbar, type DetailNavbarProps } from './DetailNavbar';
export { PaneDivider, type PaneDividerProps } from './PaneDivider';
export { PaneEdgesContext, usePaneEdges, type PaneEdges } from './pane-edges';
export { PaneListHeader, type PaneListHeaderProps } from './PaneListHeader';
export { PaneSearchBar, type PaneSearchBarProps } from './PaneSearchBar';
export { PaneToggle, type PaneToggleProps } from './PaneToggle';
export {
  usePaneControlsStore,
  publishPaneControls,
  clearPaneControls,
  type PaneControlsRegistration,
} from './pane-controls.store';
export { SidebarSection, type SidebarSectionProps } from './SidebarSection';
export { SwipeableRow, type SwipeableRowProps, ACTION_WIDTH } from './SwipeableRow';
export { usePaneVisibility } from './use-pane-visibility';
export { useStickyHeader, type StickyHeader } from './use-sticky-header';
export { usePaneSearch, usePaneSearchStore } from './pane-search.store';
export { usePaneOverrideStore } from './pane-overrides.store';
