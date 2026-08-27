// The job runner's composition root — where the three live queues meet the work
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
import { NextRequest } from 'next/server';
import {
  distillKey,
  drainQueues,
  enqueue,
  sweepKey,
  utcDay,
  type DrainOptions,
  type DrainReport,
  type JobHandlers,
  type JobsReporter,
  type LiveQueueName,
} from '@acme/jobs';
import { POST as retentionSweep } from '@/app/api/retention/sweep/route';
import { POST as mediaSweep } from '@/app/api/media/sweep/route';
import { distillTranscript } from './distill.service';
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
    'retention.sweep.transcripts': async () => {
      await callSweep('/api/retention/sweep', 'RETENTION_SWEEP_SECRET', retentionSweep);
    },
    'retention.sweep.media': async () => {
      await callSweep('/api/media/sweep', 'MEDIA_SWEEP_SECRET', mediaSweep);
    },
    'edu.distill': async (payload) => {
      await distillTranscript(payload.transcriptId);
    },
  };
}

/**
 * Where the drain's alerts go.
 *
 * `reportRouteError` is the reporter every route in this app already uses, so a
 * dead-letter page and a 500 land in the same place rather than in two. When the
 * Sentry SDK lands (`docs/design/slo.md` §2 records that it has not), JOB-3 and
 * JOB-7 become alert rules over these same events without this file changing.
 *
 * No learner id in any line. A queue name and a depth is what an operator needs;
 * a child's handle is not something an operations log needs to hold.
 */
const reporter: JobsReporter = {
  deadLetter: (alert) => {
    reportRouteError(
      new Error(
        `JOB-3 ${alert.severity} — ${alert.queue}.dlq depth ${alert.depth} (threshold ${alert.threshold})`,
      ),
    );
  },
  shed: (plan) => {
    reportRouteError(
      new Error(
        `ops.shed — backlog ${plan.totalDepth}, shed to order ${String(plan.depth)}: ${plan.shed.join(', ')}`,
      ),
    );
  },
  jobFailed: (queue, jobId, error) => {
    reportRouteError(new Error(`${queue} job ${jobId} failed: ${error.message}`));
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
