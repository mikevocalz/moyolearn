// Practice content — items, the sets that group them, and the band each set
// belongs to. Demo content, replaced by curriculum queries in Wave 4.
//
// The help ladder is authored per item, not generated: R4 requires probe →
// nudge → hint → scaffold → worked example, and "Hint 1 of 3" must be true.
// No rung ever states the answer — the last rung is the closest scaffold that
// still leaves the child the final step.
//
// Content is BAND-SCOPED, which is the whole point of `learner.stuff`'s D-row
// action ("confirm K–2 content fork under real `'young'` band"). Before this,
// every band was handed the same three quadratics, so a six-year-old's My Stuff
// tab opened on "Factor: x² + 5x + 6". The band decides the maths, not just the
// type size.
// SOT: docs/pack/04-screen-briefs.md §S10 · design/screens/learner/learner.stuff/contract.md
// SOT-KEYWORDS: practice item ladder hint choices answer mastery set band young child teen my stuff

import type { AgeBand } from '../capture/age-band';

export interface PracticeItem {
  id: string;
  prompt: string;
  choices: string[];
  /** Index into `choices`. */
  answerIndex: number;
  /** The ladder, in order. Never includes the answer itself. */
  ladder: string[];
}

/**
 * A set is what the hub lists and what a session plays: one skill, a handful of
 * items, and a plain-speech line saying what it is. K–2 sets are deliberately
 * short — doc 36 §1's children's findings put a pre-reader's session in minutes,
 * not questions.
 */
export interface PracticeSet {
  id: string;
  title: string;
  /** One line under the title, in the band's own register. Never a count. */
  blurb: string;
  items: PracticeItem[];
}

const YOUNG_SETS: PracticeSet[] = [
  {
    id: 'young-adding',
    title: 'Adding',
    blurb: 'Put numbers together',
    items: [
      {
        id: 'y-add-1',
        prompt: '5 + 4 = ?',
        choices: ['9', '8', '10', '7'],
        answerIndex: 0,
        ladder: [
          'Hold up five fingers.',
          'Now put up four more.',
          'Count every finger you are holding up.',
        ],
      },
      {
        id: 'y-add-2',
        prompt: '7 + 2 = ?',
        choices: ['9', '8', '5', '10'],
        answerIndex: 0,
        ladder: ['Start at seven.', 'Count up two more.', 'Say the next two numbers after seven.'],
      },
    ],
  },
  {
    id: 'young-taking-away',
    title: 'Taking away',
    blurb: 'Start big, take some off',
    items: [
      {
        id: 'y-take-1',
        prompt: '10 − 3 = ?',
        choices: ['7', '6', '8', '13'],
        answerIndex: 0,
        ladder: ['Picture ten blocks.', 'Take three blocks off.', 'Count the blocks that are left.'],
      },
      {
        id: 'y-take-2',
        prompt: '8 − 5 = ?',
        choices: ['3', '4', '2', '13'],
        answerIndex: 0,
        ladder: ['Picture eight blocks.', 'Take five blocks off.', 'Count what is still there.'],
      },
    ],
  },
];

const CHILD_SETS: PracticeSet[] = [
  {
    id: 'child-times-tables',
    title: 'Times tables',
    blurb: 'Groups of the same number',
    items: [
      {
        id: 'c-mul-1',
        prompt: '7 × 6 = ?',
        choices: ['42', '36', '48', '40'],
        answerIndex: 0,
        ladder: [
          'This is seven groups of six.',
          'Count up in sixes: 6, 12, 18…',
          'Or work out 7 × 3 = 21, then double it.',
        ],
      },
      {
        id: 'c-mul-2',
        prompt: '9 × 4 = ?',
        choices: ['36', '32', '45', '40'],
        answerIndex: 0,
        ladder: [
          'Nine groups of four.',
          'Ten groups of four would be 40.',
          'You have one group of four too many — take it off.',
        ],
      },
    ],
  },
  {
    id: 'child-fractions',
    title: 'Fractions',
    blurb: 'Sharing things into equal parts',
    items: [
      {
        id: 'c-frac-1',
        prompt: 'Which is bigger: 1/2 or 1/3?',
        choices: ['1/2', '1/3'],
        answerIndex: 0,
        ladder: [
          'Picture one pizza cut into two, and one cut into three.',
          'More slices means each slice is smaller.',
          'Compare one slice from each pizza.',
        ],
      },
      {
        id: 'c-frac-2',
        prompt: 'What is 3/4 of 12?',
        choices: ['9', '8', '12', '6'],
        answerIndex: 0,
        ladder: [
          'Split 12 into four equal parts.',
          'Each part is 3.',
          'Now take three of those parts.',
        ],
      },
    ],
  },
];

const OLDER_SETS: PracticeSet[] = [
  {
    id: 'teen-factoring',
    title: 'Factoring quadratics',
    blurb: 'Two brackets that multiply back',
    items: [
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
    ],
  },
  {
    id: 'teen-solving',
    title: 'Solving for x',
    blurb: 'Undo the operations, one at a time',
    items: [
      {
        id: 't-lin-1',
        prompt: 'Solve: 3x + 4 = 19',
        choices: ['x = 5', 'x = 7', 'x = 6', 'x = 4'],
        answerIndex: 0,
        ladder: [
          'What is being done to x, and in what order?',
          'Undo the +4 first — subtract it from both sides.',
          'That leaves 3x = 15. One step to go.',
        ],
      },
      {
        id: 't-lin-2',
        prompt: 'Solve: 2(x − 3) = 10',
        choices: ['x = 8', 'x = 5', 'x = 2', 'x = 11'],
        answerIndex: 0,
        ladder: [
          'The bracket is multiplied by 2 — deal with that first.',
          'Divide both sides by 2.',
          'That leaves x − 3 = 5. One step to go.',
        ],
      },
    ],
  },
];

/**
 * `adult` shares the older band's content: doc 08's adult band on a learner
 * surface is the unsimplified register (9–12), not a different curriculum.
 */
const SETS_BY_BAND = {
  young: YOUNG_SETS,
  child: CHILD_SETS,
  teen: OLDER_SETS,
  adult: OLDER_SETS,
} as const satisfies Record<AgeBand, PracticeSet[]>;

export function practiceSetsForBand(ageBand: AgeBand): PracticeSet[] {
  return SETS_BY_BAND[ageBand];
}

/** The set behind an id, whichever band authored it — the store's lookup. */
export function practiceSetById(setId: string): PracticeSet | undefined {
  for (const sets of Object.values(SETS_BY_BAND)) {
    const found = sets.find((set) => set.id === setId);
    if (found) return found;
  }
  return undefined;
}

/**
 * The hub's copy, per band. K–2 gets ≤8 words a line and no idioms (doc 31's
 * voice gate); the older bands get the plain adult register with no artificial
 * simplification. The empty line NAMES where the work comes from instead of
 * apologising — the contract's `no_data` path is "Natalie suggests snapping
 * homework", one action, not a shrug.
 */
export interface PracticeHubCopy {
  title: string;
  purpose: string;
  setsLabel: string;
  finishedLabel: string;
  start: string;
  again: string;
  emptyTitle: string;
  emptyBody: string;
  snap: string;
  back: string;
}

const HUB_COPY = {
  young: {
    title: 'My Stuff',
    purpose: 'Pick something to practise.',
    setsLabel: 'Practise',
    finishedLabel: 'You finished',
    start: 'Start',
    again: 'Do it again',
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Snap your homework and we make some.',
    snap: 'Snap your homework',
    back: 'Back to My Stuff',
  },
  child: {
    title: 'My Stuff',
    purpose: 'Your practice, and what you finished.',
    setsLabel: 'Practice',
    finishedLabel: 'You finished',
    start: 'Start practice',
    again: 'Practise again',
    emptyTitle: 'No practice yet',
    emptyBody: 'Snap a page of homework and Natalie will build some from it.',
    snap: 'Snap homework instead',
    back: 'Back to My Stuff',
  },
  teen: {
    title: 'My Stuff',
    purpose: 'Practice sets you can start, and what you have finished.',
    setsLabel: 'Practice sets',
    finishedLabel: 'Finished',
    start: 'Start practice',
    again: 'Practise again',
    emptyTitle: 'No practice sets yet',
    emptyBody: 'Snap a page of homework and Natalie builds practice from it.',
    snap: 'Snap homework instead',
    back: 'Back to My Stuff',
  },
  adult: {
    title: 'My Stuff',
    purpose: 'Practice sets you can start, and what you have finished.',
    setsLabel: 'Practice sets',
    finishedLabel: 'Finished',
    start: 'Start practice',
    again: 'Practise again',
    emptyTitle: 'No practice sets yet',
    emptyBody: 'Snap a page of homework and Natalie builds practice from it.',
    snap: 'Snap homework instead',
    back: 'Back to My Stuff',
  },
} as const satisfies Record<AgeBand, PracticeHubCopy>;

export function practiceHubCopyFor(ageBand: AgeBand): PracticeHubCopy {
  return HUB_COPY[ageBand];
}
