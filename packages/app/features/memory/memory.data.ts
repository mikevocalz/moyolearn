// S27 fixture data — the student model as a guardian would read it.
//
// The shape is `DerivedFact` from `@acme/student-model/pure`, the client-safe
// entry point, imported type-only (CLAUDE.md: cross-boundary types travel as
// type-only imports). That matters more here than convenience: S27's entire
// claim is that the guardian sees the same rows the tutor's prompt sees, and a
// second view-model hand-written for the screen is how those two quietly drift
// apart. When the repository lands the fixture is replaced, not the type.
//
// The transcript rows carry `expiresAt` because doc 07 §4 makes the retention
// window a visible fact rather than a policy sentence, and because deleting one
// is what demonstrates the cascade.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · docs/pack/19-learning-outcomes-spec.md §1
// SOT-KEYWORDS: memory s27 fixture derived facts transcripts cascade guardian

import type { DerivedFact, FactKind } from '@acme/student-model/pure';

/** Doc 07 §S27: "the graph in parent language". Headings are the parent's, not ours. */
export const GROUPS = [
  { kind: 'mastery', heading: 'Working on' },
  { kind: 'misconception', heading: 'Watches out for' },
  { kind: 'review', heading: 'Coming back to' },
  { kind: 'interest', heading: 'Examples she likes' },
  { kind: 'scaffolding', heading: 'How much help she wants' },
] as const satisfies readonly { kind: FactKind; heading: string }[];

export interface TranscriptLine {
  id: string;
  label: string;
  expiresLabel: string;
}

const iso = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 86_400_000).toISOString();

export const MEMORY_FACTS: DerivedFact[] = [
  {
    kind: 'mastery',
    id: 'maya:mastery:fraction-addition',
    learnerId: 'maya',
    skillId: 'fraction-addition',
    skillTitle: 'adding fractions',
    p: 0.62,
    attempts: 11,
    sentence: 'Getting there on adding fractions',
    derivedFrom: ['s-0219', 's-0224'],
    observedAt: iso(-2),
    expiresAt: iso(398),
  },
  {
    kind: 'mastery',
    id: 'maya:mastery:decimal-sense',
    learnerId: 'maya',
    skillId: 'decimal-sense',
    skillTitle: 'comparing decimals',
    p: 0.88,
    attempts: 14,
    sentence: 'Has comparing decimals down',
    derivedFrom: ['s-0211'],
    observedAt: iso(-9),
    expiresAt: iso(391),
  },
  {
    kind: 'misconception',
    id: 'maya:misconception:adds-denominators',
    learnerId: 'maya',
    skillId: 'fraction-addition',
    tag: 'adds-denominators',
    strategy:
      'Return to unit fractions before renaming; do not correct the answer, correct the model.',
    active: true,
    sentence: 'Adds the bottom numbers when adding fractions',
    derivedFrom: ['s-0224'],
    observedAt: iso(-2),
    expiresAt: iso(398),
  },
  {
    kind: 'review',
    id: 'maya:review:decimal-sense',
    learnerId: 'maya',
    skillId: 'decimal-sense',
    skillTitle: 'comparing decimals',
    dueAt: iso(3),
    intervalDays: 16,
    sentence: 'Due for a comparing decimals refresher',
    derivedFrom: ['s-0211'],
    observedAt: iso(-9),
    expiresAt: iso(391),
  },
  {
    kind: 'interest',
    id: 'maya:interest:basketball',
    learnerId: 'maya',
    tag: 'basketball',
    guardianApproved: true,
    sentence: 'Likes examples about basketball',
    derivedFrom: ['s-0219'],
    observedAt: iso(-6),
    expiresAt: iso(394),
  },
  {
    kind: 'scaffolding',
    id: 'maya:scaffolding:fraction-addition',
    learnerId: 'maya',
    skillId: 'fraction-addition',
    hintDepth: 2.3,
    sentence: 'Wants a couple of hints before adding fractions clicks',
    derivedFrom: ['s-0219', 's-0224'],
    observedAt: iso(-2),
    expiresAt: iso(398),
  },
];

export const MEMORY_TRANSCRIPTS: TranscriptLine[] = [
  { id: 's-0224', label: 'Session · Feb 24 · fractions', expiresLabel: 'Deleted in 24 days' },
  { id: 's-0219', label: 'Session · Feb 19 · fractions', expiresLabel: 'Deleted in 19 days' },
  { id: 's-0211', label: 'Session · Feb 11 · decimals', expiresLabel: 'Deleted in 11 days' },
];

/** "from 2 sessions" — provenance in the row, because the cascade needs explaining once. */
export const provenanceLabel = (fact: DerivedFact): string =>
  fact.derivedFrom.length === 1 ? 'From 1 session' : `From ${fact.derivedFrom.length} sessions`;
