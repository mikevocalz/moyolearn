// Dead-man switch proof — doc 35 §7 checklist row 11's testable half: the 500
// path is shown with a tightened threshold override here, never by pausing a
// real queue.
// SOT: docs/pack/35-sentry-free-tier.md §5 · §7 checklist row 11
// SOT-KEYWORDS: jobs health test dead man stale threshold override 500 path
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateJobsHealth,
  QUEUE_HEALTH_RULES,
  type QueueHealthSample,
} from './health.ts';
import { liveQueues } from './topology.ts';

const NOW = new Date('2026-08-27T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

/** Every live queue fresh: sweeps succeeded an hour ago, nothing waiting. */
function freshSamples(): QueueHealthSample[] {
  return liveQueues().map((queue) => ({
    queue,
    lastCompletedAt:
      QUEUE_HEALTH_RULES[queue].kind === 'scheduled' ? minutesAgo(60) : null,
    oldestReadyAt: null,
  }));
}

test('a fully fresh fleet is healthy', () => {
  const report = evaluateJobsHealth(freshSamples(), NOW);
  assert.equal(report.healthy, true);
  assert.equal(report.queues.length, liveQueues().length);
  assert.ok(report.queues.every((q) => q.healthy && q.reasons.length === 0));
});

test('an event queue with no traffic and no history is healthy — silence is not death', () => {
  const report = evaluateJobsHealth(freshSamples(), NOW);
  const distill = report.queues.find((q) => q.queue === 'edu.distill');
  assert.equal(distill?.healthy, true);
});

test('a scheduled queue past its cadence goes stale and takes the fleet with it', () => {
  const samples = freshSamples().map((sample) =>
    sample.queue === 'retention.sweep.transcripts'
      ? { ...sample, lastCompletedAt: minutesAgo(27 * 60) }
      : sample,
  );
  const report = evaluateJobsHealth(samples, NOW);
  assert.equal(report.healthy, false);
  const sweep = report.queues.find((q) => q.queue === 'retention.sweep.transcripts');
  assert.equal(sweep?.healthy, false);
  assert.match(sweep?.reasons[0] ?? '', /stale/);
});

test('a scheduled queue with NO recorded success is stale — a dead eraser is silent', () => {
  const samples = freshSamples().map((sample) =>
    sample.queue === 'retention.sweep.media' ? { ...sample, lastCompletedAt: null } : sample,
  );
  const report = evaluateJobsHealth(samples, NOW);
  assert.equal(report.healthy, false);
});

test('ready work older than the drain budget marks an event queue stale', () => {
  const samples = freshSamples().map((sample) =>
    sample.queue === 'safety.alert.guardian'
      ? { ...sample, oldestReadyAt: minutesAgo(20) }
      : sample,
  );
  const report = evaluateJobsHealth(samples, NOW);
  assert.equal(report.healthy, false);
  const guardian = report.queues.find((q) => q.queue === 'safety.alert.guardian');
  assert.match(guardian?.reasons[0] ?? '', /ready work waiting/);
});

test('a missing sample fails closed', () => {
  const samples = freshSamples().filter((s) => s.queue !== 'summary.generate');
  const report = evaluateJobsHealth(samples, NOW);
  assert.equal(report.healthy, false);
  const summary = report.queues.find((q) => q.queue === 'summary.generate');
  assert.deepEqual(summary?.reasons, ['no health sample']);
});

test('the 500 path is provable by threshold override, not by breaking a queue', () => {
  // The same fresh fleet, judged under a 1-minute cadence: the sweeps' hour-old
  // successes are now stale. This is the override the route test story leans on.
  const tightened = Object.fromEntries(
    Object.entries(QUEUE_HEALTH_RULES).map(([queue, rule]) => [
      queue,
      rule.kind === 'scheduled' ? { ...rule, maxSinceSuccessMs: 60_000 } : rule,
    ]),
  ) as typeof QUEUE_HEALTH_RULES;

  const fresh = evaluateJobsHealth(freshSamples(), NOW);
  const stale = evaluateJobsHealth(freshSamples(), NOW, tightened);
  assert.equal(fresh.healthy, true);
  assert.equal(stale.healthy, false);
});
