// Job payloads and idempotency keys — `docs/design/jobs.md` §3 and §4.1, as
// types rather than as a table.
//
// TWO RULES ARE ENFORCED HERE BY SHAPE, NOT BY REVIEW.
//
// 1. THE PAYLOAD IS IDS ONLY. §4.1: "A dead-lettered `edu.distill` job holding a
//    child's turns is a transcript outside the retention window, unreachable by
//    `expireTranscripts` and invisible to `sweep.sql`." Neither
//    `packages/student-model/src/erasure.ts` nor `packages/payload/src/retention/sweep.sql`
//    can see `jobs.job`, so a job row that holds only an id becomes harmless the
//    moment the row it names is deleted — its handler finds nothing and
//    completes. `JobPayloads` is therefore a closed map of narrow record types
//    with no field wide enough to hold a sentence, and the handler does the
//    loading.
//
// 2. THE KEY IS NEVER DERIVED FROM THE PAYLOAD'S CONTENT. §3: "Hashing a job
//    payload produces a key that changes when an unrelated field changes, which
//    is how a 'sent once' guarantee quietly becomes 'sent once per schema
//    version'." Every builder below takes the ids it keys on as arguments.
// SOT: docs/design/jobs.md §3 §4.1 · packages/inference/src/budget.ts:dayKey
// SOT-KEYWORDS: jobs idempotency singleton key payload ids only dead letter distill retention sweep transcript media day
import type { LiveQueueName } from './topology.ts';

/**
 * What each live queue carries.
 *
 * Keyed on `LiveQueueName`, not `QueueName`, and that is deliberate: a queue
 * with no handler has no payload shape to agree on, and giving one a type now
 * would be inventing the contract its future producer has to honour. It also
 * makes `send` structurally unable to enqueue a declared-only queue.
 */
export interface JobPayloads {
  /**
   * The scheduled UTC day, and nothing else. The sweep reads `expiresAt <= now`
   * itself — passing a cutoff in the payload would let a replayed job delete
   * rows that were not expired when it was enqueued.
   */
  readonly 'retention.sweep.transcripts': { readonly day: string };
  readonly 'retention.sweep.media': { readonly day: string };
  /**
   * `sessionTranscripts.sessionId`. §3: the key is the TRANSCRIPT, not the
   * learner — keying on the learner would collapse two transcripts from the same
   * child in the same minute into one job and silently lose the second one's
   * facts. The learner id is read off the row by the handler, which is also what
   * keeps identity out of a client-reachable value (CLAUDE.md §The block).
   */
  readonly 'edu.distill': { readonly transcriptId: string };
  /**
   * Doc 31 §4.3's fan-out, both legs. `incidentReports.incidentId`, and nothing
   * else — the handler loads the row.
   *
   * The ids-only rule bites hardest here, which is why it is stated again: an
   * incident is the one record in this system whose SUMMARY is a sentence about
   * a child's worst day. A payload carrying it would be a copy of that sentence
   * in `jobs.job`, outside the retention sweep, outside the legal-hold predicate,
   * and outside the erasure cascade — three guarantees broken by one convenience.
   */
  readonly 'safety.alert.guardian': { readonly incidentId: string };
  readonly 'safety.review.enqueue': { readonly incidentId: string };
}

export type JobPayload<Q extends LiveQueueName> = JobPayloads[Q];

/**
 * The UTC calendar day a scheduled sweep belongs to.
 *
 * The same slice `packages/inference/src/budget.ts:dayKey` takes, and for the
 * same reason it gives: a calendar day is a thing a person can reason about,
 * and a rolling window is not. Duplicated rather than imported because
 * `@acme/jobs` importing `@acme/inference` would put the provider credential
 * package in the dependency graph of the queue runner for one string slice.
 */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * `singletonKey` for one scheduled sweep run.
 *
 * pg-boss's `singletonKey` guarantees at most one job with that key is queued or
 * active at a time, so a cron that fires twice — a Vercel retry, a manual
 * trigger landing on the schedule — enqueues once. It stops protecting the
 * moment the first job COMPLETES, which is fine here and is why §3 records a
 * natural key beside it: both sweeps re-read `expiresAt <= cutoff` and delete
 * exactly that set, so a second run finds nothing.
 */
export function sweepKey(queue: 'transcripts' | 'media', day: string): string {
  return `retention:${queue}:${day}`;
}

/**
 * `singletonKey` for one transcript's distillation.
 *
 * The natural key behind it is `packages/student-model/src/distill.ts:factId`,
 * which is `${learnerId}:${kind}:${subject}` and deterministic — `saveFacts`
 * upserts on it, so re-running distillation over the same transcript recomputes
 * the same rows rather than appending a second set.
 */
export function distillKey(transcriptId: string): string {
  return transcriptId;
}

/**
 * `singletonKey` for one leg of one incident's fan-out (doc 31 §4.3).
 *
 * The LEG is part of the key, not just the incident: an S4 report fans out to
 * both queues at once, and a key that named only the incident would let the
 * guardian alert and the human page collide on the one rung where both are
 * required. Two queues, two keys, one incident.
 *
 * The natural key behind it is `incidentReports.guardianNotifiedAt` /
 * `.reviewPagedAt` — `docs/design/jobs.md` §3 wants both mechanisms, because
 * `singletonKey` stops protecting the moment the first job COMPLETES and a
 * dead-letter replay happens long after that.
 */
export function incidentFanOutKey(leg: 'guardian' | 'review', incidentId: string): string {
  return `incident:${leg}:${incidentId}`;
}
