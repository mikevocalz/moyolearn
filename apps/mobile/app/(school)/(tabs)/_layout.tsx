import { Tabs } from 'expo-router';
import { Calendar, GraduationCap, LayoutGrid, MoreHorizontal, Users } from '@acme/ui/icons';
import { ShellHeader } from '../../../components/ShellHeader';
import { ShellTabBar, type ShellTabItem } from '../../../components/ShellTabBar';

/**
 * School-admin tabs. Doc 36 defines no school-admin IA — its §3.4 is the ORG
 * companion set, not a school set. ADR-103
 * (docs/decisions/adr-103-school-admin-ia.md) makes the role web-first and
 * parks mobile at Overview-only until a PRD persona and entitlement story
 * exist; if mobile ever ships it is Overview · People · Academics · Inbox,
 * never a More tab. ITEMS below still carries the pre-ADR five until the shell
 * build phase shrinks it; only school-home has a route file, so only it
 * renders.
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
