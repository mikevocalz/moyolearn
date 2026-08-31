import { Tabs } from 'expo-router';
import { Calendar, Home, MessageCircle, User, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Guardian tabs — doc 36 §3.2: Home · Children · Calendar · Messages · Account.
 *
 * Reports and Alerts move to the drawer/secondary surface; they are still
 * reachable as routes but no longer compete for a primary tab slot.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'family-home', label: 'Home', Icon: Home },
  { name: 'family', label: 'Children', Icon: Users },
  { name: 'calendar', label: 'Calendar', Icon: Calendar },
  { name: 'messages', label: 'Messages', Icon: MessageCircle },
  { name: 'account', label: 'Account', Icon: User },
];

const TITLES: Record<string, string> = {
  '/family-home': 'Home',
  '/family': 'Children',
  '/calendar': 'Calendar',
  '/messages': 'Messages',
  '/account': 'Account',
  '/reports': 'Reports',
  '/alerts': 'Alerts',
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
      <Tabs.Screen name="family" options={{ title: 'Children' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="messages" options={{ title: 'Messages' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
