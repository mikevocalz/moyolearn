// Parent home demo data — replace with real child + activity queries.
//
// WHAT WAS REMOVED, AND WHY IT IS NOT COMING BACK IN THIS SHAPE:
//
//  · `ACTION_ITEMS` — three pressable rows (approve a session plan, pay an
//    invoice, sign a consent form) whose handler was empty. Not one of the
//    three has a surface behind it: booking and its approvals are J2's missing
//    middle, billing is unmounted (the same finding that struck org.money — no
//    money collection, no Stripe keys), and there is no guardian consent
//    screen. A live row that goes nowhere is the dead end this codebase strikes
//    on sight, and three of them under a heading called "Action needed" tell a
//    parent they are behind on work they cannot do.
//  · `NEEDS_ATTENTION` — two hardcoded lines rendered in danger red. "Jordan
//    skipped 2 AI practice sessions" is engagement-pressure copy about a minor
//    (CLAUDE.md §Children's surfaces), and "Maya's invoice is due Friday" is a
//    payment nag; neither is an emergency, and danger red on a family surface
//    means something happened to a child. Real attention has a real channel —
//    incidents reach the guardian through doc 31's ladder and render on
//    guardian.alerts, which is where this screen now points.
//
// What remains is what the surface can honestly say today: who the children
// are, what the week held, and what is next. The newest report is NOT here —
// it is a live read (`useGuardianReports`), because the contract's primary
// action must open a real report, not a fixture.
// SOT: design/screens/guardian/guardian.home/contract.md · docs/pack/04-screen-briefs.md §S11
// SOT-KEYWORDS: parent home guardian child activity upcoming fixture struck action items

import type { AgeBand } from '../capture/age-band';

export interface ChildSummary {
  id: string;
  name: string;
  gradeBand: AgeBand;
  status: string;
}

export interface UpcomingItem {
  id: string;
  title: string;
  time: string;
}

export const CHILDREN: ChildSummary[] = [
  { id: 'maya', name: 'Maya', gradeBand: 'young', status: 'On track' },
  { id: 'jordan', name: 'Jordan', gradeBand: 'child', status: 'Needs check-in' },
];

export const THIS_WEEK = {
  sessions: 4,
  assignments: 2,
  aiPractice: 3,
};

export const UPCOMING: UpcomingItem[] = [
  { id: '1', title: 'Maya · Factoring', time: 'Today, 4:00 PM' },
  { id: '2', title: 'Jordan · Linear equations', time: 'Today, 5:30 PM' },
];
