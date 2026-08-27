// The queue topology — every queue doc 12 §6 and `docs/design/jobs.md` name, as
// data rather than as a document.
//
// `docs/design/jobs.md` §2 is a table of fourteen queues on a five-band priority
// ladder, with per-queue retry policy and a §5 shed order. Until now that table
// existed only in Markdown, which meant "the priority ladder" was a thing a
// reader could check and a program could not. This file is the same table with
// `as const satisfies`, so the names, the bands and the shed order are derived
// types — CLAUDE.md §Types: derived, never hand-written.
//
// THE `status` FIELD IS THE POINT OF THIS FILE. Doc 12 §6 asks for fourteen
// queues; three of them have real work today. Declaring the other eleven with
// `status: 'declared'` and refusing to register a worker for them is what keeps
// the topology honest in both directions: a reader can see the whole ladder, and
// nothing pretends `payroll.transfer.send` is running when Stripe Connect does
// not exist in this repository. `liveQueues()` is what `boss.ts` iterates.
// SOT: docs/design/jobs.md §2 §3 §4 §5 · docs/pack/12-systems-design-prompt.md §6 §7
// SOT-KEYWORDS: jobs topology queues priority ladder retry dead letter dlq shed order backlog live declared pg-boss

/**
 * The five bands, named. Doc 12 §6's coarse ladder — "five bands, not fifteen —
 * because a priority number nobody can justify is a number that drifts."
 *
 * pg-boss orders by `priority` DESCENDING, then by creation time.
 */
export const PRIORITY = {
  /** Doc 07 §3 layer 6. There is no load level at which a guardian is not told. */
  safety: 100,
  /** A stranded webhook leaves a paid subscription in `pending` and guards flipped wrong. */
  webhook: 80,
  /** Money. Late is bad and recoverable; wrong is neither. */
  payroll: 60,
  /** A published window on a child's data. Deferring it is not a delay, it is a breach. */
  retention: 50,
  /** Derived work the learner is not waiting for. */
  derived: 40,
  /** Cosmetic renders. */
  render: 30,
  /** Housekeeping. */
  cleanup: 20,
  /** A late reminder is an annoyance. */
  notify: 10,
} as const satisfies Record<string, number>;

export type PriorityBand = keyof typeof PRIORITY;

/**
 * Doc 12 §7's shed order, as an ordinal.
 *
 * `1 | 2 | 3` is the order things are dropped under backlog; `'protected'` is a
 * queue that is never shed at any load. Modelled as a union rather than as a
 * number with 0 meaning "never", because "shed order 0" is a value somebody
 * sorts by mistake and a guardian goes untold.
 */
export type ShedOrder = 1 | 2 | 3 | 'protected';

/**
 * Whether a queue has a producer AND a handler in this repository.
 *
 * `'live'` means both exist and `registerWorkers` will run it. `'declared'`
 * means the queue is part of the committed topology and is deliberately NOT
 * registered — usually because the domain it serves does not exist yet. A
 * declared queue is never created in pg-boss either: an empty queue with no
 * worker reads on every dashboard exactly like a healthy one.
 */
export type QueueStatus = 'live' | 'declared';

export interface QueueSpec {
  readonly priority: number;
  readonly band: PriorityBand;
  /** `retryLimit` on the pg-boss queue. */
  readonly retryLimit: number;
  /** `retryDelay` in seconds — the FIRST delay; backoff doubles from there. */
  readonly retryDelay: number;
  readonly shed: ShedOrder;
  readonly status: QueueStatus;
  /** Why it is declared-only. `null` for a live queue. */
  readonly blockedOn: string | null;
}

/**
 * The topology.
 *
 * Retry ladders are `docs/design/jobs.md` §2's, unchanged. `retryBackoff` is on
 * for every queue and is not a field: a fixed retry delay against a provider
 * that is down is a thundering herd, and there is no queue here for which that
 * would be the right choice.
 */
export const QUEUES = {
  'safety.alert.guardian': {
    priority: PRIORITY.safety,
    band: 'safety',
    retryLimit: 10,
    retryDelay: 15,
    shed: 'protected',
    status: 'declared',
    // jobs.md §3.1: `safetyEvents` does not exist, so the queue has a
    // `singletonKey` and no natural key behind it. Registering a worker that
    // delivers guardian alerts with no durable dedupe, and no delivery path in
    // `packages/safety/src/crisis.ts` besides, would be worse than not having
    // the queue: it would make the alert look shipped.
    blockedOn: 'safetyEvents collection + a delivery path (jobs.md §8.4)',
  },
  'safety.review.enqueue': {
    priority: PRIORITY.safety,
    band: 'safety',
    retryLimit: 10,
    retryDelay: 15,
    shed: 'protected',
    status: 'declared',
    blockedOn: 'safetyEvents collection + a human review surface (jobs.md §8.4)',
  },
  'billing.webhook.replay': {
    priority: PRIORITY.webhook,
    band: 'webhook',
    retryLimit: 8,
    retryDelay: 30,
    shed: 'protected',
    status: 'declared',
    // The first attempt stays synchronous inside the Better Auth Stripe plugin
    // on purpose (jobs.md §2.1). Nothing there currently catches a thrown
    // handler and enqueues, so there is no producer.
    blockedOn: 'a failure hook on billingPlugin (jobs.md §2.1)',
  },
  'payroll.payRun.execute': {
    priority: PRIORITY.payroll,
    band: 'payroll',
    retryLimit: 5,
    retryDelay: 60,
    shed: 3,
    status: 'declared',
    blockedOn: 'the payroll domain — no Stripe Connect in this repository (jobs.md §8.7)',
  },
  'payroll.transfer.send': {
    priority: PRIORITY.payroll,
    band: 'payroll',
    retryLimit: 5,
    retryDelay: 60,
    shed: 3,
    status: 'declared',
    blockedOn: 'the payroll domain — no Stripe Connect in this repository (jobs.md §8.7)',
  },
  'retention.sweep.transcripts': {
    priority: PRIORITY.retention,
    band: 'retention',
    retryLimit: 3,
    retryDelay: 300,
    shed: 'protected',
    status: 'live',
    blockedOn: null,
  },
  'retention.sweep.media': {
    priority: PRIORITY.retention,
    band: 'retention',
    retryLimit: 3,
    retryDelay: 300,
    shed: 'protected',
    status: 'live',
    blockedOn: null,
  },
  'edu.distill': {
    priority: PRIORITY.derived,
    band: 'derived',
    retryLimit: 5,
    retryDelay: 30,
    shed: 2,
    status: 'live',
    blockedOn: null,
  },
  'payroll.statement.render': {
    priority: PRIORITY.render,
    band: 'render',
    retryLimit: 5,
    retryDelay: 60,
    shed: 2,
    status: 'declared',
    blockedOn: 'the payroll domain — no Stripe Connect in this repository (jobs.md §8.7)',
  },
  'cleanup.unlinkedLearner': {
    priority: PRIORITY.cleanup,
    band: 'cleanup',
    retryLimit: 3,
    retryDelay: 300,
    shed: 2,
    status: 'declared',
    blockedOn: 'no producer — doc 06 §3.1 unlinked-learner rule is undrawn in code',
  },
  'cleanup.staleTutorSession': {
    priority: PRIORITY.cleanup,
    band: 'cleanup',
    retryLimit: 3,
    retryDelay: 300,
    shed: 2,
    status: 'declared',
    blockedOn: 'no producer — nothing reads TutorSessions.expiresAt except the sweep',
  },
  'notify.reminder.trial': {
    priority: PRIORITY.notify,
    band: 'notify',
    retryLimit: 3,
    retryDelay: 300,
    shed: 1,
    status: 'declared',
    blockedOn: 'a notificationsSent store and a sender (jobs.md §8.5)',
  },
  'notify.reminder.session': {
    priority: PRIORITY.notify,
    band: 'notify',
    retryLimit: 3,
    retryDelay: 300,
    shed: 1,
    status: 'declared',
    blockedOn: 'a notificationsSent store and a sender (jobs.md §8.5)',
  },
  'notify.digest.guardian': {
    priority: PRIORITY.notify,
    band: 'notify',
    retryLimit: 3,
    retryDelay: 300,
    shed: 1,
    status: 'declared',
    blockedOn: 'a notificationsSent store and a sender (jobs.md §8.5)',
  },
} as const satisfies Record<string, QueueSpec>;

/** Every queue name in the committed topology, live or not. */
export type QueueName = keyof typeof QUEUES;

/** The three that have a producer and a handler today. */
export type LiveQueueName = {
  [K in QueueName]: (typeof QUEUES)[K]['status'] extends 'live' ? K : never;
}[QueueName];

const NAMES = Object.keys(QUEUES) as QueueName[];

/**
 * The queues a worker may be registered for.
 *
 * Sorted by priority DESCENDING, which is the order pg-boss drains in and
 * therefore the order a bounded drain must fetch in. Sorting here rather than at
 * each call site means the shed order and the fetch order cannot disagree.
 */
export function liveQueues(): LiveQueueName[] {
  return NAMES.filter((name): name is LiveQueueName => QUEUES[name].status === 'live').sort(
    (a, b) => QUEUES[b].priority - QUEUES[a].priority,
  );
}

/** The eleven that are part of the topology and deliberately unregistered. */
export function declaredQueues(): QueueName[] {
  return NAMES.filter((name) => QUEUES[name].status === 'declared');
}

/** Type guard for a name arriving from outside — a route parameter, a DLQ row. */
export function isQueueName(value: string): value is QueueName {
  return Object.hasOwn(QUEUES, value);
}

/**
 * A queue's dead-letter queue. `docs/design/jobs.md` §4.1: one DLQ per queue,
 * because "a shared DLQ makes 'which promise is broken' a query rather than a
 * glance."
 */
export function deadLetterFor(name: QueueName): string {
  return `${name}.dlq`;
}

/** True for `x.dlq`. The drain must never register a worker on one — §4.1: replay is manual. */
export function isDeadLetterQueue(name: string): boolean {
  return name.endsWith('.dlq');
}

/**
 * Doc 12 §7's alerting asymmetry, made a function.
 *
 * JOB-3: one dead-lettered safety job is one guardian who was not told, and that
 * pages at any hour. Ten dead-lettered reminders is a ticket. Expressed as a
 * threshold per queue rather than as an `if` in the alerting code, so the rule
 * moves with the topology when a queue changes band.
 */
export function deadLetterAlertThreshold(name: QueueName): number {
  return QUEUES[name].band === 'safety' ? 1 : 10;
}

/**
 * `docs/design/jobs.md` §4.1, the DLQ retention window: long enough to replay
 * after a fix ships, short enough that a queue holding learner ids is not a
 * second permanent store.
 */
export const DEAD_LETTER_RETENTION_DAYS = 30;

/**
 * §5's shed order as a list, worst-first-to-go.
 *
 * Returned rather than inlined so the shed mechanism and this file cannot drift:
 * a queue whose `shed` field changes moves in this list automatically, and a
 * `'protected'` queue can never appear in it at all — which is the property doc
 * 12 §7's "never safety alerts" needs to be structural rather than remembered.
 */
export function shedOrder(): QueueName[] {
  return NAMES.filter((name) => QUEUES[name].shed !== 'protected').sort((a, b) => {
    const left = QUEUES[a].shed;
    const right = QUEUES[b].shed;
    if (left === 'protected' || right === 'protected') return 0;
    return left - right;
  });
}
