// Enqueue — the only way a job is created, and the only place a `singletonKey`
// is attached to one.
//
// `docs/design/jobs.md` §3 requires TWO mechanisms per queue and is explicit
// that they are not interchangeable: `singletonKey` prevents a double ENQUEUE,
// the handler's natural key makes a second EXECUTION a no-op. This file owns the
// first half and cannot be called without it — `key` is a required argument, not
// an option, because an optional idempotency key is one a caller forgets on the
// path that needed it most.
//
// The signature also enforces §4.1's ids-only rule by type. `JobPayloads` in
// `keys.ts` is a closed map of narrow record types with no field wide enough to
// hold a sentence, and `enqueue` is generic over `LiveQueueName` — so there is
// no call that puts a child's turns in `jobs.job.data`, and no call that
// enqueues a queue nothing can run.
// SOT: docs/design/jobs.md §3 §4.1 · packages/jobs/src/keys.ts · packages/jobs/src/topology.ts
// SOT-KEYWORDS: jobs enqueue send singleton key idempotency priority dead letter transactional enqueue ids only
import 'server-only';
import type { Db } from 'pg-boss';
import { getBoss } from './boss.ts';
import { QUEUES, deadLetterFor, type LiveQueueName } from './topology.ts';
import type { JobPayload } from './keys.ts';

export interface EnqueueOptions {
  /**
   * The transaction to enqueue INSIDE.
   *
   * Doc 12 §6's stated reason for choosing this runner is transactional enqueue:
   * "the domain write and the `boss.send` commit together or neither happens,
   * because they are the same Postgres transaction." pg-boss supports it by
   * running the insert through a caller-supplied handle, so the seam is here.
   *
   * NOTHING PASSES IT TODAY, and `docs/design/jobs.md` §8.3 says why:
   * `protectedOperation` hands an operation a `ctx`, not a transaction, so there
   * is no transaction in scope at the point a domain write happens. The argument
   * exists so that closing §8.3 is a change at the call sites rather than a
   * change to this file — and so that the gap is visible in the type instead of
   * only in a document.
   */
  readonly db?: Db;
  /**
   * Delays the job. Used by nothing yet; `notify.reminder.session` will need it,
   * because doc 07 forbids a late-night push to a minor and the reminder
   * therefore schedules into the learner's waking hours rather than at
   * `startAt − 30m` whatever the clock says.
   */
  readonly startAfter?: Date;
}

/**
 * Enqueues one job. Returns the job id, or `null` when the `singletonKey`
 * already had a job queued or active — which is a SUCCESS, not a failure.
 *
 * The null is the dedupe working. A cron that fires twice, a Vercel retry, a
 * human triggering a sweep that is already running: all three land here and the
 * second one is refused by `jobs.job_i2`, in the database, rather than by a
 * check someone remembered to write. Callers that log should say "already
 * queued", not "failed".
 *
 * `priority` and `deadLetter` are read off the topology rather than passed in.
 * A caller that could choose its own priority is a caller that can put a
 * reminder above a safety alert, and §5's ladder would then be advisory.
 */
export async function enqueue<Q extends LiveQueueName>(
  queue: Q,
  payload: JobPayload<Q>,
  key: string,
  options: EnqueueOptions = {},
): Promise<string | null> {
  const boss = await getBoss({ db: options.db });
  return boss.send(queue, payload, {
    priority: QUEUES[queue].priority,
    singletonKey: key,
    deadLetter: deadLetterFor(queue),
    db: options.db,
    startAfter: options.startAfter,
  });
}
