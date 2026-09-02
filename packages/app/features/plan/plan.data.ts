// Student plan data — one mixed timeline, source-agnostic by design.
// A child does not care which collection an item came from (S8), so sessions,
// assignments, and AI practice are one list with a `kind` discriminant.
//
// Decision: assignments are REAL (published rows from the learner's classes,
// via useLearnerAssignments) and are bucketed into the week client-side by
// `dueAt`; sessions and practice remain fixture rows until their loops have a
// server read to arrive from. The week scaffold itself is still the fixture's
// three positional days — day 0 is today, day 1 tomorrow, day 2 the day after
// — so real due dates map by calendar distance from now, not by the fixture's
// decorative day-of-month numbers.
// SOT: docs/pack/04-screen-briefs.md §S8 · design/screens/learner/learner.plan/contract.md
// SOT-KEYWORDS: student plan timeline agenda session assignment practice due bucket merge label

import type { LearnerAssignment } from '../assignments/learner-assignments.service';

export type PlanItemKind = 'session' | 'assignment' | 'practice';

export interface PlanTimelineItem {
  id: string;
  kind: PlanItemKind;
  title: string;
  /** Plain speech, never a raw date — "Due tomorrow", not "2026-08-21". */
  dueLabel: string;
  /** Human tutors carry a name; AI practice carries the presence mark. */
  tutorName?: string;
  joinable: boolean;
  done: boolean;
}

export interface PlanDay {
  id: string;
  label: string;
  weekday: string;
  dayOfMonth: number;
  items: PlanTimelineItem[];
}

export const PLAN_WEEK: PlanDay[] = [
  {
    id: 'mon',
    label: 'Today',
    weekday: 'Mon',
    dayOfMonth: 18,
    items: [
      {
        id: '1',
        kind: 'session',
        title: 'Factoring with Natalie',
        dueLabel: '4:00 PM',
        tutorName: 'Natalie',
        joinable: true,
        done: false,
      },
      {
        id: '2',
        kind: 'practice',
        title: 'Practice factoring · 15 min',
        dueLabel: 'Any time today',
        joinable: false,
        done: false,
      },
    ],
  },
  {
    id: 'tue',
    label: 'Tomorrow',
    weekday: 'Tue',
    dayOfMonth: 19,
    items: [
      {
        id: '4',
        kind: 'practice',
        title: 'Warm-up review · 10 min',
        dueLabel: 'Any time',
        joinable: false,
        done: false,
      },
    ],
  },
  {
    id: 'wed',
    label: 'Wednesday',
    weekday: 'Wed',
    dayOfMonth: 20,
    items: [],
  },
];

/** Whole calendar days from `now`'s date to `dueAt`'s date; negative = past. */
function calendarDaysUntil(dueAt: string, now: Date): number | null {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return null;
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOf(due) - startOf(now)) / 86_400_000);
}

// A static table rather than Intl: Hermes builds without full ICU render
// toLocaleDateString weekdays as raw dates, which the copy law forbids.
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Plain-speech due label (copy law above). A past-due assignment reads exactly
 * like a far-future one — "Due Monday" — because the children's-surfaces law
 * bans overdue framing: no "late", no countdown, no alarm register. The work
 * simply still names the day it was due.
 */
export function dueLabelFor(dueAt: string, now: Date = new Date()): string {
  const days = calendarDaysUntil(dueAt, now);
  if (days === null) return 'Due soon';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due ${WEEKDAY_NAMES[new Date(dueAt).getDay()]!}`;
}

/**
 * Home's "due today/soon" window: due today, due tomorrow, or already past
 * (past-due stays visible — calmly — because it is still the child's most
 * actionable work, never because it is "late").
 */
export function isDueSoon(dueAt: string, now: Date = new Date()): boolean {
  const days = calendarDaysUntil(dueAt, now);
  return days !== null && days <= 1;
}

function toPlanItem(assignment: LearnerAssignment, now: Date): PlanTimelineItem {
  return {
    id: `assignment-${assignment.id}`,
    kind: 'assignment',
    title: assignment.title,
    dueLabel: dueLabelFor(assignment.dueAt, now),
    joinable: false,
    done: false,
  };
}

/**
 * Buckets real published assignments into the week's positional days and
 * merges them into each day's mixed timeline (assignments first — they carry
 * a date; fixture rows follow).
 *
 * Past-due work lands in TODAY's bucket: it is what the child can act on now,
 * and hiding it behind a day that already scrolled past would strand it.
 * Work due beyond the visible strip belongs to days this scaffold does not
 * render yet, so it stays off rather than piling dishonestly onto the last
 * day. Never mutates the fixture.
 */
export function mergeAssignmentsIntoWeek(
  week: PlanDay[],
  assignments: readonly LearnerAssignment[],
  now: Date = new Date(),
): PlanDay[] {
  const buckets: LearnerAssignment[][] = week.map(() => []);
  for (const assignment of assignments) {
    const days = calendarDaysUntil(assignment.dueAt, now);
    if (days === null) continue;
    const index = Math.max(days, 0);
    if (index < buckets.length) buckets[index]!.push(assignment);
  }
  return week.map((day, index) => ({
    ...day,
    items: [...buckets[index]!.map((a) => toPlanItem(a, now)), ...day.items],
  }));
}
