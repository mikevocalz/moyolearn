// The safety event: a stopped turn, written down.
//
// `PlaneResult.trace` was built on every turn and thrown away. Doc 07 §3 layer 7
// says safety events "live only in the guarded `safetyEvents` store with their
// own short retention", doc 12 §5 says a fail-closed pause is "guardian-visible
// status", and neither was true of a value that never left the stack frame that
// produced it. This module is the shape that leaves it.
//
// WHAT IS NOT HERE IS THE POINT: no message, no draft, no excerpt, not one word
// a child or the tutor said. An event carries the verdict and the layer that
// reached it — `PlaneLog` is layer names and class labels, which is why it can
// be stored verbatim. The words themselves stay in `sessionTranscripts`, on the
// transcript's own clock, and doc 07 §S26's "view conversation excerpt" reads
// them from there. Copying an excerpt into this store would be a second copy of
// a child's words on a second retention schedule, which is the exact failure
// `tooling/check-versions-off.mjs` exists to prevent one layer down.
//
// A `reply` produces no event. A clean turn is not a safety event, and a store
// that logs every turn is a transcript wearing a different name.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 §7 · docs/pack/12-systems-design-prompt.md §5 §7
// SOT-KEYWORDS: safety event store retention guardian visible pause trace verdict alert category crisis boundary

import { randomUUID } from 'node:crypto';
import type { PlaneLog, PlaneOutcome } from './plane.ts';
import type { SafetyLayer } from './unavailable.ts';

/**
 * How long a safety event lives — its OWN window, deliberately not the
 * transcript's.
 *
 * The transcript's 30 days (`TRANSCRIPT_TTL_DAYS`) is a data-minimisation clock
 * on a child's WORDS. An event holds no words, so nothing about that number
 * transfers to it, and inheriting it would have been a coincidence rather than
 * a decision.
 *
 * 90 days is chosen from what the record has to be able to answer:
 *   · doc 07 §3 layer 4 wants repeated boundary-testing *logged*, and repetition
 *     across a school term is invisible in a 30-day window — the pattern would
 *     expire faster than it forms;
 *   · doc 07 §S26's metric is time-to-guardian-acknowledgment, and a guardian
 *     who opens the app monthly must still find the alert waiting;
 *   · it stays "short retention" in doc 07 §3 layer 7's sense — a derived
 *     pedagogical fact lives 400 days, so this store forgets four times sooner
 *     than the store it is kept apart from.
 *
 * Enforced in the database, not here: `expiresAt` is written once at creation
 * and the sweep in `packages/payload/src/retention/sweep.sql` deletes on it. The
 * collection has no update access, so no code path can renew a window.
 */
export const SAFETY_EVENT_TTL_DAYS = 90;

/**
 * How long a fail-closed pause counts as the CURRENT state rather than history.
 *
 * Doc 12 §5 asks for guardian-visible *status*, and status is a live claim: a
 * pause from last Tuesday is a thing that happened, not a tutor that is down
 * now. The turn is the only heartbeat there is — nothing polls the plane — so
 * "paused" means "the last turn could not be screened, recently enough that the
 * next one probably cannot either".
 */
export const PAUSE_STATUS_MINUTES = 15;

/**
 * Doc 07 §S26's three alert categories, plus the one that is not an alert.
 *
 * `crisis`/`safety`/`boundary` are about the CHILD's turn and are exactly what
 * `guardianAlert()` renders. `paused` is about the SYSTEM: doc 12 §5's
 * fail-closed stop, where no layer reached a verdict about anybody. Filing it as
 * `safety` would tell a parent their child triggered something when what
 * actually happened is that a classifier timed out.
 */
export const SAFETY_EVENT_CATEGORIES = ['crisis', 'safety', 'boundary', 'paused'] as const;
export type SafetyEventCategory = (typeof SAFETY_EVENT_CATEGORIES)[number];

/** What the plane did about the turn. Mirrors `PlaneOutcome['kind']`, plus the pause. */
export const SAFETY_EVENT_DISPOSITIONS = ['crisis', 'blocked', 'redirect', 'paused'] as const;
export type SafetyEventDisposition = (typeof SAFETY_EVENT_DISPOSITIONS)[number];

export interface SafetyEvent {
  /** Client-generated so the writer is idempotent without a round trip. */
  eventId: string;
  /** From `ctx` at the service boundary, never from a request body. */
  learnerId: string;
  /** The conversation this turn belonged to, when the caller holds one. */
  sessionId: string | null;
  category: SafetyEventCategory;
  disposition: SafetyEventDisposition;
  /** The layer that stopped the turn, named as `PlaneLog.layer` names it. */
  stoppedAt: string;
  /**
   * The plane's own trace, verbatim. Layer ids and verdict labels — `3-input:
   * sensitive`, `5-output: secrecy,exclusivity` — and never a fragment of the
   * text they were reached about.
   */
  trace: readonly PlaneLog[];
  /**
   * Whether this reaches a guardian, or only the review queue.
   *
   * Doc 07 §3 layer 4 is explicit that boundary-testing is "logged (never
   * punished — a curious kid probing the AI is normal)". Forwarding every
   * off-task redirect to a parent is how logging becomes punishing, so the
   * fence is recorded and not reported.
   */
  guardianVisible: boolean;
  occurredAt: string;
  /** Written once. Nothing extends it — see `SAFETY_EVENT_TTL_DAYS`. */
  expiresAt: string;
}

export const safetyEventExpiry = (occurredAt: Date): string =>
  new Date(occurredAt.getTime() + SAFETY_EVENT_TTL_DAYS * 86_400_000).toISOString();

/** Where the plane got to, for an outcome whose trace has a last entry. */
const lastLayer = (trace: readonly PlaneLog[]): string => trace[trace.length - 1]?.layer ?? '1-identity';

/**
 * Ordered so the most serious reading of a turn wins, the same way
 * `classifyCoachInput` orders its patterns.
 *
 * A `redirect` is two different things wearing one outcome: the topic fence
 * (`4-fence`) turning a child back to the work, and the §3 handoff of a
 * disclosure about bullying or family stress. The first is a boundary and the
 * second is something a parent should know about, so the trace — not the
 * outcome kind — decides.
 */
function categoryFor(outcome: PlaneOutcome, trace: readonly PlaneLog[]): SafetyEventCategory {
  if (outcome.kind === 'crisis') return 'crisis';
  if (outcome.kind === 'blocked') return 'safety';
  return lastLayer(trace) === '4-fence' ? 'boundary' : 'safety';
}

/**
 * The event a finished turn earns, or `null` when it earned none.
 *
 * `reply` is null because a clean turn is not an event. `refused` is null too,
 * and that one is a judgement worth stating: a refusal means the guardian's own
 * `aiEnabled` switch is off and the plane honoured it. Telling a parent that
 * their setting worked is not an alert, it is noise in the one feed that must
 * stay worth reading.
 */
export function safetyEventFor(
  outcome: PlaneOutcome,
  trace: readonly PlaneLog[],
  identity: { learnerId: string; sessionId: string | null },
  occurredAt: Date = new Date(),
): SafetyEvent | null {
  if (outcome.kind === 'reply' || outcome.kind === 'refused') return null;

  const category = categoryFor(outcome, trace);
  return {
    eventId: randomUUID(),
    learnerId: identity.learnerId,
    sessionId: identity.sessionId,
    category,
    disposition: outcome.kind,
    stoppedAt: lastLayer(trace),
    trace: [...trace],
    guardianVisible: category !== 'boundary',
    occurredAt: occurredAt.toISOString(),
    expiresAt: safetyEventExpiry(occurredAt),
  };
}

/**
 * Doc 12 §5's pause, as a record.
 *
 * The child sees "Natalie is taking a break" and is owed nothing more. The
 * adult is owed the rest: which layer could not answer, and when — because a
 * tutor that has silently stopped working is indistinguishable, from the
 * kitchen table, from a child who has stopped trying.
 */
export function pausedSafetyEvent(
  layer: SafetyLayer | 'unknown',
  identity: { learnerId: string; sessionId: string | null },
  occurredAt: Date = new Date(),
): SafetyEvent {
  return {
    eventId: randomUUID(),
    learnerId: identity.learnerId,
    sessionId: identity.sessionId,
    category: 'paused',
    disposition: 'paused',
    stoppedAt: layer,
    trace: [{ layer, detail: 'unavailable' }],
    guardianVisible: true,
    occurredAt: occurredAt.toISOString(),
    expiresAt: safetyEventExpiry(occurredAt),
  };
}

/**
 * A refusal reached by a safety classifier OUTSIDE this plane — today, the
 * provider's own, arriving as `ModelDeclined`.
 *
 * `safety`, not `paused`, and the distinction is the one the guardian status
 * line is built on: a refusal stops ONE turn and the next may well succeed,
 * while an unavailable layer stops EVERY turn until it comes back. The child
 * sees the same calm break either way; the adult is shown a stopped tutor only
 * for the second.
 *
 * Takes strings rather than the error, because `@acme/safety` must not learn
 * what a provider is. `source` becomes `stoppedAt`, which is free text for
 * exactly this reason.
 */
export function externalRefusalSafetyEvent(
  source: string,
  detail: string | null,
  identity: { learnerId: string; sessionId: string | null },
  occurredAt: Date = new Date(),
): SafetyEvent {
  return {
    eventId: randomUUID(),
    learnerId: identity.learnerId,
    sessionId: identity.sessionId,
    category: 'safety',
    disposition: 'blocked',
    stoppedAt: source,
    trace: [{ layer: source, detail: detail ?? 'unspecified' }],
    guardianVisible: true,
    occurredAt: occurredAt.toISOString(),
    expiresAt: safetyEventExpiry(occurredAt),
  };
}

/**
 * Whether tutoring is paused RIGHT NOW, given the events on record.
 *
 * Pure, and it takes `now` rather than reading the clock, because the guardian
 * surface and the test that holds it have to agree on what "recently" means.
 */
export function isTutoringPaused(events: readonly SafetyEvent[], now: Date): boolean {
  const floor = now.getTime() - PAUSE_STATUS_MINUTES * 60_000;
  return events.some(
    (event) => event.category === 'paused' && Date.parse(event.occurredAt) >= floor,
  );
}
