import { create } from 'zustand';
import type { ActiveContextKind } from '@acme/app';

// Role-scoped nav (doc 36 §3): one nav for everyone fails every role, so the
// chrome renders the ACTIVE role's IA. Hot roles (learner, guardian) keep flat
// top-nav lists — doc 36 §3.1/§3.2 "identical IA as top-nav", no sidebar. Cool
// roles get grouped rails rendered through DashboardShell's NavGroup API.
// URLs stay put — deep links and notification links predate this split — only
// what the chrome shows changes. Anon keeps the marketing set.
//
// Flow law: nav must never 404. A doc-mandated item whose route does not exist
// yet is recorded as a `pending:` comment in its group, never rendered.
// SOT: docs/pack/36-role-navigation-flows.md §3 ·
//      docs/design/overhaul-v2/G-navigation-maps.md §3 ·
//      docs/design/overhaul-v2/J-component-plan.md §6 ·
//      docs/decisions/adr-102..105
// SOT-KEYWORDS: nav items role scoped rail group header learner guardian tutor owner

export interface NavItem {
  label: string;
  href: string;
  /** Shorter form for DashboardShell's 112px rail; only when `label` would elide. */
  railLabel?: string;
}

/** Data-level mirror of DashboardShell's NavGroup (title + items, no handlers). */
export interface NavGroup {
  /** Small-caps section label. Omit for an unlabelled group. */
  title?: string;
  items: NavItem[];
}

export const MARKETING_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Notifications', href: '/notifications' },
];

export type HotNavKind = 'learner' | 'guardian';
export type RailKind = Exclude<ActiveContextKind, HotNavKind>;

/**
 * Hot top-nav (doc 36 §3.1/§3.2): same IA as the mobile tabs, flat, no rail.
 * Learner stays band-blind here — the band-adaptive web nav is a separate
 * Phase-2 item (G §3.1 ⚠), not part of the rail regrouping.
 */
export const HOT_NAV_BY_ROLE: Record<HotNavKind, NavItem[]> = {
  learner: [
    { label: 'Today', href: '/' },
    { label: 'Subjects', href: '/subjects' },
    { label: 'Snap', href: '/capture' },
    { label: 'Progress', href: '/progress' },
  ],
  guardian: [
    { label: 'Home', href: '/' },
    { label: 'Reports', href: '/reports' },
    // Alerts keeps its own item, never a bell (doc 36 §3.2).
    { label: 'Alerts', href: '/notifications' },
    // G §3.1 href fix: Family points at the real family surface, not /settings.
    { label: 'Family', href: '/family' },
  ],
};

/**
 * Org rail (doc 36 §3.4) is one grouped set for owner and staff — the two flat
 * lists collapse into it (G §3.2). Doc 36's web sidebar has no Inbox item; the
 * mobile companion keeps its Inbox tab.
 */
const ORG_RAIL: NavGroup[] = [
  { items: [{ label: 'Overview', href: '/ops' }] },
  // pending: org.crm (contract exists) — doc 36 §3.4 CRM group (Leads ·
  // Families · Enrollment) is embedded in the /ops blob today; the split rail
  // items get standalone routes before they get nav rows. Overview keeps /ops
  // so the CRM content stays reachable meanwhile.
  { title: 'Scheduling', items: [{ label: 'Calendar', href: '/schedule' }] },
  // pending: org.money (contract exists) — Payouts · Invoices (doc 36 §3.4).
  // pending: org.safety (contract exists) — Incident queue (doc 31 §5.3); web
  // sidebar view missing (D-inventory: mobile complete, web MISSING).
  // pending: org.settings — Org settings · Plan (PW-05/PW-08); no org-scoped
  // settings routes exist yet (G §2: `(org)/settings/plan` unbuilt, doc 38 §3).
];

/**
 * Cool rails, grouped per doc 36 §3.3–§3.5 as reconciled by G §3 and
 * ADR-102..105. Every rendered href resolves to an existing page; doc-mandated
 * items without routes live in `pending:` comments (flow law).
 */
export const RAIL_BY_ROLE: Record<RailKind, NavGroup[]> = {
  anon: [{ items: MARKETING_ITEMS }],
  // ADR-105: doc 36 §3.3's sidebar verbatim; Schedule retired, folded into
  // Today (the sessions timeline is the one calendar view).
  tutor: [
    {
      items: [
        { label: 'Today', href: '/' },
        { label: 'My learners', href: '/session-prep', railLabel: 'Learners' },
        { label: 'Session notes', href: '/report-queue', railLabel: 'Notes' },
      ],
    },
    // Second group per ADR-105, unrendered until the routes exist:
    // pending: tutor.incidents (contract exists) — Incidents, mine + my sessions.
    // pending: tutor.resources (contract exists) — Resources.
  ],
  // ADR-102: teacher stops impersonating the tutor; its set is Home · Classes ·
  // Assign · You. Home is the real teacher landing (`/teachers/me`,
  // TeacherHomeScreen) — `/` renders the role-blind template dashboard.
  teacher: [
    { items: [{ label: 'Home', href: '/teachers/me' }] },
    // pending: teacher.classes (contract exists) — Classes (list→detail).
    // pending: teacher.assign (contract exists) — Assign.
    // pending: teacher.you (contract exists) — on web the You anchor is the
    // utility-bar avatar menu (G §4 no-duplication law: a rail You would
    // duplicate the account menu's Profile & settings entry).
  ],
  owner: ORG_RAIL,
  staff: ORG_RAIL,
  // ADR-103: exists-only interim rail. /academics is pulled — it resolves to
  // InstitutionPlaceholderScreen, a designed dead end (school.academics,
  // C-orphans §Web); it returns to nav only when built.
  school_admin: [
    {
      items: [
        { label: 'Overview', href: '/' },
        { label: 'People', href: '/people' },
        { label: 'Reports', href: '/reports' },
      ],
    },
  ],
  // ADR-104 / doc 36 §3.5: Outcomes · Schools · Educators · Compliance ·
  // Settings, flat. Educators is the doc-36 name for the shared /people list
  // (district.people); Settings is the shared settings surface until a
  // district-scoped one exists (doc 36 §3.5; no contract row yet).
  district_admin: [
    {
      items: [
        { label: 'Outcomes', href: '/' },
        { label: 'Schools', href: '/schools' },
        { label: 'Educators', href: '/people' },
        // pending: district.compliance (contract exists) — counts, never
        // contents; sits between Educators and Settings when built.
        { label: 'Settings', href: '/settings' },
      ],
    },
  ],
};

// Profile (with settings inside) gets the avatar slot, not a text link.
export const PROFILE = { label: 'Profile', href: '/profile' } as const;

// Menu state — zustand always (repo rule).
export const useMobileMenu = create<{ open: boolean; toggle: () => void; close: () => void }>(
  (set) => ({
    open: false,
    toggle: () => set((s) => ({ open: !s.open })),
    close: () => set({ open: false }),
  }),
);
