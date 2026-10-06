import { Tabs } from 'expo-router';
import { GraduationCap, Home, ListChecks, Plus, User, Video } from '@acme/ui/icons';
import { ShellHeader } from '../../../../components/ShellHeader';
import { ShellPaneEdges, ShellTabBar, useShellNavigationPlacement, type ShellTabItem } from '../../../../components/ShellTabBar';

/**
 * Teacher tabs. Doc 36 §3.3 defines NO teacher tab set — it makes the
 * school-teacher a tokened read-only share page. The shell's actual authority
 * is doc 37 §2's PR-145 amendment plus ADR-102
 * (docs/decisions/adr-102-teacher-shell-ia.md), which fixes the IA at four
 * tabs — Home · Classes · Assign · You — with Conferences and Calendar demoted
 * to stack routes (conference lives in the shell Stack above this group).
 * ITEMS is the exists-only interim of that set (G §1.8: every declared tab
 * must navigate), mirroring the web rail's RAIL_BY_ROLE.teacher: a tab joins
 * ITEMS only when its route file lands.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'teacher-home', label: 'Home', Icon: Home },
  { name: 'classes', label: 'Classes', Icon: GraduationCap },
  { name: 'assign', label: 'Assign', Icon: ListChecks },
  { name: 'you', label: 'You', Icon: User },
];

/*
  The drawer's list — ADR-102's demoted destinations: real screens that hold
  no rail slot. The `classes/`, `students/` and `assign/` id routes all take
  params so they cannot be bare entries; `assign/new` and `conference` are
  the param-free ones. The (drawer) layout imports this list; the rail reads
  it for the footer button, so the two cannot drift.
*/
export const DRAWER_EXTRAS: ShellTabItem[] = [
  { name: 'conference', label: 'Conferences', Icon: Video },
  { name: 'assign/new', label: 'New assignment', Icon: Plus },
];

const TITLES: Record<string, string> = {
  '/teacher-home': 'Home',
  '/classes': 'Classes',
  '/assign': 'Assign',
  '/you': 'You',
};

export const unstable_settings = {
  /* Seeded-state landing tab when a pushed route's rebuilt navigator state
     reseeds this tab set — see the guardian (tabs) layout. */
  initialRouteName: 'teacher-home',
};

export default function TeacherTabs() {
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
      <Tabs.Screen name="teacher-home" options={{ title: 'Home' }} />
      <Tabs.Screen name="classes" options={{ title: 'Classes' }} />
      <Tabs.Screen name="assign" options={{ title: 'Assign' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
    </Tabs>
    </ShellPaneEdges>
  );
}
