import { create } from 'zustand';
import type { ActiveContext, ActiveContextKind } from '@acme/app';

// Role-scoped nav (doc 36 §3): one nav for everyone fails every role, so the
// chrome renders the ACTIVE role's IA. Hot roles (learner, guardian) keep flat
// top-nav lists — doc 36 §3.1/§3.2 "identical IA as top-nav", no sidebar. The
// learner list is keyed by grade band (doc 36 §3.1 / G §3.1); mobile's Me/You
// tabs collapse into the avatar slot on web (avatar-as-You law). Cool roles
// get grouped rails rendered through DashboardShell's NavGroup API.
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
  /**
   * Render only for members who may spend the org's money: the owner kind, or
   * a staff hat whose organizationRole passes `isBillingRole` (billing-plans'
   * owner/finance pair — org.overview's contract: "Money and Settings rail
   * items render for owner/finance only"). RoleShell applies the predicate;
   * the page behind the item enforces the same wall server-side
   * (`requiresMembership: BILLING_ROLES`), so hiding here is courtesy, not
   * security.
   */
  billingOnly?: true;
  items: NavItem[];
}

export const MARKETING_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Schedule', href: '/schedule' },
  { label: 'Notifications', href: '/notifications' },
];

export type HotNavKind = 'learner' | 'guardian';
export type RailKind = Exclude<ActiveContextKind, HotNavKind>;

/** Derived from the session contract — `@acme/app`'s barrel does not export
 * the capture AgeBand type, and deriving keeps the band axis single-sourced. */
export type AgeBand = NonNullable<ActiveContext['gradeBand']>;

/** 6–8 and 9–12 share one resume-first list (doc 36 §3.1) — one array by
 * reference so the shell treats the two bands identically. */
const OLDER_LEARNER_NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Subjects', href: '/subjects' },
  { label: 'Snap', href: '/capture' },
  { label: 'Progress', href: '/progress' },
];

/**
 * Band-adaptive learner top-nav — doc 36 §3.1's table reconciled for web by
 * G §3.1: mobile's Me (3–5) and You (6–8/9–12) tabs collapse into the avatar
 * slot (PROFILE), per the avatar-as-You law. Younger bands read "Today"
 * (routine-first); 6–8/9–12 read "Home" (resume-first).
 */
export const HOT_NAV_LEARNER_BY_BAND: Record<AgeBand, NavItem[]> = {
  // K–2 hub-and-spoke. My Stuff points at /practice: mobile's `stuff` tab
  // renders PracticeScreen, and (site)/practice is where that screen already
  // lives on web — the item renders because the surface exists (flow law).
  young: [
    { label: 'Today', href: '/' },
    { label: 'Snap', href: '/capture' },
    { label: 'My Stuff', href: '/practice' },
  ],
  child: [
    { label: 'Today', href: '/' },
    { label: 'Subjects', href: '/subjects' },
    { label: 'Snap', href: '/capture' },
  ],
  teen: OLDER_LEARNER_NAV,
  adult: OLDER_LEARNER_NAV,
};

/**
 * Hot top-nav (doc 36 §3.2): same IA as the mobile tabs, flat, no rail.
 * Guardian only — the learner set is band-keyed in HOT_NAV_LEARNER_BY_BAND.
 */
export const HOT_NAV_BY_ROLE: Record<'guardian', NavItem[]> = {
  guardian: [
    { label: 'Home', href: '/' },
    // /reports serves ReportsPaneScreen on apex hosts (app/reports/page.tsx
    // dispatches by tenant host) — same path the mobile Reports tab answers.
    { label: 'Reports', href: '/reports' },
    // Alerts keeps its own item, never a bell (doc 36 §3.2) — and it points
    // at the INCIDENT surface (guardian.alerts), not general notifications:
    // the contract's law is incidents + acknowledgments only. `/alerts` is
    // also the mobile Alerts tab's path.
    { label: 'Alerts', href: '/alerts' },
    // Family points at the child-management hub (FamilyScreen at /children);
    // `(guardian)/family` is the home FEED, which the Home item already owns.
    { label: 'Family', href: '/children' },
  ],
};

/**
 * Org rail (doc 36 §3.4) is one grouped set for owner and staff — the two flat
 * lists collapse into it (G §3.2). Doc 36's web sidebar has no Inbox item; the
 * mobile companion keeps its Inbox tab.
 */
const ORG_RAIL: NavGroup[] = [
  { items: [{ label: 'Overview', href: '/ops' }] },
  // Doc 36 §3.4's CRM group, split out of the /ops blob: every item renders
  // because its route exists (flow law) — /leads, /families, /enrollment all
  // live under the (business) shell.
  {
    title: 'CRM',
    items: [
      { label: 'Leads', href: '/leads' },
      { label: 'Families', href: '/families' },
      { label: 'Enrollment', href: '/enrollment', railLabel: 'Enroll' },
    ],
  },
  { title: 'Scheduling', items: [{ label: 'Calendar', href: '/schedule' }] },
  // struck: org.money — STRUCK 2026-09-02 per its own contract's failed
  // condition: state_owner says "nothing exists," and nothing does — no money
  // collection in Payload, the Stripe plugin unmounted (no STRIPE_* keys in
  // .env.example), Connect absent, and all three stages of the contract's own
  // no_data pipeline (sessions → approved reports → payable work) unbuilt. An
  // empty rail destination is a designed dead end (the /academics lesson). The
  // contract stays in design/screens/org as the record.
  // Doc 36 §3.4's Safety group (G §3.2 marked it ✱; built now): the incident
  // queue at /safety, on the safety side of the doc 23/31 wall — and carrying
  // NO count badge, ever: counts-as-pressure is the failure mode doc 31 §5.3
  // names, and unassigned-S4 interrupts on the surface itself, not the nav.
  {
    title: 'Safety',
    items: [{ label: 'Incident queue', href: '/safety', railLabel: 'Incidents' }],
  },
  // Doc 36 §3.4's Settings group (org.settings contract). One page — identity
  // + plan, read-only — rather than PW-05's two rows; the action rows land on
  // the same surface when Stripe mounts. Href is /settings/org because
  // (site)/settings already serves the shared device-prefs page at /settings
  // and two route groups must not resolve one path — the flow law is
  // "rendered href resolves", and it resolves.
  {
    title: 'Settings',
    billingOnly: true,
    items: [{ label: 'Org settings', href: '/settings/org', railLabel: 'Settings' }],
  },
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
        // tutor.today's contract names the web Today mount `/tutors/me`
        // (entry_points: "web rail first group, /tutors/me") — the teacher
        // /teachers/me precedent, and the page that renders TutorTodayScreen
        // whole. The rail pointed at '/' before, which only reaches the same
        // content through HomeContent's hat dispatch (the parent-who-tutors
        // fallback, S15) and left the contract-named page an orphan.
        { label: 'Today', href: '/tutors/me' },
        { label: 'My learners', href: '/session-prep', railLabel: 'Learners' },
        { label: 'Session notes', href: '/report-queue', railLabel: 'Notes' },
      ],
    },
    // Second group per ADR-105 (doc 36 §3.3). Incidents renders: `/incidents`
    // exists (tutor.incidents — what I filed plus incidents on sessions I
    // run, ADR-110's session→tutor edge).
    // struck: tutor.resources — STRUCK 2026-09-02 per its own contract's
    // Notes: the item was conditional on a resource content pipeline
    // existing, and none does (no collection, no catalog; Media is upload
    // transport). ADR-105's consequences already marked it conditional, and
    // an empty rail destination is a designed dead end (the /academics
    // lesson). The contract stays in design/screens/tutor as the record.
    { items: [{ label: 'Incidents', href: '/incidents' }] },
  ],
  // ADR-102: teacher stops impersonating the tutor; its set is Home · Classes ·
  // Assign · You. Home is the real teacher landing (`/teachers/me`,
  // TeacherHomeScreen) — `/` renders the role-blind template dashboard.
  teacher: [
    {
      items: [
        { label: 'Home', href: '/teachers/me' },
        { label: 'Classes', href: '/teachers/classes' },
        { label: 'Assign', href: '/teachers/assign' },
      ],
    },
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
        // contents; sits between Educators and Settings when built. DEFERRED
        // with the blocker named: IncidentReports and Consents carry no
        // orgId/districtId (the doc 31 channel is platform-scoped), and the
        // only bridge — Enrollments (learnerAuthId → districtId) — is
        // temporally wrong for occurredAt-in-period counting (it reattributes
        // history to wherever the learner sits today) and ambiguous for
        // multi-district/exited learners. Attribution needs a schema ADR, not
        // a query; Phase 3 per doc 36 §3.5 / ADR-104.
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
