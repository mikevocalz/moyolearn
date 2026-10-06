import { Tabs } from 'expo-router';
import { Calendar, FileText, User, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../../components/ShellHeader';
import { ShellPaneEdges, ShellTabBar, useShellNavigationPlacement, type ShellTabItem } from '../../../../components/ShellTabBar';

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

/*
  The drawer's list — empty today: every tutor destination already holds a
  rail slot, so nothing overflows and the footer menu button stays hidden.
  A future group-level stack route lands here.
*/
export const DRAWER_EXTRAS: ShellTabItem[] = [];

const TITLES: Record<string, string> = {
  '/tutor-today': 'Today',
  '/session-prep': 'Learners',
  '/notes': 'Session Notes',
  '/tutor-profile': 'You',
};

export const unstable_settings = {
  /* Seeded-state landing tab when a pushed route's rebuilt navigator state
     reseeds this tab set — see the guardian (tabs) layout. */
  initialRouteName: 'tutor-today',
};

export default function TutorTabs() {
  // Doc 02 §2.1: bottom nav under 600dp, rail from 600 up.
  const navigationPlacement = useShellNavigationPlacement();
  return (
    <ShellPaneEdges>
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Today" />,
        tabBarPosition: navigationPlacement.position,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} placement={navigationPlacement} railAlignment="top" hasOverflowDrawer={DRAWER_EXTRAS.length > 0} />}
    >
      <Tabs.Screen name="tutor-today" options={{ title: 'Today' }} />
      <Tabs.Screen name="session-prep" options={{ title: 'Learners' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="tutor-profile" options={{ title: 'You' }} />
    </Tabs>
    </ShellPaneEdges>
  );
}
