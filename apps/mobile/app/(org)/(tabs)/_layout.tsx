import { Tabs } from 'expo-router';
import { Bell, Calendar, LayoutGrid, Shield } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, useShellTabBarPosition, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Org companion tabs — doc 36 §3.4: Overview · Schedule · Inbox · Safety. The
 * primary action is today's exceptions, which is what Overview leads with.
 *
 * Safety is LAST and carries no badge. It is doc 31 §5.3's triage queue, and
 * §5.3 allows exactly one interrupt — unassigned S4 — which the screen states
 * as a banner it can explain. A count on the tab would put a number about
 * children's worst days in a staff member's peripheral vision all day, and it
 * could not say which kind of number it was.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'overview', label: 'Overview', Icon: LayoutGrid },
  { name: 'schedule', label: 'Schedule', Icon: Calendar },
  { name: 'inbox', label: 'Inbox', Icon: Bell },
  { name: 'safety', label: 'Safety', Icon: Shield },
];

const TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/schedule': 'Schedule',
  '/inbox': 'Inbox',
  '/safety': 'Safety',
};

export default function OrgTabs() {
  // Doc 02 §2.1: bottom nav under 600dp, rail from 600 up.
  const tabBarPosition = useShellTabBarPosition();
  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Overview" />,
        tabBarPosition,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} />}
    >
      <Tabs.Screen name="overview" options={{ title: 'Overview' }} />
      {/* The calendar draws its own header inside its safe area. */}
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', headerShown: false }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="safety" options={{ title: 'Safety' }} />
    </Tabs>
  );
}
