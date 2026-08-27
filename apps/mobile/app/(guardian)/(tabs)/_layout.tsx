import { Tabs } from 'expo-router';
import { Bell, FileText, Home, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Guardian tabs — doc 36 §3.2: Home (family feed) · Reports (the doc 34 trail)
 * · Alerts (incidents + acknowledgments get their OWN tab so serious things
 * never hide under a bell icon) · Family (children + controls + plan/billing).
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
