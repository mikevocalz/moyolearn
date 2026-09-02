// Assignment display copy — due dates in plain speech and the status→Badge
// mapping, shared by the tracking list and the detail so the two never drift.
//
// The copy law is plan.data.ts's: "Due tomorrow", never "2026-08-21". Past-due
// reads as a calm fact ("Was due yesterday") — never a countdown, never red
// urgency: what propagates from this surface reaches children's plans, and
// even the teacher side keeps the same temperature (contract note, doc 33
// non-goal 7).
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/plan/plan.data.ts
// SOT-KEYWORDS: assignment due label plain speech copy status badge tone draft published closed

import type { AssignmentStatus } from './assignments.types.ts';

const DAY_MS = 86_400_000;

/** ISO date → plain speech, relative to `now`'s calendar day. */
export function dueLabel(dueAt: string, now: Date = new Date()): string {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return 'No due date';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(now)) / DAY_MS);
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days === -1) return 'Was due yesterday';
  // Inside a week the weekday is how a teacher says it ("Due Friday"); beyond
  // that the date needs its name, still spoken ("Due September 30").
  if (days > 1 && days < 7) return `Due ${due.toLocaleDateString(undefined, { weekday: 'long' })}`;
  const named = due.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  return days > 0 ? `Due ${named}` : `Was due ${named}`;
}

/**
 * Status tones (Badge.tsx): a draft is the one row awaiting the teacher's own
 * action → `attention` (highlighter, doc 08 §4.8 — explicitly not redpen);
 * published is the working state → `success`; closed is finished business →
 * `neutral`. Nothing here is red: no status is something anyone got wrong.
 */
export const STATUS_BADGE: Record<
  AssignmentStatus,
  { label: string; tone: 'attention' | 'success' | 'neutral' }
> = {
  draft: { label: 'Draft', tone: 'attention' },
  published: { label: 'Published', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
};
