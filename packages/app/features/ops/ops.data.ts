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

export interface Session {
  id: string;
  time: string;
  learner: string;
  subject: string;
  tutor: string;
  mode: 'Virtual' | 'In person';
  needsAttention?: boolean;
}

export const TODAY_SESSIONS: readonly Session[] = [
  { id: 's1', time: '09:00–09:45', learner: 'Maya Rodriguez', subject: 'Algebra II', tutor: 'Priya Raman', mode: 'Virtual' },
  { id: 's2', time: '10:00–10:45', learner: 'Daniel Okafor', subject: 'Trial · Fractions', tutor: 'Marcus Bell', mode: 'In person', needsAttention: true },
  { id: 's3', time: '14:30–15:15', learner: 'Elena Fischer', subject: 'Reading', tutor: 'Priya Raman', mode: 'Virtual' },
];

export const STAGE_TONE = {
  Inquiry: 'neutral',
  'Trial scheduled': 'primary',
  'Trial completed': 'primary',
  Proposal: 'neutral',
  Enrolled: 'success',
  'At risk': 'attention',
} as const satisfies Record<Stage, 'neutral' | 'primary' | 'success' | 'attention'>;

/**
 * Invoiced revenue by month. Two months carry a suppressed figure so the chart's
 * hole-handling is exercised by the default fixture rather than only by a test —
 * doc 27 §4 requires every chart component to render both variants.
 */
export const REVENUE_BY_MONTH: readonly TrendPoint[] = [
  { label: 'Feb', value: { value: 2140 } },
  { label: 'Mar', value: { value: 2680 } },
  { label: 'Apr', value: { suppressed: true } },
  { label: 'May', value: { value: 3120 } },
  { label: 'Jun', value: { value: 2960 } },
  { label: 'Jul', value: { value: 3870 } },
  { label: 'Aug', value: { value: 4210 } },
];
