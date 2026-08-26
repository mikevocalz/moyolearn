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
import { Avatar, BrandLockup, DashboardShell, type NavGroup } from '@acme/ui';
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
import { useAppSession } from '../../providers/session';
import { MOCK_ORGS, MOCK_STAFF, orgBySlug } from '../../fixtures/cast.ts';
import { REVENUE_BY_ORG, SESSIONS_BY_ORG } from './ops.data';

// Size only — DashboardShell owns icon colour so it tracks the active state.
const ICON = 'h-4 w-4';

export function OpsScreen() {
  const { sidebarMode, menuOpen, section, setSidebarMode, toggleMenu, setSection } = useOpsChrome();
  /*
    The district comes from the SESSION, not from a literal. This screen used to
    type "Riverside Tutoring" into two separate places and greet a hardcoded
    "Amara" while the leads table scoped itself to whatever org the real session
    carried — so the chrome could confidently name one district while the table
    below it showed another's families.

    Falling back to the first org rather than rendering blank: an ops user always
    belongs somewhere, and a sidebar with no name is harder to diagnose than one
    naming the wrong district.
  */
  const { activeContext } = useAppSession();
  const org = orgBySlug(activeContext.orgId ?? '') ?? MOCK_ORGS[0]!;
  const operator = MOCK_STAFF.find((m) => m.orgSlug === org.slug && m.role === 'owner');

  /*
    Computed, not typed. `today` was the string "Tuesday, 26 August", which was
    correct on exactly one day. `OpsDashboardContentProps` already documents this
    as "computed by the caller so this stays pure" — the caller just wasn't.
  */
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

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
      brand={<BrandLockup orgName={org.name} orgLogoUrl={org.logoUrl} orgLogoAspect={org.logoAspect} />}
      brandMark={
        /* Collapsed, the district's mark stands alone: the rail is 32px wide
           and cannot fit two marks and a separator. Dropping Moyo's is the right
           half to lose — a district employee knows whose software this is; what
           they need at that width is which district they are looking at. */
        <BrandLockup orgName={org.name} orgLogoUrl={org.logoUrl} orgLogoAspect={org.logoAspect} variant="partner" />
      }
      mode={sidebarMode}
      onSetMode={setSidebarMode}
      menuOpen={menuOpen}
      onToggleMenu={toggleMenu}
      topBarStart={
        <Text className="text-label text-text-muted">Operations · {org.name}</Text>
      }
      /* The kit Avatar, not a hand-rolled circle: avatars in this language are
         rounded SQUARES (Avatar.tsx `rounded-md`). A circular account chip is
         the single most common way a neubrutalist UI stops looking like itself. */
      topBarEnd={<Avatar name={operator?.name ?? 'Operations'} imageUri={operator?.avatarUrl} size="sm" />}
    >
      <OpsDashboardContent
        today={today}
        operatorName={operator?.name.split(' ')[0] ?? 'there'}
        sessions={SESSIONS_BY_ORG[org.slug] ?? []}
        revenue={REVENUE_BY_ORG[org.slug] ?? []}
      />
    </DashboardShell>
  );
}
