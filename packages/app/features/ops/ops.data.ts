// The ops dashboard's shared shapes and read-time disclosure policy.
//
// Leads are NO LONGER a fixture: they come from the `leads` collection through
// `leads.repository`. What stays here is what both sides of that boundary need —
// the row shape, the stage tone map, and the k-anonymity rule — plus the two
// panels (today's sessions, revenue by month) whose collections do not exist
// yet.
// SOT: docs/pack/28-crm-spec.md §2 (object model) · §3 (pipeline) · docs/pack/19-learning-outcomes-spec.md §3–§4 · docs/pack/27-reporting-charts-spec.md §4
// SOT-KEYWORDS: ops dashboard crm leads sessions pipeline stage suppression k-anonymity cohort
import type { Suppressible, TrendPoint } from '@acme/ui';
import { MOCK_LEARNERS, MOCK_STAFF } from '../../fixtures/cast.ts';

/** Doc 28 §3 — the trial is a first-class stage, not a note. */
export type Stage =
  | 'Inquiry'
  | 'Trial scheduled'
  | 'Trial completed'
  | 'Proposal'
  | 'Enrolled'
  | 'At risk';

export interface Lead {
  id: string;
  family: string;
  learner: string;
  subject: string;
  stage: Stage;
  owner: string;
  nextSession: string;
  sessions: number;
  value: string;
  /** k-anonymity applies to attendance the moment a cohort is small (doc 19 §5). */
  attendance: Suppressible<string>;
  needsAttention?: boolean;
}

/**
 * The smallest cohort whose aggregate a human may see.
 *
 * Doc 19 §3–§4 requires small-cell suppression on every human-viewed aggregate
 * and doc 27 §4 requires a suppressed cell to say so rather than render zero —
 * but NO document in the pack states a number. 10 is the ESSA n-size most
 * states report against, so it is the defensible default, and it is a decision
 * this file is making rather than one it is quoting.
 *
 * One constant, because a threshold that appears twice is a threshold that will
 * disagree with itself — which it already did: the dashboard footer promised
 * suppression under 5 while this said 10.
 */
export const MIN_COHORT = 10;

/**
 * Decides attendance disclosure at READ time, never at write time.
 *
 * The row stores the raw percentage (doc 28 §2); suppression is a property of
 * who is asking and how big the cohort is, so baking it into the row would
 * freeze one reader's answer for every reader.
 */
export function attendanceCell(
  attendancePct: number | null | undefined,
  cohortSize: number | null | undefined,
): Suppressible<string> {
  if (attendancePct == null || (cohortSize ?? 0) < MIN_COHORT) return { suppressed: true };
  return { value: `${Math.round(attendancePct)}%` };
}

/**
 * Doc 37 §2: a brand-new org's Overview shows "seeded example rows labeled as
 * examples" instead of a bare empty table — an operator's first look at the
 * pipeline should show what a row will look like, not a void. These render
 * ONLY when the pipeline is genuinely empty (zero rows before any filter),
 * every row is labelled "Example" where it renders, and nothing here is ever
 * written to the leads collection — they are copy, not data, which is why they
 * live beside the row SHAPE rather than in a fixture cast: fixtures play real
 * people, and an example row must never be mistakable for one.
 */
export const EXAMPLE_LEADS: readonly Lead[] = [
  {
    id: 'example-inquiry',
    family: 'The Alvarez family',
    learner: 'Maya',
    subject: 'Math',
    stage: 'Inquiry',
    owner: 'You',
    nextSession: '—',
    sessions: 0,
    value: '$0',
    attendance: { value: '—' },
  },
  {
    id: 'example-trial',
    family: 'The Chen family',
    learner: 'Daniel',
    subject: 'Reading',
    stage: 'Trial scheduled',
    owner: 'You',
    nextSession: 'Thu 4:00pm',
    sessions: 1,
    value: '$45',
    attendance: { value: '—' },
  },
  {
    id: 'example-enrolled',
    family: 'The Okafor family',
    learner: 'Zuri',
    subject: 'Science',
    stage: 'Enrolled',
    owner: 'You',
    nextSession: 'Mon 5:30pm',
    sessions: 11,
    value: '$495',
    attendance: { value: '92%' },
  },
];

export interface Session {
  id: string;
  time: string;
  learner: string;
  subject: string;
  tutor: string;
  mode: 'Virtual' | 'In person';
  needsAttention?: boolean;
}

/*
  Sessions and revenue are still fixtures, and honestly so: doc 01 §7.1 plans a
  `sessions` collection and doc 28 §7 routes revenue through doc 19's rollup
  tables, but neither exists. What changed is that they are no longer a cast of
  strangers — the names are READ from the roster, so a person renamed in one
  place cannot survive in the other, and each district has its own.

  Doc 10 §2.3 specs session mode as a discriminated union
  (`{mode:'virtual'; joinUrl} | {mode:'in-person'; room}`) with lowercase
  literals. This shape predates that and carries neither `joinUrl` nor `room`;
  aligning it belongs with the `sessions` collection, not with a fixture swap.
*/
const named = (id: string) =>
  [...MOCK_LEARNERS, ...MOCK_STAFF].find((p) => p.id === id)?.name ?? id;

export const SESSIONS_BY_ORG: Readonly<Record<string, readonly Session[]>> = {
  'riverside-unified': [
    { id: 'rs1', time: '09:00\u201309:45', learner: named('learner-maya'), subject: 'Algebra II', tutor: named('staff-priya'), mode: 'Virtual' },
    { id: 'rs2', time: '10:00\u201310:45', learner: named('learner-daniel'), subject: 'Trial \u00b7 Fractions', tutor: named('staff-priya'), mode: 'In person', needsAttention: true },
    { id: 'rs3', time: '14:30\u201315:15', learner: named('learner-maya'), subject: 'Reading', tutor: named('staff-priya'), mode: 'Virtual' },
  ],
  'lincoln-public': [
    { id: 'lp1', time: '13:00\u201313:45', learner: named('learner-sofia'), subject: 'Reading', tutor: named('staff-kenji'), mode: 'Virtual' },
    { id: 'lp2', time: '15:00\u201315:45', learner: named('learner-tomi'), subject: 'Chemistry', tutor: named('staff-kenji'), mode: 'In person', needsAttention: true },
  ],
};

export const STAGE_TONE = {
  Inquiry: 'neutral',
  'Trial scheduled': 'primary',
  'Trial completed': 'primary',
  Proposal: 'neutral',
  Enrolled: 'success',
  'At risk': 'attention',
} as const satisfies Record<Stage, 'neutral' | 'primary' | 'success' | 'attention'>;

/**
 * The pipeline order as a runtime list — the board's column axis. Derived from
 * STAGE_TONE rather than typed again: its `satisfies Record<Stage, …>` is the
 * completeness check (a new Stage that skips the tone map fails to compile),
 * and its declaration order above IS doc 28 §3's pipeline order, ending on the
 * scorer-owned 'At risk'. A second hand-written list would be a second order.
 */
export const STAGES = Object.keys(STAGE_TONE) as readonly Stage[];

/**
 * Invoiced revenue by month, per district.
 *
 * Riverside hides ONE month and Lincoln hides TWO ADJACENT ones, deliberately.
 * A single hole and a run of holes take different paths through the chart —
 * `TrendLine` merges consecutive suppressed points into one hatched span — and
 * a branch only the tests reach is a branch that breaks in front of a customer.
 * The previous fixture's comment claimed two suppressed months and shipped one.
 */
export const REVENUE_BY_ORG: Readonly<Record<string, readonly TrendPoint[]>> = {
  'riverside-unified': [
    { label: 'Feb', value: { value: 2140 } },
    { label: 'Mar', value: { value: 2680 } },
    { label: 'Apr', value: { suppressed: true } },
    { label: 'May', value: { value: 3120 } },
    { label: 'Jun', value: { value: 2960 } },
    { label: 'Jul', value: { value: 3870 } },
    { label: 'Aug', value: { value: 4210 } },
  ],
  'lincoln-public': [
    { label: 'Feb', value: { value: 1180 } },
    { label: 'Mar', value: { suppressed: true } },
    { label: 'Apr', value: { suppressed: true } },
    { label: 'May', value: { value: 1640 } },
    { label: 'Jun', value: { value: 1890 } },
    { label: 'Jul', value: { value: 2310 } },
    { label: 'Aug', value: { value: 2480 } },
  ],
};
