// @acme/jobs — the job runner (doc 12 §6, `docs/design/jobs.md`): pg-boss on the
// same Postgres, in the `jobs` schema, so a job can be enqueued in the same
// transaction as the domain write that justifies it.
//
// The package is split so that the parts a person has to REASON about — the
// fourteen-queue topology, the five-band priority ladder, the §5 shed order, the
// §3 idempotency keys — are pure data and pure functions with no database
// underneath them, and the parts that TALK to Postgres are three thin files on
// top. That is why `topology.ts`, `keys.ts` and `shed.ts` are covered by tests
// that need no connection, and `boss.ts`, `enqueue.ts` and `drain.ts` are not.
//
// NINE OF THE FOURTEEN QUEUES ARE DECLARED AND DELIBERATELY UNREGISTERED, and
// the package says so in three places rather than one: `QueueSpec.status`,
// `QueueSpec.blockedOn`, and `declaredQueues()`. Nothing here creates a queue in
// pg-boss that has no producer and no handler — an empty queue with no worker
// reads on every dashboard exactly like a healthy one, and doc 12 §6's "every
// job idempotent + dead-letter with alerting" is a promise about queues that
// run, not about queue names that exist.
// SOT: docs/design/jobs.md · docs/pack/12-systems-design-prompt.md §6 §7 · packages/payload/migrations/jobs_schema.sql
// SOT-KEYWORDS: jobs barrel pg-boss queue topology priority idempotency singleton key dead letter dlq shed order drain enqueue

export {
  PRIORITY,
  QUEUES,
  DEAD_LETTER_RETENTION_DAYS,
  deadLetterAlertThreshold,
  deadLetterFor,
  declaredQueues,
  isDeadLetterQueue,
  isQueueName,
  liveQueues,
  shedOrder,
} from './src/topology.ts';
export type {
  PriorityBand,
  QueueName,
  QueueSpec,
  QueueStatus,
  LiveQueueName,
  ShedOrder,
} from './src/topology.ts';

export { distillKey, incidentFanOutKey, summaryKey, sweepKey, utcDay } from './src/keys.ts';
export type { JobPayload, JobPayloads } from './src/keys.ts';

export {
  BACKLOG_SHED_DEPTH,
  QUEUE_LATENCY_SLO_SECONDS,
  REVISIT_JOBS_PER_SECOND,
  REVISIT_SUSTAINED_MINUTES,
  deadLetterAlerts,
  isShed,
  revisitTriggered,
  shedPlan,
} from './src/shed.ts';
export type {
  AlertSeverity,
  DeadLetterAlert,
  QueueDepths,
  RevisitSignal,
  ShedPlan,
} from './src/shed.ts';

export {
  JOBS_SCHEMA,
  QUEUE_POLICY,
  ensureLiveQueues,
  getBoss,
  managedQueueNames,
  readDepths,
  stopBoss,
} from './src/boss.ts';
export type { BossOptions, Depths } from './src/boss.ts';

export { enqueue } from './src/enqueue.ts';
export type { EnqueueOptions } from './src/enqueue.ts';

export { QUEUE_HEALTH_RULES, evaluateJobsHealth } from './src/health.ts';
export type {
  JobsHealthReport,
  QueueHealth,
  QueueHealthRule,
  QueueHealthSample,
} from './src/health.ts';

export { drainQueues } from './src/drain.ts';
export type {
  DrainOptions,
  DrainReport,
  JobHandler,
  JobHandlers,
  JobsReporter,
  QueueDrainResult,
} from './src/drain.ts';
