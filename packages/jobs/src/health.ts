// The dead-man switch's brain — doc 35 §5: "the 1 uptime monitor polls
// `/api/health/jobs`, which returns 500 unless every critical queue's
// `last_success_at` is fresh (thresholds per queue). One monitor, entire fleet,
// zero events."
//
// PURE, like `shed.ts`, and for the same reason: "is the fleet alive" is a
// judgement that must be testable without a database or a clock, and the 500
// path in particular has to be provable in a test rather than by pausing a real
// queue. The half that reads timestamps off Postgres lives in the web app's
// `jobs-health.repository.ts` and hands its rows here.
//
// TWO DETECTORS, BECAUSE "FRESH LAST SUCCESS" IS ONLY HONEST FOR HALF THE
// FLEET. The sweeps run on a daily schedule, so silence longer than a day IS
// the failure — a dead eraser is silent, which is the whole reason doc 35 §5
// spends the free cron monitor on it too. But `edu.distill` or
// `safety.alert.guardian` may legitimately see no traffic for days, and
// "last success 3 days ago" on a queue nobody enqueued into is a healthy queue.
// For those, the honest dead-drain signal is AGE OF THE OLDEST READY JOB: work
// that is due and has sat unfetched past the drain cadence means nothing is
// draining, regardless of when something last succeeded. Scheduled queues get
// BOTH detectors; event-driven queues get the ready-age one.
// SOT: docs/pack/35-sentry-free-tier.md §5 · docs/design/jobs.md §2 §4.2
// SOT-KEYWORDS: jobs health dead man switch uptime monitor last success fresh threshold stale ready age evaluate 500
import { liveQueues, type LiveQueueName } from './topology.ts';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/**
 * How a queue's liveness is judged. A discriminated union rather than two
 * optional numbers, so "a scheduled queue with no cadence" cannot be written.
 */
export type QueueHealthRule =
  | {
      /** Runs on a wall-clock schedule; silence past the cadence is the failure. */
      readonly kind: 'scheduled';
      /** Max age of the last success. Cadence plus slack — daily jobs get 26h. */
      readonly maxSinceSuccessMs: number;
      /** Max age of a job sitting ready — the drain-is-dead detector. */
      readonly maxReadyAgeMs: number;
    }
  | {
      /** Enqueued by traffic; no traffic is healthy, unfetched due work is not. */
      readonly kind: 'event';
      readonly maxReadyAgeMs: number;
    };

/**
 * A TOTAL record over the live queues, exactly like `JobHandlers`: promoting a
 * queue to `'live'` in the topology makes the compiler demand a health rule
 * here, so a queue cannot go live unwatched by the dead-man switch.
 *
 * Ready-age budgets: the drain ticks every ~30 minutes (doc 35 §5's GH-Actions
 * floor is best-effort), so 2h of unfetched due work is several missed ticks,
 * not jitter. The safety pair gets 15 minutes — doc 12 §7's asymmetry: a
 * guardian alert sitting undrained is a parent not being told, and the page
 * should beat the retry ladder, not follow it.
 */
export const QUEUE_HEALTH_RULES = {
  'retention.sweep.transcripts': {
    kind: 'scheduled',
    maxSinceSuccessMs: 26 * HOUR_MS,
    maxReadyAgeMs: 2 * HOUR_MS,
  },
  'retention.sweep.media': {
    kind: 'scheduled',
    maxSinceSuccessMs: 26 * HOUR_MS,
    maxReadyAgeMs: 2 * HOUR_MS,
  },
  'edu.distill': { kind: 'event', maxReadyAgeMs: 2 * HOUR_MS },
  'summary.generate': { kind: 'event', maxReadyAgeMs: 2 * HOUR_MS },
  'safety.alert.guardian': { kind: 'event', maxReadyAgeMs: 15 * MINUTE_MS },
  'safety.review.enqueue': { kind: 'event', maxReadyAgeMs: 15 * MINUTE_MS },
} as const satisfies Record<LiveQueueName, QueueHealthRule>;

/** What the repository reads per live queue. Timestamps or null — never counts, never payloads. */
export interface QueueHealthSample {
  readonly queue: LiveQueueName;
  /** `max(completed_on)` over the queue's jobs. Null when none has ever completed. */
  readonly lastCompletedAt: Date | null;
  /** `min(created_on)` over jobs that are due and unfetched. Null when nothing waits. */
  readonly oldestReadyAt: Date | null;
}

export interface QueueHealth {
  readonly queue: LiveQueueName;
  readonly healthy: boolean;
  /** Machine-shaped, ids-only strings — safe for an unauthenticated health body. */
  readonly reasons: readonly string[];
}

export interface JobsHealthReport {
  /** False the moment ANY live queue is stale — the 500 in doc 35 §5. */
  readonly healthy: boolean;
  readonly queues: readonly QueueHealth[];
}

/**
 * Judges the fleet. FAIL-CLOSED on absence: a live queue the repository could
 * not produce a sample for is reported stale, because "no row" from a health
 * read is indistinguishable from "the thing that writes rows is dead" — and a
 * dead-man switch that shrugs at missing evidence is a dashboard ornament.
 *
 * `rules` is a parameter (defaulting to the committed table) so the 500 path is
 * proven in `health.test.ts` with a tightened threshold — never by pausing a
 * real queue, which doc 35 §7 row 11 suggests only for the live UI check.
 */
export function evaluateJobsHealth(
  samples: readonly QueueHealthSample[],
  now: Date,
  rules: Record<LiveQueueName, QueueHealthRule> = QUEUE_HEALTH_RULES,
): JobsHealthReport {
  const byQueue = new Map(samples.map((sample) => [sample.queue, sample]));

  const queues = liveQueues().map((queue): QueueHealth => {
    const rule = rules[queue];
    const sample = byQueue.get(queue);
    const reasons: string[] = [];

    if (sample === undefined) {
      reasons.push('no health sample');
    } else {
      if (rule.kind === 'scheduled') {
        if (sample.lastCompletedAt === null) {
          reasons.push('no recorded success');
        } else if (now.getTime() - sample.lastCompletedAt.getTime() > rule.maxSinceSuccessMs) {
          reasons.push(`last success ${sample.lastCompletedAt.toISOString()} is stale`);
        }
      }
      if (
        sample.oldestReadyAt !== null &&
        now.getTime() - sample.oldestReadyAt.getTime() > rule.maxReadyAgeMs
      ) {
        reasons.push(`ready work waiting since ${sample.oldestReadyAt.toISOString()}`);
      }
    }

    return { queue, healthy: reasons.length === 0, reasons };
  });

  return { healthy: queues.every((queue) => queue.healthy), queues };
}
