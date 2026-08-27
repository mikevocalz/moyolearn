import { Tabs } from 'expo-router';
import { Bell, Calendar, LayoutGrid } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Org companion tabs — doc 36 §3.4: Overview · Schedule · Inbox. The primary
 * action is today's exceptions, which is what Overview leads with.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'overview', label: 'Overview', Icon: LayoutGrid },
  { name: 'schedule', label: 'Schedule', Icon: Calendar },
  { name: 'inbox', label: 'Inbox', Icon: Bell },
];

const TITLES: Record<string, string> = {
  '/overview': 'Overview',
  '/schedule': 'Schedule',
  '/inbox': 'Inbox',
};

export default function OrgTabs() {
  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Overview" />,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} />}
    >
      <Tabs.Screen name="overview" options={{ title: 'Overview' }} />
      {/* The calendar draws its own header inside its safe area. */}
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', headerShown: false }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
    </Tabs>
  );
}
