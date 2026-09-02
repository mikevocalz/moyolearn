// Doc 31 §5.3's triage row, turned into the words and the tone a phone shows.
//
// PRESENTATION ONLY, AND THAT SEPARATION IS THE POINT. Everything a row means —
// which rung it is on, when it is due, whether that deadline has passed, the
// sort order — is decided by `triageQueueFrom` behind `protectedOperation` and
// arrives already settled. This file may not re-decide any of it, because a
// screen that recomputed "breached" from `dueAt` and a device clock would
// disagree with the server on a phone whose time is wrong, and the direction it
// would disagree in is "this looks fine".
//
// So `breached` is read, never derived, and the one thing computed here is how
// far away the deadline READS — which is a sentence, not a verdict.
//
// The ladder's own vocabulary is not restated. S1–S4 are shown as S1–S4 because
// that is what the staff who work this queue call them, and paraphrasing a rung
// into "minor"/"serious" would put a second, softer taxonomy next to the one in
// `packages/safety/src/ladder.ts` that everything else keys on.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §5.3 · packages/app/features/safety/incidents.service.ts
// SOT-KEYWORDS: safety incident queue view triage row severity status sla due overdue breach presentation labels org mobile

import type { TriageRow } from './incidents.service.ts';

/*
  Derived from the row rather than imported from `@acme/safety`. The tiers and
  the categories are the same values either way, but `@acme/safety` is the
  Safety Plane's barrel — server-side by its own header — and a client screen
  reaching into it to name four strings would put the plane on a device's
  import graph for a label.
*/
type SafetyTier = TriageRow['severity'];
type IncidentCategory = TriageRow['category'];
type IncidentStatus = TriageRow['status'];

/** Maps onto `Badge`'s tones. `danger` is the redpen and it is rationed. */
export type QueueTone = 'danger' | 'attention' | 'neutral';

/**
 * Doc 07 §S26 rations redpen to the crisis category — on a FAMILY surface,
 * where red means "your child got something wrong". This is not that surface.
 * Here red means the org is late or a child is in trouble right now, and both
 * of those are ours, not theirs. S4 is the rung that pages a human; anything
 * past its deadline is a promise we broke.
 */
const SEVERITY_TONE = {
  S1: 'neutral',
  S2: 'neutral',
  S3: 'attention',
  S4: 'danger',
} as const satisfies Record<SafetyTier, QueueTone>;

/**
 * Doc 31 §4.1's categories in sentence case. No euphemisms: a queue that said
 * "wellbeing" instead of "self-harm" would be a queue somebody skims past.
 *
 * Exported (with STATUS_LABEL below) for the tutor filed-incident list, which
 * speaks the same vocabulary — a second label map would be the "second,
 * softer taxonomy" this file's header bans, one layer up.
 */
export const CATEGORY_LABEL = {
  profanity: 'Profanity',
  'sexual-content': 'Sexual content',
  bullying: 'Bullying',
  'pii-shared': 'Personal details shared',
  violence: 'Violence',
  substances: 'Substances',
  'self-harm': 'Self-harm',
  'abuse-disclosure': 'Abuse disclosure',
  'tutor-behavior': 'Tutor behaviour',
  'safety-concern': 'Safety concern',
  other: 'Other',
} as const satisfies Record<IncidentCategory, string>;

export const STATUS_LABEL = {
  new: 'New',
  triaged: 'Triaged',
  'in-review': 'In review',
  actioned: 'Actioned',
  resolved: 'Resolved',
  closed: 'Closed',
} as const satisfies Record<IncidentStatus, string>;

/** The two statuses that stop the clock — the same pair `slaBreached` exempts. */
const SETTLED: readonly IncidentStatus[] = ['resolved', 'closed'];

/**
 * Compact duration. Minutes under an hour, hours under two days, then days —
 * a triager reads "2h" and "3d" as different urgencies at a glance, where
 * "in about 3 days" and "in about 2 hours" are the same shape of sentence.
 */
function span(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export function slaClock(row: TriageRow, now: Date): string {
  if (SETTLED.includes(row.status)) return 'Clock stopped';
  if (row.dueAt === null) return 'No response clock';
  const due = Date.parse(row.dueAt);
  if (row.breached) return `Overdue by ${span(now.getTime() - due)}`;
  return `Due in ${span(due - now.getTime())}`;
}

/** One row, ready to draw. Every field is a string the screen prints as-is. */
export interface IncidentQueueItem {
  incidentId: string;
  /** "S4" — verbatim, see the header. */
  severity: SafetyTier;
  tone: QueueTone;
  category: string;
  status: string;
  clock: string;
  /** Drives the late marker, read from the server's verdict. */
  breached: boolean;
  /** The queue's only call to action: a row nobody owns. */
  assignment: string;
  /** ISO, formatted by the screen against the reader's locale. */
  occurredAt: string;
}

export function incidentQueueItemsFrom(
  rows: readonly TriageRow[],
  now: Date,
): readonly IncidentQueueItem[] {
  return rows.map((row) => ({
    incidentId: row.incidentId,
    severity: row.severity,
    // A late row reads as late whatever rung it is on: the SLA is the promise,
    // and the tier only decided how long we had.
    tone: row.breached ? 'danger' : SEVERITY_TONE[row.severity],
    category: CATEGORY_LABEL[row.category],
    status: STATUS_LABEL[row.status],
    clock: slaClock(row, now),
    breached: row.breached,
    assignment: row.assigned ? 'Assigned' : 'Nobody yet',
    occurredAt: row.occurredAt,
  }));
}

/**
 * §5.3: "unassigned-S4 is the one thing allowed to interrupt." The sentence is
 * built here so the banner and the count can never drift apart.
 */
export function unassignedS4Line(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? '1 S4 incident has nobody on it.'
    : `${count} S4 incidents have nobody on them.`;
}
