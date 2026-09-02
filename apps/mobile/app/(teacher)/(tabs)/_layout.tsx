import { Tabs } from 'expo-router';
import { Calendar, FileText, GraduationCap, Home, Users, Video } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Teacher tabs. Doc 36 §3.3 defines NO teacher tab set — it makes the
 * school-teacher a tokened read-only share page. The shell's actual authority
 * is doc 37 §2's PR-145 amendment plus ADR-102
 * (docs/decisions/adr-102-teacher-shell-ia.md), which fixes the IA at four
 * tabs — Home · Classes · Assign · You — with Conferences and Calendar demoted
 * to stack routes. ITEMS below still carries the pre-ADR set until the shell
 * build phase re-cuts it; only teacher-home and conference have route files
 * today, so only they render.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'teacher-home', label: 'Home', Icon: Home },
  { name: 'classes', label: 'Classes', Icon: Users },
  { name: 'assign', label: 'Assign', Icon: FileText },
  { name: 'calendar', label: 'Calendar', Icon: Calendar },
  { name: 'conference', label: 'Conferences', Icon: Video },
  { name: 'students', label: 'Students', Icon: GraduationCap },
];

const TITLES: Record<string, string> = {
  '/teacher-home': 'Home',
  '/classes': 'Classes',
  '/assign': 'Assign',
  '/calendar': 'Calendar',
  '/conference': 'Conferences',
  '/students': 'Students',
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
      <Tabs.Screen name="conference" options={{ title: 'Conferences' }} />
    </Tabs>
  );
}
