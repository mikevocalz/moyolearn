import { Tabs } from 'expo-router';
import { Calendar, GraduationCap, LayoutGrid, MoreHorizontal, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * School-admin tabs — doc 36 §3.4: Overview · People · Academics · Calendar · More.
 * This slice only lands the overview (home) tab; the other routes are reserved
 * for the next build slice and do not yet have files, so they do not render.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'school-home', label: 'Overview', Icon: LayoutGrid },
  { name: 'people', label: 'People', Icon: Users },
  { name: 'academics', label: 'Academics', Icon: GraduationCap },
  { name: 'calendar', label: 'Calendar', Icon: Calendar },
  { name: 'more', label: 'More', Icon: MoreHorizontal },
];

const TITLES: Record<string, string> = {
  '/school-home': 'Overview',
  '/people': 'People',
  '/academics': 'Academics',
  '/calendar': 'Calendar',
  '/more': 'More',
};

export default function SchoolTabs() {
  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Overview" />,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} />}
    >
      <Tabs.Screen name="school-home" options={{ title: 'Overview' }} />
    </Tabs>
  );
}
