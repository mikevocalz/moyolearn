'use client';
// The ops surface: DashboardShell chrome wrapped around the dashboard content.
// SOT: docs/pack/28-crm-spec.md · docs/pack/02-adaptive-screens-design-spec.md §5.3
// SOT-KEYWORDS: ops screen shell sidebar nav dashboard crm chrome
// Mobbin: https://mobbin.com/screens/35f5c474-ed6a-4c77-a6cb-f2e1d6b12398 (Twenty —
//   workspace identity pinned to the top of the sidebar, not the top bar) ·
//   https://mobbin.com/screens/45d9181e-ad36-4146-91ea-93ce49aef464 (Pipedrive —
//   nav grouped under small-caps labels, counts right-aligned on the item) ·
//   https://mobbin.com/screens/0b39694c-dee7-4300-9f2e-ebe25b14c75e (Whop — the
//   three groups a business actually has, rather than one flat list) ·
//   https://mobbin.com/screens/906938fc-3914-4f31-ae27-bc08a2e9e412 (Sentry —
//   collapse control lives in the sidebar's own header row) ·
//   https://mobbin.com/screens/7edb1dcf-9015-471a-8625-11a0f51767d7 (Uxcel —
//   breadcrumb left, account right, nothing else in the top bar)
import { Avatar, DashboardShell, type NavGroup } from '@acme/ui';
import {
  CalendarDays,
  CircleDot,
  Contact,
  CreditCard,
  GraduationCap,
  Receipt,
  Settings,
  Users,
} from '@acme/ui/icons';
import { Text, View } from '@acme/ui/primitives';
import { OpsDashboardContent } from './ops-dashboard-content';
import { useOpsChrome } from './ops.store';

// Size only — DashboardShell owns icon colour so it tracks the active state.
const ICON = 'h-4 w-4';

function Brand() {
  return (
    <View className="flex-row items-center gap-element">
      <View className="h-8 w-8 items-center justify-center rounded-control border-2 border-border-strong bg-primary">
        <Text className="font-display text-label text-on-primary">M</Text>
      </View>
      <View className="gap-0">
        <Text className="font-display text-title text-text">Moyo</Text>
        <Text className="text-caption text-text-muted">Riverside Tutoring</Text>
      </View>
    </View>
  );
}

function BrandMark() {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-control border-2 border-border-strong bg-primary">
      <Text className="font-display text-label text-on-primary">M</Text>
    </View>
  );
}

export function OpsScreen() {
  const { collapsed, menuOpen, section, toggleCollapsed, toggleMenu, setSection } = useOpsChrome();

  const item = (
    id: string,
    label: string,
    icon: React.ReactNode,
    badge?: number,
    railLabel?: string,
  ) => ({
    id,
    label,
    railLabel,
    icon,
    badge,
    active: section === id,
    onPress: () => setSection(id),
  });

  /*
    Grouped under small-caps section labels rather than one flat list: past about
    eight items a flat sidebar stops being scannable, and the groups here are the
    three things a tutoring business actually does (doc 28 §2).
  */
  const groups: NavGroup[] = [
    {
      items: [
        item('today', 'Today', <CircleDot className={ICON} />),
        item('calendar', 'Calendar', <CalendarDays className={ICON} />),
      ],
    },
    {
      title: 'Pipeline',
      items: [
        item('leads', 'Leads', <Contact className={ICON} />, 3),
        item('families', 'Families', <Users className={ICON} />),
        item('enrolments', 'Enrolments', <GraduationCap className={ICON} />, undefined, 'Enrol'),
      ],
    },
    {
      title: 'Money',
      items: [
        item('invoices', 'Invoices', <Receipt className={ICON} />, 2),
        item('payroll', 'Payroll', <CreditCard className={ICON} />),
      ],
    },
    {
      title: 'Workspace',
      items: [item('settings', 'Settings', <Settings className={ICON} />)],
    },
  ];

  return (
    <DashboardShell
      groups={groups}
      brand={<Brand />}
      brandMark={<BrandMark />}
      collapsed={collapsed}
      onToggleCollapsed={toggleCollapsed}
      menuOpen={menuOpen}
      onToggleMenu={toggleMenu}
      topBarStart={
        <Text className="text-label text-text-muted">Operations · Riverside Tutoring</Text>
      }
      /* The kit Avatar, not a hand-rolled circle: avatars in this language are
         rounded SQUARES (Avatar.tsx `rounded-md`). A circular account chip is
         the single most common way a neubrutalist UI stops looking like itself. */
      topBarEnd={<Avatar name="Amara Osei" size="sm" />}
    >
      <OpsDashboardContent today="Tuesday, 26 August" operatorName="Amara" />
    </DashboardShell>
  );
}
