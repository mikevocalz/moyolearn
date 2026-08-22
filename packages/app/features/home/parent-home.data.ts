// Parent home demo data — replace with real child + action queries.
// SOT: docs/pack/04-screen-briefs.md §S11
// SOT-KEYWORDS: parent home guardian child activity action needed upcoming

import type { AgeBand } from '../capture/age-band';

export interface ChildSummary {
  id: string;
  name: string;
  gradeBand: AgeBand;
  status: string;
}

export interface ActionItem {
  id: string;
  label: string;
  due: string;
  kind: 'approval' | 'payment' | 'form' | 'reschedule';
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

export const NEEDS_ATTENTION = [
  'Jordan skipped 2 AI practice sessions',
  'Maya’s invoice is due Friday',
];

export const ACTION_ITEMS: ActionItem[] = [
  { id: '1', label: 'Approve Jordan’s session plan', due: 'Today', kind: 'approval' },
  { id: '2', label: 'Pay Maya’s invoice', due: 'Fri', kind: 'payment' },
  { id: '3', label: 'Sign consent form', due: '3 days', kind: 'form' },
];

export const UPCOMING: UpcomingItem[] = [
  { id: '1', title: 'Maya · Factoring', time: 'Today, 4:00 PM' },
  { id: '2', title: 'Jordan · Linear equations', time: 'Today, 5:30 PM' },
];
