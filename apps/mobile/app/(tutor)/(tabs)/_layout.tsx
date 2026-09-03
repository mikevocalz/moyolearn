import { Tabs } from 'expo-router';
import { Calendar, FileText, User, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, useShellTabBarPosition, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Tutor tabs — doc 36 §3.3: Today (sessions timeline) · Learners (my roster →
 * per-learner trail; the session-prep surface already is that trail) · Notes
 * (the doc 34 draft queue awaiting approval) · You.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'tutor-today', label: 'Today', Icon: Calendar },
  { name: 'session-prep', label: 'Learners', Icon: Users },
  { name: 'notes', label: 'Notes', Icon: FileText },
  { name: 'tutor-profile', label: 'You', Icon: User },
];

const TITLES: Record<string, string> = {
  '/tutor-today': 'Today',
  '/session-prep': 'Learners',
  '/notes': 'Session Notes',
  '/tutor-profile': 'You',
};

export default function TutorTabs() {
  // Doc 02 §2.1: bottom nav under 600dp, rail from 600 up.
  const tabBarPosition = useShellTabBarPosition();
  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Today" />,
        tabBarPosition,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} />}
    >
      <Tabs.Screen name="tutor-today" options={{ title: 'Today' }} />
      <Tabs.Screen name="session-prep" options={{ title: 'Learners' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="tutor-profile" options={{ title: 'You' }} />
    </Tabs>
  );
}
