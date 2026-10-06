import { Tabs } from 'expo-router';
import { Bell, CalendarDays, FileText, Home, LineChart, Sparkles, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../../components/ShellHeader';
import { ShellPaneEdges, ShellTabBar, useShellNavigationPlacement, type ShellTabItem } from '../../../../components/ShellTabBar';

/**
 * Guardian tabs — doc 36 §3.2: Home · Reports · Alerts · Family, adopted by
 * ADR-101 (docs/decisions/adr-101-guardian-tab-set.md). Alerts is its own tab
 * so serious things never hide under a bell icon; Family holds children +
 * controls including plan/billing. Calendar is a stack route pushed from
 * Home/Family, not a tab. Messages and Account are retired per ADR-101 (no
 * messaging surface exists; account content moves to the ADR-106 sheet) —
 * their route files and screen entries are removed.
 *
 * Messages stays struck rather than deferred: the precondition failed, not a
 * decision. There is no messaging collection, no participants model, no unread
 * state and no route under apps/web/app/api. It returns when all four exist and
 * the doc 31 safety review has run, and not before — a tab here without them is
 * an empty state that can never fill. Struck 2026-09-05,
 * docs/design/reset/03-dispositions.md S1.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'family-home', label: 'Home', Icon: Home },
  { name: 'reports', label: 'Reports', Icon: FileText },
  { name: 'alerts', label: 'Alerts', Icon: Bell },
  { name: 'family', label: 'Family', Icon: Users },
];

/*
  The drawer's list — the group's STACK routes, exactly the destinations that
  are real but hold no rail slot (ADR-101: calendar is "one push away", not a
  tab). `reports/[sessionId]` takes a param so it cannot be a bare entry. The
  (drawer) layout imports this single list for its content and the rail reads
  it for the footer button, so the two cannot drift.
*/
export const DRAWER_EXTRAS: ShellTabItem[] = [
  { name: 'memory', label: 'Memory & Data', Icon: Sparkles },
  { name: 'ai-activity', label: 'AI Activity', Icon: LineChart },
  { name: 'calendar', label: 'Calendar', Icon: CalendarDays },
];

const TITLES: Record<string, string> = {
  '/family-home': 'Home',
  '/reports': 'Reports',
  '/alerts': 'Alerts',
  '/family': 'Family',
};

export const unstable_settings = {
  /* When a pushed stack route's rebuilt state reseeds this tab set (guardian
     stack's initialRouteName is `(drawer)`), hardware back must land on the
     home tab — not whatever the file-sorted linking config picks first
     (observed: 'alerts'). */
  initialRouteName: 'family-home',
};

export default function GuardianTabs() {
  // Doc 02 §2.1: bottom nav under 600dp, rail from 600 up.
  const navigationPlacement = useShellNavigationPlacement();
  return (
    <ShellPaneEdges>
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Home" />,
        tabBarPosition: navigationPlacement.position,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} placement={navigationPlacement} railAlignment="top" hasOverflowDrawer={DRAWER_EXTRAS.length > 0} />}
    >
      <Tabs.Screen name="family-home" options={{ title: 'Home' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="family" options={{ title: 'Family' }} />
    </Tabs>
    </ShellPaneEdges>
  );
}
