// The mock cast: two districts and the people in them.
//
// WHY THIS IS A FIXTURE AND NOT A TABLE. Learners, guardians and staff are
// Better Auth users (doc 06 §2 — "learners are real Better Auth users, not rows
// in a profile table"), and Better Auth has no tables in this database yet.
// Payload's `users` is not a substitute: it is the CMS auth collection, and
// seeding a nine-year-old into it would hand them an admin login. So the people
// live here, and everything that DOES have a collection — organizations, leads,
// guardianships, consents — is seeded from this same file by
// `apps/web/scripts/seed.ts`. One cast, two representations, joined by id.
// When Better Auth is migrated, these ids become rows and nothing else moves.
//
// The ids are what `guardianships.guardianAuthId` / `learnerAuthId` and
// `consents` carry, which is why they are stable readable strings rather than
// generated — a seed you cannot grep is a seed you cannot debug.
//
// Doc 28 §2's wall holds here too: nobody in this file carries a mastery score,
// a struggle flag or a progress percentage. Ops rows hold relationship,
// scheduling, attendance and billing context and never learning content.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §7 · docs/pack/01-ai-tutoring-platform-plan.md §(auth mapping) · docs/pack/28-crm-spec.md §2
// SOT-KEYWORDS: cast fixtures mock districts orgs staff learners guardians family seed roster
import { avatarFor } from './avatars.ts';

/**
 * Ops-staff roles. Doc 06 §2 lists `owner, manager, scheduler, finance` for
 * business staff and assigns `tutor` on invitation-accept; `teacher` is its own
 * account type. Doc 01 §(auth mapping) lists a sixth, `manager`, which doc 06
 * keeps — the two lists agree on everything except where tutor/teacher sit.
 * "Coordinator" appears in neither and is deliberately absent.
 */
export type StaffRole = 'owner' | 'manager' | 'scheduler' | 'finance' | 'tutor' | 'teacher';

export interface MockOrg {
  /** The tenant key. This is `organizations.slug` and every row's `orgId`. */
  slug: string;
  name: string;
  kind: 'tutoring' | 'school' | 'district';
  /** A palette token name, never a hex — see the Organizations collection. */
  brandAccent: 'ember' | 'gold' | 'forest' | 'sky' | 'rose';
  logoUrl: string;
}

export interface MockPerson {
  id: string;
  name: string;
  orgSlug: string;
  avatarUrl: string;
}

export interface MockStaff extends MockPerson {
  role: StaffRole;
  email: string;
}

export interface MockLearner extends MockPerson {
  /**
   * Doc 06 §2: a learner under 13 signs in with a guardian-chosen USERNAME that
   * is non-identifying by policy, never an email. Storing a real name beside a
   * `blue-falcon-42` handle is the point — staff see the name, the credential
   * never carries it.
   */
  username: string;
  isMinor: boolean;
  gradeBand: 'young' | 'older';
}

export interface MockGuardian extends MockPerson {
  email: string;
  /** Learner ids this adult is a guardian for. */
  learnerIds: readonly string[];
  /** Doc 06 §7's enum. `email-plus` is the v1 primary method (§3.1). */
  consentMethod: 'email-plus' | 'text-plus' | 'kba' | 'card';
}

/*
  Logos are inline SVG data URIs rather than files.

  The districts are fictional, so there is nothing to download; and `Media` is
  `upload: true` with no storage adapter, so an uploaded logo would live on one
  machine's disk. A data URI renders identically through SolitoImage on both
  platforms, needs no `next.config.ts` remotePatterns entry, and cannot 404 in a
  demo. A real district replaces this with its own hosted URL — the field does
  not change.
*/
const logo = (mark: string, bg: string, fg: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img"><rect width="64" height="64" rx="14" fill="${bg}"/><text x="32" y="43" font-family="Georgia,serif" font-size="30" font-weight="700" text-anchor="middle" fill="${fg}">${mark}</text></svg>`,
  )}`;

export const MOCK_ORGS: readonly MockOrg[] = [
  {
    slug: 'riverside-unified',
    name: 'Riverside Unified',
    kind: 'district',
    brandAccent: 'sky',
    logoUrl: logo('RU', '#1E4B8F', '#FFFFFF'),
  },
  {
    slug: 'lincoln-public',
    name: 'Lincoln Public Schools',
    kind: 'district',
    brandAccent: 'forest',
    logoUrl: logo('LP', '#1F5B3A', '#FFFFFF'),
  },
];

export const MOCK_STAFF: readonly MockStaff[] = [
  {
    id: 'staff-amara',
    name: 'Amara Osei',
    orgSlug: 'riverside-unified',
    role: 'owner',
    email: 'amara.osei@riverside.example',
    avatarUrl: avatarFor('amara', 'top=curly&hairColor=2c1b18&skinColor=614335&clothing=blazerAndShirt'),
  },
  {
    id: 'staff-jonah',
    name: 'Jonah Mercer',
    orgSlug: 'riverside-unified',
    role: 'scheduler',
    email: 'jonah.mercer@riverside.example',
    avatarUrl: avatarFor('jonah', 'top=shortFlat&hairColor=b58143&skinColor=ffdbb4&clothing=shirtCrewNeck'),
  },
  {
    id: 'staff-priya',
    name: 'Priya Raman',
    orgSlug: 'riverside-unified',
    role: 'tutor',
    email: 'priya.raman@riverside.example',
    avatarUrl: avatarFor('priya', 'top=straightAndStrand&hairColor=090806&skinColor=ae5d29&clothing=blazerAndShirt'),
  },
  {
    id: 'staff-elena',
    name: 'Elena Fischer',
    orgSlug: 'lincoln-public',
    role: 'owner',
    email: 'elena.fischer@lincoln.example',
    avatarUrl: avatarFor('elena', 'top=longButNotTooLong&hairColor=b58143&skinColor=ffdbb4&clothing=blazerAndShirt'),
  },
  {
    id: 'staff-kenji',
    name: 'Kenji Watanabe',
    orgSlug: 'lincoln-public',
    role: 'teacher',
    email: 'kenji.watanabe@lincoln.example',
    avatarUrl: avatarFor('kenji', 'top=shortFlat&hairColor=090806&skinColor=edb98a&clothing=shirtScoopNeck'),
  },
];

export const MOCK_LEARNERS: readonly MockLearner[] = [
  {
    id: 'learner-maya',
    name: 'Maya Rodriguez',
    orgSlug: 'riverside-unified',
    username: 'blue-falcon-42',
    isMinor: true,
    gradeBand: 'older',
    avatarUrl: avatarFor('maya', 'top=bigHair&hairColor=2c1b18&skinColor=d08b5b&clothing=blazerAndSweater'),
  },
  {
    id: 'learner-daniel',
    name: 'Daniel Okafor',
    orgSlug: 'riverside-unified',
    username: 'amber-otter-17',
    isMinor: true,
    gradeBand: 'young',
    avatarUrl: avatarFor('daniel', 'top=shortCurly&hairColor=2c1b18&skinColor=614335&clothing=shirtCrewNeck'),
  },
  {
    id: 'learner-sofia',
    name: 'Sofia Bell',
    orgSlug: 'lincoln-public',
    username: 'green-heron-08',
    isMinor: true,
    gradeBand: 'young',
    avatarUrl: avatarFor('sofia', 'top=bob&hairColor=724133&skinColor=f8d25c&clothing=graphicShirt'),
  },
  {
    id: 'learner-tomi',
    name: 'Tomi Adeyemi',
    orgSlug: 'lincoln-public',
    username: 'silver-marten-63',
    isMinor: true,
    gradeBand: 'older',
    avatarUrl: avatarFor('tomi', 'top=dreads01&hairColor=090806&skinColor=614335&clothing=hoodie'),
  },
];

/*
  Doc 06 §2: "Two guardians per learner are supported from day one (real families
  have two households); the second guardian joins by invitation from the first."
  The Rodriguez household is the one that exercises it — a single-guardian family
  never proves the pair works, and a `guardianId` column on the learner would
  have made two impossible.
*/
export const MOCK_GUARDIANS: readonly MockGuardian[] = [
  {
    id: 'guardian-dana',
    name: 'Dana Rodriguez',
    orgSlug: 'riverside-unified',
    email: 'dana.rodriguez@example.com',
    learnerIds: ['learner-maya'],
    consentMethod: 'email-plus',
    avatarUrl: avatarFor('dana', 'top=straight02&hairColor=2c1b18&skinColor=d08b5b&clothing=overall'),
  },
  {
    id: 'guardian-marcus',
    name: 'Marcus Rodriguez',
    orgSlug: 'riverside-unified',
    email: 'marcus.rodriguez@example.com',
    learnerIds: ['learner-maya'],
    // The invited second guardian, so the pair is verified by a different route
    // than the first (doc 06 §3.1 step 2 makes text-plus the alternative).
    consentMethod: 'text-plus',
    avatarUrl: avatarFor('marcusr', 'top=shortWaved&hairColor=2c1b18&facialHair=beardMedium&facialHairColor=2c1b18&skinColor=ae5d29&clothing=shirtVNeck'),
  },
  {
    id: 'guardian-ruth',
    name: 'Ruth Bell',
    orgSlug: 'lincoln-public',
    email: 'ruth.bell@example.com',
    learnerIds: ['learner-sofia'],
    consentMethod: 'email-plus',
    avatarUrl: avatarFor('ruth', 'top=bun&hairColor=724133&skinColor=f8d25c&clothing=blazerAndSweater'),
  },
];

export const orgBySlug = (slug: string): MockOrg | undefined =>
  MOCK_ORGS.find((o) => o.slug === slug);

export const personById = (id: string): MockPerson | undefined =>
  [...MOCK_STAFF, ...MOCK_LEARNERS, ...MOCK_GUARDIANS].find((p) => p.id === id);
