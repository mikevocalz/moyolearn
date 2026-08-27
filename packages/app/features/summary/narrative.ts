// Doc 34 §4 step 2 — the narrative pass: evidence in, five phrased blocks out.
//
// THE INPUT BOUNDARY IS THE WHOLE DESIGN. The prompt is built from
// `ExtractedEvidence` and from nothing else — no transcript, no messages, no
// child's words — so the model structurally cannot leak chat content and
// cannot praise what did not happen. One boundary, three guarantees (§4).
//
// THE MODEL PHRASES; IT NEVER MEASURES. Its JSON carries copy fields only.
// `assembleNarrative` overlays every number — before/after estimates, grade
// position, the effort citation — from the evidence, so a model that returned
// inflated figures would simply have them ignored, and the honesty lint then
// re-checks the assembled result anyway. Defence in two layers because each
// fails differently: the overlay is lost by a refactor, the lint by a deleted
// call, and no single change removes both.
//
// THE DETERMINISTIC FALLBACK IS A FIRST-CLASS PATH, not an apology. A parse
// failure, a declined model, a lint rejection — all land on
// `deterministicNarrative`, which words the same evidence with fixed
// templates. Flat prose beats no report, and CRUCIALLY beats a retried model
// call that might pass the lint on flattery the second time. Its own lint-
// cleanliness is pinned by test.
// SOT: docs/pack/34-session-summary-reports.md §2 §4 · packages/inference/src/routing.ts (summary-narrative cell)
// SOT-KEYWORDS: narrative pass prompt json parse deterministic fallback phrasing overlay evidence first schema version
import type { ExtractedEvidence, SkillEvidence } from './evidence.ts';
import { gradePosition, masteryLevel } from './evidence.ts';
import type { NarrativeCandidate } from './honesty.ts';
import type { EffortMoment, MasteryMovement, WorkedOnSkill } from './summary.types.ts';

/** Provenance strings for `generator` (§3). Bumped when the prompt or shape changes. */
export const PROMPT_VERSION = 'doc34-narrative-v1';
export const SCHEMA_VERSION = '1';

/** Curated "why it matters next" per skill — block 2's second clause, in parent language. */
const WHY_IT_MATTERS: Record<string, string> = {
  Fractions: 'the idea every ratio, percent and probability later leans on.',
  Decimals: 'the notation money and measurement run on.',
  Percent: 'how discounts, interest and statistics talk.',
  'Equation sense': 'the skill that unlocks solving for anything.',
  'Algebra basics': 'the first step from arithmetic to reasoning with unknowns.',
  'Word problems': 'turning real situations into math — the part tests actually test.',
  'Order of operations': 'the grammar every longer calculation depends on.',
  'Number sense': 'the estimation instinct everything else checks against.',
};

const whyItMattersFor = (skillTitle: string): string =>
  WHY_IT_MATTERS[skillTitle] ?? 'the groundwork the next step builds on.';

/**
 * The prompt. `system` carries the register and the schema; `message` carries
 * the serialized evidence table and NOTHING else. Adult register regardless of
 * band (§2 — band shapes content examples, not the report's voice), which is
 * why no BAND_FRAME rides along: those are the CHILD's voice frames.
 */
export function narrativePayload(evidence: ExtractedEvidence): {
  readonly system: string;
  readonly message: string;
} {
  const system = [
    'You write one section of a progress report a parent will read about their child\'s tutoring session.',
    'You are given an EVIDENCE TABLE of measured facts. You may only restate and phrase these facts — never add a claim, a number, or an event that is not in the table.',
    '',
    'Register: adult, plain, specific. Process over ability: describe what the child DID (tried, stuck with, worked through), never what they ARE (no "smart", "gifted", "talented", "natural").',
    'Never write unfalsifiable praise ("great session", "amazing"). Never mention minutes or duration as an achievement. Never compare to other children. Never predict grades.',
    '',
    'Return ONLY a JSON object, no prose around it, in exactly this shape:',
    '{',
    '  "headline": "one concrete sentence about the most meaningful thing that happened, citing a number from the table",',
    '  "workedOn": [{ "skillId": "<from table>", "parentLabel": "the skill in plain parent language", "whyItMatters": "why this skill matters next, one clause" }],',
    '  "positionCopy": { "<skillId>": "one normalizing sentence about where this skill sits for their grade — honest, never alarming, never a letter grade" },',
    '  "effortCopy": "one specific sentence about the effort event in the table, or null if the table has none",',
    '  "nextUp": "one sentence on what the next session will do, continuing from this one"',
    '}',
    '',
    'workedOn lists at most two skills, the ones that moved most (the table is already sorted). positionCopy has one entry per skill in workedOn.',
  ].join('\n');

  const message = JSON.stringify(
    {
      problem: evidence.problem,
      skills: evidence.skills.map((skill) => ({
        skillId: skill.skillId,
        skillTitle: skill.skillTitle,
        attempts: skill.attempts,
        solved: skill.solved,
        solvedOnTheirOwn: skill.independent,
        missesBeforeSolve: skill.missesBeforeSolve,
        movement:
          skill.beforeP !== null && skill.afterP !== null
            ? { from: masteryLevel(skill.beforeP), to: masteryLevel(skill.afterP) }
            : null,
        gradePosition: skill.afterP !== null ? gradePosition(skill.afterP) : null,
      })),
      effortEvents: evidence.effortEvents.map((event) => ({
        kind: event.kind,
        skillTitle: event.skillTitle,
        count: event.count,
        endedSolved: event.endedSolved,
      })),
      facts: evidence.facts,
    },
    null,
    1,
  );

  return { system, message };
}

/*
  JSON off the wire, decoded rather than cast — the same edge discipline
  `tutor-session.repository.ts` applies to its column. One local union, one
  cast at the boundary, ordinary typed code after.
*/
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const asObject = (value: JsonValue | undefined): Record<string, JsonValue> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;

const asString = (value: JsonValue | undefined): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

interface ModelCopy {
  readonly headline: string;
  readonly workedOn: readonly WorkedOnSkill[];
  readonly positionCopy: Readonly<Record<string, string>>;
  readonly effortCopy: string | null;
  readonly nextUp: string;
}

/**
 * Parses the model's completion. `null` on ANY shape failure — a malformed
 * narrative is not repaired, it is replaced by the deterministic path. The
 * model sometimes fences JSON in markdown; the one concession made is
 * stripping that fence, because it changes no content.
 */
export function parseModelCopy(text: string): ModelCopy | null {
  const bare = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let decoded: JsonValue;
  try {
    decoded = JSON.parse(bare) as JsonValue;
  } catch {
    return null;
  }
  const root = asObject(decoded);
  if (!root) return null;

  const headline = asString(root.headline);
  const nextUp = asString(root.nextUp);
  if (headline === null || nextUp === null) return null;

  const workedOnRaw = Array.isArray(root.workedOn) ? root.workedOn : null;
  if (!workedOnRaw) return null;
  const workedOn: WorkedOnSkill[] = [];
  for (const entry of workedOnRaw) {
    const row = asObject(entry);
    const skillId = row ? asString(row.skillId) : null;
    const parentLabel = row ? asString(row.parentLabel) : null;
    const whyItMatters = row ? asString(row.whyItMatters) : null;
    if (skillId === null || parentLabel === null || whyItMatters === null) return null;
    workedOn.push({ skillId, parentLabel, whyItMatters });
  }

  const positionRaw = asObject(root.positionCopy ?? {});
  if (positionRaw === null) return null;
  const positionCopy: Record<string, string> = {};
  for (const [skillId, copy] of Object.entries(positionRaw)) {
    const sentence = asString(copy);
    if (sentence === null) return null;
    positionCopy[skillId] = sentence;
  }

  const effortCopy = root.effortCopy === null || root.effortCopy === undefined ? null : asString(root.effortCopy);

  return { headline, workedOn, positionCopy, effortCopy, nextUp };
}

/**
 * Overlays the model's copy onto the evidence's numbers. Every measured value
 * in the result comes from `evidence`; the model's contribution is words.
 * Skills the model named but the evidence did not are dropped here AND flagged
 * by the lint — dropped so the render never holds them, flagged so §6's drift
 * alarm still counts the attempt.
 */
export function assembleNarrative(evidence: ExtractedEvidence, copy: ModelCopy): NarrativeCandidate {
  const byId = new Map(evidence.skills.map((skill) => [skill.skillId, skill]));
  const workedOn = copy.workedOn.filter((skill) => byId.has(skill.skillId)).slice(0, 2);

  const mastery = workedOn
    .map((entry) => {
      const skill = byId.get(entry.skillId);
      if (!skill || skill.beforeP === null || skill.afterP === null) return null;
      return movementRow(skill, entry.parentLabel, copy.positionCopy[entry.skillId] ?? positionCopyFor(skill));
    })
    .filter((row): row is MasteryMovement => row !== null);

  const topEffort = evidence.effortEvents[0];
  const effortMoment: EffortMoment | null =
    topEffort !== undefined && copy.effortCopy !== null
      ? { copy: copy.effortCopy, evidenceRef: topEffort.ref }
      : null;

  return { headline: copy.headline, workedOn, mastery, effortMoment, nextUp: copy.nextUp };
}

/**
 * §2.4's position axis in fixed normalizing language. Deterministic — the
 * model may replace the words, never the position. "Never red mid-struggle"
 * starts in the copy: `building-toward` is framed as where the work should be,
 * because for a skill being actively tutored, it is.
 */
export function positionCopyFor(skill: SkillEvidence): string {
  const position = skill.afterP !== null ? gradePosition(skill.afterP) : 'on-track';
  if (position === 'building-toward') {
    return 'Still building toward where this lands for their grade — right where the work should be.';
  }
  if (position === 'beyond') {
    return 'Beyond what this asks at their grade — ready for the next step up.';
  }
  return 'Right in the band where practice moves the needle for their grade.';
}

const movementRow = (skill: SkillEvidence, parentLabel: string, positionCopy: string): MasteryMovement | null =>
  skill.beforeP === null || skill.afterP === null
    ? null
    : {
        skillId: skill.skillId,
        parentLabel,
        before: masteryLevel(skill.beforeP),
        after: masteryLevel(skill.afterP),
        beforeP: skill.beforeP,
        afterP: skill.afterP,
        gradePosition: gradePosition(skill.afterP),
        positionCopy,
      };

/**
 * The evidence, worded by templates. Every sentence here obeys the lint's own
 * rules by construction (its test proves it stays that way), and every number
 * it states is in `evidencedNumbers`.
 */
export function deterministicNarrative(evidence: ExtractedEvidence): NarrativeCandidate {
  const top = evidence.skills[0];
  const headline =
    top === undefined
      ? 'A tutoring session with no graded problems — the conversation is the record this time.'
      : headlineFor(top);

  const workedOn: WorkedOnSkill[] = evidence.skills.slice(0, 2).map((skill) => ({
    skillId: skill.skillId,
    parentLabel: skill.skillTitle,
    whyItMatters: whyItMattersFor(skill.skillTitle),
  }));

  const mastery = workedOn
    .map((entry) => {
      const skill = evidence.skills.find((candidate) => candidate.skillId === entry.skillId);
      return skill ? movementRow(skill, entry.parentLabel, positionCopyFor(skill)) : null;
    })
    .filter((row): row is MasteryMovement => row !== null);

  const topEffort = evidence.effortEvents[0];
  const effortMoment: EffortMoment | null =
    topEffort === undefined ? null : { copy: effortCopyFor(topEffort.kind, topEffort.skillTitle, topEffort.count, topEffort.endedSolved), evidenceRef: topEffort.ref };

  const stillWorking = evidence.skills.find((skill) => !skill.solved);
  const nextUp = stillWorking
    ? `Next session picks ${stillWorking.skillTitle} back up from where the work stopped.`
    : top
      ? `Next session pushes ${top.skillTitle} one step further.`
      : 'Next session starts from a fresh problem.';

  return { headline, workedOn, mastery, effortMoment, nextUp };
}

function headlineFor(skill: SkillEvidence): string {
  if (skill.solved && skill.independent) {
    return `Solved a ${skill.skillTitle} problem on their own — first try, no hints.`;
  }
  if (skill.solved && skill.missesBeforeSolve >= 2) {
    return `Worked through ${skill.missesBeforeSolve} misses on ${skill.skillTitle} and solved it.`;
  }
  if (skill.solved) {
    return `Solved a ${skill.skillTitle} problem with some coaching — ${skill.attempts} attempts, finishing strong is the point.`;
  }
  return `Put ${skill.attempts} attempts into ${skill.skillTitle} and kept going — the problem is still open, the work is real.`;
}

function effortCopyFor(kind: string, skillTitle: string, count: number, endedSolved: boolean): string {
  if (kind === 'persistence-after-miss') {
    return `Sat with ${skillTitle} through ${count} misses and stayed with it until it worked.`;
  }
  if (kind === 'strategy-switch') {
    return `Tried ${count} different approaches on ${skillTitle} rather than repeating the first one.`;
  }
  return endedSolved
    ? `Came back to ${skillTitle} ${count} times in one sitting and finished it.`
    : `Came back to ${skillTitle} ${count} times in one sitting and hasn't let it go.`;
}
