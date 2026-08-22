// Practice item set — demo content, replaced by curriculum queries in Wave 4.
// The help ladder is authored per item, not generated: R4 requires probe →
// nudge → hint → scaffold → worked example, and "Hint 1 of 3" must be true.
// SOT: docs/pack/04-screen-briefs.md §S10
// SOT-KEYWORDS: practice item ladder hint choices answer mastery

export interface PracticeItem {
  id: string;
  prompt: string;
  choices: string[];
  /** Index into `choices`. */
  answerIndex: number;
  /** The ladder, in order. Never includes the answer itself. */
  ladder: string[];
}

export const PRACTICE_ITEMS: PracticeItem[] = [
  {
    id: '1',
    prompt: 'Factor: x² + 5x + 6',
    choices: ['(x + 2)(x + 3)', '(x + 1)(x + 6)', '(x − 2)(x − 3)', '(x + 5)(x + 6)'],
    answerIndex: 0,
    ladder: [
      'What two numbers multiply to 6?',
      'Of those pairs, which one adds to 5?',
      'You need 2 and 3 — now write them as two brackets.',
    ],
  },
  {
    id: '2',
    prompt: 'Factor: x² − 9',
    choices: ['(x − 3)(x − 3)', '(x + 3)(x − 3)', '(x + 9)(x − 1)', 'Cannot be factored'],
    answerIndex: 1,
    ladder: [
      'Is there a middle term? What does that tell you?',
      'This is a difference of two squares.',
      'Both terms are perfect squares: x² and 3².',
    ],
  },
  {
    id: '3',
    prompt: 'Factor: 2x² + 7x + 3',
    choices: ['(2x + 1)(x + 3)', '(2x + 3)(x + 1)', '(x + 7)(2x + 3)', '(2x − 1)(x − 3)'],
    answerIndex: 0,
    ladder: [
      'The leading coefficient is not 1 — what changes?',
      'You need two numbers that multiply to 2 × 3 = 6 and add to 7.',
      'That pair is 1 and 6. Split the middle term and group.',
    ],
  },
];
