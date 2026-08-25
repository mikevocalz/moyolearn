// Erasure, and the cascade that makes it true.
//
// Doc 07 §4 promises a guardian that "any line is deletable; erasure cascades
// through derived artifacts". The failure mode that promise exists to prevent is
// the one every ML product has shipped at least once: the row disappears from
// the screen, the derived artifact keeps the belief, and the assistant goes on
// saying the deleted thing. So deletion here is defined on PROVENANCE, not on
// rows — every fact knows the transcripts it came from, and a transcript's
// erasure walks that edge.
//
// A fact derived from several transcripts loses only the erased one. If that
// leaves it with no provenance at all it is deleted rather than kept as an
// orphan belief: a fact nobody can trace to anything is exactly the thing a
// guardian was told does not exist.
//
// `blockedTags` is the second half. Deleting a fact that the next session would
// re-derive is theatre, so an erasure records what was erased and distillation
// is filtered through it — the child can re-earn a mastery estimate by doing the
// work, but a deleted interest stays deleted until the family says otherwise.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 · docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: erasure cascade delete provenance transcript fact guardian right-to-delete

import type { DerivedFact } from './facts.ts';
import type { SessionTranscript, SessionTurn } from './distill.ts';

export interface ErasureResult {
  facts: DerivedFact[];
  /** Ids removed, for the audit row and for the "we deleted N things" copy. */
  erasedFactIds: string[];
}

/** Deletes one line from S27. Nothing else moves — the guardian picked a line. */
export function eraseFact(facts: readonly DerivedFact[], factId: string): ErasureResult {
  const present = facts.some((fact) => fact.id === factId);
  return {
    facts: facts.filter((fact) => fact.id !== factId),
    erasedFactIds: present ? [factId] : [],
  };
}

/**
 * Deletes a transcript and everything it is the sole source of. This is what
 * runs when a transcript hits its TTL and when a guardian erases a session.
 */
export function eraseTranscript(
  facts: readonly DerivedFact[],
  transcriptId: string,
): ErasureResult {
  const kept: DerivedFact[] = [];
  const erasedFactIds: string[] = [];

  for (const fact of facts) {
    if (!fact.derivedFrom.includes(transcriptId)) {
      kept.push(fact);
      continue;
    }
    const remaining = fact.derivedFrom.filter((id) => id !== transcriptId);
    if (remaining.length === 0) {
      erasedFactIds.push(fact.id);
      continue;
    }
    kept.push({ ...fact, derivedFrom: remaining });
  }

  return { facts: kept, erasedFactIds };
}

/** Every fact a transcript would take with it. S27 shows this before deleting. */
export const cascadePreview = (
  facts: readonly DerivedFact[],
  transcriptId: string,
): DerivedFact[] =>
  facts.filter(
    (fact) =>
      fact.derivedFrom.includes(transcriptId) &&
      fact.derivedFrom.filter((id) => id !== transcriptId).length === 0,
  );

/** The TTL sweep. Transcripts are dropped and their sole-source facts with them. */
export function expireTranscripts(
  transcripts: readonly SessionTranscript[],
  facts: readonly DerivedFact[],
  now: Date,
): { transcripts: SessionTranscript[]; facts: DerivedFact[]; erasedFactIds: string[] } {
  const expired = transcripts.filter((t) => Date.parse(t.expiresAt) <= now.getTime());
  let remainingFacts = [...facts];
  const erasedFactIds: string[] = [];

  for (const transcript of expired) {
    const result = eraseTranscript(remainingFacts, transcript.id);
    remainingFacts = result.facts;
    erasedFactIds.push(...result.erasedFactIds);
  }

  return {
    transcripts: transcripts.filter((t) => Date.parse(t.expiresAt) > now.getTime()),
    facts: remainingFacts,
    erasedFactIds,
  };
}

/**
 * The re-derivation guard. An erased interest or misconception tag is filtered
 * out of a transcript before distillation sees it, because the alternative is a
 * guardian deleting "loves basketball" on Monday and reading it again on Friday.
 * Mastery and review are deliberately NOT blockable: they are a record of work
 * the child did, and suppressing them permanently would leave the tutor teaching
 * a child it is forbidden to notice is improving.
 */
export function withoutBlockedTags(
  turns: readonly SessionTurn[],
  blockedTags: readonly string[],
): SessionTurn[] {
  if (blockedTags.length === 0) return [...turns];
  const blocked = new Set(blockedTags);
  return turns.map((turn) => ({
    ...turn,
    misconceptionTag:
      turn.misconceptionTag !== undefined && blocked.has(turn.misconceptionTag)
        ? undefined
        : turn.misconceptionTag,
    interestTags: turn.interestTags?.filter((tag) => !blocked.has(tag)),
  }));
}
