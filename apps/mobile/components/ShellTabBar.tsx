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
// large FAB — iOS has no raised-tab convention to defend against), raise 38
// (how far that slab breaks the bar's top edge). All px: they used to be
// rem-derived Tailwind steps, and the mobile bundler resolves rem at 14
// (apps/mobile/metro.config.js), so the whole nav shell was shipping at 87.5%
// of the size the code claimed.
//
// SELECTION IS THE PLATFORM'S, NOT THE HOUSE'S. The bar wore the neubrutalist
// slab — 2px ink border, hard offset shadow, full-strength fill across the
// whole tab cell — and it read as a BUTTON sitting inside the bar rather than
// as "you are here"; the product owner's words were "too much". Both platforms
// solve this with the lightest possible mark: Apple tints the selected item and
// draws no container at all, and Material 3 puts a pill-shaped ACTIVE INDICATOR
// behind the selected ICON ONLY, with the label outside it on the bare surface
// (m3.material.io/components/navigation-bar/guidelines). What is left here is
// exactly that indicator — no border, no shadow, hugging a 24dp glyph — plus
// the label stepping to bold. Material's fallback rule is also why the label
// stays: it asks for "other cues such as showing the destination label" when an
// icon set has no filled/outlined pair to switch between, and ours (Lucide)
// does not.
//
// The raised center slot (learner Snap) follows Speechify's raised
// primary-action tab. It is a rounded SQUARE slab, never a circle — the kit's
// TabBar emphasis slot is `rounded-md` and the radius law (doc 02 §A.5) bans
// pill-ifying the language. Its 64 floor is lifted, never lowered, by the
// age-band target token, so a K–2 thumb gets the NN/g 2cm target and no other
// band shrinks.
//
// Role accent: doc 36 §5's allowlist names "active tab/nav indicator underlay"
// as one of the five slots the accent may occupy, and this indicator is that
// slot — so when PR-141 lands its token, it replaces the indicator's fill here
// and nowhere else. Until then the indicator carries `bg-highlighter`, the
// product's own selection colour (doc 08 §4.6), and label weight is the second,
// non-colour cue that keeps selection legible without it.
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
// Mobbin (structure only — pulled again for the native-selection pass):
// BeReal raised centre camera, selection by tint with no container
//   (mobbin.com/screens/b83a2290-0e42-457c-b7c1-8768a1cb1bef) ·
// Vivino raised centre camera, active item in a hugging pill
//   (mobbin.com/screens/5ba0521b-9501-478b-bba5-f481bb311878) ·
// Snapchat 5-tab bar, raised centre camera, label under every tab
//   (mobbin.com/screens/9aeab467-10aa-4960-82ef-e4b6533d1196) ·
// Weverse 4-tab bar, selection carried by tint + weight alone
//   (mobbin.com/screens/154967f0-87a8-4fa4-9bcd-24cb43b2477c) ·
// Quicken vertical rail, selected row as a soft tint rather than a bordered slab
//   (mobbin.com/screens/0f4f02a0-2616-4ad9-ada9-05fee5ceea78)
// Platform specs: Material 3 navigation bar (active indicator behind the icon,
// m3.material.io/components/navigation-bar/guidelines) · Material 3 navigation
// rail (m3.material.io/components/navigation-rail/specs) · Apple HIG Tab bars
// (developer.apple.com/design/human-interface-guidelines/tab-bars).
// SOT: docs/pack/36-role-navigation-flows.md §3 §5 · docs/pack/08-visual-hierarchy-spacing-spec.md §4.9 ·
//      docs/pack/02-adaptive-screens-design-spec.md §2.1 §2.3
// SOT-KEYWORDS: shell tab bar role raised center camera band target indicator rail size class foldable hinge haptics

// expo-router's `react-navigation` entry does not re-export the bottom-tabs
// types, so this reaches the module that declares them.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import type { ComponentType } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion, useWindowSizeClass } from '@acme/ui';
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
  /*
    The kit's OWN reduce-motion reader (packages/ui/motion.tsx, already consumed
    by CoachMark and StageBoard) — not a second subscription, and not a per-press
    `AccessibilityInfo` call, which is async and would land after the press it
    was meant to gate.

    A haptic is not motion, and neither platform exposes a "reduce haptics"
    query: iOS keeps system haptics under Settings › Sounds & Haptics with no
    public API, Android's is a vibration intensity the app cannot read. Reduce
    Motion is the only sensory-load preference either OS will tell us about, so
    it is the one this honours — a reader who asked the device to calm down does
    not get buzzed for navigating.
  */
  const reducedMotion = useReducedMotion();

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

    /*
      The tick fires on a CHANGE of tab, never on the tab you are already on.
      It used to fire on every press, so holding a thumb on the open tab
      buzzed the device with nothing happening on screen — a haptic that does
      not correspond to a state change is noise, and iOS/Android both reserve
      the selection tick for the moment the selection actually moves.

      `haptics.selection` (react-native-pulsar's `Presets.System.selection`, via
      the kit's semantic vocabulary — components never call Pulsar directly) and
      not `tap`: it is the lightest tick we have, which is what a navigation
      change gets. `@acme/ui/haptics` already no-ops when the native TurboModule
      is missing from the binary, so a JS-only reload cannot crash the bar here.
    */
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        if (!reducedMotion) haptics.selection();
        navigation.navigate(route.name);
      }
    };

    if (item.raised) {
      return (
        <Pressable
          key={route.key}
          role="tab"
          aria-label={item.label}
          aria-selected={focused}
          onPress={onPress}
          className={rail ? 'items-center active:opacity-80' : 'flex-1 items-center active:opacity-80'}
        >
          {/*
            On the bottom bar the slot breaks the bar's top edge by
            `-mt-nav-raise` (38) — the signature action is physically the
            biggest, highest thing on the bar on every band. 38 of a 64 slab
            leaves 26 seated in the chrome: it was 28/36, which read as a tile
            embedded in the bar rather than as a control standing proud of it.
            A vertical rail has no top edge to break, so there the emphasis is
            carried by size and by the slot's position in the middle of the
            column, and the negative margin is dropped rather than reinterpreted
            as a sideways overhang into the content.
          */}
          <View className={rail ? 'items-stretch gap-0.5 py-stack' : '-mt-nav-raise items-center gap-0.5'}>
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

                NO LIGHT FILL. This slab used to be a near-white/action-yellow
                block with a border round it, and against a pale chrome bar that
                read as a hole in the bar rather than as the product's signature
                control. `bg-nav-cta` is the chrome's own deep CTA — the fill is
                what separates it now — and the 2px ink border stays as
                STRUCTURE (the doc 08 rule: borders are structure, never
                emphasis), the same edge every other raised object in the product
                carries. This is the one place the house's raised language is
                allowed to stay loud, because it is the one control on the bar
                that is an ACTION rather than a destination.
              */
              className={`${rail ? 'w-full' : 'w-nav-raised'} h-nav-raised ${raisedTarget} items-center justify-center rounded-md border-2 border-on-surface-footer bg-nav-cta shadow-card`}
            >
              <item.Icon size={30} className="text-on-nav-cta" />
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
      ONE selected-state treatment, in every shell and in both forms of the bar —
      and it is the PLATFORM'S, not the house's.

      What stood here was a highlighter slab with a 2px ink border and a hard
      offset shadow, filling the whole tab cell. That is the language CONTENT
      uses for buttons, so the selected tab read as a button somebody had left
      pressed — the product owner's report, in his words, was that it was "too
      much". Neither platform marks a tab that way. Apple tints the selected item
      and draws no container at all (HIG, Tab bars). Material 3 draws exactly one
      small ACTIVE INDICATOR: a pill behind the selected ICON, with the label
      outside it on the bare bar, `on-secondary-container` ink inside it and
      `on-surface-variant` everywhere else.

      We take Material's, because the item is icon-over-label and Android is
      where the rail actually ships — but only what Material specifies: no
      border, no shadow, hugging a 24dp glyph, never touching the label. The fill
      is `highlighter` (doc 08 §4.6's selection language, and `on-highlighter` is
      already a ratified contrast pair) and deliberately NOT `action-primary` or
      `nav-cta`, which the raised camera slab owns — selection and action cannot
      wear one paint or the bar has two buttons and no state.

      Selection is never carried by colour alone (WCAG 1.4.1): the label steps
      from semibold to bold. Material asks for that second cue in as many words
      when an icon set has no filled/outlined pair to swap between — Lucide,
      which is ours, has none.

      Door identity is not carried here at all. It is carried by the chrome
      surface the whole bar sits on (`surface-header`/`surface-footer`, one
      family per door), which is what M3 means by keeping the bars on one surface
      and spending colour only on the indicator.
    */
    return (
      <Pressable
        key={route.key}
        /*
          `role="tab"` matches the kit's own TabBar and the `role="tablist"` on
          both containers below: TalkBack and VoiceOver then announce "tab, 2 of
          4, selected" instead of reading a bare button, which is the difference
          between a native-feeling bar and a row of buttons that happen to
          navigate.
        */
        role="tab"
        aria-label={item.label}
        aria-selected={focused}
        onPress={onPress}
        /*
          `flex-1` divides the bar's WIDTH between items and is right there. On
          the rail the items must not divide its HEIGHT — four tabs stretched
          over 800dp would put 200dp of slab behind each icon — so the rail item
          sizes to its content and the column distributes the slack instead.

          The press dim sits on the PRESSABLE, not on a child: react-native-css
          turns any component carrying an `active:` variant into its own press
          target, and a View that steals the touch from the Pressable wrapping it
          is a dead tab.
        */
        className={rail ? 'active:opacity-70' : 'flex-1 active:opacity-70'}
      >
        {/*
          The cell keeps the AGE BAND's target as its min-height and nothing
          else. Material's `ActiveIndicatorHeight` is 32, and a first pass put
          that here beside the band class — two `min-height` declarations on one
          element, where the later class simply wins. It measured 54.7dp on a K–2
          device required to be 72. Our SMALLEST band (adult, 44) is already above
          Material's 32, so the band is always the binding constraint.
        */}
        <View className={`${minTarget} self-center items-center justify-center gap-0.5 px-inset-tight py-1`}>
          {/*
            The indicator — the only thing that changes shape between states, and
            the padding is on BOTH states so selecting a tab cannot shift the
            layout by the size of its own container; the resting item simply
            draws no fill.

            `rounded-control` — the same radius every button in the system uses,
            NOT Material's pill. Material's indicator is a pill by spec, but this
            product's radius language is squared (doc 02 §A.5 bans pill-ifying
            it) and a lone pill in the chrome read as borrowed from another
            product. Selection is still carried by fill and ink, which is the
            part of the indicator pattern that matters.

            Both axes are content-driven: a 24dp glyph plus `py-1` lands ~31
            against Material's 32, and the width comes from `px-inset-tight`
            rather than Material's fixed 64, which would leave 16 a side inside a
            96 rail and overhang a three-tab K–2 bottom bar.
          */}
          <View
            className={`items-center justify-center rounded-control px-inset-tight py-1 ${
              focused ? 'bg-highlighter' : 'hover:bg-surface-sunken'
            }`}
          >
            <item.Icon size={24} className={focused ? 'text-on-highlighter' : 'text-on-surface-footer'} />
          </View>
          {/*
            Both labels take the footer's ink and only the WEIGHT moves. Material
            varies the ink instead (on-surface vs on-surface-variant) and we
            cannot: `text-text-muted` is the CONTENT ground's muted ink and
            measured 3.42:1 on this chrome, so the resting labels failed AA in
            exactly the scheme where they were hardest to read. Weight is the cue
            that survives the contrast floor.
          */}
          <Text
            numberOfLines={1}
            className={`text-label ${focused ? 'font-bold' : 'font-semibold'} text-on-surface-footer`}
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
        className="w-nav-rail flex-col items-stretch justify-center gap-1 border-l-2 border-on-surface-footer bg-surface-footer"
      >
        {rendered}
      </View>
    );
  }

  /*
    Same `role="tablist"` + name the rail carries. It was on the rail only, so
    the identical bar announced itself as a tab list on a tablet and as an
    anonymous group of buttons on a phone — the form of the bar is a layout
    decision and must not change what assistive tech is told about it.
  */
  return (
    <View
      role="tablist"
      aria-label="Main navigation"
      style={{ paddingBottom: insets.bottom }}
      className="flex-row items-end gap-1 border-t-2 border-on-surface-footer bg-surface-footer px-2 pt-1"
    >
      {rendered}
    </View>
  );
}
