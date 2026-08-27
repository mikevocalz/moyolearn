// Safety-event repository — the write from the coaching boundary, and the read
// a guardian's screen is built from.
//
// A PAYLOAD collection, not `edu`, and that is doc 12 §4 read literally: it puts
// `safetyEvents` in the list Payload owns, beside `guardianships`, `consents` and
// `auditEvents`. Doc 07 §3 layer 7 says the same thing from the other side —
// safety events are "excluded from the pedagogical student model", so the one
// store they must not live in is the one the model lives in.
//
// Split from `student-model.repository.ts` because the two answer to different
// authorities. That file is learner-scoped: every query is `ctx.learnerId`. This
// one is GUARDIAN-scoped on the read — the acting user is an adult asking about
// somebody else's rows, and the only thing that entitles them to see one is an
// active guardianship. Keeping the two shapes of query in one file is how a
// relationship-scoped `where` eventually gets copied onto a self-scoped path.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 §7 · docs/pack/12-systems-design-prompt.md §4 §5 · packages/payload/src/collections/SafetyEvents.ts
// SOT-KEYWORDS: safety event repository payload write guardian scope guardianship read pause alert retention
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { SafetyEvent as SafetyEventRow } from '@acme/payload';
/*
  The DOMAIN shape, and it comes through `@acme/app/server` rather than from
  `@acme/safety` directly — the app does not depend on the plane and must not
  start to. The row and the domain object collide by name, so the row is the one
  that is aliased: this file is a repository, and its subject is the object the
  rest of the tree speaks in.
*/
import type {
  LoadGuardianSafetyEvents,
  PlaneLog,
  ProtectedCtx,
  RecordSafetyEvent,
  SafetyEvent,
} from '@acme/app/server';
import { reportRouteError } from './report-error';

/**
 * How many rows a guardian's screen reads at once.
 *
 * Bounded because the feed is a feed, not an archive: the store keeps 90 days
 * and a household that has genuinely produced more than this in that time has a
 * problem no list length solves.
 */
const FEED_LIMIT = 50;

/** Two guardians per learner is normal (doc 06 §2); a whole classroom is not. */
const WARDS_LIMIT = 50;

async function withPayload<T>(
  fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>,
): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

/**
 * Doc 07 §3 layer 7's write.
 *
 * `void`-returning, and the swallow below is the reason the port is shaped that
 * way rather than an apology for it. The event is taken AFTER the plane reached
 * its verdict and cannot change it; an awaited write that rejected would surface
 * at `coach.service.ts`'s catch as an ordinary error, which is `unavailable` →
 * `retry` — so a database hiccup would hand a child a retry button into the
 * layer that had just blocked them. A lost record is bad. A lost record that
 * unblocks a blocked turn is the thing the whole plane exists to prevent.
 *
 * So it is reported loudly instead — to the log AND to Sentry through the same
 * helper the routes use. Doc 12 §7 asks for safety-pipeline degradation at
 * page-severity, and a write that silently failed is precisely that degradation;
 * it is the one failure on this path that nobody downstream can infer, because
 * the absence of a row and the absence of an incident look the same.
 */
export const recordSafetyEvent: RecordSafetyEvent = (_ctx: ProtectedCtx, event: SafetyEvent) => {
  void withPayload((payload) =>
    payload.create({
      collection: 'safetyEvents',
      /*
        Spread field by field rather than cast, for the reason `saveTranscript`
        records: `trace` is a readonly array on the domain type and a mutable
        JSON column on the row's, and a cast through `unknown` would hide that
        alongside every future field the two shapes stop agreeing on.
      */
      data: {
        eventId: event.eventId,
        learnerAuthId: event.learnerId,
        sessionId: event.sessionId,
        category: event.category,
        disposition: event.disposition,
        stoppedAt: event.stoppedAt,
        trace: [...event.trace],
        guardianVisible: event.guardianVisible,
        occurredAt: event.occurredAt,
        expiresAt: event.expiresAt,
      },
    }),
    // `Error` rather than the `unknown` a rejection is typed as, for the reason
    // `reportRouteError` gives about its own signature: the driver rejects with
    // an Error, and nothing untyped should cross into the reporter.
  ).catch((error: Error) => {
    /*
      The IDS and the verdict, never the trace and never the turn. A log line is
      the least protected surface in the system, so what goes in it is what an
      operator needs to find the row — not what the row says about a child.
    */
    console.error('[safety] lost a safety event', {
      eventId: event.eventId,
      category: event.category,
      stoppedAt: event.stoppedAt,
      message: error.message,
    });
    reportRouteError(error);
  });
};

/** One row back into the domain shape the service and the screen speak. */
function eventFromDoc(doc: SafetyEventRow): SafetyEvent {
  return {
    eventId: doc.eventId,
    learnerId: doc.learnerAuthId,
    sessionId: doc.sessionId ?? null,
    category: doc.category,
    disposition: doc.disposition,
    stoppedAt: doc.stoppedAt,
    /*
      The JSON column, narrowed rather than asserted-through. `trace` is written
      as `PlaneLog[]` by this very file and by nothing else, so an array is what
      is there; a row that somehow holds anything else reads as an empty trace
      rather than as a crash on a guardian's screen, because the verdict is the
      part they need and the trace is the part a reviewer needs.
    */
    trace: Array.isArray(doc.trace) ? (doc.trace as PlaneLog[]) : [],
    guardianVisible: doc.guardianVisible,
    occurredAt: doc.occurredAt,
    expiresAt: doc.expiresAt,
  };
}

/**
 * Every safety event belonging to a learner this session is actually
 * responsible for, newest first.
 *
 * The guardianship read comes FIRST and an empty result short-circuits, so the
 * event query is never issued without a relationship behind it. A learner
 * signing in and opening this surface gets nothing — correctly: doc 07 §3 layer
 * 4 logs boundary-testing "never punished", and a child reading their own safety
 * file is the punishment.
 *
 * `status: active` and not merely present: an `invited` guardian has not
 * completed doc 06 §2's ladder, and a `revoked` one is a household that has
 * changed. Neither is somebody to hand a child's safety history to.
 */
export const loadGuardianSafetyEvents: LoadGuardianSafetyEvents = async (ctx) => {
  return withPayload(async (payload) => {
    const { docs: wards } = await payload.find({
      collection: 'guardianships',
      where: {
        guardianAuthId: { equals: ctx.learnerId },
        status: { equals: 'active' },
      },
      limit: WARDS_LIMIT,
    });

    const learnerIds = wards.map((ward) => ward.learnerAuthId);
    if (learnerIds.length === 0) return [];

    const { docs } = await payload.find({
      collection: 'safetyEvents',
      where: { learnerAuthId: { in: learnerIds } },
      sort: '-occurredAt',
      limit: FEED_LIMIT,
    });

    return docs.map(eventFromDoc);
  });
};
