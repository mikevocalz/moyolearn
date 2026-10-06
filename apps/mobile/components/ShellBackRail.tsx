/**
 * apps/mobile/components/ShellBackRail.tsx
 *
 * The pushed-route escape column. Stack screens pushed ABOVE a shell's
 * (drawer)/(tabs) — guardian reports/[sessionId], teacher classes/[classId]
 * and siblings — render no tab bar, so on rail devices the physical edge
 * column the user just left simply vanishes and the only exits are the
 * header chevron and the hardware back gesture. On the Duo this trapped the
 * reader: fold -> tap a report (compact, so the card pushes the detail
 * route) -> unfold -> wide screen, no rail, no visible way back.
 *
 * This component keeps the edge column alive on pushed routes: same width,
 * chrome and border rule as the rail it replaces, with a single Back control
 * anchored just above the slot the rail's footer menu button occupies. It
 * renders ONLY when all three hold: the leaf route is not inside (tabs),
 * the shell navigation placement is an edge column (rail/sidebar, not the
 * compact bottom bar — where the header chevron plus platform back already
 * cover it), and there is actually somewhere to go back to.
 *
 * The column is a flex SIBLING of the Stack, never an overlay — the real
 * rail is a sibling of the scene and this column keeps that contract, so a
 * pushed screen's content can never slide under the chrome.
 *
 * SOT-KEYWORDS: back rail pushed route escape edge column foldable navigation
 */
import { useRouter, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navChrome } from '@acme/theme';
import { useReducedMotion } from '@acme/ui';
import { Pressable, Text, View } from '@acme/ui/tw';
import { haptics } from '@acme/ui/haptics';
import { ChevronLeft } from '@acme/ui/icons';
import { useShellNavigationPlacement } from './ShellTabBar';

const NAV_RAIL_WIDTH = parseInt(navChrome.rail, 10);
/* Matches ShellTabBar's NAV_MENU_ZONE — the footer slot the rail reserves
   for its menu button. Back sits directly above it, where the user asked. */
const NAV_MENU_ZONE = 60;

export function ShellBackRail({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const placement = useShellNavigationPlacement();
  const segments = useSegments();
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  /*
    `useSegments` includes the route groups, so a tab root reads
    `['(guardian)', '(drawer)', '(tabs)', 'reports']` while the pushed detail
    reads `['(guardian)', 'reports', 'abc123']`. Absence of '(tabs)' is the
    pushed marker — no per-role route-name list to maintain. When a route
    outside this shell is focused the whole layout is unmounted, so a stale
    column cannot linger.
  */
  const pushed = !(segments as readonly string[]).includes('(tabs)');
  const edge = placement.position;
  const show = pushed && edge !== 'bottom';

  /*
    The exit is an explicit parent climb, not `router.back()`: the push that
    landed here can REBUILD this navigator's state with the detail as its
    only entry — `canGoBack()` has been observed reporting true while
    `GO_BACK` is unhandled and hardware back exits the app (Duo, folded).
    Drop the pushed leaf and the route groups and `replace`, so no phantom
    history is fabricated — `/reports/abc` returns to `/reports`, a
    one-segment push like `/calendar` returns to `/`.
  */
  const parentHref =
    '/' +
    (segments as readonly string[])
      .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
      .slice(0, -1)
      .join('/');
  const goBack = () =>
    router.replace(parentHref as Parameters<typeof router.replace>[0]);

  /*
    Column order is stable: the scene wrapper is always index 0 and the
    column index 1 for the physical-right rail, so toggling `show` never
    remounts the Stack (and with it the tab state it holds). The left-edge
    Apple sidebar puts the column first — the index flip only happens on an
    actual placement change, which resizes the scene anyway.
  */
  const column = show ? (
    <View
      role="toolbar"
      aria-label="Back navigation"
      style={{
        width: NAV_RAIL_WIDTH + (edge === 'left' ? insets.left : insets.right),
        paddingTop: insets.top,
        paddingLeft: edge === 'left' ? insets.left : 0,
        paddingRight: edge === 'right' ? insets.right : 0,
        /*
          justify-end pins the control at the foot; the extra NAV_MENU_ZONE
          leaves the menu button's slot empty beneath it — "above where the
          menu button would be".
        */
        paddingBottom: insets.bottom + NAV_MENU_ZONE,
      }}
      className={`flex-col items-stretch justify-end ${
        edge === 'left' ? 'border-r-2' : 'border-l-2'
      } border-on-surface-footer bg-surface-footer`}
    >
      <Pressable
        role="button"
        aria-label="Back"
        onPress={() => {
          if (!reducedMotion) haptics.selection();
          goBack();
        }}
        className="min-h-target-adult items-center justify-center gap-0.5 px-inset-tight py-1 active:opacity-70"
      >
        <View className="aspect-square h-nav-indicator items-center justify-center rounded-control">
          <ChevronLeft size={24} className="text-on-surface-footer" />
        </View>
        <Text numberOfLines={1} className="text-label font-semibold text-on-surface-footer">
          Back
        </Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <View className="flex-1 flex-row">
      {edge === 'left' ? column : null}
      <View className="flex-1">{children}</View>
      {edge === 'right' ? column : null}
    </View>
  );
}
