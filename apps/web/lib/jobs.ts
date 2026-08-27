// The job runner's composition root — where the five live queues meet the work
// they actually do.
//
// `@acme/jobs` holds the topology, the keys, the shed order and the drain, and
// deliberately holds no handler: a queue package that imported the retention
// sweep would import Bunny, Payload and the educational store, and the runner
// would then be the widest dependency in the repository rather than the
// narrowest. `JobHandlers` is a total map over `LiveQueueName`, so this file is
// what the compiler points at the day a fourth queue goes live.
//
// THE TWO SWEEPS ARE WRAPPED, NOT REIMPLEMENTED. `app/api/retention/sweep/route.ts`
// and `app/api/media/sweep/route.ts` already hold the whole sweep — the cascade
// driver, the two stores, the Bunny Stream half — behind a POST with a bearer
// secret, and `.../sweep/cron/route.ts` already calls that POST by constructing
// a request rather than duplicating it. The handlers below use the SAME door in
// the SAME way. There is one sweep implementation and there are now three
// callers of it (a human, the cron, a job), which is the arrangement the two
// cron doors were already written for.
// SOT: packages/jobs/index.ts · apps/web/app/api/retention/sweep/route.ts · apps/web/app/api/media/sweep/route.ts · docs/design/jobs.md §2.1 §7
// SOT-KEYWORDS: jobs composition root handlers retention sweep media sweep distill drain enqueue reporter dead letter shed ops.shed
import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { NextRequest } from 'next/server';
import {
  distillKey,
  drainQueues,
  enqueue,
  incidentFanOutKey,
  summaryKey,
  sweepKey,
  utcDay,
  type DrainOptions,
  type DrainReport,
  type JobHandlers,
  type JobsReporter,
  type LiveQueueName,
} from '@acme/jobs';
import { generateSessionSummary, markFannedOut, type NarrativeModel } from '@acme/app/server';
import { POST as retentionSweep } from '@/app/api/retention/sweep/route';
import { POST as mediaSweep } from '@/app/api/media/sweep/route';
import { distillTranscript } from './distill.service';
import { loadIncident, saveIncident } from './incident.repository';
import { loadEduPriorFacts, loadEduTurnsInWindow } from './edu.repository';
import { loadGradeBand } from './student-model.repository';
import {
  loadSessionForSummary,
  loadSummaryBySession,
  saveSummaryReport,
} from './summary.repository';
import { budgetedGateway } from './inference';
import { reportRouteError } from './report-error';

/**
 * The origin a wrapped sweep is called against.
 *
 * `NextRequest` needs an absolute URL and a job has no incoming request to take
 * one from. The value is otherwise unread — both sweeps authenticate on a header
 * and route on nothing — so this is the same fallback `payload.config.ts` uses
 * for `serverURL` rather than a second source for the same fact.
 */
function origin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
}

/**
 * Calls a sweep's POST the way its cron door already does.
 *
 * A non-2xx throws, and that is the whole point of running the sweep as a job:
 * today a failed retention cron is simply lost until tomorrow, which is a
 * twenty-four-hour hole in a published window on a child's data. Thrown here, it
 * fails the job, and pg-boss retries it on the queue's own ladder (3 attempts
 * from 5 minutes, exponential) before dead-lettering it into an alert.
 */
async function callSweep(
  path: string,
  secretName: 'RETENTION_SWEEP_SECRET' | 'MEDIA_SWEEP_SECRET',
  handler: (request: NextRequest) => Promise<Response>,
): Promise<void> {
  const secret = process.env[secretName];
  if (!secret) {
    // Loudly, for the reason the cron doors give: a sweep that returns 200
    // having done nothing is a retention promise that looks kept and is not.
    throw new Error(`${secretName} is not set — the sweep cannot run.`);
  }

  const response = await handler(
    new NextRequest(new URL(path, origin()), {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    }),
  );

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
}

/**
 * Every live queue, handled.
 *
 * The `day` on a sweep payload is not read. It is the `singletonKey`'s subject
 * and nothing else — `docs/design/jobs.md` §3: "The route reads `expiresAt <=
 * cutoff` and deletes exactly that set", so passing the cutoff INTO the sweep
 * would let a job that sat in the queue for an hour delete rows against an hour-
 * old clock, or a replayed job delete rows that were not expired when it was
 * enqueued. The sweep reads its own clock, once, and that stays true.
 */
export function jobHandlers(): JobHandlers {
  return {
    /*
      THE ONE FREE CRON MONITOR GUARDS THIS QUEUE — doc 35 §5: of every
      scheduled job, the one whose SILENT death is a compliance breach is
      erasure. A dead drain is loud (queues back up); a dead eraser is a
      retention promise that looks kept and is not. `withMonitor` files an
      in-progress check-in, then ok/error from the callback's outcome — real on
      the installed SDK: `withMonitor<T>(monitorSlug: CheckIn['monitorSlug'],
      callback: () => T, upsertMonitorConfig?)` (@sentry/core 10.71.0,
      build/types/exports.d.ts:151, re-exported by @sentry/nextjs). A no-op
      while the SDK is disabled (dev, no DSN), and the throw still propagates,
      so pg-boss's retry ladder is unchanged.
    */
    'retention.sweep.transcripts': async () => {
      await Sentry.withMonitor('retention-sweep', () =>
        callSweep('/api/retention/sweep', 'RETENTION_SWEEP_SECRET', retentionSweep),
      );
    },
    'retention.sweep.media': async () => {
      await callSweep('/api/media/sweep', 'MEDIA_SWEEP_SECRET', mediaSweep);
    },
    'edu.distill': async (payload) => {
      await distillTranscript(payload.transcriptId);
    },
    /*
      Doc 34 §4 — the report pipeline, shaped on `distillTranscript`'s rules:
      ids-only payload, identity read off the session row, every store re-read
      on every run so a dead-letter replay honours an erasure that happened
      after enqueue, and a missing session COMPLETES (the sweep may have taken
      it). The narrative call goes through `budgetedGateway()` — importing
      `./inference` above is also what installs the durable budget ledger in
      this lambda, the module's stated rule: any route that can reach a model
      must import it.
    */
    'summary.generate': async (payload) => {
      await generateSessionSummary(payload.sessionId, {
        loadSession: loadSessionForSummary,
        loadSummary: loadSummaryBySession,
        loadEvidenceTurns: loadEduTurnsInWindow,
        loadPriorFacts: loadEduPriorFacts,
        loadBand: loadGradeBand,
        narrativeModel: summaryNarrativeModel,
        saveSummary: saveSummaryReport,
      });
    },
    /*
      Doc 31 §4.3's two fan-out legs.

      BOTH ARE IDEMPOTENT ON A NATURAL KEY, which is what `docs/design/jobs.md`
      §3 requires beside the `singletonKey` and what these queues lacked for as
      long as they sat `declared`: `markFannedOut` returns the report UNCHANGED
      when the marker is already set, so a pg-boss retry, a dead-letter replay
      and a hand-run drain between them produce one notification and one timeline
      line. A guardian alert without that is a queue that tells a parent their
      child is in crisis twice.

      A MISSING ROW COMPLETES, it does not fail. §4.1's ids-only payload means a
      job outlives the record it names — the retention sweep may have taken it,
      and a handler that threw on absence would retry ten times and dead-letter
      into a JOB-3 page about a row that was correctly deleted.

      WHAT IS DELIBERATELY NOT HERE IS THE DELIVERY. `docs/design/jobs.md` §8.5
      records that there is no notification sender and no `notificationsSent`
      store in this repository, and inventing an email call here would be the
      same mistake the `notify.*` queues are still declared-only to avoid. What
      these handlers do is make the obligation DURABLE and VISIBLE: the marker
      and the timeline entry are what a guardian's screen and the §5.3 queue read,
      and they are what an auditor is shown. The channel is named in the timeline
      note so the day a sender lands, it lands in one place.
    */
    'safety.alert.guardian': async (payload) => {
      const report = await loadIncident(payload.incidentId);
      if (report === null) return;
      const notified = markFannedOut(report, 'guardian', 'in-app');
      if (notified !== report) await saveIncident(notified);
    },
    'safety.review.enqueue': async (payload) => {
      const report = await loadIncident(payload.incidentId);
      if (report === null) return;
      const paged = markFannedOut(report, 'review', 'on-call');
      if (paged !== report) await saveIncident(paged);
    },
  };
}

/**
 * Runs `capture` inside a scope tagged the way doc 35 §4.4 requires of every
 * worker event: `surface`/`runtime` mark it worker traffic (the free-tier
 * stand-in for the `moyo-server` project split, §3), `queue` and `jobId` say
 * which promise broke — and NOTHING else. `jobId` is a pg-boss uuid, ids-only
 * by construction; payload contents never reach a tag, a message, or a context,
 * and every tag used here is in §7.7's allowlist that
 * `tooling/check-sentry-invariants.mjs` enforces.
 */
function withWorkerScope(tags: { queue?: string; jobId?: string }, capture: () => void): void {
  Sentry.withScope((scope) => {
    scope.setTag('surface', 'worker');
    scope.setTag('runtime', 'worker');
    if (tags.queue !== undefined) scope.setTag('queue', tags.queue);
    if (tags.jobId !== undefined) scope.setTag('jobId', tags.jobId);
    capture();
  });
}

/**
 * Where the drain's alerts go.
 *
 * Every handler throw is captured HERE rather than inside each handler, because
 * this is the one place that also knows the `jobId` — the drain calls
 * `jobFailed(queue, jobId, error)` for every throw, so "wrap every pg-boss
 * handler" is a property of the drain's contract, not of six functions
 * remembering to. The ORIGINAL error object is captured (its message crosses
 * `sentry.server.config.ts`'s scrubber like everything else); JOB-3 and JOB-7
 * synthesize theirs from queue names and depths only.
 *
 * No learner id in any line. A queue name and a depth is what an operator needs;
 * a child's handle is not something an operations log needs to hold.
 */
const reporter: JobsReporter = {
  deadLetter: (alert) => {
    withWorkerScope({ queue: alert.queue }, () => {
      reportRouteError(
        new Error(
          `JOB-3 ${alert.severity} — ${alert.queue}.dlq depth ${alert.depth} (threshold ${alert.threshold})`,
        ),
      );
    });
  },
  shed: (plan) => {
    withWorkerScope({}, () => {
      reportRouteError(
        new Error(
          `ops.shed — backlog ${plan.totalDepth}, shed to order ${String(plan.depth)}: ${plan.shed.join(', ')}`,
        ),
      );
    });
  },
  jobFailed: (queue, jobId, error) => {
    withWorkerScope({ queue, jobId }, () => {
      reportRouteError(error);
    });
  },
};

/** One bounded pass, with this app's handlers and this app's reporter. */
export function drain(options: Omit<DrainOptions, 'reporter'> = {}): Promise<DrainReport> {
  return drainQueues(jobHandlers(), { ...options, reporter });
}

/**
 * The scheduled sweeps, enqueued for `now`'s UTC day.
 *
 * Returns `null` when the day's job is already queued or running — which is the
 * `singletonKey` doing its job, not a failure. A Vercel cron retry, a redeploy
 * that re-fires the schedule, and a human triggering the sweep by hand all land
 * on the same key and produce one sweep.
 */
export function enqueueSweep(
  queue: Extract<LiveQueueName, `retention.sweep.${string}`>,
  now: Date = new Date(),
): Promise<string | null> {
  const day = utcDay(now);
  const kind = queue === 'retention.sweep.transcripts' ? 'transcripts' : 'media';
  return enqueue(queue, { day }, sweepKey(kind, day));
}

/**
 * The distillation job for one transcript.
 *
 * Called from the tutoring write path immediately after the transcript row
 * lands, which is as close to doc 12 §6's transactional enqueue as this codebase
 * can currently get: `docs/design/jobs.md` §8.3 records that `protectedOperation`
 * hands an operation a `ctx` and not a transaction, so there is no handle to
 * pass to `enqueue`'s `db` seam yet. The window between the two writes is one
 * statement wide, and the failure it leaves — a transcript with no distillation
 * job — is recoverable by re-enqueueing on the same key, because the key is the
 * transcript id.
 */
export function enqueueDistillation(transcriptId: string): Promise<string | null> {
  return enqueue('edu.distill', { transcriptId }, distillKey(transcriptId));
}

/**
 * Doc 34 §4 step 2's one model call, composed here so the service stays
 * gateway-agnostic. `classify` is the classifier-tier door — the routing table
 * owns which model answers (`summary-narrative` → the small model), and a
 * feature never names one (CLAUDE.md §Children's surfaces: no model calls from
 * features; the gateway is the boundary).
 */
const summaryNarrativeModel: NarrativeModel = async (payload) => {
  const completion = await budgetedGateway().classify('summary-narrative', payload);
  return { text: completion.text, model: completion.outcome.servedBy };
};

/**
 * Doc 34 §4's producer: one report job per closed session, keyed on the
 * session. Called from the session-close route immediately after `closedAt`
 * lands — enqueue-after-write, the same ordering `enqueueDistillation`
 * documents. `null` is the singleton dedupe working, not a failure.
 */
export function enqueueSummary(sessionId: string): Promise<string | null> {
  return enqueue('summary.generate', { sessionId }, summaryKey(sessionId));
}

/**
 * One leg of doc 31 §4.3's incident fan-out.
 *
 * `priority` and `deadLetter` are NOT arguments — `enqueue` reads them off the
 * topology, where both legs sit at `PRIORITY.safety` with `shed: 'protected'`.
 * That is the whole mechanism behind doc 12 §7's "reminders before pay runs,
 * NEVER safety alerts": `shedPlan` walks `shedOrder()`, a protected queue is not
 * in that list at any depth, and there is no argument a caller could pass here
 * that would put one there.
 *
 * Returns `null` when the leg is already queued or running, which is the dedupe
 * working rather than a failure — see `enqueue`'s own comment. Callers that log
 * should say "already queued".
 */
export function enqueueIncidentFanOut(
  leg: 'guardian' | 'review',
  incidentId: string,
): Promise<string | null> {
  return enqueue(
    leg === 'guardian' ? 'safety.alert.guardian' : 'safety.review.enqueue',
    { incidentId },
    incidentFanOutKey(leg, incidentId),
  );
}
