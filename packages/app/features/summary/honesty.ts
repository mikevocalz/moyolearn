// Doc 34 §4 step 3 — the honesty lint. Pure functions between the narrative
// pass and anything a parent can see.
//
// §1 names the failure this file exists to prevent: ~80% of kids bring home
// B's or better while ~30% are proficient, because the reporting layer is
// engineered to feel good. A model asked to celebrate a session will drift the
// same way — so the celebration is gated by checks a test can pin, and a
// summary that fails ANY of them does not publish. The lint refusing a
// beautifully written lie is the lint working.
//
// EVERY CHECK IS FALSIFIABLE. There is no "sounds too positive" heuristic —
// that would be a second model judging the first. What is checked is what can
// be checked: banned lexicon (ability praise, unfalsifiable praise,
// minutes-as-achievement, comparison, prediction), numeric claims that must
// appear in the evidence, skill claims that must name an evidenced skill, an
// effort moment that must carry a real citation, and §2.4's two axes both
// present and never collapsed into one sentence of grade-speak.
// SOT: docs/pack/34-session-summary-reports.md §1 §2 §4 · docs/pack/19-learning-outcomes-spec.md
// SOT-KEYWORDS: honesty lint banned language ability praise sycophancy evidence ref numeric claim minutes not learning axes distinct publish gate
import type { ExtractedEvidence } from './evidence.ts';
import type { EffortMoment, EvidenceRef, MasteryMovement, WorkedOnSkill } from './summary.types.ts';

/** What the narrative pass produced and the lint judges — blocks 1/2/4/5/6. */
export interface NarrativeCandidate {
  readonly headline: string;
  readonly workedOn: readonly WorkedOnSkill[];
  readonly mastery: readonly MasteryMovement[];
  readonly effortMoment: EffortMoment | null;
  readonly nextUp: string;
}

export interface LintViolation {
  readonly rule: string;
  readonly field: string;
  readonly detail: string;
}

/**
 * Ability praise — Dweck's finding is that it TEACHES fixed mindset, so it is
 * not a style choice, it is banned vocabulary. Process praise ("tried",
 * "stuck with", "worked through") passes because it names an act.
 */
const ABILITY_PRAISE = /\b(smart|gifted|brilliant|genius|talented|a natural|so intelligent|whiz|prodigy)\b/i;

/**
 * Unfalsifiable praise — §2.1 names "had a great session!" as the B-plus
 * machine. Superlatives with no proposition under them.
 */
const EMPTY_PRAISE = /\b(great session|amazing|awesome|incredible|fantastic|wonderful|outstanding|perfect|superstar|crushed it|killed it|nailed everything)\b/i;

/** Minutes are not learning (doc 19). Duration may be a fact, never a feat. */
const MINUTES_AS_ACHIEVEMENT = /\b(\d+\s*minutes?|an hour|hours?)\b[^.!?]*\b(hard work|effort|dedication|impressive|proud|achievement|committed)\b|\b(hard work|effort|dedication|impressive|proud|achievement|committed)\b[^.!?]*\b\d+\s*minutes?\b/i;

/** No comparisons to other children (§2, "what the report never contains"). */
const COMPARISON = /\b(other (kids|children|students)|classmates?|peers?|than most|ahead of the class|top of (the|her|his|their) class)\b/i;

/** No grade predictions. */
const PREDICTION = /\b(will (get|earn|score)|headed for|on track for) (an? [A-F][+-]?|a [0-9]{2,3})\b|\bpredict/i;

const NARRATIVE_FIELDS = (candidate: NarrativeCandidate): readonly [string, string][] => [
  ['headline', candidate.headline],
  ...candidate.workedOn.map(
    (skill, i) => [`workedOn[${String(i)}].whyItMatters`, `${skill.parentLabel} ${skill.whyItMatters}`] as [string, string],
  ),
  ...candidate.mastery.map(
    (row, i) => [`mastery[${String(i)}].positionCopy`, row.positionCopy] as [string, string],
  ),
  ...(candidate.effortMoment ? [['effortMoment.copy', candidate.effortMoment.copy] as [string, string]] : []),
  ['nextUp', candidate.nextUp],
];

/**
 * Every number the evidence can vouch for. A digit in the narrative that is
 * not in this set is a claim nobody measured.
 */
export function evidencedNumbers(evidence: ExtractedEvidence): ReadonlySet<string> {
  const numbers = new Set<string>();
  const add = (n: number) => {
    numbers.add(String(n));
  };
  for (const skill of evidence.skills) {
    add(skill.attempts);
    add(skill.missesBeforeSolve);
    add(skill.hintDepthMax);
  }
  for (const event of evidence.effortEvents) add(event.count);
  add(evidence.facts.attempted);
  add(evidence.facts.solvedIndependently);
  add(evidence.facts.solvedWithHelp);
  add(evidence.facts.durationMin);
  // Numbers the problem itself printed are quotable — "4 two-digit problems"
  // may legitimately restate the question.
  for (const match of evidence.problem.matchAll(/\d+/g)) numbers.add(match[0]);
  return numbers;
}

/**
 * The lint. Returns every violation rather than the first — a drifting
 * generator is diagnosed from the full list (§6 tracks the rejection rate as
 * the drift alarm), and a single-fault return would hide the pattern.
 */
export function lintNarrative(
  candidate: NarrativeCandidate,
  evidence: ExtractedEvidence,
): LintViolation[] {
  const violations: LintViolation[] = [];
  const flag = (rule: string, field: string, detail: string) => {
    violations.push({ rule, field, detail });
  };

  // ── Banned lexicon, over every narrative field ─────────────────────────────
  for (const [field, text] of NARRATIVE_FIELDS(candidate)) {
    const lexicon: [string, RegExp][] = [
      ['ability-praise', ABILITY_PRAISE],
      ['empty-praise', EMPTY_PRAISE],
      ['minutes-as-achievement', MINUTES_AS_ACHIEVEMENT],
      ['comparison', COMPARISON],
      ['prediction', PREDICTION],
    ];
    for (const [rule, pattern] of lexicon) {
      const match = pattern.exec(text);
      if (match) flag(rule, field, `"${match[0]}"`);
    }
  }

  // ── Numeric claims must be evidenced ───────────────────────────────────────
  const numbers = evidencedNumbers(evidence);
  for (const [field, text] of NARRATIVE_FIELDS(candidate)) {
    for (const match of text.matchAll(/\d+/g)) {
      if (!numbers.has(match[0])) {
        flag('unevidenced-number', field, `claims "${match[0]}", evidence has {${[...numbers].join(', ')}}`);
      }
    }
  }

  // ── Skill claims must name evidenced skills ────────────────────────────────
  const skillIds = new Set(evidence.skills.map((skill) => skill.skillId));
  for (const [i, skill] of candidate.workedOn.entries()) {
    if (!skillIds.has(skill.skillId)) {
      flag('unevidenced-skill', `workedOn[${String(i)}]`, `"${skill.skillId}" was not touched this session`);
    }
  }
  // §2.2: one or two skills max — a session that touched five lists the two that moved.
  if (candidate.workedOn.length > 2) {
    flag('worked-on-overflow', 'workedOn', `${String(candidate.workedOn.length)} skills listed, max is 2`);
  }
  if (candidate.workedOn.length === 0 && evidence.skills.length > 0) {
    flag('worked-on-empty', 'workedOn', 'the session evidenced skills and the report names none');
  }

  // ── Block 4: both axes, honestly, and the deltas the evidence computed ─────
  const byId = new Map(evidence.skills.map((skill) => [skill.skillId, skill]));
  for (const [i, row] of candidate.mastery.entries()) {
    const field = `mastery[${String(i)}]`;
    const skill = byId.get(row.skillId);
    if (!skill) {
      flag('unevidenced-skill', field, `"${row.skillId}" was not touched this session`);
      continue;
    }
    /*
      The model may PHRASE the movement; it may not move it. before/after ride
      the narrative shape for rendering convenience, so the lint re-derives
      both from the evidence and refuses a row that inflated either.
    */
    if (skill.beforeP === null || skill.afterP === null) {
      flag('unevidenced-mastery', field, 'no stored estimate to move — the row should not exist');
      continue;
    }
    if (Math.abs(row.beforeP - skill.beforeP) > 1e-6 || Math.abs(row.afterP - skill.afterP) > 1e-6) {
      flag('tampered-mastery', field, 'before/after do not match the evidence extraction');
    }
    if (row.positionCopy.trim() === '') {
      flag('missing-axis', field, 'movement without position — §2.4 requires both, distinct');
    }
    // Position speaks in normalizing language, never in letter grades — grades
    // are the signal that built the perception gap.
    if (/\b[A-F][+-]?\s*(grade|student)\b|\bgets? (an? [A-F][+-]?)\b/i.test(row.positionCopy)) {
      flag('grade-speak', field, 'position rendered as a letter grade');
    }
  }

  // ── Block 5: cited or absent ───────────────────────────────────────────────
  if (candidate.effortMoment !== null) {
    if (!hasRef(evidence.evidenceRefs, candidate.effortMoment.evidenceRef)) {
      flag('uncited-effort', 'effortMoment', 'the citation points at nothing this session recorded');
    }
    if (evidence.effortEvents.length === 0) {
      flag('invented-effort', 'effortMoment', 'no effort event was extracted — the block must be omitted');
    }
  }

  // ── Required blocks present ────────────────────────────────────────────────
  if (candidate.headline.trim() === '') flag('missing-block', 'headline', 'block 1 is empty');
  if (candidate.nextUp.trim() === '') flag('missing-block', 'nextUp', 'block 6 is empty');

  return violations;
}

const hasRef = (refs: readonly EvidenceRef[], ref: EvidenceRef): boolean =>
  refs.some((candidate) => candidate.kind === ref.kind && candidate.id === ref.id);
