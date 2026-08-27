// Backlog policy — `docs/design/jobs.md` §4.2, §5 and §6, as decisions a program
// makes rather than paragraphs a person remembers.
//
// EVERY FUNCTION HERE IS PURE, and that is the point of the file existing
// separately from `drain.ts`. The shed order is the one rule in this package
// where being wrong is not an outage but a child not being told something — doc
// 12 §7's "reminders before pay runs, NEVER safety alerts" — so it is decided by
// code that needs no database, no clock and no boss instance to test. The half
// that reads depths off Postgres lives in `boss.ts` and hands its numbers here.
//
// The protected set is not a list in this file. It is `QueueSpec.shed ===
// 'protected'` in `topology.ts`, read through `shedOrder()`, so a queue can only
// become sheddable by someone editing the topology row that also carries its
// priority and its retry ladder. There is deliberately no way to shed a queue
// from here that the topology says is protected.
// SOT: docs/design/jobs.md §4.2 §5 §6 · docs/pack/12-systems-design-prompt.md §6 §7 · docs/design/slo.md §4.5 §5
// SOT-KEYWORDS: jobs shed order backlog depth dead letter alert threshold page ticket revisit trigger throughput queue latency slo
import {
  QUEUES,
  deadLetterAlertThreshold,
  shedOrder,
  type QueueName,
  type ShedOrder,
} from './topology.ts';

/**
 * Ready depth per queue. Partial because a queue that has never been created has
 * no row to read a depth from, and treating that as `0` is correct — an absent
 * queue has no backlog.
 */
export type QueueDepths = Partial<Record<QueueName, number>>;

/**
 * The depth at which shedding starts.
 *
 * `docs/design/jobs.md` §6 is explicit that the REVISIT trigger is not a depth
 * threshold — "a deep queue draining fast is healthy" — and this number is not
 * that trigger. It is the point past which a bounded drain cannot clear the
 * backlog in one window, which is a different question with a different answer:
 * §6.1 models the design load at 0.6 jobs/s peak, so five thousand ready jobs is
 * roughly two hours of arrivals with nothing leaving. A queue in that state is
 * not busy, it is stuck, and §5 says what to drop first when it is.
 */
export const BACKLOG_SHED_DEPTH = 5_000;

export interface ShedPlan {
  /** Whether the backlog is deep enough for §5 to apply at all. */
  readonly triggered: boolean;
  readonly totalDepth: number;
  /**
   * The queues to stop fetching, in the order §5 drops them. Empty when
   * `triggered` is false, and NEVER contains a `'protected'` queue at any depth.
   */
  readonly shed: readonly QueueName[];
  /**
   * The band the plan stopped at — `null` when nothing is shed. Reported so the
   * `ops.shed` event can say how far down §5 the system had to go, which is the
   * difference between "reminders are late" and "money is late".
   */
  readonly depth: ShedOrder | null;
}

/**
 * §5, applied to a set of depths.
 *
 * Bands are dropped whole rather than queue by queue. Shedding
 * `notify.reminder.trial` while still draining `notify.reminder.session` would
 * be a policy nobody wrote and nobody could explain to a family; §5's table is
 * three rows, so this is three steps.
 *
 * It stops as soon as the remaining depth is under the threshold, which is why
 * pay runs are only shed when dropping every reminder and every derived job did
 * not do it. Money being late is the third answer, not a simultaneous one.
 */
export function shedPlan(depths: QueueDepths, threshold: number = BACKLOG_SHED_DEPTH): ShedPlan {
  const depthOf = (name: QueueName): number => depths[name] ?? 0;
  const totalDepth = (Object.keys(QUEUES) as QueueName[]).reduce(
    (sum, name) => sum + depthOf(name),
    0,
  );

  if (totalDepth <= threshold) {
    return { triggered: false, totalDepth, shed: [], depth: null };
  }

  const shed: QueueName[] = [];
  let remaining = totalDepth;
  let reached: ShedOrder | null = null;

  /*
    `shedOrder()` has already removed every protected queue and sorted the rest
    1 → 2 → 3. Walking its output rather than re-deriving the order here is what
    makes "never safety alerts" structural: there is no branch in this loop that
    could include one, because one is not in the list.
  */
  for (const name of shedOrder()) {
    if (remaining <= threshold) break;
    shed.push(name);
    remaining -= depthOf(name);
    const band = QUEUES[name].shed;
    if (band !== 'protected') reached = band;
  }

  return { triggered: true, totalDepth, shed, depth: reached };
}

/** True when `name` must not be fetched under `plan`. */
export function isShed(plan: ShedPlan, name: QueueName): boolean {
  return plan.shed.includes(name);
}

/**
 * JOB-3's two severities. `docs/design/slo.md` §4.5: a page wakes someone up, a
 * ticket does not, and the asymmetry between them is the whole rule.
 */
export type AlertSeverity = 'page' | 'ticket';

export interface DeadLetterAlert {
  readonly queue: QueueName;
  readonly depth: number;
  readonly threshold: number;
  readonly severity: AlertSeverity;
}

/**
 * JOB-3 — dead-letter depth, evaluated per queue.
 *
 * "One dead-lettered `safety.alert.guardian` job is one guardian who was not
 * told, and that pages at any hour. Ten dead-lettered reminders is a ticket."
 * The threshold comes from `deadLetterAlertThreshold`, which reads the queue's
 * BAND rather than its name — so a queue that moves band moves severity with it
 * and this function never needs editing.
 */
export function deadLetterAlerts(depths: QueueDepths): DeadLetterAlert[] {
  const alerts: DeadLetterAlert[] = [];
  for (const name of Object.keys(QUEUES) as QueueName[]) {
    const depth = depths[name] ?? 0;
    const threshold = deadLetterAlertThreshold(name);
    if (depth < threshold) continue;
    alerts.push({
      queue: name,
      depth,
      threshold,
      severity: QUEUES[name].band === 'safety' ? 'page' : 'ticket',
    });
  }
  return alerts;
}

/**
 * §6, the revisit trigger: "sustained > ~50 jobs/s" or a queue-latency SLO
 * breach → move the hottest single queue to dedicated infra.
 */
export const REVISIT_JOBS_PER_SECOND = 50;

/** §6: > 50/s has to hold for an hour before it counts. A spike is not a trend. */
export const REVISIT_SUSTAINED_MINUTES = 60;

/** slo.md JOB-4: enqueue → first-attempt start, p95, on a normal-priority queue. */
export const QUEUE_LATENCY_SLO_SECONDS = 300;

export interface RevisitSignal {
  /** Jobs completed per second across all queues, 15-minute rolling (§6). */
  readonly jobsPerSecond: number;
  /** How long that rate has held. */
  readonly sustainedMinutes: number;
  /** p95 enqueue → first-attempt start, in seconds, on the worst normal-priority queue. */
  readonly p95LatencySeconds: number;
}

/**
 * Whether §6 says to open the ADR.
 *
 * Two signals, either one sufficient, because they fail in different directions:
 * throughput says the runner is at its ceiling, latency says a family is
 * experiencing the ceiling. §6 is explicit that latency "is the number a family
 * experiences", so it is not gated on the sustained window — a queue that is
 * five minutes behind is five minutes behind whether or not it has been for an
 * hour.
 */
export function revisitTriggered(signal: RevisitSignal): boolean {
  const hot =
    signal.jobsPerSecond > REVISIT_JOBS_PER_SECOND &&
    signal.sustainedMinutes >= REVISIT_SUSTAINED_MINUTES;
  return hot || signal.p95LatencySeconds > QUEUE_LATENCY_SLO_SECONDS;
}
