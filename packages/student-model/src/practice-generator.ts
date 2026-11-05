// Seeded practice items, one template family per skill tag.
//
// Every number here is chosen by a small xorshift32 stream keyed from the
// set's seed string, so the same seed and tags reproduce the same sheet on
// any machine: a guardian who approved a draft prints exactly what they read.
// No dependency carries the randomness because the sequence must stay stable
// across package upgrades; a library's internal reseeding would silently
// change a printed sheet.
//
// The generator never decides an item is correct. It emits the prompt and the
// answer it computed, and `practice-checker.ts` re-derives the pair through
// `checkExactMath` against the printed text. An item that fails there is
// dropped, which is why nothing in this file is typed as a `PracticeItem`.
//
// Two shapes of prompt, because those are the two the checker can parse:
//   "What is <expression>?"           arithmetic, fractions, decimals, integers
//   "Solve for x: <lhs> = <rhs>"      one-step, two-step, both-sides linear
// Percent, word problems, comparisons and anything with units are not here;
// the checker could not confirm them and an unverified answer key is the one
// thing this module must not produce.
//
// A prompt that contains its own answer as an operand (7 + 0, 5 × 1, 3x = 9
// with x = 3) is rejected inside the loop rather than filtered later, so a
// set never silently shrinks because of a leak.
// SOT: docs/work/pr-100/contract.md §Practice sets · docs/design/homework-end-to-end-2026.md · docs/decisions/adr-homework-exact-math.md
// SOT-KEYWORDS: practice generator seeded xorshift skill tag band arithmetic fraction decimal linear equation exact answer
import type { VoiceBand } from './voice-band.ts';

export const PRACTICE_SKILL_TAGS = [
  'addition-within-20',
  'subtraction-within-20',
  'addition-multi-digit',
  'subtraction-multi-digit',
  'multiplication-facts',
  'division-facts',
  'fraction-sense',
  'fraction-addition',
  'fraction-subtraction',
  'fraction-multiplication',
  'decimal-sense',
  'integer-operations',
  'order-of-operations',
  'equation-sense',
  'linear-two-step',
  'linear-both-sides',
] as const;

export type PracticeSkillTag = (typeof PRACTICE_SKILL_TAGS)[number];

export const isPracticeSkillTag = (tag: string): tag is PracticeSkillTag =>
  (PRACTICE_SKILL_TAGS as readonly string[]).includes(tag);

/** Adult-facing names. Band-neutral: "within 20" is a fact about the numbers, not about the child. */
export const PRACTICE_SKILL_LABELS: Readonly<Record<PracticeSkillTag, string>> = {
  'addition-within-20': 'Adding within 20',
  'subtraction-within-20': 'Subtracting within 20',
  'addition-multi-digit': 'Adding larger numbers',
  'subtraction-multi-digit': 'Subtracting larger numbers',
  'multiplication-facts': 'Multiplication facts',
  'division-facts': 'Division facts',
  'fraction-sense': 'Fractions of one whole',
  'fraction-addition': 'Adding fractions',
  'fraction-subtraction': 'Subtracting fractions',
  'fraction-multiplication': 'Multiplying fractions',
  'decimal-sense': 'Decimals and place value',
  'integer-operations': 'Positive and negative numbers',
  'order-of-operations': 'Order of operations',
  'equation-sense': 'Keeping an equation balanced',
  'linear-two-step': 'Two-step equations',
  'linear-both-sides': 'Equations with x on both sides',
};

/** What the checker receives. `checkerVersion` is absent on purpose: the checker stamps it. */
export interface GeneratedItem {
  readonly id: string;
  readonly skillTag: PracticeSkillTag;
  readonly prompt: string;
  readonly answer: string;
}

export interface GeneratePracticeSetInput {
  readonly seed: string;
  readonly skillTags: readonly string[];
  readonly band: VoiceBand;
  /** Items to attempt. The result can be shorter when templates run out of distinct prompts. */
  readonly count?: number;
}

export interface PracticeRng {
  /** Inclusive on both ends. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

/* FNV-1a over the seed's UTF-16 units; the fallback keeps xorshift out of its zero fixed point. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0 || 0x9e3779b9;
}

export function createRng(seed: string): PracticeRng {
  let state = hashSeed(seed);
  const next = (): number => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
  return {
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)]!,
  };
}

/* Exact rationals on plain numbers; every operand here stays far below 2^53. */
interface Frac {
  readonly n: number;
  readonly d: number;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x === 0 ? 1 : x;
}

function frac(n: number, d: number): Frac {
  const g = gcd(n, d);
  const sign = d < 0 ? -1 : 1;
  return { n: (sign * n) / g, d: (sign * d) / g };
}

const whole = (n: number): Frac => ({ n, d: 1 });
const add = (a: Frac, b: Frac): Frac => frac(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Frac, b: Frac): Frac => frac(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Frac, b: Frac): Frac => frac(a.n * b.n, a.d * b.d);
const sameValue = (a: Frac, b: Frac): boolean => a.n * b.d === b.n * a.d;

const fmtFrac = (f: Frac): string => (f.d === 1 ? String(f.n) : `${String(f.n)}/${String(f.d)}`);

/* Hundredths as a decimal string, trailing zeros trimmed: 350 -> "3.5", 407 -> "4.07", 600 -> "6". */
function fmtHundredths(hundredths: number): string {
  const sign = hundredths < 0 ? '-' : '';
  const magnitude = Math.abs(hundredths);
  const wholePart = Math.floor(magnitude / 100);
  const rest = magnitude % 100;
  if (rest === 0) return `${sign}${String(wholePart)}`;
  const digits = String(rest).padStart(2, '0').replace(/0$/, '');
  return `${sign}${String(wholePart)}.${digits}`;
}

/* `2x + 3`, `2x − 3`, never `2x + -3`: the printed form a textbook uses. */
const signed = (value: number): string =>
  value < 0 ? ` − ${String(-value)}` : ` + ${String(value)}`;

/* An x value as it is substituted in the checker: negatives and fractions parenthesised. */
const unknownText = (x: Frac): string => fmtFrac(x);

interface Built {
  readonly prompt: string;
  readonly answerText: string;
  readonly answerValue: Frac;
  /** Every number the prompt shows, for the leak check. */
  readonly operands: readonly Frac[];
}

type Template = (rng: PracticeRng) => Built;

const arithmetic = (text: string, value: Frac, operands: readonly Frac[]): Built => ({
  prompt: `What is ${text}?`,
  answerText: fmtFrac(value),
  answerValue: value,
  operands,
});

const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12] as const;

/* A proper fraction with a denominator from the list, reduced so the printed form is canonical. */
function properFraction(rng: PracticeRng, denominators: readonly number[] = DENOMINATORS): Frac {
  const d = rng.pick(denominators);
  return frac(rng.int(1, d - 1), d);
}

function unlikeDenominatorPair(rng: PracticeRng): [Frac, Frac] {
  const a = properFraction(rng);
  let b = properFraction(rng);
  while (b.d === a.d) b = properFraction(rng);
  return [a, b];
}

const additionWithin20: Template = (rng) => {
  const a = rng.int(1, 10);
  const b = rng.int(1, 10);
  return arithmetic(`${String(a)} + ${String(b)}`, whole(a + b), [whole(a), whole(b)]);
};

const subtractionWithin20: Template = (rng) => {
  const a = rng.int(2, 20);
  const b = rng.int(1, a - 1);
  return arithmetic(`${String(a)} − ${String(b)}`, whole(a - b), [whole(a), whole(b)]);
};

const additionMultiDigit: Template = (rng) => {
  const a = rng.int(25, 999);
  const b = rng.int(25, 999);
  return arithmetic(`${String(a)} + ${String(b)}`, whole(a + b), [whole(a), whole(b)]);
};

const subtractionMultiDigit: Template = (rng) => {
  const a = rng.int(100, 999);
  const b = rng.int(11, a - 1);
  return arithmetic(`${String(a)} − ${String(b)}`, whole(a - b), [whole(a), whole(b)]);
};

const multiplicationFacts: Template = (rng) => {
  const a = rng.int(2, 12);
  const b = rng.int(2, 12);
  return arithmetic(`${String(a)} × ${String(b)}`, whole(a * b), [whole(a), whole(b)]);
};

const divisionFacts: Template = (rng) => {
  const divisor = rng.int(2, 12);
  const quotient = rng.int(2, 12);
  const dividend = divisor * quotient;
  return arithmetic(`${String(dividend)} ÷ ${String(divisor)}`, whole(quotient), [
    whole(dividend),
    whole(divisor),
  ]);
};

/* One shared whole: like denominators, and the pieces never exceed it. */
const fractionOfOneWhole: Template = (rng) => {
  const d = rng.pick([2, 3, 4, 5, 6, 8, 10]);
  const a = rng.int(1, d - 1);
  const b = rng.int(1, d - a);
  const left = frac(a, d);
  const right = frac(b, d);
  return arithmetic(
    `${String(a)}/${String(d)} + ${String(b)}/${String(d)}`,
    add(left, right),
    [left, right],
  );
};

const likeDenominatorAddition: Template = (rng) => {
  const d = rng.pick(DENOMINATORS);
  const a = rng.int(1, d - 1);
  const b = rng.int(1, d - 1);
  const left = frac(a, d);
  const right = frac(b, d);
  return arithmetic(
    `${String(a)}/${String(d)} + ${String(b)}/${String(d)}`,
    add(left, right),
    [left, right],
  );
};

const unlikeDenominatorAddition: Template = (rng) => {
  const [a, b] = unlikeDenominatorPair(rng);
  return arithmetic(`${fmtFrac(a)} + ${fmtFrac(b)}`, add(a, b), [a, b]);
};

const likeDenominatorSubtraction: Template = (rng) => {
  const d = rng.pick(DENOMINATORS);
  const a = rng.int(2, d - 1);
  const b = rng.int(1, a - 1);
  const left = frac(a, d);
  const right = frac(b, d);
  return arithmetic(
    `${String(a)}/${String(d)} − ${String(b)}/${String(d)}`,
    sub(left, right),
    [left, right],
  );
};

const unlikeDenominatorSubtraction: Template = (rng) => {
  const [first, second] = unlikeDenominatorPair(rng);
  const larger = first.n * second.d >= second.n * first.d ? first : second;
  const smaller = larger === first ? second : first;
  return arithmetic(`${fmtFrac(larger)} − ${fmtFrac(smaller)}`, sub(larger, smaller), [larger, smaller]);
};

/* 9-12 keeps the sign the numbers give; a negative difference is the point there. */
const signedFractionSubtraction: Template = (rng) => {
  const [a, b] = unlikeDenominatorPair(rng);
  return arithmetic(`${fmtFrac(a)} − ${fmtFrac(b)}`, sub(a, b), [a, b]);
};

const fractionMultiplication: Template = (rng) => {
  const a = properFraction(rng, [2, 3, 4, 5, 6, 7, 8, 9]);
  const b = properFraction(rng, [2, 3, 4, 5, 6, 7, 8, 9]);
  return arithmetic(`${fmtFrac(a)} × ${fmtFrac(b)}`, mul(a, b), [a, b]);
};

const decimalAddition: Template = (rng) => {
  const a = rng.int(101, 2999);
  const b = rng.int(101, 2999);
  return {
    prompt: `What is ${fmtHundredths(a)} + ${fmtHundredths(b)}?`,
    answerText: fmtHundredths(a + b),
    answerValue: frac(a + b, 100),
    operands: [frac(a, 100), frac(b, 100)],
  };
};

const decimalSubtraction: Template = (rng) => {
  const a = rng.int(201, 4999);
  const b = rng.int(101, a - 1);
  return {
    prompt: `What is ${fmtHundredths(a)} − ${fmtHundredths(b)}?`,
    answerText: fmtHundredths(a - b),
    answerValue: frac(a - b, 100),
    operands: [frac(a, 100), frac(b, 100)],
  };
};

/* Tenths times a whole number: the place-value shift without a long multiplication. */
const decimalByWhole: Template = (rng) => {
  const tenths = rng.int(2, 99);
  const factor = rng.int(2, 9);
  return {
    prompt: `What is ${fmtHundredths(tenths * 10)} × ${String(factor)}?`,
    answerText: fmtHundredths(tenths * factor * 10),
    answerValue: frac(tenths * factor, 10),
    operands: [frac(tenths, 10), whole(factor)],
  };
};

const negativePlusPositive: Template = (rng) => {
  const a = rng.int(2, 20);
  const b = rng.int(1, 20);
  return arithmetic(`−${String(a)} + ${String(b)}`, whole(b - a), [whole(-a), whole(b)]);
};

const minusANegative: Template = (rng) => {
  const a = rng.int(1, 20);
  const b = rng.int(1, 20);
  return arithmetic(`${String(a)} − (−${String(b)})`, whole(a + b), [whole(a), whole(-b)]);
};

const negativeTimesPositive: Template = (rng) => {
  const a = rng.int(2, 12);
  const b = rng.int(2, 12);
  return arithmetic(`(−${String(a)}) × ${String(b)}`, whole(-a * b), [whole(-a), whole(b)]);
};

const negativeTimesNegative: Template = (rng) => {
  const a = rng.int(2, 12);
  const b = rng.int(2, 12);
  return arithmetic(`(−${String(a)}) × (−${String(b)})`, whole(a * b), [whole(-a), whole(-b)]);
};

const addThenMultiply: Template = (rng) => {
  const a = rng.int(2, 20);
  const b = rng.int(2, 9);
  const c = rng.int(2, 9);
  const d = rng.int(1, 9);
  return arithmetic(
    `${String(a)} + ${String(b)} × ${String(c)} − ${String(d)}`,
    whole(a + b * c - d),
    [whole(a), whole(b), whole(c), whole(d)],
  );
};

const parenthesesFirst: Template = (rng) => {
  const a = rng.int(2, 12);
  const b = rng.int(2, 12);
  const c = rng.int(2, 9);
  return arithmetic(`(${String(a)} + ${String(b)}) × ${String(c)}`, whole((a + b) * c), [
    whole(a),
    whole(b),
    whole(c),
  ]);
};

const divideThenSubtract: Template = (rng) => {
  const divisor = rng.int(2, 9);
  const quotient = rng.int(3, 12);
  const c = rng.int(1, quotient - 1);
  const dividend = divisor * quotient;
  return arithmetic(
    `${String(dividend)} ÷ ${String(divisor)} − ${String(c)}`,
    whole(quotient - c),
    [whole(dividend), whole(divisor), whole(c)],
  );
};

const equation = (lhs: string, rhs: string, x: Frac, operands: readonly Frac[]): Built => ({
  prompt: `Solve for x: ${lhs} = ${rhs}`,
  answerText: unknownText(x),
  answerValue: x,
  operands,
});

const oneStepAdd: Template = (rng) => {
  const x = rng.int(1, 20);
  const b = rng.int(1, 20);
  return equation(`x + ${String(b)}`, String(x + b), whole(x), [whole(b), whole(x + b)]);
};

const oneStepSubtract: Template = (rng) => {
  const x = rng.int(2, 25);
  const b = rng.int(1, x - 1);
  return equation(`x − ${String(b)}`, String(x - b), whole(x), [whole(b), whole(x - b)]);
};

const oneStepMultiply: Template = (rng) => {
  const a = rng.int(2, 12);
  const x = rng.int(2, 12);
  return equation(`${String(a)}x`, String(a * x), whole(x), [whole(a), whole(a * x)]);
};

const twoStepPositive: Template = (rng) => {
  const a = rng.int(2, 9);
  const x = rng.int(1, 12);
  const b = rng.int(-9, 9);
  const c = a * x + b;
  return equation(`${String(a)}x${signed(b)}`, String(c), whole(x), [whole(a), whole(b), whole(c)]);
};

/* 9-12: the root may be negative; the arithmetic of signs is the practice. */
const twoStepSigned: Template = (rng) => {
  const a = rng.int(2, 9);
  const x = rng.pick([-9, -8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const b = rng.int(-12, 12);
  const c = a * x + b;
  return equation(`${String(a)}x${signed(b)}`, String(c), whole(x), [whole(a), whole(b), whole(c)]);
};

/* x/a + b = c, with x chosen as a multiple of a so the root stays an integer. */
const twoStepDivide: Template = (rng) => {
  const a = rng.int(2, 9);
  const quotient = rng.int(1, 9);
  const x = a * quotient;
  const b = rng.int(-9, 9);
  const c = quotient + b;
  return equation(`x/${String(a)}${signed(b)}`, String(c), whole(x), [whole(a), whole(b), whole(c)]);
};

/* A fractional root: the coefficient does not divide the constant. */
const twoStepFractionRoot: Template = (rng) => {
  const a = rng.int(2, 9);
  const b = rng.int(-9, 9);
  let c = rng.int(-20, 20);
  while ((c - b) % a === 0) c = rng.int(-20, 20);
  const x = frac(c - b, a);
  return equation(`${String(a)}x${signed(b)}`, String(c), x, [whole(a), whole(b), whole(c)]);
};

const bothSides: Template = (rng) => {
  const a = rng.int(2, 9);
  let c = rng.int(1, 9);
  while (c === a) c = rng.int(1, 9);
  const x = rng.pick([-8, -7, -6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7, 8]);
  const b = rng.int(-12, 12);
  const d = (a - c) * x + b;
  return equation(
    `${String(a)}x${signed(b)}`,
    `${String(c)}x${signed(d)}`,
    whole(x),
    [whole(a), whole(b), whole(c), whole(d)],
  );
};

const TEMPLATES: Readonly<Record<PracticeSkillTag, Partial<Readonly<Record<VoiceBand, readonly Template[]>>>>> = {
  'addition-within-20': { 'k-2': [additionWithin20] },
  'subtraction-within-20': { 'k-2': [subtractionWithin20] },
  'addition-multi-digit': { '3-5': [additionMultiDigit] },
  'subtraction-multi-digit': { '3-5': [subtractionMultiDigit] },
  'multiplication-facts': { '3-5': [multiplicationFacts] },
  'division-facts': { '3-5': [divisionFacts] },
  'fraction-sense': { '3-5': [fractionOfOneWhole] },
  'fraction-addition': {
    '3-5': [likeDenominatorAddition],
    '6-8': [unlikeDenominatorAddition],
    '9-12': [unlikeDenominatorAddition],
  },
  'fraction-subtraction': {
    '3-5': [likeDenominatorSubtraction],
    '6-8': [unlikeDenominatorSubtraction],
    '9-12': [signedFractionSubtraction],
  },
  'fraction-multiplication': { '6-8': [fractionMultiplication], '9-12': [fractionMultiplication] },
  'decimal-sense': {
    '3-5': [decimalAddition, decimalSubtraction],
    '6-8': [decimalAddition, decimalSubtraction, decimalByWhole],
  },
  'integer-operations': {
    '6-8': [negativePlusPositive, minusANegative, negativeTimesPositive],
    '9-12': [negativePlusPositive, minusANegative, negativeTimesPositive, negativeTimesNegative],
  },
  'order-of-operations': { '6-8': [addThenMultiply, parenthesesFirst, divideThenSubtract] },
  'equation-sense': {
    '3-5': [oneStepAdd, oneStepSubtract],
    '6-8': [oneStepAdd, oneStepSubtract, oneStepMultiply],
  },
  'linear-two-step': {
    '6-8': [twoStepPositive, twoStepDivide],
    '9-12': [twoStepSigned, twoStepDivide, twoStepFractionRoot],
  },
  'linear-both-sides': { '9-12': [bothSides] },
};

const BAND_ORDER: readonly VoiceBand[] = ['k-2', '3-5', '6-8', '9-12'];

/**
 * The band's own templates when the tag has them; otherwise the nearest band
 * that does, nearer-and-lower first. A tag the submission surfaced is still
 * worth practising when its templates sit a band away; asking a 3-5 child to
 * do 6-8 unlike-denominator sums is the lesser error compared to dropping the
 * area they struggled with.
 */
function templatesFor(tag: PracticeSkillTag, band: VoiceBand): readonly Template[] {
  const byBand = TEMPLATES[tag];
  const own = byBand[band];
  if (own) return own;
  const index = BAND_ORDER.indexOf(band);
  for (let distance = 1; distance < BAND_ORDER.length; distance += 1) {
    const lower = BAND_ORDER[index - distance];
    if (lower && byBand[lower]) return byBand[lower];
    const higher = BAND_ORDER[index + distance];
    if (higher && byBand[higher]) return byBand[higher];
  }
  throw new Error(`No templates for ${tag}`);
}

/** The tags a band practises when the submission names none the generator knows. */
export function defaultTagsForBand(band: VoiceBand): readonly PracticeSkillTag[] {
  return PRACTICE_SKILL_TAGS.filter((tag) => TEMPLATES[tag][band] !== undefined);
}

const leaksAnswer = (built: Built): boolean =>
  built.operands.some((operand) => sameValue(operand, built.answerValue));

/**
 * Round-robin over the requested tags. A slot advances only on success, so a
 * tag whose template keeps producing duplicates or leaks does not starve the
 * others; the attempt budget bounds the loop when a tag has few distinct
 * prompts (adding within 20 has 100).
 */
export function generatePracticeSet(input: GeneratePracticeSetInput): readonly GeneratedItem[] {
  const count = input.count ?? 8;
  const rng = createRng(input.seed);
  const requested = [...new Set(input.skillTags.filter(isPracticeSkillTag))];
  const tags = requested.length > 0 ? requested : defaultTagsForBand(input.band);
  const prefix = hashSeed(input.seed).toString(16).padStart(8, '0');
  const prompts = new Set<string>();
  const items: GeneratedItem[] = [];
  let slot = 0;
  for (let attempt = 0; items.length < count && attempt < count * 25; attempt += 1) {
    const tag = tags[slot % tags.length]!;
    const built = rng.pick(templatesFor(tag, input.band))(rng);
    if (prompts.has(built.prompt) || leaksAnswer(built)) continue;
    prompts.add(built.prompt);
    items.push({
      id: `pi-${prefix}-${String(items.length + 1)}`,
      skillTag: tag,
      prompt: built.prompt,
      answer: built.answerText,
    });
    slot += 1;
  }
  return items;
}
