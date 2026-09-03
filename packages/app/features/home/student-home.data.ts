// Student home demo data — replace with real queries.
//
// Band-scoped, for the same reason the practice sets are: two bands render
// `StudentHomeContent`, and a single fixture handed a nine-year-old "Continue:
// Factoring" and "Watch: solving two-step equations". A demo that shows the
// wrong child the wrong subject is not a neutral placeholder — it is the band
// bug wearing fixture clothes, and it reads as the product's actual behaviour
// in every screenshot and every review.
//
// `young` is present for completeness even though K–2 forks to the hub before
// reaching this component: a band map with a hole is a map that throws the day
// someone routes a new surface through it.
// SOT: docs/pack/04-screen-briefs.md §S7 · design/screens/learner/learner.home/contract.md
// SOT-KEYWORDS: student home data continue session plan improvement band young child teen fixture

import type { AgeBand } from '../capture/age-band';

export interface ContinueSkill {
  title: string;
  /** Names what happened last time. Never a streak, never "don't lose it". */
  subtitle: string;
}

export interface PlanItem {
  id: string;
  label: string;
  done: boolean;
  href?: string;
}

export interface StudentHomeFixture {
  continueSkill: ContinueSkill;
  planItems: PlanItem[];
}

const FIXTURES = {
  young: {
    continueSkill: { title: 'Adding', subtitle: 'You were adding numbers last time' },
    planItems: [
      { id: '1', label: 'Practise adding', done: false, href: '/practice' },
      { id: '2', label: 'Count to twenty', done: true },
    ],
  },
  child: {
    continueSkill: { title: 'Times tables', subtitle: 'You worked on sixes last time' },
    planItems: [
      { id: '1', label: 'Practise times tables · 10 min', done: false, href: '/practice' },
      { id: '2', label: 'Watch: what a fraction is', done: true },
      { id: '3', label: 'Read your notes from yesterday', done: true },
    ],
  },
  teen: {
    continueSkill: { title: 'Factoring', subtitle: 'You picked this up quickly last time' },
    planItems: [
      { id: '1', label: 'Practice factoring · 15 min', done: false, href: '/practice' },
      { id: '2', label: 'Watch: solving two-step equations', done: true },
      { id: '3', label: 'Review notes from yesterday', done: true },
    ],
  },
  adult: {
    continueSkill: { title: 'Factoring', subtitle: 'You picked this up quickly last time' },
    planItems: [
      { id: '1', label: 'Practice factoring · 15 min', done: false, href: '/practice' },
      { id: '2', label: 'Watch: solving two-step equations', done: true },
      { id: '3', label: 'Review notes from yesterday', done: true },
    ],
  },
} as const satisfies Record<AgeBand, StudentHomeFixture>;

export function studentHomeFixtureFor(ageBand: AgeBand): StudentHomeFixture {
  return FIXTURES[ageBand];
}

export const NEXT_SESSION = {
  tutorName: 'Natalie',
  timeLabel: 'Today, 4:00 PM',
};

/**
 * A 6–12 card only (the Progress band). The framing is a gain that already
 * happened, never a target to defend — a delta a child is asked to protect is
 * the pressure mechanic the children's rules ban.
 */
export const IMPROVEMENT = {
  skill: 'factoring',
  previous: 64,
  current: 72,
  delta: 8,
};
