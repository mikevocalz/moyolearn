// Distillation: a session transcript in, derived pedagogical facts out, and the
// transcript on a clock from the moment it lands.
//
// This is the only writer of the student model, and it has one hard input gate:
// a turn is distilled if and only if the Safety Plane marked it storable. Doc 07
// §3 layer 7 excludes safety events from the pedagogical model — "a crisis is
// never a personalization feature" — and the honest way to enforce that is to
// carry the plane's own verdict on the turn rather than re-deriving it here.
// Re-deriving would mean a second classifier that can disagree with the first,
// and the one that says "store it" would win by being downstream.
//
// Facts are keyed deterministically per learner+skill+kind, so distillation
// UPSERTS a current belief rather than appending an observation log. That is
// what makes S27 legible (one line per thing Natalie thinks, not a thousand) and
// what makes deleting a line mean something — an append log would regrow the
// line on the next session and call it a new fact.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 §4 · docs/pack/19-learning-outcomes-spec.md §1
// SOT-KEYWORDS: distillation transcript derived facts storable upsert expiry job

import {
  addDays,
  interestFact,
  isMisconceptionTag,
  masteryFact,
  misconceptionFact,
  reviewFact,
  scaffoldingFact,
  TRANSCRIPT_TTL_DAYS,
  type DerivedFact,
  type MasteryFact,
  type ReviewFact,
  type ScaffoldingFact,
} from './facts.ts';
import { DEFAULT_TRACING, traceAttempt, type TracingParams } from './mastery.ts';
import { scheduleReview } from './review.ts';

export interface SessionTurn {
  skillId: string;
  skillTitle: string;
  correct: boolean;
  /** How far down the hint ladder the learner went before answering. */
  hintDepth: number;
  /** Matched against the curated taxonomy; anything unknown is dropped. */
  misconceptionTag?: string;
  /** Candidate interests. Never used until a guardian approves the tag. */
  interestTags?: readonly string[];
  /**
   * `PlaneOutcome.storeInStudentModel` from `@acme/safety`, carried verbatim.
   * A turn with `false` here contributes nothing — not mastery, not an interest.
   */
  storable: boolean;
}

export interface SessionTranscript {
  id: string;
  learnerId: string;
  capturedAt: string;
  /** Set at capture by `transcriptExpiry`, never extended by distillation. */
  expiresAt: string;
  turns: readonly SessionTurn[];
}

/** Doc 07 §4 / ADR-006: the raw transcript's window starts when it is captured. */
export const transcriptExpiry = (capturedAt: Date): string =>
  addDays(capturedAt, TRANSCRIPT_TTL_DAYS);

export const factId = (learnerId: string, kind: string, subject: string): string =>
  `${learnerId}:${kind}:${subject}`;

const mergeProvenance = (existing: readonly string[] | undefined, transcriptId: string) =>
  existing?.includes(transcriptId) ? existing : [...(existing ?? []), transcriptId];

export interface DistillOptions {
  /**
   * Doc 07 §4 Loop A makes interests guardian opt-in. The approved list is
   * passed in rather than read here so the consent check happens against the
   * consent store, not against something a transcript claimed.
   */
  guardianApprovedInterests?: readonly string[];
  tracing?: TracingParams;
}

/**
 * Returns the facts as they stand after this transcript — prior facts for
 * untouched skills included, so the result is the whole model rather than a
 * patch the caller has to apply correctly.
 */
export function distill(
  transcript: SessionTranscript,
  priorFacts: readonly DerivedFact[],
  now: Date,
  options: DistillOptions = {},
): DerivedFact[] {
  const tracing = options.tracing ?? DEFAULT_TRACING;
  const approved = new Set(options.guardianApprovedInterests ?? []);
  const byId = new Map(priorFacts.map((fact) => [fact.id, fact]));

  const storable = transcript.turns.filter((turn) => turn.storable);
  const { learnerId, id: transcriptId } = transcript;

  /*
    IDEMPOTENCE ON THE TRANSCRIPT, not merely on the fact id.

    `distillKey`'s `singletonKey` stops protecting the moment the first job
    completes (`jobs/src/keys.ts` says so in place), and every accumulating
    value below is a function of the PREVIOUS RUN'S OUTPUT rather than of the
    turns: `p` traces forward from the stored `p`, `attempts` increments, the
    review rung advances, the hint-depth mean re-blends. So a dead-letter
    replay a week later — the one §4.1 has a human perform by hand — took one
    correct turn from p=0.25 to 0.66 and then to 0.85, flipping the
    parent-facing sentence from "Getting there on…" to "Has … down" and
    dropping the skill out of the frontier brief. The upsert made it one ROW.
    It never made it the same row.

    The provenance list is the record of which transcripts a fact already
    counts, and `mergeProvenance` was computing it all along. Read from
    `priorFacts` rather than the running map, so a transcript with two turns on
    one skill still applies both of them on a first run.
  */
  const alreadyCounted = new Set(
    priorFacts.filter((fact) => fact.derivedFrom.includes(transcriptId)).map((fact) => fact.id),
  );

  for (const turn of storable) {
    const { skillId, skillTitle } = turn;

    const masteryKey = factId(learnerId, 'mastery', skillId);
    // The misconception and interest facts below are assignments rather than
    // accumulations, so a replay would recompute them identically — skipping
    // the whole turn is equivalent, and says the rule once.
    if (alreadyCounted.has(masteryKey)) continue;
    const priorMastery = byId.get(masteryKey);
    const previousP =
      priorMastery?.kind === 'mastery' ? priorMastery.p : tracing.prior;
    const attempts = priorMastery?.kind === 'mastery' ? priorMastery.attempts : 0;
    const updated: MasteryFact = masteryFact({
      id: masteryKey,
      learnerId,
      skillId,
      skillTitle,
      p: traceAttempt(previousP, turn.correct, tracing),
      attempts: attempts + 1,
      derivedFrom: mergeProvenance(priorMastery?.derivedFrom, transcriptId),
      observedAt: now,
    });
    byId.set(masteryKey, updated);

    const reviewKey = factId(learnerId, 'review', skillId);
    const priorReview = byId.get(reviewKey);
    const nextReview = scheduleReview(
      priorReview?.kind === 'review'
        ? { intervalDays: priorReview.intervalDays, dueAt: priorReview.dueAt }
        : null,
      turn.correct,
      now,
    );
    byId.set(
      reviewKey,
      reviewFact({
        id: reviewKey,
        learnerId,
        skillId,
        skillTitle,
        dueAt: nextReview.dueAt,
        intervalDays: nextReview.intervalDays,
        derivedFrom: mergeProvenance(priorReview?.derivedFrom, transcriptId),
        observedAt: now,
      }),
    );

    const scaffoldKey = factId(learnerId, 'scaffolding', skillId);
    const priorScaffold = byId.get(scaffoldKey);
    // A running mean over attempts, so one heavily-hinted problem does not
    // relabel a learner as needing more support than she does.
    const priorDepth =
      priorScaffold?.kind === 'scaffolding' ? priorScaffold.hintDepth : turn.hintDepth;
    const blended: ScaffoldingFact = scaffoldingFact({
      id: scaffoldKey,
      learnerId,
      skillId,
      skillTitle,
      hintDepth: (priorDepth * attempts + turn.hintDepth) / (attempts + 1),
      derivedFrom: mergeProvenance(priorScaffold?.derivedFrom, transcriptId),
      observedAt: now,
    });
    byId.set(scaffoldKey, blended);

    // A tag the taxonomy does not know is discarded rather than stored as free
    // text: an unrecognised tag is a model writing prose about a child.
    if (turn.misconceptionTag !== undefined && isMisconceptionTag(turn.misconceptionTag)) {
      const key = factId(learnerId, 'misconception', turn.misconceptionTag);
      const prior = byId.get(key);
      byId.set(
        key,
        misconceptionFact({
          id: key,
          learnerId,
          tag: turn.misconceptionTag,
          // Getting it right retires the misconception; it stays on the record
          // as resolved rather than vanishing, so a tutor reading the model can
          // see what the child worked through.
          active: !turn.correct,
          derivedFrom: mergeProvenance(prior?.derivedFrom, transcriptId),
          observedAt: now,
        }),
      );
    }

    for (const tag of turn.interestTags ?? []) {
      if (!approved.has(tag)) continue;
      const key = factId(learnerId, 'interest', tag);
      const prior = byId.get(key);
      byId.set(
        key,
        interestFact({
          id: key,
          learnerId,
          tag,
          guardianApproved: true,
          derivedFrom: mergeProvenance(prior?.derivedFrom, transcriptId),
          observedAt: now,
        }),
      );
    }
  }

  return [...byId.values()];
}

/** Doc 19 §1's frontier read, with decay applied at read time (mastery.ts). */
export const masteryFacts = (facts: readonly DerivedFact[]): MasteryFact[] =>
  facts.filter((fact): fact is MasteryFact => fact.kind === 'mastery');

export const reviewFacts = (facts: readonly DerivedFact[]): ReviewFact[] =>
  facts.filter((fact): fact is ReviewFact => fact.kind === 'review');
