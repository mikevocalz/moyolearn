// The runner — a BOUNDED DRAIN rather than a long-lived worker, and the reason
// is the one `docs/design/jobs.md` §8.2 refused to answer on the page:
//
//   "A worker process. `apps/web` is a Next.js deployment on Vercel; a pg-boss
//    worker is a long-lived process and Vercel functions are not."
//
// §8.2 listed three candidates — a separate always-on service, a container, or a
// scheduled invocation that drains a bounded batch — and said picking one
// without a hosting analysis would be inventing an answer. This is the third,
// and it is chosen because it is the only one that needs no new infrastructure
// and therefore no analysis to justify: it runs on the Vercel Cron that already
// exists, in the deployment that already exists, against the Postgres that
// already exists. If the load ever justifies an always-on worker, `boss.work()`
// replaces this file and nothing else changes — the handlers, the topology and
// the idempotency keys are all outside it.
//
// WHAT THE DRAIN GUARANTEES, stated plainly, because a bounded drain guarantees
// less than a worker and pretending otherwise is how a queue rots:
//   · a job survives the process — it is a row, committed before the drain ever
//     sees it, so a lambda that is frozen mid-handler loses nothing;
//   · a failed job is retried on the ladder its queue declares, on a LATER
//     drain, not inside this one;
//   · a job whose retries are exhausted is dead-lettered by pg-boss and alerted
//     on here (§4.2 JOB-3);
//   · latency is bounded by the drain's SCHEDULE, not by the queue. A queue
//     drained every 30 minutes has a 30-minute floor, which is inside slo.md
//     JOB-4's 5-minute budget for nothing — so any queue that needs JOB-4 needs
//     a worker first. Nothing live today does.
// SOT: docs/design/jobs.md §4 §5 §8.2 · docs/pack/12-systems-design-prompt.md §6 §7 · docs/design/slo.md §4.5
// SOT-KEYWORDS: jobs drain bounded worker fetch complete fail dead letter alerting shed backlog ops.shed handlers idempotent
import 'server-only';
import type { Job, PgBoss } from 'pg-boss';
import { getBoss, readDepths, stopBoss } from './boss.ts';
import { liveQueues, type LiveQueueName, type QueueName } from './topology.ts';
import type { JobPayload } from './keys.ts';
import { deadLetterAlerts, isShed, shedPlan, type DeadLetterAlert, type ShedPlan } from './shed.ts';

/**
 * What a handler is: a function of the job's ids that either completes or
 * throws.
 *
 * It returns `void`, deliberately. A handler that returned a result would invite
 * the result being stored in `jobs.job.output`, and §4.1's ids-only rule applies
 * to the output column exactly as it applies to the input one — a completed
 * `edu.distill` job whose output held the facts it derived is a copy of a child's
 * model in a table the erasure cascade cannot see.
 */
export type JobHandler<Q extends LiveQueueName> = (payload: JobPayload<Q>) => Promise<void>;

/**
 * Every live queue, handled.
 *
 * A TOTAL map, not a partial one. Promoting a queue from `'declared'` to
 * `'live'` in `topology.ts` makes this type require a handler, so the compiler —
 * not a reviewer — is what stops a queue being created in pg-boss with nothing
 * on the other end. That failure mode is silent by nature: jobs accumulate,
 * nothing errors, and the dashboard shows a queue with a healthy zero-failure
 * rate.
 */
export type JobHandlers = { readonly [Q in LiveQueueName]: JobHandler<Q> };

/**
 * Where a drain reports things a human has to know about.
 *
 * A port rather than a direct Sentry call: `docs/design/slo.md` §2 records that
 * the Sentry SDK is not wired in this repository, and a package that imported it
 * anyway would be a dependency on a decision nobody has made. The composition
 * root injects one; the default writes to `console.error`, which is what Vercel
 * turns into a log line.
 */
export interface JobsReporter {
  /** JOB-3. One on a safety queue is a page; ten elsewhere is a ticket. */
  deadLetter(alert: DeadLetterAlert): void;
  /**
   * JOB-7 — `ops.shed`. §5: "Shedding is a decision and it must be visible …
   * A queue that quietly sheds nightly reads on every dashboard as a queue that
   * is keeping up."
   */
  shed(plan: ShedPlan): void;
  /** A handler that threw. The job is failed and will retry or dead-letter. */
  jobFailed(queue: QueueName, jobId: string, error: Error): void;
  /**
   * §4.1's archival pass failed. Reported and not thrown: the drain exists to
   * run queued work, and a queue table that needs trimming is a slower problem
   * than a child's job that did not run.
   */
  maintenance(error: Error): void;
}

const consoleReporter: JobsReporter = {
  deadLetter: (alert) =>
    console.error(
      `[jobs] JOB-3 ${alert.severity.toUpperCase()} — ${alert.queue}.dlq holds ${alert.depth} job(s), threshold ${alert.threshold}`,
    ),
  shed: (plan) =>
    console.error(
      `[jobs] ops.shed — backlog ${plan.totalDepth}, shedding to order ${String(plan.depth)}: ${plan.shed.join(', ')}`,
    ),
  jobFailed: (queue, jobId, error) =>
    console.error(`[jobs] ${queue} job ${jobId} failed: ${error.message}`),
  maintenance: (error) => console.error(`[jobs] maintenance pass failed: ${error.message}`),
};

export interface DrainOptions {
  /**
   * Maximum jobs to run per queue in one drain.
   *
   * Bounded because the invocation is. A drain that fetched everything would be
   * a lambda that times out mid-batch and leaves its jobs in `active` until
   * `expireInSeconds` releases them — which looks like a hang, not a failure.
   */
  readonly batchSize?: number;
  readonly reporter?: JobsReporter;
  /**
   * Restricts the drain to these queues. The sweep cron doors pass their own
   * queue so the scheduled request that enqueued the sweep is also the one that
   * runs it — the daily guarantee stays inside the daily trigger, and the
   * general drain is the retry path rather than the only path.
   */
  readonly only?: readonly LiveQueueName[];
  /** Closes the pg-boss instance when the drain finishes. */
  readonly stopWhenDone?: boolean;
}

export interface QueueDrainResult {
  readonly queue: LiveQueueName;
  readonly fetched: number;
  readonly completed: number;
  readonly failed: number;
  /** True when §5 said not to fetch this queue at all. */
  readonly shed: boolean;
}

export interface DrainReport {
  readonly queues: readonly QueueDrainResult[];
  readonly plan: ShedPlan;
  readonly deadLetters: readonly DeadLetterAlert[];
}

const DEFAULT_BATCH_SIZE = 25;

/**
 * One queue's fetch-and-run, with its payload type already resolved.
 *
 * THE GENERIC IS THE WHOLE REASON THIS FUNCTION EXISTS. `JobHandlers` maps each
 * queue to a handler of ITS OWN payload, and TypeScript will not let a union of
 * handlers be called with a union of payloads — correctly, since nothing there
 * says the two unions are correlated. Binding the queue name to a type parameter
 * resolves `JobHandlers[Q]` to `JobHandler<Q>` and `Job<JobPayload<Q>>` to the
 * matching row shape at the point the pair is created, so the drain loop can
 * hold a list of these without a cast and without `any` — which CLAUDE.md bans
 * outright and which would, here, be banning exactly the mistake it prevents:
 * handing a `{ day }` payload to the distiller.
 */
function bindQueue<Q extends LiveQueueName>(
  handlers: JobHandlers,
  name: Q,
  reporter: JobsReporter,
): BoundQueue {
  return {
    name,
    run: async (boss, batchSize) => {
      const jobs: Job<JobPayload<Q>>[] = await boss.fetch<JobPayload<Q>>(name, { batchSize });
      let completed = 0;
      let failed = 0;

      for (const job of jobs) {
        try {
          await handlers[name](job.data);
          await boss.complete(name, job.id);
          completed += 1;
        } catch (error) {
          /*
            FAILED, not thrown onward. A drain that aborted on the first bad job
            would leave the rest of the batch in `active` with no handler
            running, and they would only come back when `expireInSeconds`
            released them — a fifteen-minute stall caused by an unrelated job.
            pg-boss owns what happens next: retry on the queue's ladder, or the
            dead-letter queue when the ladder runs out.
          */
          const failure = error instanceof Error ? error : new Error(String(error));
          reporter.jobFailed(name, job.id, failure);
          await boss.fail(name, job.id, { message: failure.message });
          failed += 1;
        }
      }

      return { queue: name, fetched: jobs.length, completed, failed, shed: false };
    },
  };
}

interface BoundQueue {
  readonly name: LiveQueueName;
  run(boss: PgBoss, batchSize: number): Promise<QueueDrainResult>;
}

/**
 * Runs one bounded pass over the live queues.
 *
 * Order is `liveQueues()`, which is sorted by priority DESCENDING — the same
 * order pg-boss itself drains in. Sorting there rather than here is what keeps
 * the fetch order and the shed order from disagreeing.
 *
 * SHED IS DECIDED ONCE, BEFORE ANY FETCH. Re-evaluating per queue would let the
 * plan change halfway through a pass, so a job could be run under one policy and
 * its sibling refused under another within the same second, and the `ops.shed`
 * event would describe a state that never fully existed.
 */
export async function drainQueues(
  handlers: JobHandlers,
  options: DrainOptions = {},
): Promise<DrainReport> {
  const reporter = options.reporter ?? consoleReporter;
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const boss = await getBoss();

  /*
    MAINTENANCE IS A CALL, NOT A CONSTRUCTOR FLAG.

    This used to be `getBoss({ supervise: true })`. `getBoss` memoises on the
    first call and returns the cached promise without looking at later options,
    and the one route that runs this — `api/retention/sweep/cron` — calls
    `enqueueSweep` first, in the same request. That call constructed the boss
    with `supervise: false`, so the drain's `true` was dropped on the floor and
    §4.1's archival pass never ran on the single path designed to run it. The
    symptom is `jobs.job` growing without bound and no error anywhere.

    A failed maintenance pass does NOT abort the drain: housekeeping is not the
    reason this function was invoked, and refusing to run a child's queued work
    because an archival statement failed is the wrong trade.
  */
  try {
    await boss.supervise();
  } catch (error) {
    reporter.maintenance(error instanceof Error ? error : new Error(String(error)));
  }

  try {
    const depths = await readDepths(boss);
    const plan = shedPlan(depths.queues);
    if (plan.triggered) reporter.shed(plan);

    /*
      JOB-3 is evaluated on EVERY drain, including one that runs no jobs.
      A dead letter is a job that has already stopped retrying, so nothing about
      this pass will change its depth — which means the only way it is ever
      noticed is a pass that looks at it whether or not it had work to do.
    */
    const alerts = deadLetterAlerts(depths.deadLetters);
    for (const alert of alerts) reporter.deadLetter(alert);

    const wanted = options.only ?? liveQueues();
    const results: QueueDrainResult[] = [];

    for (const name of liveQueues()) {
      if (!wanted.includes(name)) continue;

      if (isShed(plan, name)) {
        results.push({ queue: name, fetched: 0, completed: 0, failed: 0, shed: true });
        continue;
      }

      results.push(await bindQueue(handlers, name, reporter).run(boss, batchSize));
    }

    return { queues: results, plan, deadLetters: alerts };
  } finally {
    if (options.stopWhenDone === true) await stopBoss();
  }
}
