import { Tabs } from 'expo-router';
import { Bell, FileText, Home, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Guardian tabs — doc 36 §3.2: Home · Reports · Alerts · Family, adopted by
 * ADR-101 (docs/decisions/adr-101-guardian-tab-set.md). Alerts is its own tab
 * so serious things never hide under a bell icon; Family holds children +
 * controls including plan/billing. Calendar is a stack route pushed from
 * Home/Family, not a tab. Messages and Account are retired per ADR-101 (no
 * messaging surface exists; account content moves to the ADR-106 sheet) —
 * their route files and screen entries are removed.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'family-home', label: 'Home', Icon: Home },
  { name: 'reports', label: 'Reports', Icon: FileText },
  { name: 'alerts', label: 'Alerts', Icon: Bell },
  { name: 'family', label: 'Family', Icon: Users },
];

const TITLES: Record<string, string> = {
  '/family-home': 'Home',
  '/reports': 'Reports',
  '/alerts': 'Alerts',
  '/family': 'Family',
};

export default function GuardianTabs() {
  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Home" />,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} />}
    >
      <Tabs.Screen name="family-home" options={{ title: 'Home' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts' }} />
      <Tabs.Screen name="family" options={{ title: 'Family' }} />
    </Tabs>
  );
}
