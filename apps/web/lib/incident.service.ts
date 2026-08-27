// Doc 31 §3.2's escalation and §4's automated intake door, composed.
//
// This is the half of the ladder that cannot live in `@acme/safety`: the climb
// from S1→S2→S3 needs the learner's RECENT HISTORY, which is a query, and that
// package holds no store and must not acquire one. So the decisions stay pure
// (`escalate`, `incidentFromSafetyEvent`, `markFannedOut`) and this file is the
// three reads and two writes that feed them.
//
// IT RUNS DETACHED, ON THE SAFETY-EVENT WRITE PATH, and that is deliberate.
// `RecordSafetyEvent` returns `void` so a failed record cannot change a verdict
// that has already been reached — see the port's own comment — and everything
// here is downstream of that same rule. An incident that failed to file is bad;
// an incident that failed to file AND unblocked a blocked turn is the thing the
// whole plane exists to prevent. So the failure is reported loudly and swallowed
// at the top, exactly as the safety-event write already is.
//
// WHY THE ESCALATION IS NOT IN THE PLANE. `runSafetyPlaneStream` is synchronous
// with a child sitting in front of it, and doc 12 §5 will not let a database
// read stand between a turn and its verdict — a slow query would have to either
// block the turn or fail it, and both are worse than an escalation that lands a
// beat later. The rung a turn is filed at does not change what the child was
// shown; it changes what an adult is told, and that is allowed to be async.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §3.2 §4 §4.3 · packages/safety/src/ladder.ts · apps/web/lib/safety-event.repository.ts
// SOT-KEYWORDS: incident service escalation rolling window repetition auto file fan out guardian alert human review paged safety event
import 'server-only';
import {
  escalate,
  escalatedSafetyEvent,
  incidentFromSafetyEvent,
  LADDER,
  type IncidentReport,
  type SafetyEvent,
} from '@acme/app/server';
import { loadRecentRungs } from './safety-event.repository';
import { saveIncident } from './incident.repository';
import { enqueueIncidentFanOut } from './jobs';
import { reportRouteError } from './report-error';

/**
 * Re-judges one event against the learner's recent rungs, then files whatever
 * doc 31 §4 says it earns.
 *
 * Returns the event to WRITE, so the caller stores the escalated rung rather
 * than the raw one: an S2 that became S3 has to reach the guardian feed as an
 * S3, and a row judged once at write time is the only version of that judgement
 * anybody ever sees. `safetyEvents` has no update path — a verdict that can be
 * edited is not a record — so the climb has to happen before the insert.
 */
export async function escalateAndFile(event: SafetyEvent): Promise<SafetyEvent> {
  if (event.tier === null) return event;

  const priors = await loadRecentRungs(event.learnerId, new Date(event.occurredAt));
  const tier = escalate(event.tier, priors, new Date(event.occurredAt));
  const judged = escalatedSafetyEvent(event, tier);

  if (!LADDER[tier].filesIncident) return judged;

  const report = incidentFromSafetyEvent(judged);
  if (report === null) return judged;

  await saveIncident(report);
  await fanOut(report);
  return judged;
}

/**
 * §4.3's fan-out, enqueued rather than delivered.
 *
 * "S3 → guardian in-app + email, org owner queue, 48h SLA; S4 → guardian
 * immediately, on-call human paged, 2h SLA." Both legs go on protected queues at
 * `PRIORITY.safety`, which `shedPlan` can never drop at any backlog depth — doc
 * 12 §7's "reminders before pay runs, NEVER safety alerts", enforced structurally
 * by `QueueSpec.shed: 'protected'` rather than remembered here.
 *
 * ENQUEUED, NOT SENT, and the difference is the whole reason a queue is involved:
 * a notification sent inline from a write path is a notification lost when that
 * path fails, with nothing to retry it. A row on `safety.alert.guardian` survives
 * the process, retries ten times on a fifteen-second ladder, and dead-letters
 * into a JOB-3 PAGE at depth one — because one dead-lettered safety job is one
 * guardian who was not told.
 *
 * Failure is reported and swallowed. The RECORD is the thing that must land;
 * `saveIncident` has already returned by the time this runs, and letting an
 * enqueue failure propagate would turn a filed incident into an error at a
 * parent who was filling in a form.
 */
export async function fanOut(report: IncidentReport): Promise<void> {
  const rung = LADDER[report.severity];
  if (!rung.filesIncident) return;

  const legs: Promise<string | null>[] = [];
  if (rung.notifiesGuardian && report.guardianVisible) {
    legs.push(enqueueIncidentFanOut('guardian', report.incidentId));
  }
  /*
    §4.3's page. It is gated on `pagesHuman` rather than on the severity literal
    so a rung that changes its paging policy changes this line with it — the
    ladder is the single place that decision is written down.
  */
  if (rung.pagesHuman) {
    legs.push(enqueueIncidentFanOut('review', report.incidentId));
  }

  const results = await Promise.allSettled(legs);
  for (const result of results) {
    if (result.status === 'rejected') {
      const error =
        result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      console.error('[safety] incident fan-out failed to enqueue', {
        incidentId: report.incidentId,
        severity: report.severity,
        message: error.message,
      });
      reportRouteError(error);
    }
  }
}
