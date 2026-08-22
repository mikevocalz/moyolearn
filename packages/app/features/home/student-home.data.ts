// Student home demo data — replace with real queries.
// SOT: docs/pack/04-screen-briefs.md §S7
// SOT-KEYWORDS: student home data continue session plan improvement

export const CONTINUE_SKILL = {
  title: 'Factoring',
  subtitle: 'You were on a roll yesterday — keep going',
};

export const NEXT_SESSION = {
  tutorName: 'Natalie',
  timeLabel: 'Today, 4:00 PM',
};

export interface PlanItem {
  id: string;
  label: string;
  done: boolean;
  href?: string;
}

export const PLAN_ITEMS: PlanItem[] = [
  { id: '1', label: 'Practice factoring · 15 min', done: false, href: '/tutor' },
  { id: '2', label: 'Watch: solving two-step equations', done: true },
  { id: '3', label: 'Review notes from yesterday', done: true },
];

export const IMPROVEMENT = {
  skill: 'factoring',
  previous: 64,
  current: 72,
  delta: 8,
};
