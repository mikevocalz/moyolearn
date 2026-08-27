// The pg-boss instance, its lifecycle, and the only place queues are created.
//
// Doc 12 §6 binds the runner to pg-boss on the SAME Postgres, in the `jobs`
// schema. Two decisions in this file are the ones worth reading:
//
// 1. `migrate: false, createSchema: false`. pg-boss will happily create and
//    migrate its own schema on `start()`. `apps/web` is a Next.js deployment on
//    Vercel, so `start()` runs inside a request-scoped function — that is a cold
//    start racing DDL against the request that woke it, on the database a child
//    is being tutored through. The schema is installed out of band by
//    `pnpm jobs:install` and recorded in `packages/payload/migrations/jobs_schema.sql`.
//    A lambda that CANNOT alter a schema is better than one trusted not to.
//
// 2. ONLY LIVE QUEUES ARE CREATED. `docs/design/jobs.md` §2 declares fourteen;
//    three have a producer and a handler in this repository. Creating the other
//    eleven would put eleven permanently empty rows on every queue dashboard,
//    and an empty queue with no worker reads exactly like a healthy one. The
//    topology keeps them visible in code (`declaredQueues()`); the database only
//    learns about a queue when something can actually run it.
// SOT: docs/design/jobs.md §1 §2 §4 · docs/pack/12-systems-design-prompt.md §6 · packages/payload/migrations/jobs_schema.sql
// SOT-KEYWORDS: pg-boss boss instance jobs schema migrate false create schema queue creation dead letter retention depth supervise pool
import 'server-only';
import { PgBoss, type Db, type QueueResult } from 'pg-boss';
import {
  DEAD_LETTER_RETENTION_DAYS,
  QUEUES,
  deadLetterFor,
  liveQueues,
  type LiveQueueName,
  type QueueName,
} from './topology.ts';
import type { QueueDepths } from './shed.ts';

/** Doc 12 §3's three-store separation, applied to the queue. */
export const JOBS_SCHEMA = 'jobs';

const SECONDS_PER_DAY = 86_400;

export interface BossOptions {
  /**
   * An existing database handle to run every statement through.
   *
   * The seam exists so a composition root that already holds a pool can hand it
   * over rather than opening a second connection budget against the same
   * Postgres — doc 12 §8's first trade-off is one Postgres, and Supabase's
   * connection ceiling is the resource that runs out first at the §7 load. When
   * omitted, pg-boss opens its own small pool (see `MAX_CONNECTIONS`).
   */
  readonly db?: Db;
}

/*
  THERE IS NO `supervise` OPTION HERE, and its absence is the fix rather than an
  omission.

  `docs/design/jobs.md` §4.1's archival pass must run on the bounded drain and
  nowhere else — most instances of this process are enqueuing from inside a
  learner's request and have no business running housekeeping on the way past.
  That was expressed as a constructor flag the drain passed, which `getBoss`
  silently dropped whenever it had already been memoised: `api/retention/sweep/
  cron` enqueues and then drains in ONE request, so the enqueue built the boss
  without maintenance and the drain inherited it. Archival never ran on the one
  path built to run it, with no error to notice.

  `drainQueues` calls `boss.supervise()` directly instead. A call cannot be
  dropped by a memo.
*/

/**
 * pg-boss's own pool, when one is not injected.
 *
 * Two, against the `max: 8` `packages/payload/src/payload.config.ts` caps the
 * app at. `docs/design/jobs.md` §6 names "job workers holding > 25 % of the
 * pool" as the saturation signal that means tune concurrency first — so the
 * default is set AT that line rather than above it, and a drain that needs more
 * is a decision somebody makes by injecting `db`.
 */
const MAX_CONNECTIONS = 2;

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    /*
      Thrown, not defaulted. A queue that silently points at nothing accepts
      `send` calls that go nowhere, and the failure surfaces days later as work
      that never happened rather than now as a deployment that will not start.
    */
    throw new Error('DATABASE_URL is not set — the job runner has no database.');
  }
  return url;
}

let started: Promise<PgBoss> | undefined;

/**
 * The started boss, one per process.
 *
 * Memoised on the PROMISE rather than on the resolved instance, so two
 * concurrent callers in the same lambda share one `start()` instead of racing
 * two. A failed start clears the slot: caching a rejection would make one bad
 * cold start permanent for the life of the instance.
 */
export function getBoss(options: BossOptions = {}): Promise<PgBoss> {
  if (started !== undefined) return started;

  const url = connectionString();
  const boss = new PgBoss({
    connectionString: url,
    schema: JOBS_SCHEMA,
    db: options.db,
    max: MAX_CONNECTIONS,
    ssl: url.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
    // See the file header. Both false, always, in every runtime.
    migrate: false,
    createSchema: false,
    // Never on construction — see the note above `BossOptions`.
    supervise: false,
    /*
      pg-boss's own cron scheduler is off. The schedule this product runs on is
      Vercel Cron (`apps/web/vercel.json`), which is the trigger that already
      exists and already alerts; a second scheduler living inside a function that
      is not always running would fire whenever a lambda happened to be warm.
    */
    schedule: false,
  });

  started = boss
    .start()
    .then(async (instance) => {
      await ensureLiveQueues(instance);
      return instance;
    })
    .catch((error: Error) => {
      started = undefined;
      throw error;
    });

  return started;
}

/** Stops the shared instance and forgets it. Called at the end of a bounded drain. */
export async function stopBoss(): Promise<void> {
  if (started === undefined) return;
  const pending = started;
  started = undefined;
  const boss = await pending;
  await boss.stop({ graceful: true, close: true });
}

/**
 * Creates the live queues and their dead-letter queues, idempotently.
 *
 * `createQueue` is an `ON CONFLICT DO NOTHING` insert into `jobs.queue`, so this
 * is safe to run on every cold start and is NOT a migration — no DDL is issued
 * because every queue here is `partition: false` and therefore lands in the
 * shared `jobs.job_common` table.
 *
 * ORDER MATTERS. `jobs.queue.dead_letter` is a foreign key onto `jobs.queue`, so
 * the DLQ has to exist before the queue that names it.
 */
export async function ensureLiveQueues(boss: PgBoss): Promise<readonly LiveQueueName[]> {
  const names = liveQueues();
  const existing = new Map(
    (await boss.getQueues([...managedQueueNames()])).map((queue) => [queue.name, queue]),
  );

  for (const name of names) {
    const spec = QUEUES[name];
    const dlq = deadLetterFor(name);
    const expireInSeconds = expireSecondsFor(name);

    /*
      A QUEUE'S POLICY IS FIXED AT CREATION, and pg-boss's `updateQueue` cannot
      change it — the policy selects which partial unique index the queue's rows
      are deduped by, and rewriting that under live jobs is not an update. So a
      topology whose policy has drifted from the database's is a deployment
      error, raised here, rather than a queue that silently stops deduping.

      This check is not hypothetical. The first version of this file created the
      queues with `singleton`, whose index is `WHERE state = 'active'` — meaning
      a second job with the same key was accepted while the first was merely
      QUEUED. `docs/design/jobs.md` §3 asks for "queued OR active", which is
      `exclusive` (`WHERE state <= 'active'`), and the difference is a retention
      sweep running twice.
    */
    const live = existing.get(name);
    if (live !== undefined && live.policy !== QUEUE_POLICY) {
      throw new Error(
        `jobs.queue '${name}' has policy '${String(live.policy)}', topology requires '${QUEUE_POLICY}'. ` +
          'Drain the queue and recreate it — a policy cannot be updated in place.',
      );
    }

    /*
      The DLQ takes no retries and no dead letter of its own. `docs/design/jobs.md`
      §4.1: "Replay: manual, by a human, per job." A dead-letter queue that
      retried would re-run the failure that filled it, and one with its own DLQ
      would make "which promise is broken" a chain rather than a glance.
    */
    await boss.createQueue(dlq, {
      retryLimit: 0,
      retentionSeconds: DEAD_LETTER_RETENTION_DAYS * SECONDS_PER_DAY,
      deleteAfterSeconds: DEAD_LETTER_RETENTION_DAYS * SECONDS_PER_DAY,
    });

    await boss.createQueue(name, {
      policy: QUEUE_POLICY,
      retryLimit: spec.retryLimit,
      retryDelay: spec.retryDelay,
      /*
        Exponential, on every queue, and §2 says why it is not a per-queue field:
        "a fixed retry delay against a provider that is down is a thundering
        herd, and there is no queue here for which that would be the right
        choice."
      */
      retryBackoff: true,
      deadLetter: dlq,
      expireInSeconds,
    });

    /*
      `createQueue` is `ON CONFLICT DO NOTHING`, so it is the creation path and
      NOT the update path — a retry ladder edited in `topology.ts` would never
      reach a database that already had the queue. `updateQueue` is what makes
      the topology the source of truth on every cold start rather than only on
      the first one.
    */
    if (live !== undefined) {
      await boss.updateQueue(name, {
        retryLimit: spec.retryLimit,
        retryDelay: spec.retryDelay,
        retryBackoff: true,
        deadLetter: dlq,
        expireInSeconds,
      });
    }
  }

  return names;
}

/**
 * `exclusive`, on every live queue.
 *
 * `docs/design/jobs.md` §3: "at most one job with that key may be queued or
 * active at a time". In pg-boss 12 that sentence names exactly one policy —
 * `exclusive`, whose unique index is `(name, singleton_key) WHERE state <=
 * 'active'`. The neighbouring policies each drop half of it: `short` only covers
 * `created`, so a second sweep is accepted the moment the first starts running,
 * and `singleton` only covers `active`, so two are accepted while both are still
 * queued.
 */
export const QUEUE_POLICY = 'exclusive';

/**
 * The retention sweeps run multi-statement deletes over a month of rows across
 * two stores, and pg-boss's default 900 s would mark a slow-but-healthy sweep
 * expired and start a second one on top of it. Doubled for those two, left at
 * the default everywhere else.
 */
function expireSecondsFor(name: LiveQueueName): number {
  return QUEUES[name].band === 'retention' ? 1_800 : 900;
}

/**
 * Ready depth per live queue and per dead-letter queue.
 *
 * `readyCount`, not `queuedCount`: pg-boss counts deferred (future-dated) jobs
 * in `queuedCount`, and a queue holding a thousand jobs scheduled for tomorrow
 * is not behind. Shedding on that number would drop reminders because reminders
 * exist.
 */
export interface Depths {
  readonly queues: QueueDepths;
  readonly deadLetters: QueueDepths;
}

export async function readDepths(boss: PgBoss): Promise<Depths> {
  const names = liveQueues();
  const wanted = [...names, ...names.map((name) => deadLetterFor(name))];
  const results: QueueResult[] = await boss.getQueues(wanted);

  const byName = new Map(results.map((result) => [result.name, result.readyCount]));

  /*
    Keyed by the LIVE queue's name on both sides. A `DeadLetterAlert` that named
    `edu.distill.dlq` would not match anything in the topology, and
    `deadLetterAlertThreshold` reads the band off the queue — so the dead-letter
    depth is filed under the promise it belongs to, not under the table it sits
    in.
  */
  const queues: QueueDepths = {};
  const deadLetters: QueueDepths = {};

  for (const name of names) {
    queues[name] = byName.get(name) ?? 0;
    deadLetters[name] = byName.get(deadLetterFor(name)) ?? 0;
  }

  return { queues, deadLetters };
}

/** Every name this process will create in pg-boss, live queues and their DLQs. */
export function managedQueueNames(): readonly string[] {
  const names: QueueName[] = [...liveQueues()];
  return [...names, ...names.map((name) => deadLetterFor(name))];
}
