import { Tabs } from 'expo-router';
import { Home } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

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
  // pending: teacher.classes (contract exists) — Classes (list→detail; Students
  // folds in per ADR-102).
  // pending: teacher.assign (contract exists) — Assign.
  // pending: teacher.you (contract exists) — You (role switcher + ADR-106
  // account-sheet anchor).
];

const TITLES: Record<string, string> = {
  '/teacher-home': 'Home',
};

export default function TeacherTabs() {
  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Home" />,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} />}
    >
      <Tabs.Screen name="teacher-home" options={{ title: 'Home' }} />
    </Tabs>
  );
}
