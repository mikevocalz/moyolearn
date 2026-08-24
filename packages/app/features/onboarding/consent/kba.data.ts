// KBA question source (doc 06 §3.1's "having trouble?" fallback).
//
// The Rule's test is questions "a child in the household could not reasonably
// ascertain", which means they have to come from records the household does not
// keep on the fridge — address history, prior vehicles, mortgage originators. A
// real deployment buys those from an identity provider; there is no way to
// synthesise them from data we hold, and pretending otherwise would be the worst
// possible thing to fake.
//
// So the shape is a provider, and this is the demo one. Swapping it is one
// import — nothing above it knows where questions come from.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent kba questions provider demo identity fallback

import type { KbaQuestion } from '@acme/auth';

/** A set arrives whole and is scored whole; a failed set is never re-served. */
export type KbaProvider = (exclude: string[][]) => KbaQuestion[];

const DEMO_SETS: KbaQuestion[][] = [
  [
    {
      id: 'addr-1',
      prompt: 'Which of these streets have you lived on?',
      options: ['Marchmont Road', 'Kelvin Grove', 'None of these', 'Ashfield Lane'],
      answerIndex: 1,
    },
    {
      id: 'year-1',
      prompt: 'In which year did you move to your current address?',
      options: ['2016', '2019', '2021', 'None of these'],
      answerIndex: 2,
    },
    {
      id: 'lender-1',
      prompt: 'Which of these have you held an account with?',
      options: ['Northgate Credit Union', 'Pemberton Savings', 'None of these', 'Halloway Bank'],
      answerIndex: 0,
    },
    {
      id: 'vehicle-1',
      prompt: 'Which of these have you registered a vehicle to?',
      options: ['A silver estate', 'A blue hatchback', 'None of these', 'A white van'],
      answerIndex: 2,
    },
  ],
  [
    {
      id: 'addr-2',
      prompt: 'Which of these postcodes is associated with you?',
      options: ['EH9 1QT', 'G12 8QQ', 'None of these', 'M20 2RN'],
      answerIndex: 1,
    },
    {
      id: 'year-2',
      prompt: 'Which year did that association begin?',
      options: ['2011', '2014', '2018', 'None of these'],
      answerIndex: 0,
    },
    {
      id: 'phone-2',
      prompt: 'Which of these numbers have you used?',
      options: ['Ends 0184', 'Ends 7726', 'None of these', 'Ends 3390'],
      answerIndex: 3,
    },
    {
      id: 'employer-2',
      prompt: 'Which of these have you been employed by?',
      options: ['Corbett & Ward', 'Ainsley Group', 'None of these', 'Whitfield Ltd'],
      answerIndex: 2,
    },
  ],
];

/**
 * Hands back the first set the guardian has not already spent. Running out is a
 * real outcome, not an error state to paper over — a guardian who fails every
 * set has to reach support, which is the correct end of an identity check.
 */
export const demoKbaProvider: KbaProvider = (exclude) => {
  const spent = new Set(exclude.map((set) => set.join()));
  return DEMO_SETS.find((set) => !spent.has(set.map((q) => q.id).join())) ?? [];
};
