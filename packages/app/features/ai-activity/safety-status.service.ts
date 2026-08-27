// What a guardian is shown about the safety plane (doc 12 §5, doc 07 §S26).
//
// Doc 12 §5's fail-closed rule has two halves and only one of them was built:
// "tutoring pauses — 'Natalie is taking a break' (never an error screen at a
// child), guardian-visible status". The child's half has been on screen since
// `TutorStage`'s `paused` case. The adult's half was nowhere — the paused state
// lived in `useTutorStore` on the child's device and ended with the tab.
//
// That asymmetry is the failure worth naming: from the kitchen table, a tutor
// that has silently stopped working and a child who has silently stopped trying
// look identical, and only one of them is anybody's fault.
//
// The feed is deliberately NOT every safety event. Doc 07 §3 layer 4 says
// boundary-testing is "logged (never punished — a curious kid probing the AI is
// normal)", so `guardianVisible` is decided once, at write time, by
// `safetyEventFor` — and this read honours it rather than re-deciding. A parent
// shown every off-task redirect is a parent being handed a surveillance feed.
// SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3 §S26 · docs/pack/04-screen-briefs.md §S12
// SOT-KEYWORDS: guardian safety status paused alerts ai activity protected operation safety events feed
import 'server-only';
import type { Auth } from '@acme/auth/server';
import {
  guardianAlert,
  isTutoringPaused,
  PAUSE_STATUS_MINUTES,
  type GuardianAlert,
  type SafetyEvent,
} from '@acme/safety';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';

/**
 * A row a guardian is shown as an ALERT: visible to them, and about the child's
 * turn rather than about the system.
 *
 * A predicate rather than a filter callback so the narrowing survives into the
 * `map` below — `guardianAlert` takes doc 07 §S26's three categories, and
 * `paused` is deliberately not one of them.
 */
const isGuardianAlert = (
  event: SafetyEvent,
): event is SafetyEvent & { category: GuardianAlert['category'] } =>
  event.guardianVisible && event.category !== 'paused';

/**
 * The guardian-visible events for every learner this session is responsible
 * for, newest first.
 *
 * Which learners those are is the repository's question, not this service's:
 * identity comes from `ctx` and the guardianship rows are a Payload read, so
 * resolving them here would put a collection query in a service (CLAUDE.md
 * §The block).
 */
export type LoadGuardianSafetyEvents = (ctx: ProtectedCtx) => Promise<readonly SafetyEvent[]>;

export interface SafetyAlertSummary {
  eventId: string;
  /** Whose turn it was, so a two-child household knows who to go and find. */
  learnerId: string;
  /** The conversation, when the turn had one — S26's excerpt link hangs off it. */
  sessionId: string | null;
  /** Doc 07 §S26's copy: what the SYSTEM did, never what the child did wrong. */
  alert: GuardianAlert;
}

export interface GuardianSafetyStatus {
  /**
   * Doc 12 §5's status line. True when a layer could not screen a turn recently
   * enough that the next one probably cannot either — see `PAUSE_STATUS_MINUTES`.
   */
  paused: boolean;
  /** When the pause started, so the surface can say "since 4:12" rather than "now". */
  pausedSince: string | null;
  alerts: readonly SafetyAlertSummary[];
}

/**
 * The projection, pure and exported so it can be held by a test without a
 * session, a database or a clock.
 *
 * Everything a reviewer would question lives here — which rows become the status
 * line, which become alerts, and which become neither — and none of it needs an
 * auth boundary to be exercised. `guardianSafetyStatus` below is the boundary
 * and nothing else.
 */
export function safetyStatusFrom(
  events: readonly SafetyEvent[],
  now: Date,
): GuardianSafetyStatus {
  const paused = isTutoringPaused(events, now);

  /*
    The OLDEST pause in the live window, not the newest.

    Every turn attempted while a layer is down writes its own row, so the newest
    is seconds old and would draw "paused since just now" through an outage that
    had been running for ten minutes. What a parent is asking is how long this
    has been going on.
  */
  const floor = now.getTime() - PAUSE_STATUS_MINUTES * 60_000;
  const live = events
    .filter((event) => event.category === 'paused' && Date.parse(event.occurredAt) >= floor)
    .map((event) => event.occurredAt)
    .sort();

  return {
    paused,
    pausedSince: paused ? (live[0] ?? null) : null,
    alerts: events.filter(isGuardianAlert).map((event) => ({
      eventId: event.eventId,
      learnerId: event.learnerId,
      sessionId: event.sessionId,
      /*
        Rendered from the category rather than stored as copy. `guardianAlert` is
        doc 07 §S26's wording and it is also what the crisis protocol publishes;
        a second copy written here is a second thing to keep in step with a
        statute.
      */
      alert: guardianAlert(event.category, new Date(event.occurredAt)),
    })),
  };
}

/**
 * The one thing this service must never do is invent a reassuring default.
 *
 * An empty feed means "nothing was stopped", and that is only honest if the read
 * succeeded. A failed read propagates rather than resolving to
 * `{ paused: false, alerts: [] }`, because a guardian looking at a calm screen
 * has been told something, and "we could not check" is not that.
 */
export async function guardianSafetyStatus(
  auth: Auth,
  headers: Headers,
  loadEvents: LoadGuardianSafetyEvents,
  now: Date = new Date(),
): Promise<GuardianSafetyStatus> {
  return protectedOperation(auth, headers, async (ctx) =>
    safetyStatusFrom(await loadEvents(ctx), now),
  );
}
