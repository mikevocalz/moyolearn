// The dead-man switch's eyes — the repository that reads pg-boss's own tables
// so `evaluateJobsHealth` (pure, in `@acme/jobs`) can judge the fleet.
//
// A REPOSITORY, because doc 12 §3's store separation applies to the jobs store
// exactly as it does to `edu`: only a `*.repository.ts` file talks to a
// database, and this one follows `edu.client.ts`'s connection posture — the
// pool is `payload.db.pool`, never a second pool against the same Postgres,
// because Supabase's connection ceiling is the resource that runs out first.
//
// WHY RAW SQL AND NOT pg-boss. The runner reads queue COUNTS through
// `boss.getQueues()`, but health needs two timestamps pg-boss's API does not
// surface: the newest `completed_on` and the oldest due-and-unfetched
// `created_on`. `jobs.job` is `PARTITION BY LIST (name)`
// (`packages/payload/migrations/jobs_schema.sql`, pg-boss 12.28.0 schema v38),
// so one aggregate over the parent covers every queue's partition. Read-only,
// ids and timestamps only — the `data` column is never selected, so a health
// probe cannot become a payload leak.
// SOT: docs/pack/35-sentry-free-tier.md §5 · packages/jobs/src/health.ts · packages/payload/migrations/jobs_schema.sql
// SOT-KEYWORDS: jobs health repository dead man last success oldest ready pg-boss partition timestamps read only
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import { liveQueues, type LiveQueueName, type QueueHealthSample } from '@acme/jobs';

interface HealthRow {
  name: LiveQueueName;
  last_completed_at: Date | null;
  oldest_ready_at: Date | null;
}

/**
 * One sample per live queue, always — a queue with no rows yet (fresh install,
 * queue never created) still gets a `{null, null}` sample rather than being
 * absent, so the evaluator judges it by ITS rule instead of failing closed on
 * "no sample" for a queue that has honestly never had work.
 *
 * `state < 'active'` leans on the `job_state` enum's declared order
 * (created < retry < active < …), the same comparison pg-boss's own fetch and
 * deletion plans use; `start_after <= now()` excludes a retry that is not due
 * yet, and `NOT blocked` excludes dependency-held jobs — neither is a drain
 * failure.
 */
export async function readQueueHealthSamples(): Promise<QueueHealthSample[]> {
  const names = liveQueues();
  const payload = await getPayload({ config });

  const result = await payload.db.pool.query<HealthRow>(
    `SELECT name,
            max(completed_on) FILTER (WHERE state = 'completed')      AS last_completed_at,
            min(created_on)   FILTER (WHERE state < 'active'
                                        AND start_after <= now()
                                        AND NOT blocked)              AS oldest_ready_at
       FROM jobs.job
      WHERE name = ANY($1::text[])
      GROUP BY name`,
    [names],
  );

  const byName = new Map(result.rows.map((row) => [row.name, row]));

  return names.map((queue) => {
    const row = byName.get(queue);
    return {
      queue,
      lastCompletedAt: row?.last_completed_at ?? null,
      oldestReadyAt: row?.oldest_ready_at ?? null,
    };
  });
}
