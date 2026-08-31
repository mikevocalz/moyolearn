import { Tabs } from 'expo-router';
import { Calendar, FileText, GraduationCap, Home, Users, Video } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * Teacher tabs — doc 36 §3.3: Home · Classes · Assign · Calendar · Students.
 * This slice only lands the home tab; the other routes are reserved for the
 * next build slice and do not yet have files, so they do not render.
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
