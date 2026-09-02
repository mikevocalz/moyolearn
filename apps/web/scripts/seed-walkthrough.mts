// Walkthrough seed — one account per tenant × role × band cell the product can
// actually represent (overhaul §17.4, filtered by E-matrix §2 and its §5 gap
// ledger). These are the accounts Argent walkthroughs sign in as.
//
// Run: `pnpm --filter web seed:walkthrough` (append `-- --dry-run` to print the
// plan without touching anything).
//
// It is a SIBLING of `seed.mts`, not a replacement: that script writes the mock
// cast's org-side rows for the dev personas; this one creates REAL Better Auth
// accounts — through the same paths the product uses (`auth.api.signUpEmail`,
// `createManagedLearner` with the Payload writer) — so a walkthrough exercises
// live auth, not the persona fixtures. Names and shapes mirror
// `packages/app/fixtures/personas.ts` so the walkthrough cast reads like the dev
// cast.
//
// IDEMPOTENT BY DETERMINISTIC KEY. Adults are keyed by
// `walkthrough+<cell>@moyolearn.test`, learners by a `wt_*` username (both
// unique columns), orgs by slug, better_auth rows by deterministic ids with
// `on conflict do update`, and the Payload rows use the same find-first guards
// `seed.mts` uses. Re-running cannot duplicate a person or re-consent a child.
//
// NEVER PRODUCTION. The guard below refuses NODE_ENV/VERCEL_ENV production,
// any Vercel or CI runtime, and an auth base URL under the production apex.
// `.test` is an RFC 2606 reserved TLD — these addresses cannot receive mail.
// Credentials live in this file only; ACCOUNTS.md documents the matrix, not
// the passwords (qa/walkthroughs/ACCOUNTS.md).
//
// E-matrix skips honoured here (docs/design/overhaul-v2/E-tenant-role-band-matrix.md §5):
//   G-1 campus, G-2 adult self-serve learner — not tenants, no cells.
//   G-3 school-sponsored entitlement — school/district orgs get no subscription.
//   G-7 no `expired` status — the lapsed family is `canceled`, period ended.
//   G-9 org-client family entitlement — Brightpath families carry no plan.
//   G-4 scheduler is organizationRole only — seeded, renders as generic staff;
//       and the learner band write path is broken under live auth (A-audit),
//       so band is carried by one account per band, not by a stored field.
// SOT: docs/design/overhaul-v2/E-tenant-role-band-matrix.md §1–§5 · docs/pack/06-auth-onboarding-spec.md §2 §4 · qa/walkthroughs/ACCOUNTS.md
// SOT-KEYWORDS: walkthrough seed matrix tenant role band argent qa accounts idempotent guard
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
nextEnv.loadEnvConfig(workspaceRoot, true, console);

/* ── The production guard ──────────────────────────────────────────────── */

function refuse(reason: string): never {
  console.error(`\nwalkthrough seed refused: ${reason}`);
  console.error('This script writes test accounts and must never touch production.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') refuse('NODE_ENV is production.');
if (process.env.VERCEL_ENV === 'production') refuse('VERCEL_ENV is production.');
// Any Vercel or CI runtime is a deploy pipeline, not a dev machine.
if (process.env.VERCEL) refuse('running inside Vercel.');
if (process.env.CI) refuse('running inside CI.');
for (const url of [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_AUTH_URL]) {
  // The production apex. `nycdoe.localhost` and preview URLs pass; the live
  // domain in any auth base URL means this environment serves real families.
  if (url && /(^|\/|\.)moyolearn\.com/i.test(url)) {
    refuse(`auth base URL points at production (${url}).`);
  }
}
if (!process.env.DATABASE_URL) refuse('no DATABASE_URL in the environment.');

const DRY_RUN = process.argv.includes('--dry-run');

/* ── The cast — deterministic, greppable, mirroring personas.ts ────────── */

const EMAIL_DOMAIN = 'moyolearn.test';
const email = (cell: string) => `walkthrough+${cell}@${EMAIL_DOMAIN}`;

// Credentials live here and only here (see header). One password per audience
// so a walkthrough runner memorises two strings, not thirty.
const ADULT_PASSWORD = 'Moyo-Walkthrough!2026';
const LEARNER_PASSWORD = 'Moyo-Walkthrough-Kid!2026';
const PLATFORM_ADMIN_PASSWORD = 'Moyo-Walkthrough-Admin!2026';

interface WtOrg {
  slug: string;
  name: string;
  kind: 'tutoring' | 'school' | 'district';
  brandAccent: 'ember' | 'gold' | 'forest' | 'sky' | 'rose';
  /** Payload relationship target — a district slug, resolved to a doc id. */
  districtSlug?: string;
}

const ORGS: readonly WtOrg[] = [
  { slug: 'wt-solo-tutoring', name: 'Marchetti Math Tutoring', kind: 'tutoring', brandAccent: 'gold' },
  { slug: 'wt-fresh-tutoring', name: 'Fresh Start Tutoring', kind: 'tutoring', brandAccent: 'rose' },
  { slug: 'wt-brightpath', name: 'Brightpath Tutoring', kind: 'tutoring', brandAccent: 'ember' },
  { slug: 'wt-lakeview-district', name: 'Lakeview Public Schools', kind: 'district', brandAccent: 'sky' },
  { slug: 'wt-lakeview-elementary', name: 'Lakeview Elementary', kind: 'school', brandAccent: 'forest', districtSlug: 'wt-lakeview-district' },
  { slug: 'wt-lakeview-high', name: 'Lakeview High School', kind: 'school', brandAccent: 'sky', districtSlug: 'wt-lakeview-district' },
];

interface WtMembership {
  orgSlug: string;
  /** The org plugin's `role` column — what `permitsLoginAtHost` and billing read. */
  role: 'owner' | 'manager' | 'scheduler' | 'finance' | 'member';
  /** RoleKind of record for the shell (member_education_role_additive.sql). */
  educationRole: 'tutor' | 'teacher' | 'owner' | 'staff' | 'school_admin' | 'district_admin';
}

interface WtAdult {
  cell: string;
  name: string;
  memberships: readonly WtMembership[];
}

const ADULTS: readonly WtAdult[] = [
  // Family — deliberately org-less (E §1 row 1).
  { cell: 'family-guardian', name: 'Naomi Carter', memberships: [] },
  { cell: 'family-guardian-free', name: 'Omar Haddad', memberships: [] },
  { cell: 'family-guardian-trial', name: 'Lena Petrov', memberships: [] },
  { cell: 'family-guardian-lapsed', name: 'Victor Osei', memberships: [] },
  // Independent tutor — org of one (E §1 row 3). One member row carries one
  // educationRole, so the tutor hat wins the shell and `role: owner` keeps the
  // billing gate; the dual-hat switcher needs two memberships (E §3).
  { cell: 'solo-tutor', name: 'Rosa Marchetti', memberships: [
    { orgSlug: 'wt-solo-tutoring', role: 'owner', educationRole: 'tutor' },
  ] },
  { cell: 'solo-family-1', name: 'Grace Ito', memberships: [] },
  { cell: 'solo-family-2', name: 'Sam Boateng', memberships: [] },
  { cell: 'solo-family-3', name: 'Nia Flores', memberships: [] },
  { cell: 'empty-tutor', name: 'Theo Lindqvist', memberships: [
    { orgSlug: 'wt-fresh-tutoring', role: 'owner', educationRole: 'tutor' },
  ] },
  // Tutoring business.
  { cell: 'biz-owner', name: 'Amara Whitfield', memberships: [
    { orgSlug: 'wt-brightpath', role: 'owner', educationRole: 'owner' },
  ] },
  // G-4: scheduler exists only as organizationRole; on screen this is generic staff.
  { cell: 'biz-staff', name: 'Carlos Vega', memberships: [
    { orgSlug: 'wt-brightpath', role: 'scheduler', educationRole: 'staff' },
  ] },
  { cell: 'biz-tutor-1', name: 'James Duarte', memberships: [
    { orgSlug: 'wt-brightpath', role: 'member', educationRole: 'tutor' },
  ] },
  { cell: 'biz-tutor-2', name: 'Ingrid Larsen', memberships: [
    { orgSlug: 'wt-brightpath', role: 'member', educationRole: 'tutor' },
  ] },
  { cell: 'biz-family-1', name: 'Priya Nair', memberships: [] },
  { cell: 'biz-family-2', name: 'Ruben Silva', memberships: [] },
  { cell: 'biz-family-3', name: 'Tara Quinn', memberships: [] },
  // School.
  { cell: 'school-admin', name: 'Luisa Moreau', memberships: [
    { orgSlug: 'wt-lakeview-elementary', role: 'owner', educationRole: 'school_admin' },
  ] },
  { cell: 'teacher-1', name: 'Kenji Sato', memberships: [
    { orgSlug: 'wt-lakeview-elementary', role: 'member', educationRole: 'teacher' },
  ] },
  // The multi-context person: teacher membership AND a guardianship (Sofia).
  // Under live auth the member row wins the shell; the guardian hat is data-only
  // until guardian-as-membership exists (E §3 — only fixtures model it).
  { cell: 'multi-context', name: 'Dana Okafor', memberships: [
    { orgSlug: 'wt-lakeview-elementary', role: 'member', educationRole: 'teacher' },
  ] },
  { cell: 'school-family-1', name: 'Ruth Rivera', memberships: [] },
  { cell: 'school-family-2', name: 'Ben Park', memberships: [] },
  // District (Phase 3 IA — E §1 row 7).
  { cell: 'district-admin', name: 'Marcus Bell', memberships: [
    { orgSlug: 'wt-lakeview-district', role: 'owner', educationRole: 'district_admin' },
  ] },
];

interface WtLearner {
  /** Underscores, not hyphens — Better Auth's username validator is `[a-zA-Z0-9_.]`. */
  username: string;
  name: string;
  /** E §2 band row this account exists to walk. Doc label, not a stored field (G-4). */
  band: 'K-2' | '3-5' | '6-8' | '9-12';
  guardianCell: string;
  enrollOrgSlug?: string;
}

const LEARNERS: readonly WtLearner[] = [
  // One per band. Band is carried by the account, not a column: the live band
  // write path keys payload.users by a Better Auth text id against numeric ids
  // (A-audit defect, E §5 G-4), so there is nowhere lawful to store it yet.
  { username: 'wt_bo_k2', name: 'Bo Haddad', band: 'K-2', guardianCell: 'family-guardian-free' },
  { username: 'wt_zuri_35', name: 'Zuri Carter', band: '3-5', guardianCell: 'family-guardian' },
  { username: 'wt_eli_68', name: 'Eli Carter', band: '6-8', guardianCell: 'family-guardian' },
  { username: 'wt_ada_912', name: 'Ada Osei', band: '9-12', guardianCell: 'family-guardian-lapsed', enrollOrgSlug: 'wt-lakeview-high' },
  { username: 'wt_mira_35', name: 'Mira Petrov', band: '3-5', guardianCell: 'family-guardian-trial' },
  // The independent tutor's roster.
  { username: 'wt_ivy_solo', name: 'Ivy Ito', band: '3-5', guardianCell: 'solo-family-1' },
  { username: 'wt_noel_solo', name: 'Noel Boateng', band: '6-8', guardianCell: 'solo-family-2' },
  { username: 'wt_kofi_solo', name: 'Kofi Flores', band: '9-12', guardianCell: 'solo-family-3' },
  // Brightpath's client children (no family plan — G-9).
  { username: 'wt_luca_bp', name: 'Luca Nair', band: '3-5', guardianCell: 'biz-family-1' },
  { username: 'wt_hana_bp', name: 'Hana Silva', band: '6-8', guardianCell: 'biz-family-2' },
  { username: 'wt_deniz_bp', name: 'Deniz Quinn', band: '9-12', guardianCell: 'biz-family-3' },
  // School rosters (Enrollments is the learner→institution bridge, E §1 row 5).
  { username: 'wt_sofia_elem', name: 'Sofia Okafor', band: '3-5', guardianCell: 'multi-context', enrollOrgSlug: 'wt-lakeview-elementary' },
  { username: 'wt_tomas_elem', name: 'Tomas Rivera', band: 'K-2', guardianCell: 'school-family-1', enrollOrgSlug: 'wt-lakeview-elementary' },
  { username: 'wt_jun_high', name: 'Jun Park', band: '9-12', guardianCell: 'school-family-2', enrollOrgSlug: 'wt-lakeview-high' },
];

/**
 * Entitlement rows, written straight into the Better Auth `subscription` table
 * the reader projects from (subscription-reader.ts). `none` is the ABSENCE of a
 * row (family-guardian-free); `canceled` with a past periodEnd is the closest
 * lapsed state the repo has — doc 38's `expired` does not exist (G-7).
 * Dates are relative to the run so a trial reads as currently running.
 */
const DAY = 24 * 60 * 60 * 1000;
interface WtSubscription {
  id: string;
  plan: 'family' | 'ops-solo' | 'ops-studio';
  status: 'active' | 'trialing' | 'canceled';
  /** An adult cell (family plan on the guardian user) or an org slug. */
  ref: { kind: 'user'; cell: string } | { kind: 'org'; slug: string };
  periodStartDays?: number;
  periodEndDays?: number;
  trialStartDays?: number;
  trialEndDays?: number;
  canceledAtDays?: number;
  seats?: number;
}

const SUBSCRIPTIONS: readonly WtSubscription[] = [
  { id: 'wt-sub-family-paid', plan: 'family', status: 'active', ref: { kind: 'user', cell: 'family-guardian' }, periodStartDays: -7, periodEndDays: 23 },
  { id: 'wt-sub-family-trial', plan: 'family', status: 'trialing', ref: { kind: 'user', cell: 'family-guardian-trial' }, trialStartDays: -3, trialEndDays: 27, periodEndDays: 27 },
  { id: 'wt-sub-family-lapsed', plan: 'family', status: 'canceled', ref: { kind: 'user', cell: 'family-guardian-lapsed' }, periodStartDays: -44, periodEndDays: -14, canceledAtDays: -14 },
  { id: 'wt-sub-solo', plan: 'ops-solo', status: 'active', ref: { kind: 'org', slug: 'wt-solo-tutoring' }, periodStartDays: -10, periodEndDays: 20 },
  { id: 'wt-sub-fresh', plan: 'ops-solo', status: 'active', ref: { kind: 'org', slug: 'wt-fresh-tutoring' }, periodStartDays: -10, periodEndDays: 20 },
  { id: 'wt-sub-brightpath', plan: 'ops-studio', status: 'active', ref: { kind: 'org', slug: 'wt-brightpath' }, periodStartDays: -10, periodEndDays: 20, seats: 6 },
  // No school/district rows on purpose — no school-sponsored entitlement exists (G-3).
];

/** CRM pipelines, per org, in the exact shape `seed.mts` writes. */
interface WtLead {
  family: string;
  learner: string;
  subject: string;
  stage: 'Inquiry' | 'Trial scheduled' | 'Trial completed' | 'Proposal' | 'Enrolled' | 'At risk';
  owner: string;
  sessions: number;
  cohortSize: number;
  learnerUsername?: string;
}

const LEADS: Record<string, readonly WtLead[]> = {
  'wt-solo-tutoring': [
    { family: 'Ito', learner: 'Ivy', subject: 'Fractions', stage: 'Enrolled', owner: 'Rosa', sessions: 12, cohortSize: 1, learnerUsername: 'wt_ivy_solo' },
    { family: 'Boateng', learner: 'Noel', subject: 'Algebra I', stage: 'Enrolled', owner: 'Rosa', sessions: 9, cohortSize: 1, learnerUsername: 'wt_noel_solo' },
    { family: 'Flores', learner: 'Kofi', subject: 'Pre-Calculus', stage: 'At risk', owner: 'Rosa', sessions: 15, cohortSize: 1, learnerUsername: 'wt_kofi_solo' },
  ],
  // 'wt-fresh-tutoring' has NO pipeline — the empty-schedule tutor cell.
  'wt-brightpath': [
    { family: 'Nair', learner: 'Luca', subject: 'Reading', stage: 'Enrolled', owner: 'James', sessions: 14, cohortSize: 12, learnerUsername: 'wt_luca_bp' },
    { family: 'Silva', learner: 'Hana', subject: 'Geometry', stage: 'Enrolled', owner: 'Ingrid', sessions: 11, cohortSize: 12, learnerUsername: 'wt_hana_bp' },
    { family: 'Quinn', learner: 'Deniz', subject: 'Chemistry', stage: 'At risk', owner: 'Ingrid', sessions: 19, cohortSize: 12, learnerUsername: 'wt_deniz_bp' },
    { family: 'Whitfield', learner: 'Ade', subject: 'Essay writing', stage: 'Inquiry', owner: 'James', sessions: 0, cohortSize: 0 },
    { family: 'Marchetti', learner: 'Gia', subject: 'Statistics', stage: 'Trial scheduled', owner: 'James', sessions: 1, cohortSize: 0 },
    { family: 'Lindqvist', learner: 'Aya', subject: 'Biology', stage: 'Proposal', owner: 'Ingrid', sessions: 2, cohortSize: 0 },
  ],
  // District drill-down data. Cohorts straddle 10 so both k-anon suppression
  // branches render (same reasoning as seed.mts).
  'wt-lakeview-district': Array.from({ length: 10 }, (_, i) => {
    const stages = ['Inquiry', 'Trial scheduled', 'Trial completed', 'Proposal', 'Enrolled', 'At risk'] as const;
    const families = ['Adeyemi', 'Kowalski', 'Mensah', 'Novak', 'Rahman', 'Duarte', 'Ibrahim', 'Larsen', 'Moreau', 'Abara'];
    const learners = ['Tomi', 'Zofia', 'Kwame', 'Jan', 'Ayaan', 'Ines', 'Hana', 'Freja', 'Anais', 'Ngozi'];
    const subjects = ['Fractions', 'Algebra I', 'Reading', 'Chemistry', 'Biology', 'Geometry'];
    const stage = stages[i % stages.length]!;
    const enrolled = stage === 'Enrolled' || stage === 'At risk';
    return {
      family: families[i]!,
      learner: learners[i]!,
      subject: subjects[i % subjects.length]!,
      stage,
      owner: i % 2 === 0 ? 'Luisa' : 'Kenji',
      sessions: enrolled ? 8 + i * 3 : i % 3,
      cohortSize: enrolled ? 12 + i : i % 8,
    } satisfies WtLead;
  }),
};

/**
 * Tutor↔learner engagements (ADR-108's roster edge). No creation UI exists
 * yet — org/scheduling work — so the walkthrough cast's rows enter here, which
 * is exactly the "ops/seed for now" path the ADR's consequences record. The
 * pairs mirror the LEADS owners above, so the CRM story and the roster tell
 * the same story: Rosa works her whole solo roster; Brightpath's learners
 * split between its two tutors.
 */
interface WtEngagement {
  tutorCell: string;
  learnerUsername: string;
  orgSlug: string;
}

const ENGAGEMENTS: readonly WtEngagement[] = [
  { tutorCell: 'solo-tutor', learnerUsername: 'wt_ivy_solo', orgSlug: 'wt-solo-tutoring' },
  { tutorCell: 'solo-tutor', learnerUsername: 'wt_noel_solo', orgSlug: 'wt-solo-tutoring' },
  { tutorCell: 'solo-tutor', learnerUsername: 'wt_kofi_solo', orgSlug: 'wt-solo-tutoring' },
  { tutorCell: 'biz-tutor-1', learnerUsername: 'wt_luca_bp', orgSlug: 'wt-brightpath' },
  { tutorCell: 'biz-tutor-2', learnerUsername: 'wt_hana_bp', orgSlug: 'wt-brightpath' },
  { tutorCell: 'biz-tutor-2', learnerUsername: 'wt_deniz_bp', orgSlug: 'wt-brightpath' },
];

/**
 * Human-tutoring sessions (ADR-110's calendar rows). No creation UI exists yet
 * — the booking write path is the ADR's recorded non-goal — so the walkthrough
 * cast's rows enter here, the same "ops/seed for now" posture as the
 * engagements above. Every pair MIRRORS an engagement row so the roster, the
 * pipeline and the calendar tell one story: Rosa sessions her solo roster,
 * Brightpath's learners session with their own tutors. Day offsets are
 * relative to the run so the ops hero's "today" and the this-week window both
 * hold rows on any day a walkthrough happens.
 */
interface WtSession {
  tutorCell: string;
  learnerUsername: string;
  orgSlug: string;
  subject: string;
  /** 0 = today; positive = later this week. */
  dayOffset: number;
  startHour: number;
  startMinute: number;
  durationMin: number;
  mode: 'virtual' | 'in-person';
  room?: string;
  needsAttention?: boolean;
}

const SESSIONS: readonly WtSession[] = [
  { tutorCell: 'solo-tutor', learnerUsername: 'wt_ivy_solo', orgSlug: 'wt-solo-tutoring', subject: 'Fractions', dayOffset: 0, startHour: 9, startMinute: 0, durationMin: 45, mode: 'virtual' },
  { tutorCell: 'solo-tutor', learnerUsername: 'wt_noel_solo', orgSlug: 'wt-solo-tutoring', subject: 'Algebra I', dayOffset: 0, startHour: 10, startMinute: 0, durationMin: 45, mode: 'in-person', room: 'Studio A', needsAttention: true },
  { tutorCell: 'solo-tutor', learnerUsername: 'wt_kofi_solo', orgSlug: 'wt-solo-tutoring', subject: 'Pre-Calculus', dayOffset: 0, startHour: 14, startMinute: 30, durationMin: 45, mode: 'virtual' },
  { tutorCell: 'solo-tutor', learnerUsername: 'wt_ivy_solo', orgSlug: 'wt-solo-tutoring', subject: 'Fractions', dayOffset: 2, startHour: 16, startMinute: 0, durationMin: 45, mode: 'virtual' },
  { tutorCell: 'biz-tutor-1', learnerUsername: 'wt_luca_bp', orgSlug: 'wt-brightpath', subject: 'Reading', dayOffset: 0, startHour: 13, startMinute: 0, durationMin: 45, mode: 'virtual' },
  // Deniz is the pipeline's At-risk row; the flag here is the same doc 28 §6
  // business signal, so the hero's attention branch renders from real data.
  { tutorCell: 'biz-tutor-2', learnerUsername: 'wt_deniz_bp', orgSlug: 'wt-brightpath', subject: 'Chemistry', dayOffset: 0, startHour: 15, startMinute: 0, durationMin: 45, mode: 'in-person', room: 'Room 2', needsAttention: true },
  { tutorCell: 'biz-tutor-2', learnerUsername: 'wt_hana_bp', orgSlug: 'wt-brightpath', subject: 'Geometry', dayOffset: 2, startHour: 11, startMinute: 0, durationMin: 45, mode: 'virtual' },
];

/** Display name off the LEARNERS cast — the row stores text, never a join. */
const learnerNameOf = (username: string): string => {
  const learner = LEARNERS.find((row) => row.username === username);
  if (!learner) throw new Error(`SESSIONS names an unknown learner: ${username}`);
  return learner.name;
};

const ENROLLED_AT = '2026-08-24T09:00:00.000Z';
const CONSENT = {
  method: 'email-plus' as const,
  scope: 'account,ai-tutoring,transcripts',
  policyVersion: '2026-08-01',
};

/* ── Dry run: the plan, no connections ─────────────────────────────────── */

if (DRY_RUN) {
  console.log('walkthrough seed — dry run (nothing written)\n');
  console.log(`orgs      ${ORGS.map((o) => o.slug).join(', ')}`);
  for (const adult of ADULTS) {
    const roles = adult.memberships.map((m) => `${m.educationRole}@${m.orgSlug}`).join(', ') || 'guardian (org-less)';
    console.log(`adult     ${email(adult.cell).padEnd(48)} ${adult.name.padEnd(18)} ${roles}`);
  }
  for (const learner of LEARNERS) {
    console.log(`learner   ${learner.username.padEnd(48)} ${learner.name.padEnd(18)} band ${learner.band}${learner.enrollOrgSlug ? ` → ${learner.enrollOrgSlug}` : ''}`);
  }
  for (const sub of SUBSCRIPTIONS) {
    const ref = sub.ref.kind === 'user' ? email(sub.ref.cell) : sub.ref.slug;
    console.log(`sub       ${sub.id.padEnd(48)} ${sub.plan}/${sub.status} → ${ref}`);
  }
  for (const [slug, rows] of Object.entries(LEADS)) console.log(`leads     ${slug} (${rows.length})`);
  for (const engagement of ENGAGEMENTS) {
    console.log(`engage    ${engagement.tutorCell} ↔ ${engagement.learnerUsername} @ ${engagement.orgSlug}`);
  }
  for (const session of SESSIONS) {
    const when = session.dayOffset === 0 ? 'today' : `+${session.dayOffset}d`;
    console.log(
      `session   ${session.tutorCell} → ${learnerNameOf(session.learnerUsername).padEnd(14)} ${session.subject.padEnd(14)} ${when} ${String(session.startHour).padStart(2, '0')}:${String(session.startMinute).padStart(2, '0')} (${session.mode}) @ ${session.orgSlug}`,
    );
  }
  console.log(`admin     ${email('platform-admin')} (Payload users collection)`);
  process.exit(0);
}

/* ── Live run ──────────────────────────────────────────────────────────── */

const { Pool } = await import('pg');
const { getPayload } = await import('payload');
const { default: config } = await import('@payload-config');
const { createAuth } = await import('@acme/auth/server');
const { createManagedLearner, createPayloadLearnerWriter } = await import('@acme/auth');

const connectionString = process.env.DATABASE_URL;
console.log(`target: ${new URL(connectionString!).hostname}\n`);

const payload = await getPayload({ config });
const auth = createAuth();
const authCtx = await auth.$context;
// Same construction as createAuth's own pool: search_path is the schema lever.
const pool = new Pool({
  connectionString,
  options: '-c search_path=better_auth',
  ssl: connectionString?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});

/*
  Preflight: three collections/fields shipped ahead of their hand-extracted
  additive migrations (`member.educationRole`, the whole `enrollments` table,
  and `organizations.district_id`/`brand_theme`), so a database built from the
  shipped .sql files refuses the very reads this seed depends on. The files ARE
  the fix — schema-qualified, additive, idempotent — and running them here
  keeps the seed self-contained on a dev database. Production applies the same
  files through the normal migration channel, never through this script.
*/
const { readFile } = await import('node:fs/promises');
const migrationsDir = resolve(workspaceRoot, 'packages/payload/migrations');
for (const file of [
  'member_education_role_additive.sql',
  'enrollments_additive.sql',
  'organizations_district_brand_theme_additive.sql',
  // For its locked-documents rels column — without it, Payload's lock check
  // fails every UPDATE on every collection (see the file's own comment).
  'handoff_codes_additive.sql',
  // ADR-108's roster edge — the engagements block below writes into it.
  'tutor_engagements_additive.sql',
  // ADR-110's calendar rows — the sessions block below writes into it.
  'sessions_additive.sql',
]) {
  await pool.query(await readFile(resolve(migrationsDir, file), 'utf8'));
  console.log(`migrate  ~ ${file}`);
}

/* ── Organizations: better_auth row + Payload tenant row ───────────────── */

// The org plugin's `organization.id` IS the tenant slug: `memberRole` in
// server.ts queries `member.organizationId = <host slug>`, so one string names
// the tenant in better_auth, payload and ctx.orgId alike.
for (const org of ORGS) {
  await pool.query(
    `INSERT INTO organization (id, name, slug, "createdAt") VALUES ($1, $2, $1, now())
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
    [org.slug, org.name],
  );
}

const payloadOrgIds = new Map<string, string | number>();
// Districts first so a school's relationship target exists.
const orderedOrgs = [...ORGS].sort((a, b) => (a.districtSlug ? 1 : 0) - (b.districtSlug ? 1 : 0));
for (const org of orderedOrgs) {
  const data: Record<string, unknown> = {
    name: org.name,
    slug: org.slug,
    kind: org.kind,
    brandAccent: org.brandAccent,
  };
  if (org.districtSlug) {
    const districtId = payloadOrgIds.get(org.districtSlug);
    if (districtId !== undefined) data.district = districtId;
  }
  const { docs } = await payload.find({
    collection: 'organizations',
    where: { slug: { equals: org.slug } },
    limit: 1,
  });
  if (docs[0]?.id !== undefined) {
    await payload.update({ collection: 'organizations', id: docs[0].id, data });
    payloadOrgIds.set(org.slug, docs[0].id);
    console.log(`org      ~ ${org.slug}`);
  } else {
    const created = (await payload.create({ collection: 'organizations', data })) as { id: string | number };
    payloadOrgIds.set(org.slug, created.id);
    console.log(`org      + ${org.slug}`);
  }
}

/* ── Adults, through the product's signup path ─────────────────────────── */

const adultIds = new Map<string, string>();
for (const adult of ADULTS) {
  const address = email(adult.cell);
  const found = await authCtx.internalAdapter.findUserByEmail(address);
  if (found?.user?.id) {
    adultIds.set(adult.cell, found.user.id);
    console.log(`adult    = ${address}`);
  } else {
    const result = await auth.api.signUpEmail({
      body: { email: address, password: ADULT_PASSWORD, name: adult.name },
    });
    const id = result?.user?.id;
    if (!id) throw new Error(`Better Auth returned no id for ${address}`);
    // Verified up front: dev has no email adapter and a walkthrough must not
    // stall on a message that can never arrive at a .test address.
    await authCtx.internalAdapter.updateUser(id, { emailVerified: true });
    adultIds.set(adult.cell, id);
    console.log(`adult    + ${address}`);
  }
}

/* ── Memberships ───────────────────────────────────────────────────────── */

for (const adult of ADULTS) {
  const userId = adultIds.get(adult.cell)!;
  for (const membership of adult.memberships) {
    const id = `wt-mem-${membership.orgSlug}-${adult.cell}`;
    await pool.query(
      `INSERT INTO member (id, "organizationId", "userId", role, "educationRole", "createdAt")
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, "educationRole" = EXCLUDED."educationRole"`,
      [id, membership.orgSlug, userId, membership.role, membership.educationRole],
    );
  }
  if (adult.memberships.length > 0) {
    console.log(`member   ~ ${adult.cell} (${adult.memberships.map((m) => `${m.educationRole}@${m.orgSlug}`).join(', ')})`);
  }
}

/* ── Learners, guardianships, consents ─────────────────────────────────── */

// The one server action of doc 06 §2, exactly as /api/family/learners runs it.
const writer = createPayloadLearnerWriter(auth, payload);
const learnerIds = new Map<string, string>();

async function ensureGuardianship(guardianAuthId: string, learnerAuthId: string) {
  const link = await payload.find({
    collection: 'guardianships',
    where: { and: [{ guardianAuthId: { equals: guardianAuthId } }, { learnerAuthId: { equals: learnerAuthId } }] },
    limit: 1,
  });
  if (link.docs.length === 0) {
    await payload.create({
      collection: 'guardianships',
      data: { guardianAuthId, learnerAuthId, relationship: 'parent', status: 'active' },
    });
  }
}

// Consents are immutable and versioned (doc 06 §6): create-only, never twice.
async function ensureConsent(guardianAuthId: string, learnerAuthId: string) {
  const consent = await payload.find({
    collection: 'consents',
    where: { and: [{ guardianAuthId: { equals: guardianAuthId } }, { learnerAuthId: { equals: learnerAuthId } }] },
    limit: 1,
  });
  if (consent.docs.length === 0) {
    await payload.create({
      collection: 'consents',
      data: {
        learnerAuthId,
        guardianAuthId,
        ...CONSENT,
        evidenceRef: `walkthrough:${guardianAuthId}:${learnerAuthId}`,
        grantedAt: new Date('2026-08-01T12:00:00Z').toISOString(),
      },
    });
  }
}

for (const learner of LEARNERS) {
  const guardianAuthId = adultIds.get(learner.guardianCell)!;
  const existing = await authCtx.adapter.findMany<{ id: string }>({
    model: 'user',
    where: [{ field: 'username', value: learner.username }],
    limit: 1,
  });
  if (existing[0]?.id) {
    learnerIds.set(learner.username, existing[0].id);
    // The action wrote these on creation; re-runs only backfill what a partial
    // earlier run might have missed.
    await ensureGuardianship(guardianAuthId, existing[0].id);
    await ensureConsent(guardianAuthId, existing[0].id);
    console.log(`learner  = ${learner.username}`);
  } else {
    const { learnerAuthId } = await createManagedLearner(writer, {
      guardianAuthId,
      username: learner.username,
      password: LEARNER_PASSWORD,
      displayName: learner.name,
      consent: { ...CONSENT, evidenceRef: `walkthrough:${learner.guardianCell}:${learner.username}` },
    });
    learnerIds.set(learner.username, learnerAuthId);
    console.log(`learner  + ${learner.username} (guardian ${learner.guardianCell})`);
  }
}

/* ── Enrollments — the learner→institution bridge ──────────────────────── */

for (const learner of LEARNERS) {
  if (!learner.enrollOrgSlug) continue;
  const learnerAuthId = learnerIds.get(learner.username)!;
  const existing = await payload.find({
    collection: 'enrollments',
    where: { and: [{ learnerAuthId: { equals: learnerAuthId } }, { orgId: { equals: learner.enrollOrgSlug } }] },
    limit: 1,
  });
  if (existing.docs.length === 0) {
    await payload.create({
      collection: 'enrollments',
      data: {
        learnerAuthId,
        orgId: learner.enrollOrgSlug,
        districtId: 'wt-lakeview-district',
        status: 'active',
        enrolledAt: ENROLLED_AT,
      },
    });
    console.log(`enroll   + ${learner.username} → ${learner.enrollOrgSlug}`);
  }
}

/* ── Tutor engagements — ADR-108's roster edge ─────────────────────────── */

// Find-first like the guardianship/enrollment guards above; the table's own
// (tutor, learner, org) UNIQUE makes a race a collision rather than a twin.
for (const engagement of ENGAGEMENTS) {
  const tutorAuthId = adultIds.get(engagement.tutorCell)!;
  const learnerAuthId = learnerIds.get(engagement.learnerUsername)!;
  const existing = await payload.find({
    collection: 'tutorEngagements',
    where: {
      and: [
        { tutorAuthId: { equals: tutorAuthId } },
        { learnerAuthId: { equals: learnerAuthId } },
        { orgId: { equals: engagement.orgSlug } },
      ],
    },
    limit: 1,
  });
  if (existing.docs.length === 0) {
    await payload.create({
      collection: 'tutorEngagements',
      data: {
        tutorAuthId,
        learnerAuthId,
        orgId: engagement.orgSlug,
        status: 'active',
        startedAt: ENROLLED_AT,
      },
    });
    console.log(`engage   + ${engagement.tutorCell} ↔ ${engagement.learnerUsername} @ ${engagement.orgSlug}`);
  }
}

/* ── Sessions — ADR-110's calendar rows ────────────────────────────────── */

// Guarded per ORG like the leads block, not per row: times are relative to the
// run day, so a row-level find-first would append a fresh "today" on every
// re-run and the calendar would silt up. An org that already has sessions is
// left alone — reseeding a moved walkthrough day is a manual truncate, the
// same trade the leads guard makes.
for (const orgSlug of new Set(SESSIONS.map((session) => session.orgSlug))) {
  const existing = await payload.find({
    collection: 'sessions',
    where: { orgId: { equals: orgSlug } },
    limit: 1,
  });
  if (existing.docs.length > 0) {
    console.log(`session  = ${orgSlug} (already has a calendar, left alone)`);
    continue;
  }
  for (const session of SESSIONS.filter((row) => row.orgSlug === orgSlug)) {
    const start = new Date();
    start.setDate(start.getDate() + session.dayOffset);
    start.setHours(session.startHour, session.startMinute, 0, 0);
    const end = new Date(start.getTime() + session.durationMin * 60_000);
    await payload.create({
      collection: 'sessions',
      data: {
        orgId: session.orgSlug,
        // The session→tutor edge (ADR-108's recorded gap): the tutor's REAL
        // Better Auth id, so the "my sessions" incident scope and any future
        // My-schedule read exercise the live join, not a fixture.
        tutorAuthId: adultIds.get(session.tutorCell)!,
        learner: learnerNameOf(session.learnerUsername),
        learnerRef: learnerIds.get(session.learnerUsername) ?? null,
        subject: session.subject,
        scheduledAt: start.toISOString(),
        endsAt: end.toISOString(),
        status: 'scheduled',
        mode: session.mode,
        room: session.room ?? null,
        needsAttention: session.needsAttention ?? false,
      },
    });
  }
  console.log(`session  + ${orgSlug} (${SESSIONS.filter((row) => row.orgSlug === orgSlug).length})`);
}

/* ── Subscriptions — the entitlement variants ──────────────────────────── */

const days = (n: number | undefined) => (n === undefined ? null : new Date(Date.now() + n * DAY));
for (const sub of SUBSCRIPTIONS) {
  const referenceId = sub.ref.kind === 'user' ? adultIds.get(sub.ref.cell)! : sub.ref.slug;
  await pool.query(
    `INSERT INTO subscription
       (id, plan, "referenceId", status, "periodStart", "periodEnd", "trialStart", "trialEnd", "cancelAtPeriodEnd", "canceledAt", seats)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (id) DO UPDATE SET
       plan = EXCLUDED.plan, "referenceId" = EXCLUDED."referenceId", status = EXCLUDED.status,
       "periodStart" = EXCLUDED."periodStart", "periodEnd" = EXCLUDED."periodEnd",
       "trialStart" = EXCLUDED."trialStart", "trialEnd" = EXCLUDED."trialEnd",
       "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd", "canceledAt" = EXCLUDED."canceledAt",
       seats = EXCLUDED.seats`,
    [
      sub.id,
      sub.plan,
      referenceId,
      sub.status,
      days(sub.periodStartDays),
      days(sub.periodEndDays),
      days(sub.trialStartDays),
      days(sub.trialEndDays),
      sub.status === 'canceled',
      days(sub.canceledAtDays),
      sub.seats ?? null,
    ],
  );
  console.log(`sub      ~ ${sub.id} (${sub.plan}/${sub.status})`);
}

/* ── Leads — CRM pipelines, guarded per org like seed.mts ──────────────── */

for (const [slug, rows] of Object.entries(LEADS)) {
  const existing = await payload.find({
    collection: 'leads',
    where: { orgId: { equals: slug } },
    limit: 1,
  });
  if (existing.docs.length > 0) {
    console.log(`leads    = ${slug} (already has a pipeline, left alone)`);
    continue;
  }
  for (const [i, lead] of rows.entries()) {
    const enrolled = lead.stage === 'Enrolled' || lead.stage === 'At risk';
    await payload.create({
      collection: 'leads',
      data: {
        orgId: slug,
        family: lead.family,
        learner: lead.learner,
        subject: lead.subject,
        stage: lead.stage,
        owner: lead.owner,
        valueCents: lead.sessions * 4500,
        currency: 'USD',
        sessions: lead.sessions,
        nextSessionAt:
          lead.stage === 'Inquiry' || lead.stage === 'Proposal'
            ? null
            : new Date(new Date().setHours(9 + (i % 8), (i % 2) * 30, 0, 0)).toISOString(),
        needsAttention: lead.stage === 'Trial scheduled' || lead.stage === 'Proposal' || lead.stage === 'At risk',
        // The k-anon wall: below MIN_COHORT the percentage is suppressed.
        attendancePct: lead.cohortSize >= 10 ? 72 + i * 2 : null,
        cohortSize: lead.cohortSize,
        learnerRef: lead.learnerUsername ? learnerIds.get(lead.learnerUsername) ?? null : null,
      },
    });
  }
  console.log(`leads    + ${slug} (${rows.length})`);
}

/* ── Platform admin — a Payload CMS user, the internal shell ───────────── */

{
  const address = email('platform-admin');
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: address } },
    limit: 1,
  });
  if (docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: { email: address, password: PLATFORM_ADMIN_PASSWORD, name: 'Moyo Walkthrough Admin' },
    });
    console.log(`admin    + ${address}`);
  } else {
    console.log(`admin    = ${address}`);
  }
}

console.log('\nWalkthrough seed complete. Matrix: qa/walkthroughs/ACCOUNTS.md');
await pool.end();
process.exit(0);
