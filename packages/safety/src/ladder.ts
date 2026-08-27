// Doc 31 §3.2's child-input ladder — S1 · S2 · S3 · S4 — as data and pure
// functions.
//
// THIS FILE REPLACES A VOCABULARY RATHER THAN ADDING ONE. `events.ts` already
// had a severity dimension: `crisis | safety | boundary | paused`. Doc 31 §3.2
// fixes the taxonomy in S-tiers, names a rolling-window escalation the old
// four-way split had no way to express, and attaches an SLA and a paging rule to
// each rung. Where the two disagree doc 31 wins, so `tierFor` below is the
// MIGRATION: the old category keeps its job (what the plane did, and to whom —
// `paused` is about the system, not the child), and the tier is what decides
// whether a guardian is told, whether an incident is filed, and how long anyone
// has to answer it.
//
// DETECTION IS NOT PUNISHMENT, and the ladder is shaped by that sentence rather
// than decorated with it. S1 records and says nothing to anybody; a curse from a
// nine-year-old is developmentally ordinary and doc 07 §3 layer 4 already
// forbids punishing it. The rungs that reach an adult are the two where content
// crossed a line (S3) or where a child is in danger (S4).
//
// Everything here is pure and takes its clock as an argument, because the one
// rule in the file whose failure is a child not being heard — S4 — must be
// provable without a database, a session or a `Date.now()`.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §3.2 §4.3 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: safety ladder tier S1 S2 S3 S4 escalation rolling window repetition incident sla page guardian child input taxonomy

import type { SafetyEventCategory } from './events.ts';

/** Doc 31 §3.2's four rungs, ordered least to most serious. */
export const SAFETY_TIERS = ['S1', 'S2', 'S3', 'S4'] as const;
export type SafetyTier = (typeof SAFETY_TIERS)[number];

/**
 * The order, as a lookup rather than as string comparison.
 *
 * `'S4' > 'S3'` happens to be true lexicographically today and would stop being
 * true the moment anybody adds an `S10` or renames a rung — and the failure
 * would be silent and downward, which is the direction that matters.
 */
const RANK: Record<SafetyTier, number> = { S1: 0, S2: 1, S3: 2, S4: 3 };

export const tierAtLeast = (tier: SafetyTier, floor: SafetyTier): boolean =>
  RANK[tier] >= RANK[floor];

/** The more serious of two readings of the same turn. */
export const worstTier = (left: SafetyTier, right: SafetyTier): SafetyTier =>
  RANK[left] >= RANK[right] ? left : right;

/**
 * Doc 31 §4.1's category list, verbatim.
 *
 * `tutor-behavior`, `safety-concern` and `other` have no automated producer —
 * they exist for the human intake path (§4's second door), where a staff member
 * or a guardian files something the classifiers never saw.
 */
export const INCIDENT_CATEGORIES = [
  'profanity',
  'sexual-content',
  'bullying',
  'pii-shared',
  'violence',
  'substances',
  'self-harm',
  'abuse-disclosure',
  'tutor-behavior',
  'safety-concern',
  'other',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

/**
 * One row of doc 31 §3.2's table.
 *
 * `sla` and `pagesHuman` are here rather than in the routing code because §4.3's
 * fan-out is a CONSEQUENCE of the tier, not a second policy: a queue that chose
 * its own SLA could disagree with the tier that produced it, and the disagreement
 * would only ever be discovered by a breach that nobody was paged for.
 */
export interface LadderRung {
  /** What the tutor does in-session. Never a generated apology; a fixed move. */
  readonly behavior: string;
  /** Whether §4 files an Incident Report. */
  readonly filesIncident: boolean;
  /** Whether the guardian is notified — separate from `filesIncident`, see §4.1. */
  readonly notifiesGuardian: boolean;
  /** Hours to respond, from §4.3. `null` where no clock is owed. */
  readonly slaHours: number | null;
  /** §4.3: S4 pages an on-call human. Nothing else does. */
  readonly pagesHuman: boolean;
  /** §3.2 S4: the session stops and stays stopped until a human clears it. */
  readonly entersSafeMode: boolean;
}

export const LADDER = {
  S1: {
    behavior:
      'Warm redirect to the work. No comment on the word itself beyond, at most, "let’s keep it school words".',
    filesIncident: false,
    notifiesGuardian: false,
    slaHours: null,
    pagesHuman: false,
    entersSafeMode: false,
  },
  S2: {
    behavior:
      'Named redirect — "those words aren’t for our session, back to the problem". The tutor never mirrors and never escalates.',
    filesIncident: false,
    notifiesGuardian: false,
    slaHours: null,
    pagesHuman: false,
    entersSafeMode: false,
  },
  S3: {
    behavior:
      'Age-calibrated deflection WITHOUT engaging the content, then the topic fence is re-asserted. The thread is never continued.',
    filesIncident: true,
    notifiesGuardian: true,
    slaHours: 48,
    pagesHuman: false,
    entersSafeMode: false,
  },
  S4: {
    behavior:
      'Tutoring stops. A fixed, human-written script is delivered — never a generated response in this tier — and the session moves to safe mode.',
    filesIncident: true,
    notifiesGuardian: true,
    slaHours: 2,
    pagesHuman: true,
    entersSafeMode: true,
  },
} as const satisfies Record<SafetyTier, LadderRung>;

/** §4.3's clock, derived from the tier so the two can never disagree. */
export function slaDueAt(tier: SafetyTier, from: Date): string | null {
  const hours = LADDER[tier].slaHours;
  return hours === null ? null : new Date(from.getTime() + hours * 3_600_000).toISOString();
}

/**
 * THE MIGRATION. The plane's existing verdict, read as a rung of doc 31's
 * ladder.
 *
 * `null` for `paused`, and that null is the reason the tier is nullable
 * everywhere downstream: doc 12 §5's fail-closed pause is a fact about a
 * classifier that timed out, and there is no severity of CHILD BEHAVIOUR to
 * assign to it. Filing it as S1 would put a system outage on a ladder whose
 * every other rung is a judgement about a person.
 *
 * `boundary` → S1 and `safety` → S3 preserve today's `guardianVisible` answers
 * exactly, which is deliberate: this change re-expresses the rule in doc 31's
 * terms without silently starting or stopping a single notification to a parent.
 * S2 has no mapping from a single turn and cannot have one — it is a rung a
 * child reaches by REPEATING, which is what `escalate` below is for.
 */
export function tierFor(category: SafetyEventCategory): SafetyTier | null {
  if (category === 'crisis') return 'S4';
  if (category === 'safety') return 'S3';
  if (category === 'boundary') return 'S1';
  return null;
}

/**
 * Doc 31 §3.2's own rule for what a guardian sees, replacing
 * `category !== 'boundary'`.
 *
 * A `null` tier is the pause, which IS guardian-visible — doc 12 §5 — so it is
 * answered `true` here rather than falling through the ladder. The two reasons a
 * parent is told are "something crossed a line" and "the tutor is not running",
 * and they are different sentences on the same screen.
 */
export const tierIsGuardianVisible = (tier: SafetyTier | null): boolean =>
  tier === null || LADDER[tier].notifiesGuardian;

/**
 * How far back repetition counts.
 *
 * A SESSION-shaped window, not a term-shaped one. §3.2's escalation is about a
 * child who was redirected and carried on anyway — that is behaviour inside one
 * sitting, and stretching the window to a week would file an incident on a
 * Friday for two words said on a Monday, which is the "detection is punishment"
 * failure the whole section is written against.
 */
export const REPETITION_WINDOW_MINUTES = 60;

/**
 * How many times, inclusive of the turn being judged.
 *
 * Three, not two. Two is a child who swore and then swore again in the same
 * breath before the redirect could land; three is a child who was told, heard
 * it, and continued — which is the thing §3.2 means by "after redirect".
 */
export const REPETITION_THRESHOLD = 3;

/** A turn already on record for this learner, as the escalation needs to see it. */
export interface PriorRung {
  readonly tier: SafetyTier;
  /** ISO-8601, as `SafetyEvent.occurredAt` stores it. */
  readonly at: string;
}

/**
 * §3.2's escalation, applied to one turn.
 *
 * TWO CLIMBS, and they are the same rule applied twice rather than two rules:
 * an S1 repeated becomes the S2 the table describes as "repeated profanity after
 * redirect", and an S2 repeated becomes S3 — "repetition within a rolling window
 * auto-escalates to S3". Nothing climbs out of S3: S4 is a disclosure, never an
 * accumulation, and a child who asks three off-limits questions is not in
 * crisis. Filing them there would spend the tier that pages a human at 3am on a
 * child testing a fence.
 *
 * Counts the turn being judged, so `REPETITION_THRESHOLD` reads as "the third
 * one" rather than as "two before this one".
 */
export function escalate(
  tier: SafetyTier,
  priors: readonly PriorRung[],
  now: Date,
): SafetyTier {
  if (tier !== 'S1' && tier !== 'S2') return tier;

  const floor = now.getTime() - REPETITION_WINDOW_MINUTES * 60_000;
  const sameRungInWindow = priors.filter(
    (prior) => prior.tier === tier && Date.parse(prior.at) >= floor,
  ).length;

  if (sameRungInWindow + 1 < REPETITION_THRESHOLD) return tier;
  return tier === 'S1' ? 'S2' : 'S3';
}

/**
 * The incident category a machine-classified turn is filed under.
 *
 * DELIBERATELY COARSE. The plane knows which LAYER stopped a turn, not what the
 * child was talking about — `3-input: prohibited` covers a sex question, a
 * weapon question and a drug question with one label, and inventing a
 * distinction between them here would be the report recording inferred intent,
 * which doc 31 §3.2's closing note bans by name.
 *
 * So the automated path files the honest category, and a human narrows it at
 * triage. `safety-concern` is the shrug and it is the right shrug: a report that
 * says "a classifier stopped this and here is the excerpt" is actionable, and
 * one that guesses "sexual-content" and is wrong is a conversation a parent has
 * with a child about something that did not happen.
 *
 * A crisis turn is NOT auto-filed as `self-harm`, for the same reason and with
 * more at stake: `CRISIS_PATTERNS` matches "I want to die" and "someone is
 * hurting me" with one verdict, and those are `self-harm` and `abuse-disclosure`
 * — two categories with two different sets of obligations behind them. The
 * legal-hold rule in `incidents.ts` keys on the TIER for exactly this reason, so
 * the hold never depends on a machine having guessed which one it was.
 */
export function incidentCategoryFor(
  tier: SafetyTier,
  _category: SafetyEventCategory,
): IncidentCategory {
  if (tier === 'S1' || tier === 'S2') return 'profanity';
  return 'safety-concern';
}
