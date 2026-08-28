# AdaptivePanes

The adaptive list-detail navigator — one renderer on **every** platform
(doc 37 §3.2), promoted here from `apps/mobile/src/navigation/split-view`
under doc 30's category-6 rule.

expo-router's [`unstable-split-view`](https://docs.expo.dev/versions/latest/sdk/router/split-view/)
is **not** used: it is alpha, iOS-only, root-layout-only, and doc 37 §3.2
defers it until it exits alpha. Until then this app-layer layout serves iOS,
Android and web alike — one behavior to test instead of two. The compound API
below is the adoption seam if the native renderer ever lands: columns are
matched by type identity exactly as expo-router's SplitView matches its own.

```tsx
import { AdaptivePanes } from '@acme/ui';

<AdaptivePanes topColumnForCollapsing="primary" showInspector detail={<ReportDetail />}>
  <AdaptivePanes.Column>{/* sidebar / list */}</AdaptivePanes.Column>
  <AdaptivePanes.Column>{/* supplementary list */}</AdaptivePanes.Column>
  <AdaptivePanes.Inspector>{/* inspector */}</AdaptivePanes.Inspector>
</AdaptivePanes>
```

## The detail pane — escape hatch first

`detail` content wins; with no `detail` prop the native build renders
expo-router's `<Slot />` (`detail-slot.native.tsx`) so a route layout can let
the router drive the trailing pane. On web there is no router slot
(`detail-slot.web.tsx` renders null), so a web host must supply `detail` —
which is also what makes the host storyable. The expo-router import lives
ONLY in the native fork, so the web build of this package never resolves it.

## Breakpoints

Doc 02 §2.1 width classes, in dp, from `widthClassMinDp` in
`packages/theme/tokens.ts` — the single source. `constants.ts` re-orders them
widest-first for resolution; nothing else in the module names a number.

| Class | Min width |
|---|---|
| `compact` | 0 |
| `medium` | 600 |
| `expanded` | 840 |
| `large` | 1200 |

**A second width system exists on purpose**: `packages/ui/size-class.constants.ts`
splits `compact|regular` at 768 dp for one-column/two-column decisions —
TutorStage and DashboardShell hold that line. These four bands decide how many
panes tile; the 768 split decides screen composition. Do not merge them.

Pane widths come from `--container-pane-*` tokens in `packages/theme/tokens.ts`,
so panes are sized by `w-pane-primary` and friends rather than arbitrary values.
`pane-widths.ts` mirrors them as dp for the width animation (rem polyfill 14 —
tested in `pane-overrides.test.ts`).

## Visibility policy

`columnCount` is the number of authored `AdaptivePanes.Column` children.

**Two-pane shape (1 column + detail)**

| Size class | primary | supplementary | inspector | detail |
|---|---|---|---|---|
| large | full | — | yes | flex |
| expanded | full | — | yes | flex |
| medium | narrow rail | — | no | flex |
| compact | single pane only | — | no | single pane only |

**Three-pane shape (2 columns + detail)**

| Size class | primary | supplementary | inspector | detail |
|---|---|---|---|---|
| large | full | yes | yes | flex |
| expanded | narrow rail | yes | no | flex |
| medium | hidden | yes | no | flex |
| compact | single pane only | single pane only | no | single pane only |

At `compact` exactly one pane renders. The inspector occupies **no layout
space** below `expanded` — it is not rendered zero-width. Collapse is decided
by **width class, never device type** (doc 37 §3.2): a folded foldable is a
phone, a resized window is whatever width it currently is.

Diagnostics: more than two `AdaptivePanes.Column` **throws**, foreign children
warn, zero children warn and fall back to the detail pane.

`show(column)` on the host ref: collapsed, it swaps the visible pane;
expanded, it is a visual no-op but the column is recorded so a later collapse
lands there. Requesting `supplementary` in the two-pane shape clamps to
`primary`.

## State — one scoped store per host

`store.ts` is a **per-instance** vanilla Zustand store created by the host in
a ref (the kit's `use-instance-store` pattern) and provided via context
(`context.tsx`). It carries `column`, `direction`, `primaryWidth` and
`selectedId` — doc 37 §3.2's "selection survives the fold" lives here:
compact ⇄ expanded ⇄ compact returns to the same column **and the same
selected record**, and two mounted hosts (tutor Notes, guardian Reports) can
never share a selection the way the old module-level singleton forced.

- Inside a host: `useAdaptivePanesStore(selector)` (throws outside one —
  divider, back hook).
- Pane content that also renders outside any host (compact routes, web
  pages): `useAdaptivePaneSelection()` — null-safe; a `select` of `null` is
  how a screen knows to navigate instead of select.

## Platform forks

The renderer is identical everywhere; only leaf couplings fork
(`.native`/`.web` + a same-extension anchor — see `detail-slot.tsx` for the
Metro resolution-order trap the anchors avoid):

| File | native | web |
|---|---|---|
| `detail-slot` | expo-router `<Slot />` | null — supply `detail` |
| `use-split-view-back` | Android `hardwareBackPress` (no-op on iOS — `Platform.OS` guard; no hardware Back exists there) | no-op — browser Back is history, owned by the router |
| `pane-overrides.store` | MMKV, instance id `split-view` | `localStorage` behind MMKV's shape, absent during SSR |
| `PaneDivider` | Gesture Handler drag + keyboard | keyboard/press only — GH is not in Next's `transpilePackages`, same trade as the schedule feature's EventDrag |
| `SwipeableRow` | Gesture Handler + Reanimated swipe | static row — swipe is a touch idiom; expose the action as a visible control |
| `use-sticky-header` / `PaneListHeader` | Reanimated auto-hide | static header |

The sizing math itself is portable (dp/points, no PixelRatio).

## Back behaviour (Android)

Order: pop within the detail pane's stack → step back one column → fall through.

Two implementation notes that are easy to get wrong:

1. **Subscription ordering is inherited, not arranged.** `BackHandler.android.js`
   walks `_backPressSubscriptions` last-registered-first and stops at the first
   handler returning `true`. expo-router's navigation container mounts *above*
   the split view, so it subscribes *earlier* and runs *after* this handler.
   Returning `false` is therefore what hands the press down to it. We never call
   `router.back()` ourselves — that would double-pop by racing the container.

2. **Predictive back is off in this app.** `AndroidManifest.xml` has
   `android:enableOnBackInvokedCallback="false"`, so the legacy `hardwareBackPress`
   path is authoritative. If that is ever flipped to `true`, `useSplitViewBack`
   must move to `onBackInvokedCallback`, because the legacy event stops firing.

**Deliberate refinement:** the stack pop is scoped to when the detail pane is the
visible one. Popping unconditionally would, while the sidebar is showing, spend a
Back press mutating a stack the user cannot see — a press that looks dead. Tested
in `split-view.test.ts`.

### Back priority chain

`resolveSearchBack` in `pane-search.ts`, applied by `use-split-view-back.native.ts`.
Highest first:

1. Focused search with a non-empty query → **clear the query**, keyboard stays.
2. Focused search with an empty query → **blur**.
3. Detail pane showing with a poppable stack → **defer** to the navigator.
4. Collapsed split view not on the leading column → **step back one column**.
5. Nothing left → **fall through** to the system.

1 and 2 outrank navigation because the keyboard is the most recent thing the
user opened and Back undoes the most recent thing. The clear decision reads the
DRAFT, not the debounced query, so Back still empties a field typed within the
debounce window. Search focus also gates horizontal gestures
(`horizontalGesturesEnabled`): while a field holds focus a drawer swipe is
disabled, because a horizontal drag near the edge is also how you move the caret.

## Pane visibility: automatic policy vs manual overrides

Two things decide whether a pane is on screen, and they disagree unless the
precedence is written down. It is `resolvePaneVisibility` in
`pane-overrides.ts`, and it is pure so every combination is unit-tested before
it reaches a component (`pane-overrides.test.ts`).

1. `paneVisibility(sizeClass, columnCount)` computes the DEFAULT for the current
   size class.
2. An override recorded for THIS size class replaces that default.
3. An override recorded for a DIFFERENT size class is ignored. Crossing a
   breakpoint lands on the new class's own default unless it too has one — so
   hiding the list on a tablet does not hide it on a phone, where it is the only
   thing on screen.
4. Overrides persist through `pane-overrides.store.shared.ts` over the platform
   storage fork (MMKV native / localStorage web), key `pane-overrides`, as a
   JSON blob of the size-class-keyed map. Reads are synchronous, so the first
   render already knows the answer and no pane flashes open before an async
   read resolves. A malformed blob is discarded rather than left to strand a
   pane.
5. An override can always HIDE a pane, but can only SHOW one the size class can
   physically fit (`canShow`). Compact shows exactly one pane and the navigator
   owns which, so nothing there is user-togglable; medium fits the primary rail
   beside the detail, but not a third column.

`primaryNarrow` — the rail step — is derived, never toggled: a hidden pane is
not narrow, it is absent.

Unlike the layout store, overrides are module-level: they are a device-wide
preference, not per-surface state.

## Animation boundary: Reanimated vs Legend Motion

Both systems are in this app deliberately, and the split is by KIND of
animation, never mixed inside one component.

| System | Owns | Why |
|---|---|---|
| **Reanimated** (+ Gesture Handler) | sticky header, divider drag, swipeable rows | Anything tracking a finger or a scroll offset must update every frame on the UI thread. |
| **Legend Motion** | pane show/hide, inspector drawer, chevron rotation, entrances | Declarative state transitions. Zero-dependency, built on RN `Animated`. |

Legend Motion is built on React Native's `Animated`, not Reanimated, and RN
cannot mix native-driven and JS-driven properties on one component — so neither
can Legend Motion. Native-driven: `opacity`, `x`, `y`, `scale`, `rotate` and
friends. Everything else — `width`, `flexBasis`, colours — is JS-driven.

That is why `CollapsiblePane` animates **width and nothing else** on its own
node, with the pane's content on a separate inner view. Width is the deliberate
choice over a native-driven `translateX`: sliding the pane out would leave its
width in the layout, so the detail pane would keep its old size and a blank
strip would sit where the pane used to be. Neighbours have to reflow, and only
an animated width makes them do it continuously.

Moti is the Reanimated-backed alternative with a similar API if we ever want one
system; it is deliberately not installed (never moti — Legend Motion stays).

## Transition tokens

Named in `transitions.ts`; no inline transition literals anywhere.

| Token | Shape | Drives |
|---|---|---|
| `paneSlide` | spring, damping 28, stiffness 260 | Pane translateX (native-driven) |
| `paneWidth` | timing 220ms easeInOut | Pane width — a TWEEN, because a spring on width reflows every neighbour on each overshoot frame |
| `paneContent` | timing 160ms easeOut | Content fade/slide inside a pane |
| `disclosure` | timing 180ms easeInOut | Chevron / toggle rotation |
| `selection` | timing 140ms easeOut | Selected-row colour |

## Search

Panes COMPOSE `PaneSearchBar` rather than taking a `searchable` flag. A boolean
would make the pane own the placeholder, result count and field placement, none
of which the split view can know — and composition gives "no layout space when
absent" for free, since a pane that does not render it has nothing to reserve.

State is one slice per pane in `pane-search.store.ts`: a global query would leak
one pane's filter into the other's list, which at expanded widths is the normal
case. (Search state is intentionally module-level like overrides — a draft query
is keyboard-transient, and the Back chain reads it store-first at press time.)
Debounce is owned by `PaneSearchBar`, not delegated to the kit's `SearchBar` —
that component debounces `onChangeText` and keeps the instant text internally,
which would make the store's draft lag the field.

## Swipeable rows (native)

`swipe-actions.ts` (pure, tested) + `SwipeableRow.native.tsx`. Two thresholds:

- **Open** at half the action width — the row parks so the buttons can be tapped.
- **Commit** past 60% of the ROW width — far enough that peeking at the actions
  can never fire one by accident.

Velocity is considered before distance, so a quick flick commits even having
covered little ground, and a flick back always closes.

## Gesture arbitration

The split view has exactly one horizontal recognizer — the pane divider — and
it is confined to its own hit area. Collapse is derived from the window size
class, column stepping comes from Back, and any horizontal scrolling lives
inside the detail pane. Two recognizers that can never receive the same pointer
do not need a race.

The rule that preserves this: **the divider must not grow its hit slop into the
detail pane.** If it ever needs a larger target, or if swipe-to-collapse is
added, the divider's pan genuinely competes with the detail's scroll for the
same pointer and must be composed with `useCompetingGestures`, with the decision
written down here.

Note the API: Expo SDK 57 pins Gesture Handler **2.x**, so the builder API
(`Gesture.Pan()` + `GestureDetector`) is current here and composition is
`Gesture.Race()` / `Gesture.Simultaneous()`. GH 3.x flips this — it deprecates
the builder in favour of `usePanGesture` and the `use*Gestures` hooks. Check the
installed version before writing gesture code.

## Styling rules

Tailwind classes only — no `StyleSheet`, no hex literals, no inline `style` for
appearance. The single documented exception is **computed geometry**: animated
pane widths in dp may be passed numerically, and may never carry a colour,
radius, border or spacing value.

State is Zustand. There is no `useState` in this module.

## Consumers

- **Tutor Notes queue|draft** — `apps/mobile/app/(tutor)/(tabs)/notes.tsx` →
  `SummaryQueuePaneScreen` (`packages/app/features/summary/`).
- **Guardian Reports|report** — `apps/mobile/app/(guardian)/(tabs)/reports.tsx` →
  `ReportsPaneScreen`; compact keeps the `(guardian)/reports/[sessionId]` route.
- **Learner: never** (doc 37 §3.3 — single-focus by design). Ops is a web
  sidebar app; no panes.

## Verification status

The policy modules are `node --test`ed (`pnpm --filter @acme/ui test`). The
divider's drag, the pane transitions and focus traversal between panes are
implemented but **unverified on a device in this promotion pass** — the module
was proven on Android at its old path; re-verification on iOS/web devices is
owed before §0's "working everywhere" is claimed.

## Testing

`node --test` with `node:assert` — zero test dependencies. Node 24 strips
TypeScript natively, so `.test.ts` runs directly.

```
pnpm --filter @acme/ui test   # size classes, visibility, back policy, overrides, search, swipe, selection
```

Testable logic is kept in modules with no `react-native` import so it stays
runnable under plain node.

## Prior art

- [`craftzdog/inkdrop-ui-mockup-react-native`](https://github.com/craftzdog/inkdrop-ui-mockup-react-native)
  (Apache-2.0) — collapse choreography, auto-hiding header, search-focus gesture
  gating, swipe-to-reveal rows. Reimplemented, never copied — that project is
  React Navigation v6 + jotai + Restyle + RN `Animated`; this is expo-router +
  Zustand + Legend Motion + Reanimated.
- [`craftzdog/react-native-three-column-layout`](https://github.com/craftzdog/react-native-three-column-layout)
  (MIT) — fixed leading widths with a flexible trailing pane. Its render-prop +
  imperative `*Visible` API was **rejected**: visibility here is derived from the
  window size class and children are JSX. Not added as a dependency.
- Mobbin, structure only: [Plain](https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7)
  (sidebar + list + detail), [Featurebase](https://mobbin.com/screens/0b8a7848-7bbb-4b35-8999-d71b47f469c3)
  (multi-column inbox + details inspector), [Zillow](https://mobbin.com/screens/9dae9f31-b569-44e1-948b-5dcae49c1e7a)
  (list|detail with selected-row highlight), [Threads](https://mobbin.com/screens/beafa73d-3c43-4ddc-9949-b0b1c2f76d12)
  (list drives detail column).

Its `RESPONSIVE_SCREEN_BREAKPOINT = 1024` single boolean and its practice of
rendering different subtrees per size class were both rejected: this module uses
four window size classes and keeps ONE tree, so panes survive rotation and
multi-window resize with scroll position, selection and search intact.
