// Demo fixtures for the ops dashboard until the CRM repositories land (doc 28
// PR-72/73). Kept in one file so the screen imports a shape, not a literal, and
// swapping in the real service is a one-import change.
// SOT: docs/pack/28-crm-spec.md §2 (object model) · §3 (pipeline)
// SOT-KEYWORDS: ops dashboard crm demo fixtures leads sessions pipeline stage
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

export const LEADS: readonly Lead[] = [
  { id: 'l1', family: 'Okafor', learner: 'Daniel', subject: 'Fractions', stage: 'Trial scheduled', owner: 'Amara', nextSession: '10:00', sessions: 1, value: '$45', attendance: { suppressed: true }, needsAttention: true },
  { id: 'l2', family: 'Whitfield', learner: 'Noah', subject: 'Algebra I', stage: 'Proposal', owner: 'Amara', nextSession: '—', sessions: 0, value: '$0', attendance: { suppressed: true }, needsAttention: true },
  { id: 'l3', family: 'Bell', learner: 'Sofia', subject: 'Reading', stage: 'At risk', owner: 'Jonah', nextSession: '14:30', sessions: 11, value: '$495', attendance: { value: '61%' }, needsAttention: true },
  { id: 'l4', family: 'Rodriguez', learner: 'Maya', subject: 'Algebra II', stage: 'Enrolled', owner: 'Amara', nextSession: '09:00', sessions: 24, value: '$1,080', attendance: { value: '96%' } },
  { id: 'l5', family: 'Fischer', learner: 'Elena', subject: 'Reading', stage: 'Enrolled', owner: 'Jonah', nextSession: '16:00', sessions: 38, value: '$1,710', attendance: { value: '99%' } },
  { id: 'l6', family: 'Adeyemi', learner: 'Tomi', subject: 'Chemistry', stage: 'Trial completed', owner: 'Jonah', nextSession: '—', sessions: 1, value: '$45', attendance: { suppressed: true } },
  { id: 'l7', family: 'Nakamura', learner: 'Rin', subject: 'Geometry', stage: 'Inquiry', owner: 'Amara', nextSession: '—', sessions: 0, value: '$0', attendance: { suppressed: true } },
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
