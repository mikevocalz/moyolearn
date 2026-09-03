// The per-shell primary navigation. One component, config-driven, so all five
// role shells share the slab visual language (2px ink border, hard offset
// shadow) while each shell declares only its items — doc 36 §5's "one product,
// different door" as a component contract.
//
// TWO FORMS, ONE ITEM LIST (doc 02 §2.1, measured on the WINDOW not the
// device): compact (<600dp) renders the bottom bar; medium and wider render a
// vertical RAIL on the trailing edge. The shell layouts flip
// `tabBarPosition` to 'right' at the same threshold, so react-navigation's own
// BottomTabView turns its container to `flexDirection: 'row'` and the rail is a
// real flex sibling of the scene — no absolute overlay, no scene padding to
// keep in sync. Structure taken from poke-xr's PokeballTabBar (one component,
// `if (rail) return <column/>` before the row return, emphasis slot kept in the
// middle of the item order); its `position:absolute` + `sceneStyle.paddingRight`
// compensation is deliberately NOT taken, because that repo's header is a
// floating overlay and ours is inside the scene.
//
// GEOMETRY IS PLATFORM-SPEC, from `navChrome` in packages/theme/tokens.ts:
// rail 96 (Material 3 `NavigationRailCollapsedTokens.ContainerWidth`; 80 is its
// narrow variant), raised slab 64 (between Material's 56 standard FAB and 96
// large FAB — iOS has no raised-tab convention to defend against). The selection
// marker takes Material's SHAPE rule (hug the content, never fill the cell) but
// its height from the age band, because our smallest band already exceeds
// Material's 32. Both are px: they used to be rem-derived Tailwind steps, and the mobile bundler
// resolves rem at 14 (apps/mobile/metro.config.js), so the whole nav shell was
// shipping at 87.5% of the size the code claimed.
//
// The raised center slot (learner Snap) follows Speechify's raised
// primary-action tab. It is a rounded SQUARE slab, never a circle — the kit's
// TabBar emphasis slot is `rounded-md` and the radius law (doc 02 §A.5) bans
// pill-ifying the language. Its 64 floor is lifted, never lowered, by the
// age-band target token, so a K–2 thumb gets the NN/g 2cm target and no other
// band shrinks.
//
// Role accent: the focused underlay consumes `bg-role-accent-underlay` BY NAME
// (doc 36 §5 allowlist: "active tab/nav indicator underlay"). PR-141 owns the
// token; until it lands the class is inert and the ink border + label weight
// carry selection alone — which is also the doc 08 §4.9 fallback.
//
// DEFERRED — doc 02 §2.3 hinge awareness. Moving nav to a VERTICAL edge is the
// part of §2.3 that lands today: a bottom bar spanning a Surface Duo would
// straddle the hinge, a rail on either side structurally cannot. The rest of §2.3 —
// snapping the pane split to the hinge, refusing to straddle it, and the
// tabletop (HALF_OPENED + HORIZONTAL) posture that docks actions to the lower
// half — needs the hinge RECTANGLE in window coordinates, which JS cannot
// derive from width at all. BLOCKER: the `androidx.window` `WindowInfoTracker`
// / `FoldingFeature` native module costed and deliberately not built in
// packages/ui/adaptive-panes/PHASE-8-FOLDING-FEATURE.md. Until it exists this
// component classes the window it is given and makes no hinge claim.
//
// Mobbin: Speechify raised center tab (mobbin.com/screens/6fd8ade9-3090-4143-9141-a1c4051a81e2) ·
// Quizlet 4-tab bar (mobbin.com/screens/d8bb66b8-7bae-4cc3-8241-7aab8e04be5a) ·
// Headway 4-tab bar (mobbin.com/screens/b7fa7b42-bea8-4d9d-b89f-1042779ffb17) ·
// Gmail tablet navigation rail (mobbin.com/screens/0b7b3e8f-2a4d-4f1e-9c33-6a5f1f0b7c21) ·
// Asana tablet navigation rail (mobbin.com/screens/3c9d1a52-77b8-4e0a-9b6d-2f4a8e51d0c9)
// SOT: docs/pack/36-role-navigation-flows.md §3 §5 · docs/pack/08-visual-hierarchy-spacing-spec.md §4.9 ·
//      docs/pack/02-adaptive-screens-design-spec.md §2.1 §2.3
// SOT-KEYWORDS: shell tab bar role raised center camera band target slab rail size class foldable hinge

// expo-router's `react-navigation` entry does not re-export the bottom-tabs
// types, so this reaches the module that declares them.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ComponentType } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowSizeClass } from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { haptics } from '@acme/ui/haptics';

/**
 * Where the navigator must DOCK the bar, for the same window the bar itself
 * classes. Exported so the five shell layouts cannot drift from the component:
 * a layout that said `left` while the bar still drew a horizontal row would put
 * a full-width bottom bar in a 112dp column, and nothing would have failed.
 *
 * `right`, and this is a deliberate departure from Material, which start-aligns
 * its navigation rail. Stated plainly so nobody "corrects" it back: the product
 * owner chose the trailing edge. It is defensible on this product's own layout
 * rather than on the platform convention — AdaptivePanes puts its primary pane
 * on the LEADING edge, so a leading rail stacks two navigation columns against
 * each other on exactly the tablet widths where both are visible, and the rail
 * ends up separated from the content it navigates by a second list. On the
 * trailing edge the shell's nav and the screen's own pane sit on opposite sides
 * of the content, which is also where a tablet held two-handed puts the thumb.
 *
 * What it does NOT change is the doc 02 §2.3 property: a bottom bar spanning a
 * dual-screen device straddles the hinge, and a rail on EITHER vertical edge
 * cannot, because it lives entirely within one half.
 */
export function useShellTabBarPosition(): 'bottom' | 'right' {
  return useWindowSizeClass() === 'compact' ? 'bottom' : 'right';
}

export interface ShellTabItem {
  /** The route name inside the shell's (tabs) group. */
  name: string;
  label: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  /** The Speechify slot: rendered as a raised rounded-square slab. At most one. */
  raised?: boolean;
}

interface ShellTabBarProps extends BottomTabBarProps {
  items: ShellTabItem[];
  /**
   * Hot shells pass the learner's band so item height clears the band's target
   * token; Cool shells omit it and get the adult 44.
   */
  targetClass?: string;
  /**
   * The band's target as a min-h AND min-w pair, applied to the raised slab on
   * top of its 64 base. A FLOOR, never a size: at `young` it lifts the slab to
   * the NN/g 2cm target the K–2 band requires, and at every other band the
   * token (56/48/44) is under 64 so the slab keeps the size it already had.
   * Written this way because the signature action must also stay the physically
   * largest thing on the bar — sizing it directly from the band token would
   * SHRINK it for teens, which is the opposite of the rule.
   */
  raisedTargetClass?: string;
}

export function ShellTabBar({
  state,
  navigation,
  items,
  targetClass,
  raisedTargetClass,
}: ShellTabBarProps) {
  const insets = useSafeAreaInsets();
  /*
    The FOUR-band hook, not the binary `useSizeClass`. Both read the window and
    both are foldable-honest, but they answer different questions and
    adaptive-panes/constants.ts says so in as many words: the binary 768 split
    decides one column vs two, while these four bands own the progression whose
    collapse rule is "step to a rail, then drop". Doc 02 §2.1 puts the rail
    threshold at 600, so the 768 hook would leave a 700dp window on a phone's
    bottom bar — the exact defect being fixed.
  */
  const sizeClass = useWindowSizeClass();
  const rail = sizeClass !== 'compact';
  const minTarget = targetClass ?? 'min-h-target-adult';
  const raisedTarget = raisedTargetClass ?? '';

  const rendered = items.map((item) => {
    const index = state.routes.findIndex((route) => route.name === item.name);
    if (index === -1) {
      // The silent skip once shipped a 1-of-5 tab bar (G §1.8 · ADR-101):
      // dev fails loud; production keeps the safe skip so a bad ITEMS entry
      // degrades a shell instead of crashing it.
      if (__DEV__) {
        console.error(
          `ShellTabBar: ITEMS entry "${item.name}" has no route file in this (tabs) group — the tab is silently dropped. Add the route file or remove the entry.`,
        );
      }
      return null;
    }
    const route = state.routes[index]!;
    const focused = state.index === index;

    const onPress = () => {
      haptics.selection();
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    if (item.raised) {
      return (
        <Pressable
          key={route.key}
          aria-label={item.label}
          aria-selected={focused}
          onPress={onPress}
          className={rail ? 'items-center' : 'flex-1 items-center'}
        >
          {/*
            On the bottom bar the slot breaks the bar's top edge (`-mt-8`) — the
            signature action is physically the biggest, highest thing on the bar
            on every band. A vertical rail has no top edge to break, so there the
            emphasis is carried by size and by the slot's position in the middle
            of the column, and the negative margin is dropped rather than
            reinterpreted as a sideways overhang into the content.
          */}
          <View className={rail ? 'items-stretch gap-0.5 py-stack' : '-mt-8 items-center gap-0.5'}>
            <View
              /*
                ROUNDED SQUARE, not a circle. The kit's own emphasis slot
                (packages/ui/TabBar.tsx) is `rounded-md`, and doc 02 §A.5's
                do/never table bans "pill-ifying the language" — this component
                had diverged into `rounded-full` and was the one circle in the
                chrome.

                `h-nav-raised` (64) replaces a bare `h-16`. Same intended size,
                but `h-16` is 4rem, and the mobile bundler resolves rem at 14, so
                the slab was actually shipping 56 — a standard Material FAB —
                while the code and every review read 64. The token is px, so the
                number is the number on both platforms. `raisedTarget` still only
                ever raises it (K–2 → 72).
              */
              className={`${rail ? 'w-full' : 'w-nav-raised'} h-nav-raised ${raisedTarget} items-center justify-center rounded-md border-2 border-on-surface-footer bg-action-primary shadow-card ${
                focused ? '' : 'active:opacity-80'
              }`}
            >
              <item.Icon size={30} className="text-on-action-primary" />
            </View>
            {/*
              NO visible label under this one slot, deliberately. Every other item
              needs its label — an icon alone is ambiguous at 24px — but the raised
              slab is 64–72 with a camera glyph at 30, and a caption under an
              element that size reads as a stray word rather than as a tab name.
              It was also the only label sitting under a RAISED element, so it
              broke the baseline the other labels share and made the bar look
              misaligned. Material's own FAB-in-a-bar carries no label either.

              The accessible name is untouched — `aria-label` on the Pressable
              above is what a screen reader announces, and it was never the
              visible Text. Removing the glyph's caption does not remove the
              name.
            */}
          </View>
        </Pressable>
      );
    }

    /*
      ONE selected-state treatment, in every shell and in both forms of the bar.

      Material 3 gives the navigation bar a single active indicator — a
      `secondary-container` pill behind the icon with `on-secondary-container`
      type on it, and `on-surface-variant` for everything unselected — and Apple's
      tab bars do the same job with one tint. The shell had THREE looks in one
      rail (a filled marker slab, a plum slab, and bare text) because selection
      was forked per role and per band, and no user could learn what "selected"
      looked like.

      The Moyo dialect of that indicator is the MARKER: doc 08 §4.6 already makes
      highlighter-with-ink the product's selection language, and the house's 2px
      ink border keeps the neubrutalist frame the rest of the chrome carries. It
      is deliberately NOT `action-primary` — the raised camera slab owns that
      fill, and reusing it made selection read as a second button.

      Door identity is not carried here at all. It is carried by the chrome
      surface the whole bar sits on (`surface-header`/`surface-footer`, one
      family per door), which is what M3 means by keeping the bars on one surface
      and spending colour only on the indicator.
    */
    const focusedSlab = 'border-on-surface-footer bg-highlighter shadow-card';
    const focusedText = 'text-on-highlighter';

    return (
      <Pressable
        key={route.key}
        aria-label={item.label}
        aria-selected={focused}
        onPress={onPress}
        /*
          `flex-1` divides the bar's WIDTH between items and is right there. On
          the rail the items must not divide its HEIGHT — four tabs stretched
          over 800dp would put 200dp of slab behind each icon — so the rail item
          sizes to its content and the column distributes the slack instead.
        */
        className={rail ? undefined : 'flex-1'}
      >
        {/*
          Unselected keeps a transparent border so selection never shifts layout
          by the border's width.

          `self-center` + `px-inset-tight`, NOT a stretched block. Material's
          active indicator is a 56×32dp marker sitting behind the ICON with the
          label below it (`NavigationBarVerticalItemTokens.ActiveIndicatorWidth`
          / `ActiveIndicatorHeight`); iOS marks selection with tint alone and no
          shape at all. Ours was neither: it filled the entire tab cell edge to
          edge and full height, which is why the selected tab read as a BUTTON
          rather than as state — the thing the user actually reported.

          We keep the house fill (doc 08 §4.9 reserves solid fills for the
          child's world, and DashboardShell settled on a filled rect for the
          sidebar after pulling six shipped products), and we keep Material's
          shape discipline: the marker hugs its content instead of spanning the
          slot. Width is content-driven rather than Material's fixed 56 because
          our labels are words, not a single glyph.

          The height stays the AGE BAND's target and nothing else. Material's
          `ActiveIndicatorHeight` is 32, and a first pass put that on here beside
          the band class — two `min-height` declarations on one element, where
          the later class simply wins. It measured 54.7dp on a K–2 device that is
          required to be 72: a rule meant to document Material's floor silently
          overrode a child's touch target. The two never needed to coexist —
          our SMALLEST band (adult, 44) is already above Material's 32, so the
          band is always the binding constraint and the indicator height has
          nothing left to say.
        */}
        <View
          className={`${minTarget} self-center items-center justify-center gap-0.5 rounded-md border-2 px-inset-tight py-1.5 ${
            focused ? focusedSlab : 'border-transparent hover:bg-surface-sunken'
          }`}
        >
          {/*
            Resting items carry the footer's ink at semibold, selected steps to
            bold on the marker — weight and fill do the work. `text-text-muted`
            was the CONTENT ground's muted ink and measured 3.42:1 on the dark
            footer, so the resting labels failed AA in exactly the scheme where
            they were hardest to read.
          */}
          <item.Icon size={24} className={focused ? focusedText : 'text-on-surface-footer'} />
          <Text
            numberOfLines={1}
            className={`text-label ${focused ? `font-bold ${focusedText}` : 'font-semibold text-on-surface-footer'}`}
          >
            {item.label}
          </Text>
        </View>
      </Pressable>
    );
  });

  if (rail) {
    /*
      `w-nav-rail` is 96 — Material 3's OWN collapsed rail width
      (`NavigationRailCollapsedTokens.ContainerWidth = 96.dp`; its
      `NarrowContainerWidth` is the 80dp variant, and the expanded rail is
      220–360). This was `w-28`, which is 7rem: 112 on web and 98 on device,
      because the mobile rem base is 14. Two different widths, neither of them a
      number anyone had chosen. 96 is the platform standard AND the width this
      product needs — the rail carries a label under every icon (DashboardShell's
      ratified rail rejected icon-only: "a bare icon rail costs a
      hover-and-wait on every navigation", which on a touch tablet is not even
      available; doc 36 §4.1 requires visible labels independently), and it has
      to fit the K–2 72px emphasis slab with padding, which 80 cannot do.

      iPadOS has no rail primitive to reconcile against — Apple's nearest
      equivalents are the sidebar and iOS 18's floating tab bar — so Material's
      number is the one that governs.

      The rail carries its own top/bottom insets: react-navigation makes it a
      flex SIBLING of the scene at `tabBarPosition: 'right'`, so it spans the
      full window height beside the header rather than sitting under it, and the
      header's own SafeArea does not cover it.

      TRAILING edge, so the divider is `border-l-2` (the rule belongs on the side
      facing the content) and the horizontal inset it consumes is `insets.right`.
      Both flip together with the position — a rail on the right that still drew
      its border on the right would put a rule against the screen edge and none
      at all against the content, and `insets.left` would pad the wrong side in
      landscape. `insets.right` is the real cutout/gesture inset on this edge.
    */
    return (
      <View
        role="tablist"
        aria-label="Main navigation"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom, paddingRight: insets.right }}
        className="w-nav-rail flex-col items-stretch justify-center gap-1 border-l-2 border-on-surface-footer bg-surface-footer px-1 py-2"
      >
        {rendered}
      </View>
    );
  }

  return (
    <View
      style={{ paddingBottom: insets.bottom }}
      className="flex-row items-end gap-1 border-t-2 border-on-surface-footer bg-surface-footer px-2 pt-1"
    >
      {rendered}
    </View>
  );
}
