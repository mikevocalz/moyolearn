// Doc 34 §4 step 1 — evidence extraction. Deterministic, no LLM, no clock, no
// database: pure functions over what the session actually recorded.
//
// THIS FILE IS THE INPUT BOUNDARY THE WHOLE PIPELINE LEANS ON. §4's
// load-bearing decision is that the narrative model never sees the transcript —
// it sees the table this module produces. So everything here must be something
// a test can pin: the problems block, the attempt counts, the effort events and
// the mastery deltas are FACTS derived by arithmetic, and the model's only job
// downstream is phrasing them. A claim this module didn't extract cannot be
// made, which is anti-sycophancy, privacy and safety as one property.
//
// TWO EVIDENCE STREAMS, MERGED BY SKILL. The conversation (`tutorMessages`)
// carries the child's verbatim words and the capture crop; the educational
// store (`edu.transcripts` turns, read through `edu.repository.ts` and handed
// in here) carries the graded attempts — correctness and hint depth. The
// evaluate path writes each turn under its own random transcript id, so the
// service scopes turns to the session by learner + capture window and this
// module never guesses at a join it doesn't have.
//
// THE MASTERY "BEFORE" IS RECONSTRUCTED, NOT REMEMBERED. Distillation runs
// per-turn, so by session close `edu.knowledge_graph` already holds the
// post-session estimate and nothing stored the pre-session one. `untraceAttempt`
// below is the algebraic inverse of `@acme/student-model`'s `traceAttempt`
// (standard BKT is invertible given the observation), so walking the session's
// storable turns backwards from the stored `p` recovers where the child
// started. Exact except at the 0.01/0.99 clamps, where information is genuinely
// gone — the round-trip test pins both facts.
// SOT: docs/pack/34-session-summary-reports.md §2 §4 · packages/student-model/src/mastery.ts · packages/student-model/src/distill.ts
// SOT-KEYWORDS: summary evidence extractor deterministic problems block effort events mastery delta untrace bkt inverse attempts independence
import { DEFAULT_TRACING, evaluateArithmetic, FRONTIER_HIGH, FRONTIER_LOW, type TracingParams } from '@acme/student-model/pure';
import type { StoredMessage } from '../tutor/session.types.ts';
import type {
  EvidenceRef,
  MasteryLevel,
  GradePosition,
  ProblemRow,
  ProblemStatus,
  QuestionRef,
  SummaryFacts,
} from './summary.types.ts';

/** One graded turn out of `edu.transcripts`, with the provenance a ref needs. */
export interface EvidencedTurn {
  readonly transcriptId: string;
  /** Index inside its transcript's `turns` array — half of the `event` ref id. */
  readonly index: number;
  readonly skillId: string;
  readonly skillTitle: string;
  readonly correct: boolean;
  readonly hintDepth: number;
  readonly storable: boolean;
}

/** The post-session mastery estimate, as `edu.knowledge_graph` holds it. */
export interface MasteryFactEvidence {
  readonly skillId: string;
  readonly p: number;
  readonly attempts: number;
}

/** Everything the extractor may know. Assembled by the service; judged here. */
export interface SessionEvidenceInput {
  readonly sessionId: string;
  /** `tutorSessions.problem` — what the session was opened about. Empty is real. */
  readonly problem: string;
  readonly openedAt: string;
  readonly closedAt: string;
  readonly messages: readonly StoredMessage[];
  readonly turns: readonly EvidencedTurn[];
  readonly masteryFacts: readonly MasteryFactEvidence[];
}

/** Per-skill aggregation — the numbers every narrative claim must trace to. */
export interface SkillEvidence {
  readonly skillId: string;
  readonly skillTitle: string;
  readonly attempts: number;
  readonly solved: boolean;
  /** Solved with no hints on the solving attempt — "on their own". */
  readonly independent: boolean;
  readonly missesBeforeSolve: number;
  readonly hintDepthMax: number;
  readonly beforeP: number | null;
  readonly afterP: number | null;
  readonly refs: readonly EvidenceRef[];
}

export type EffortKind = 'persistence-after-miss' | 'strategy-switch' | 'retry';

/** §2.5's raw material: a real event, with the citation the block must carry. */
export interface EffortEvent {
  readonly kind: EffortKind;
  readonly skillId: string;
  readonly skillTitle: string;
  /** How many misses were sat through / strategies tried / attempts made. */
  readonly count: number;
  readonly endedSolved: boolean;
  readonly ref: EvidenceRef;
}

export interface ExtractedEvidence {
  readonly sessionId: string;
  readonly problem: string;
  /** Sorted by movement, largest first — block 2's "the two that moved". */
  readonly skills: readonly SkillEvidence[];
  readonly problems: readonly ProblemRow[];
  readonly effortEvents: readonly EffortEvent[];
  readonly facts: SummaryFacts;
  readonly evidenceRefs: readonly EvidenceRef[];
}

/** The `event` ref id shape, in one place so the render parses what this wrote. */
export const eventRefId = (transcriptId: string, index: number): string =>
  `${transcriptId}#${String(index)}`;

/**
 * The algebraic inverse of `traceAttempt`: given the estimate AFTER an
 * observed attempt, recover the estimate before it.
 *
 * traceAttempt is posterior-then-learn; both steps invert in closed form:
 * learn⁻¹ is linear, and the Bayesian posterior inverts in odds space with the
 * same likelihood ratio it multiplied by. Clamped to the same [0.01, 0.99]
 * band — inside the clamps the round trip is exact to floating point, at them
 * the pre-clamp value is unrecoverable and the clamp is the honest answer.
 */
export function untraceAttempt(
  next: number,
  correct: boolean,
  params: TracingParams = DEFAULT_TRACING,
): number {
  const { slip, guess, learn } = params;
  const clamped = Math.min(0.99, Math.max(0.01, next));
  const posterior = Math.min(1, Math.max(0, (clamped - learn) / (1 - learn)));
  if (posterior <= 0) return 0.01;
  if (posterior >= 1) return 0.99;
  // P(observation | knows) / P(observation | doesn't know), per the observed answer.
  const likelihoodKnows = correct ? 1 - slip : slip;
  const likelihoodNot = correct ? guess : 1 - guess;
  const priorOdds = (posterior / (1 - posterior)) * (likelihoodNot / likelihoodKnows);
  return Math.min(0.99, Math.max(0.01, priorOdds / (1 + priorOdds)));
}

/**
 * §2.4's rungs, cut on the fence posts the student model already owns.
 * `FRONTIER_LOW`/`FRONTIER_HIGH` are doc 19's "where the next session moves the
 * needle" band; the one mid cut splits it. A second scale, tunable apart from
 * the model, is how a bar drifts toward flattery — so there isn't one.
 */
export function masteryLevel(p: number): MasteryLevel {
  if (p < FRONTIER_LOW) return 'just-starting';
  if (p < 0.6) return 'practicing';
  if (p < FRONTIER_HIGH) return 'getting-it';
  return 'solid';
}

/**
 * Position against grade expectations (§2.4's second axis), from the same
 * estimate. Honest and coarse: the curriculum store does not yet carry
 * per-grade skill expectations, so "on track" is the frontier band itself —
 * the skill is where working on it moves the needle — and the poles are the
 * two states outside it. When doc 21's outcomes tables land a real
 * grade-expectation join, this function is the one seam to replace.
 */
export function gradePosition(p: number): GradePosition {
  if (p < FRONTIER_LOW) return 'building-toward';
  if (p < FRONTIER_HIGH) return 'on-track';
  return 'beyond';
}

/**
 * Subjects for the block-3 accordion headers. Every skill the inference layer
 * currently names is math; the map exists so the day a reading skill appears
 * it lands under its own header rather than under "Math".
 */
export function subjectFor(skillTitle: string): string {
  return SUBJECT_BY_SKILL[skillTitle] ?? 'Math';
}

const SUBJECT_BY_SKILL: Record<string, string> = {};

/**
 * A learner chat message that reads as an ANSWER rather than as talk.
 *
 * Deliberately narrow: a bare number or short arithmetic expression. "I think
 * it's 12" is talk that contains a number and is not claimed as a submission —
 * under-counting attempts is recoverable, mislabelling chat as a wrong answer
 * is a child marked down for a sentence.
 */
const ANSWER_SHAPE = /^-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?$/;

export const isAnswerCandidate = (text: string): boolean => ANSWER_SHAPE.test(text.trim());

interface SkillAccumulator {
  skillId: string;
  skillTitle: string;
  sequence: { correct: boolean; hintDepth: number; ref: EvidenceRef }[];
  afterP: number | null;
}

/** The extractor. Pure; same input, same evidence, forever. */
export function extractEvidence(input: SessionEvidenceInput): ExtractedEvidence {
  const bySkill = new Map<string, SkillAccumulator>();

  // ── Stream 1: graded turns from the educational store ──────────────────────
  for (const turn of input.turns) {
    if (!turn.storable) continue; // a safety-blocked turn evidences nothing (doc 07 §4)
    const acc = bySkill.get(turn.skillId) ?? {
      skillId: turn.skillId,
      skillTitle: turn.skillTitle,
      sequence: [],
      afterP: null,
    };
    acc.sequence.push({
      correct: turn.correct,
      hintDepth: turn.hintDepth,
      ref: { kind: 'event', id: eventRefId(turn.transcriptId, turn.index) },
    });
    bySkill.set(turn.skillId, acc);
  }

  // ── Stream 2: the conversation — verbatim answers for the session problem ──
  const learnerAnswers = input.messages.filter(
    (message) => message.role === 'learner' && isAnswerCandidate(message.text),
  );
  const problemSkill = input.problem.trim() === '' ? null : sessionProblemSkill(input, bySkill);

  if (problemSkill !== null && !bySkill.has(problemSkill.skillId)) {
    /*
      A coach-only session: the child talked the problem through and typed
      answers into the chat, and no evaluate turn was filed. The conversation
      is then the only record, and correctness comes from the SAME pure checker
      the evaluate path uses — one grader, not two that can disagree.
    */
    const sequence = learnerAnswers.map((message) => ({
      correct: evaluateArithmetic(input.problem, message.text.trim()) === true,
      hintDepth: 0,
      ref: { kind: 'message', id: message.id } as EvidenceRef,
    }));
    if (sequence.length > 0) {
      bySkill.set(problemSkill.skillId, {
        skillId: problemSkill.skillId,
        skillTitle: problemSkill.skillTitle,
        sequence,
        afterP: null,
      });
    }
  }

  // ── Mastery deltas: stored `p` walked backwards through the session ────────
  const factBySkill = new Map(input.masteryFacts.map((fact) => [fact.skillId, fact]));
  const skills: SkillEvidence[] = [];
  for (const acc of bySkill.values()) {
    const fact = factBySkill.get(acc.skillId) ?? null;
    const afterP = fact?.p ?? null;
    let beforeP: number | null = null;
    if (afterP !== null) {
      /*
        Only turns the distiller saw move `p`, and it saw the storable graded
        ones — chat-derived attempts (message refs) never reached it, so they
        are excluded from the walk exactly as they were excluded from the trace.
      */
      const graded = acc.sequence.filter((attempt) => attempt.ref.kind === 'event');
      beforeP = graded.reduceRight((p, attempt) => untraceAttempt(p, attempt.correct), afterP);
    }

    const solvingIndex = acc.sequence.findIndex((attempt) => attempt.correct);
    const solved = solvingIndex !== -1;
    skills.push({
      skillId: acc.skillId,
      skillTitle: acc.skillTitle,
      attempts: acc.sequence.length,
      solved,
      independent: solved && acc.sequence[solvingIndex]!.hintDepth === 0 && solvingIndex === 0,
      missesBeforeSolve: solved ? solvingIndex : acc.sequence.length,
      hintDepthMax: acc.sequence.reduce((max, attempt) => Math.max(max, attempt.hintDepth), 0),
      beforeP,
      afterP,
      refs: acc.sequence.map((attempt) => attempt.ref),
    });
  }
  skills.sort((a, b) => movement(b) - movement(a));

  // ── Block 3: the problems, deterministic ───────────────────────────────────
  // The one skill a single-problem session's chat answers can be attributed to.
  const soleSkillId =
    skills.length === 1 && input.problem.trim() !== '' && learnerAnswers.length > 0
      ? skills[0]!.skillId
      : null;
  const problems = skills.map((skill, order): ProblemRow => {
    const status = statusFor(skill);
    return {
      subject: subjectFor(skill.skillTitle),
      skillId: skill.skillId,
      questionRef: questionRefFor(skill, input),
      childAnswer: childAnswerFor(skill, input, learnerAnswers, soleSkillId),
      attempts: skill.attempts,
      status,
      // Redpen's one honest use: the last recorded answer was wrong and the
      // child ended the session there — a final answer submitted as done.
      submittedIncorrect: status === 'still-working' && skill.attempts > 0 && !skill.solved,
      orderInSession: order,
    };
  });

  // ── §2.5's effort events, strongest first ──────────────────────────────────
  const effortEvents = extractEffort(skills);

  // ── Block 8 ────────────────────────────────────────────────────────────────
  const durationMs = Date.parse(input.closedAt) - Date.parse(input.openedAt);
  const facts: SummaryFacts = {
    durationMin: Math.max(0, Math.round(durationMs / 60_000)),
    attempted: problems.length,
    solvedIndependently: problems.filter((row) => row.status === 'solved-independently').length,
    solvedWithHelp: problems.filter((row) => row.status === 'solved-with-help').length,
  };

  const evidenceRefs: EvidenceRef[] = [
    ...skills.flatMap((skill) => skill.refs),
    // The quoted answer's citation, when a sole-skill session attributed one.
    ...(soleSkillId !== null
      ? learnerAnswers.map((message) => ({ kind: 'message', id: message.id }) as EvidenceRef)
      : []),
    ...problems.map((row) => ({ kind: 'problem', id: `#${String(row.orderInSession)}` }) as EvidenceRef),
  ];
  // One citation per fact — a chat-derived skill already carries its message refs.
  const seen = new Set<string>();
  const dedupedRefs = evidenceRefs.filter((ref) => {
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    sessionId: input.sessionId,
    problem: input.problem,
    skills,
    problems,
    effortEvents,
    facts,
    evidenceRefs: dedupedRefs,
  };
}

const movement = (skill: SkillEvidence): number =>
  skill.beforeP !== null && skill.afterP !== null ? skill.afterP - skill.beforeP : 0;

function statusFor(skill: SkillEvidence): ProblemStatus {
  if (!skill.solved) return 'still-working';
  return skill.independent ? 'solved-independently' : 'solved-with-help';
}

function sessionProblemSkill(
  input: SessionEvidenceInput,
  bySkill: Map<string, SkillAccumulator>,
): { skillId: string; skillTitle: string } | null {
  /*
    The session problem belongs to whichever graded skill already matched it;
    otherwise it is its own skill named by the problem itself. The extractor
    does NOT call `inferSkillTitle` — grading and skill inference stay the
    evaluate path's job, and a second inference here could disagree with the
    first. A problem no grader ever saw is filed under its own text.
  */
  if (bySkill.size === 1) {
    const only = [...bySkill.values()][0]!;
    return { skillId: only.skillId, skillTitle: only.skillTitle };
  }
  if (bySkill.size === 0) {
    return { skillId: input.problem, skillTitle: input.problem };
  }
  return null;
}

function questionRefFor(skill: SkillEvidence, input: SessionEvidenceInput): QuestionRef {
  /*
    The capture crop, when the session has one: the first image attachment the
    child sent. Ids, never a URL — the render signs at read time (doc 29 §5)
    and degrades crop → problem text → "source expired" as the pieces expire.
    Only the session's OWN problem gets the crop; generated practice never had
    one and claims the problem text instead.
  */
  const isSessionProblem =
    input.problem.trim() !== '' &&
    (skill.skillId === input.problem || skill.refs.some((ref) => ref.kind === 'message'));
  const text = isSessionProblem ? input.problem : skill.skillTitle;

  if (isSessionProblem) {
    for (const message of input.messages) {
      if (message.role !== 'learner') continue;
      for (const attachment of message.attachments) {
        if (attachment.kind === 'image') {
          return { kind: 'capture-crop', messageId: message.id, attachmentId: attachment.id, text };
        }
      }
    }
  }
  return { kind: 'problem-text', text };
}

function childAnswerFor(
  skill: SkillEvidence,
  input: SessionEvidenceInput,
  learnerAnswers: readonly StoredMessage[],
  soleSkillId: string | null,
): string | null {
  /*
    Verbatim or absent, never reconstructed. Two sources may quote the child:
    a message-evidenced skill quotes the last answer-shaped learner message
    outright, and a GRADED single-skill session may too — the educational
    store keeps correctness rather than words, but when the session worked ONE
    problem and the chat holds an answer-shaped message, that message IS the
    child's answer to that problem, verbatim, with a message id to cite.
    Multi-skill sessions cannot make that attribution and stay null, which the
    render states as "answer not recorded" — a report must never quote a child
    on something they typed about a different problem.
  */
  const fromMessages = skill.refs.some((ref) => ref.kind === 'message');
  if (!fromMessages && skill.skillId !== soleSkillId) return null;
  const last = learnerAnswers[learnerAnswers.length - 1];
  return last ? last.text.trim() : null;
}

function extractEffort(skills: readonly SkillEvidence[]): EffortEvent[] {
  const events: EffortEvent[] = [];
  for (const skill of skills) {
    const lastRef = skill.refs[skill.refs.length - 1];
    if (!lastRef) continue;
    if (skill.solved && skill.missesBeforeSolve >= 2) {
      events.push({
        kind: 'persistence-after-miss',
        skillId: skill.skillId,
        skillTitle: skill.skillTitle,
        count: skill.missesBeforeSolve,
        endedSolved: true,
        ref: lastRef,
      });
      continue;
    }
    if (skill.attempts >= 2 && skill.hintDepthMax > 0 && skill.solved) {
      events.push({
        kind: 'strategy-switch',
        skillId: skill.skillId,
        skillTitle: skill.skillTitle,
        count: skill.hintDepthMax + 1,
        endedSolved: true,
        ref: lastRef,
      });
      continue;
    }
    if (skill.attempts >= 2) {
      events.push({
        kind: 'retry',
        skillId: skill.skillId,
        skillTitle: skill.skillTitle,
        count: skill.attempts,
        endedSolved: skill.solved,
        ref: lastRef,
      });
    }
  }
  /*
    Strongest story first: sticking with a problem through misses beats trying
    another strategy beats plain retrying. §2.5 renders at most ONE moment, and
    it should be the best-evidenced one.
  */
  const rank: Record<EffortKind, number> = { 'persistence-after-miss': 0, 'strategy-switch': 1, retry: 2 };
  return events.sort((a, b) => rank[a.kind] - rank[b.kind] || b.count - a.count);
}
