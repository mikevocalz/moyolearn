// The band voice system — doc 31 §2, layers 1 and 2.
//
// Doc 31 exists because the tutor answered a first grader "like an Ivy League
// adult", and its first section is the reason that is not a bug report: it is
// the measured default of every frontier model. Plain prompts produce output at
// or above 10th-grade reading level; one study puts Claude's mean lesson-plan
// output at FKGL 19.9. Asking nicely for "first grade level" drifts back upward
// within a conversation. So the band is enforced in three places, and two of
// them are here:
//
//   layer 1 — `BAND_FRAMES`, metric-guided rather than vibes. Doc 31 §1's
//             evidence is that naming the readability target in the instruction
//             significantly outperforms "keep it simple", so every frame names
//             a number.
//   layer 2 — `BAND_EXAMPLES`, graded few-shots. Few-shots move reading level
//             more reliably than instructions do, which is why the doc treats
//             them as content: versioned, committed, re-evaluated on change.
//   layer 3 — the readability gate that measures the actual reply. NOT here.
//             It is doc 31 PR-112 and doc 26b scopes it out of the demo build.
//             A comment is the honest way to record a layer we have not built;
//             a half-gate would be worse than none, because it would read as
//             coverage.
//
// This file is DATA. It has no imports and renders nothing — `inference.ts`
// owns prompt assembly and the speaker labels, and a frame that could reach the
// wire from two places is a frame nobody can audit. That direction also keeps
// `BAND_EXAMPLES` free of the label constant it is rendered with, which is what
// stops the cycle between this file and the one that renders it.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §2 · docs/pack/26b-tutor-prompt.md
// SOT-KEYWORDS: voice band grade band k-2 3-5 6-8 9-12 frame few-shot graded exemplar readability register plane

/**
 * Doc 31 §2.1's four bands. Elementary splits because a first grader and a
 * fifth grader do not share a language, which is the single change that fixes
 * the failure that started doc 31.
 *
 * The band DEFAULTS from grade; doc 31 §2.1 also specifies a per-learner
 * `readsAt` override so voice follows reading level while curriculum follows
 * grade. That override is a profile field with a guardian-facing control and is
 * not built yet — when it lands it sets this value, and nothing downstream of
 * here changes, which is why the band is one value rather than a grade plus a
 * modifier.
 */
export const VOICE_BANDS = ['k-2', '3-5', '6-8', '9-12'] as const;

export type VoiceBand = (typeof VOICE_BANDS)[number];

/**
 * The band as the model is told it, one frame per band.
 *
 * The K-2 frame is doc 31 §2.2 verbatim — the doc prints it in full precisely
 * so it is copied rather than paraphrased — with doc 26b's hard limit appended.
 * That limit ("two short sentences plus one question") is a demo constraint in
 * the doc, kept in production on the doc's own advice: a wall of text does not
 * become good teaching just because nobody is projecting it.
 *
 * The other three frames follow the same shape from doc 31 §2.2's prose. Note
 * what 9-12 does NOT have: a floor. Doc 31 is explicit that teens hear
 * condescension instantly and that simplifying at them is as much a failure as
 * complexity, so that band gets a ceiling and an instruction to leave the
 * register alone.
 *
 * Every line here reaches the wire through `scrubOutbound`, which scrubs the
 * system half too. Its header rule matches a label word plus a separator and
 * eats the rest of the line, so no frame may put `:` or a dash directly after
 * "name", "student", "child", "class", "school" or their siblings. That is not
 * a style rule — it is the rule that was broken once, silently, and cost the
 * child's every answer. `student-model.test.ts` holds it.
 */
export const BAND_FRAMES: Record<VoiceBand, string> = {
  'k-2': [
    'VOICE — K-2 (ages 5-8)',
    'You are talking with a young child, about 6 years old. Every reply:',
    '- Sentences of 8 words or fewer. One idea per sentence.',
    '- Use only words a 6-year-old hears at home or in 1st grade. If you need a',
    '  school word (like "subtract"), say it, then say what it means in kid words',
    '  in the same breath: "Subtract. That means take away."',
    '- Numbers under 20 in examples unless the problem itself uses bigger ones.',
    '- One question at a time. Never two.',
    '- Warm, playful, concrete. Things they can see and touch: blocks, snacks,',
    '  toys, fingers. Never abstract ("the concept of," "in general," "typically").',
    '- No idioms, no sarcasm, no rhetorical questions — young children read them',
    '  literally.',
    '- Target: a Flesch-Kincaid grade level near 1. If your draft reads like it is',
    '  for a 10-year-old, cut word length and sentence length until it does not.',
    '- HARD LIMIT: at most two short sentences plus one question per reply. Never',
    '  bullet points or headers. At most one emoji, usually none.',
  ].join('\n'),

  '3-5': [
    'VOICE — grades 3-5 (ages 8-11)',
    'You are talking with an upper-elementary kid, about 9 years old. Every reply:',
    '- Sentences of 12 words or fewer. One idea per sentence.',
    '- Everyday words. A subject word is welcome, but define it the moment you use',
    '  it, in the same breath: "Denominator. That is the number on the bottom."',
    '- One question at a time. Never two.',
    '- Concrete before abstract. Anchor the idea to something they can picture,',
    '  then name it.',
    '- No sarcasm and no rhetorical questions.',
    '- Target: a Flesch-Kincaid grade level of 3 to 4. If your draft reads like a',
    '  textbook, cut word length and sentence length until it does not.',
    '- HARD LIMIT: at most three short sentences plus one question per reply. No',
    '  bullet points, no headers.',
  ].join('\n'),

  '6-8': [
    'VOICE — grades 6-8 (ages 11-14)',
    'You are talking with a middle-schooler, about 12 years old. Every reply:',
    '- Sentences of 17 words or fewer.',
    '- Abstractions are allowed, but anchor each one to an example in the same',
    '  breath. An unanchored abstraction is a sentence they will nod at and lose.',
    '- Define a subject term on first use, then use it normally. Teaching the word',
    '  is part of the job; a tutor who can never say "coefficient" is not simpler,',
    '  it is less useful.',
    '- One question at a time. Never two.',
    '- Direct and matter-of-fact. No baby talk, no cheerleading.',
    '- Target: a Flesch-Kincaid grade level of 6 to 7.',
    '- HARD LIMIT: at most four short sentences plus one question per reply. No',
    '  bullet points, no headers.',
  ].join('\n'),

  '9-12': [
    'VOICE — grades 9-12 (ages 14-18)',
    'You are talking with a high-schooler. Every reply:',
    '- Natural register. Do not simplify artificially. A teenager hears',
    '  condescension instantly, and that is as much a failure as being too dense.',
    '- Subject vocabulary is expected. Define only what is genuinely new here.',
    '- One question at a time. Never two.',
    '- Brief and respectful. No praise inflation and no filler.',
    '- Ceiling rather than a target: keep the Flesch-Kincaid grade level at or',
    '  below 10. That is a cap on density, not an instruction to simplify.',
    '- HARD LIMIT: at most four sentences plus one question per reply. No bullet',
    '  points, no headers.',
  ].join('\n'),
};

/** One exemplar exchange. Rendered with the speaker labels in `inference.ts`. */
export interface BandExample {
  /** What the child said. */
  learner: string;
  /** What a reply at this band looks like. */
  tutor: string;
}

/**
 * Doc 31 §2.3's graded few-shots — 3 to 4 per band, written at that band.
 *
 * THE ONE PLACE THESE DEVIATE FROM DOC 26b, AND WHY.
 *
 * Doc 26b prints its anchors with `Student:` as the speaker label. Shipping
 * that literal would reintroduce a bug this repo has already paid for once. The
 * Inference Gateway's pseudonymizer redacts OCR'd worksheet headers by matching
 * `student|name|pupil|learner|child|teacher|parent|guardian|class|school|dob`
 * followed by a separator and consuming the rest of the line. With `Student:`
 * as a speaker label, the rule matched the scaffold the system had just written
 * and redacted the child's whole answer on every turn — silently, because the
 * request still succeeded and the model simply replied that the message came
 * through blank.
 *
 * In a few-shot the damage is worse than on a live turn. The entire job of
 * these examples is to show the model what a specific wrong answer looks like
 * and what to say back; `Student: [redacted]` shows it a redaction and an
 * unexplained reply, which is an anchor for exactly the wrong behaviour.
 *
 * So the exchanges are the doc's, and the labels are not: they render through
 * `LEARNER_TURN_LABEL` and `COACH_TURN_LABEL`. Doc 26b does not know about the
 * scrubber; the divergence is deliberate and belongs back in the doc.
 *
 * Doc 26b's four anchors are all here. Its two K-2 examples and its 3-5
 * fractions example are verbatim; its "just tell me the answer" refusal is
 * verbatim at K-2 and rewritten at each other band, because doc 26b's wiring
 * notes make that single exchange the thing to rehearse and a band whose
 * few-shots skip it has no anchor for the hardest moment in the product.
 */
export const BAND_EXAMPLES: Record<VoiceBand, readonly BandExample[]> = {
  'k-2': [
    {
      // Doc 26b: addition with regrouping, wrong answer.
      learner: '8 + 5 = 12',
      tutor: 'So close! I think you counted one short. Want to count up from 8 with me?',
    },
    {
      // Doc 26b: the direct ask. The exchange the demo lives or dies on.
      learner: 'just tell me the answer',
      tutor: "Nope — you're going to get this one yourself. What's the first thing we should try?",
    },
    {
      // Doc 26b: partly right. Credit the move, then work.
      learner: 'I counted 9 apples but the answer is wrong',
      tutor: "Counting was the right move! Let's count together and check. Ready?",
    },
  ],

  '3-5': [
    {
      // Doc 26b: fractions, wrong answer, 3-5 register.
      learner: '1/2 + 1/3 = 2/5',
      tutor:
        'You added the tops, then the bottoms. But the bottoms tell us the size of the pieces — what size pieces would let us add these?',
    },
    {
      learner: 'just tell me the answer',
      tutor:
        "I am not going to hand it over. You are closer than you think — what would you try first?",
    },
    {
      learner: 'I lined up 47 + 65 and got 812',
      tutor:
        'Lining them up was exactly right. Look at the ones column — what happens when 7 and 5 pass ten?',
    },
  ],

  '6-8': [
    {
      learner: '-3(x - 4) = -3x - 12',
      tutor:
        'You distributed the -3 across the x correctly. Now take the second term on its own — what is a negative times a negative?',
    },
    {
      learner: 'just tell me the answer',
      tutor:
        "I won't, and it isn't to be difficult. You are one step away — what does the expression look like once you distribute?",
    },
    {
      learner: 'for 20% of 80 I did 80 / 20 and got 4',
      tutor:
        'Turning the percent into a division is the right instinct. Ten percent is one tenth — so how many tenths is twenty percent?',
    },
  ],

  '9-12': [
    {
      learner: 'the derivative of x^2 sin x is 2x cos x',
      tutor:
        'You differentiated each factor and multiplied the results, which is the rule for a sum rather than a product. What does the product rule keep that this drops?',
    },
    {
      learner: 'just tell me the answer',
      tutor:
        "Not happening — you'd lose the part that transfers to the next one. Which rule applies when two functions are multiplied?",
    },
    {
      learner: 'I balanced the oxygen but the hydrogens are off',
      tutor:
        'Balancing oxygen first was the efficient order. What does changing the water coefficient do to your hydrogen count?',
    },
  ],
};

/**
 * The band as the Safety Plane's `IdentityContext` wants it.
 *
 * The plane's `gradeBand` is a POLICY REGISTER, not a voice: it selects the
 * crisis wording a child is shown, and doc 07 §3 has two of those, not four.
 * Doc 31 §2.1 splits elementary for voice; splitting it did not write a third
 * crisis script. So the register is derived here rather than stored beside the
 * band, because one meaning in two columns is two answers to the same question
 * and the wrong one is the one a turn happens to read.
 *
 * The cut is at 6-8 for the same reason `planeBandFor` cut at `teen`: the
 * younger register shown to an older child is gentle, and the older register
 * shown to an eight-year-old is a crisis message written for someone else.
 */
export function planeRegisterFor(band: VoiceBand): 'young' | 'older' {
  return band === 'k-2' || band === '3-5' ? 'young' : 'older';
}

const FALLBACK: VoiceBand = '9-12';

/**
 * Reads a stored band, including one written before doc 31 split the field.
 *
 * The old two values are mapped rather than dropped: a learner whose row still
 * says `young` is a K-2 learner, and treating that as unreadable would answer
 * a six-year-old in the register that started doc 31.
 *
 * An unrecognised value falls back to 9-12, which is the register the field has
 * always defaulted to. It is the safe end of a wrong guess for the same reason
 * it always was — the crisis resource it maps to is correct for any age, and
 * `loadLearnerFlags` next to it is the read that has NO safe default and so
 * does not have one.
 */
export function asVoiceBand(value: string | null | undefined): VoiceBand {
  if (value === 'young') return 'k-2';
  if (value === 'older') return FALLBACK;
  return (VOICE_BANDS as readonly string[]).includes(value ?? '') ? (value as VoiceBand) : FALLBACK;
}
