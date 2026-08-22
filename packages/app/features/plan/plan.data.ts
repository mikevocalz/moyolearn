// Student plan demo data — one mixed timeline, source-agnostic by design.
// A child does not care which collection an item came from (S8), so sessions,
// assignments, and AI practice are one list with a `kind` discriminant.
// SOT: docs/pack/04-screen-briefs.md §S8
// SOT-KEYWORDS: student plan timeline agenda session assignment practice due

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
      {
        id: '3',
        kind: 'assignment',
        title: 'Worksheet 4.2',
        dueLabel: 'Due tomorrow',
        joinable: false,
        done: true,
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
