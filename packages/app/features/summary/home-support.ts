// Doc 34 §2.7 — "How to help at home": one conversation starter and one
// 5-minute activity, per skill. Exactly two items; actionable beats
// comprehensive — this is the block the growth-mindset-transfer research says
// changes the home, so it is the one block written for the kitchen table.
//
// WRITTEN BY PEOPLE AND NOT GENERATED, the same rule `CONVERSATION_STARTERS`
// in `features/safety` states for its own copy and for the same reason one
// register up: this is the sentence a parent acts on with their child, and a
// model improvising it would be improvising the home half of the pedagogy.
// §4's narrative pass writes blocks 1/2/4/5/6; block 7 is deliberately not on
// that list.
//
// Keyed on the skill titles `inferSkillTitle` can produce, with a default that
// stays honest for anything new. Starters ask the child to SHOW, not to
// perform — process over ability, per the Dweck framing doc 34 §1 builds on.
// SOT: docs/pack/34-session-summary-reports.md §2.7 · packages/student-model/src/skills.ts
// SOT-KEYWORDS: home support conversation starter activity block seven curated human written per skill
import type { HomeSupport } from './summary.types.ts';

const BY_SKILL: Record<string, HomeSupport> = {
  Fractions: {
    conversationStarter:
      'Ask them to show you how they would split something into equal parts — dinner or a snack works.',
    activity:
      '5 minutes: fold one sheet of paper into halves, then quarters, then eighths, and label each fold together.',
  },
  Decimals: {
    conversationStarter:
      'Ask them what the digits after the point mean, using a price you can both see.',
    activity: '5 minutes: compare two prices at home and ask which is bigger and how they can tell.',
  },
  Percent: {
    conversationStarter: 'Ask them what "50% off" actually does to a price they care about.',
    activity: '5 minutes: pick three things around the house and work out what half price and 10% off would be.',
  },
  'Equation sense': {
    conversationStarter: 'Ask them what the equals sign means — the answer is more interesting than it sounds.',
    activity: '5 minutes: play "keep it balanced" — change one side of 6 + 4 = 10 and ask what the other side needs.',
  },
  'Algebra basics': {
    conversationStarter: 'Ask them to explain what a letter is doing in a math problem, in their own words.',
    activity: '5 minutes: think of a number, add 3, tell them the result, and ask them to find your number — then swap.',
  },
  'Word problems': {
    conversationStarter: 'Ask them what a problem is asking for BEFORE any numbers come up.',
    activity: '5 minutes: turn something real ("we need 4 cups and each box holds 6") into a question and solve it out loud.',
  },
  'Order of operations': {
    conversationStarter: 'Ask them which part of a mixed problem they would do first, and why that order.',
    activity: '5 minutes: write 2 + 3 × 4 two ways with parentheses and ask why the answers differ.',
  },
  'Number sense': {
    conversationStarter: 'Ask them to estimate something before counting it, then check together.',
    activity: '5 minutes: guess how many steps to the kitchen, how many spoons in the drawer — estimate, then count.',
  },
};

const DEFAULT_SUPPORT: HomeSupport = {
  conversationStarter: 'Ask them to teach you the thing they worked on today — teaching it back is the practice.',
  activity: '5 minutes: have them make up one problem like today’s for you to solve, and let them check your work.',
};

/** Block 7 for a skill. Total — a new skill gets the honest default, not a hole. */
export function homeSupportFor(skillTitle: string): HomeSupport {
  return BY_SKILL[skillTitle] ?? DEFAULT_SUPPORT;
}
