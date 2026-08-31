import { Tabs } from 'expo-router';
import { Calendar, FileText, LayoutGrid, MoreHorizontal, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * District-admin tabs: Overview · Schools · Programs · Calendar · More.
 * This slice only lands the overview (home) tab; the other routes are reserved
 * for the next build slice and do not yet have files, so they do not render.
 */
const ITEMS: ShellTabItem[] = [
  { name: 'district-home', label: 'Overview', Icon: LayoutGrid },
  { name: 'schools', label: 'Schools', Icon: Users },
  { name: 'programs', label: 'Programs', Icon: FileText },
  { name: 'calendar', label: 'Calendar', Icon: Calendar },
  { name: 'more', label: 'More', Icon: MoreHorizontal },
];

const TITLES: Record<string, string> = {
  '/district-home': 'Overview',
  '/schools': 'Schools',
  '/programs': 'Programs',
  '/calendar': 'Calendar',
  '/more': 'More',
};

export default function DistrictTabs() {
  return (
    <Tabs
      screenOptions={{
        header: () => <ShellHeader titles={TITLES} fallback="Overview" />,
      }}
      tabBar={(props) => <ShellTabBar {...props} items={ITEMS} />}
    >
      <Tabs.Screen name="district-home" options={{ title: 'Overview' }} />
    </Tabs>
  );
}
