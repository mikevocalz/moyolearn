// The topology, the keys and the shed order, tested without a database.
//
// Everything asserted here is a RULE somebody committed to in
// `docs/design/jobs.md` and doc 12 §6/§7, and every one of them is the kind of
// rule that decays silently: a priority number drifts, a queue quietly gains a
// worker before it has a producer, someone "tidies" the shed order and a
// guardian alert becomes sheddable at 3am. None of those show up as a failure at
// runtime — they show up as a queue that behaved reasonably and wrongly.
//
// The one test worth naming: `a safety queue can never be shed`. It does not
// check a list, it checks that NO input to `shedPlan` — not a million-deep
// backlog, not a zero threshold — can produce a plan containing a protected
// queue. Doc 12 §7's "never safety alerts" is an absolute, so the test is over
// all inputs rather than over the one somebody thought of.
// SOT: docs/design/jobs.md §2 §3 §4 §5 §6 · docs/pack/12-systems-design-prompt.md §6 §7
// SOT-KEYWORDS: jobs test topology priority ladder shed order safety never shed dead letter threshold idempotency key revisit trigger
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEAD_LETTER_RETENTION_DAYS,
  PRIORITY,
  QUEUES,
  deadLetterAlertThreshold,
  deadLetterFor,
  declaredQueues,
  isDeadLetterQueue,
  isQueueName,
  liveQueues,
  shedOrder,
  type QueueName,
} from './topology.ts';
import { distillKey, incidentFanOutKey, sweepKey, utcDay } from './keys.ts';
import { QUEUE_POLICY, managedQueueNames } from './boss.ts';
import {
  BACKLOG_SHED_DEPTH,
  REVISIT_JOBS_PER_SECOND,
  deadLetterAlerts,
  isShed,
  revisitTriggered,
  shedPlan,
  type QueueDepths,
} from './shed.ts';

const NAMES = Object.keys(QUEUES) as QueueName[];

test('the topology is the fourteen queues doc 12 §6 and jobs.md §2 commit to', () => {
  assert.equal(NAMES.length, 14);
  assert.equal(liveQueues().length + declaredQueues().length, 14);

  // §2's five-band ladder, in the order pg-boss drains: priority DESCENDING.
  assert.ok(PRIORITY.safety > PRIORITY.webhook);
  assert.ok(PRIORITY.webhook > PRIORITY.payroll);
  assert.ok(PRIORITY.payroll > PRIORITY.retention);
  assert.ok(PRIORITY.retention > PRIORITY.derived);
  assert.ok(PRIORITY.derived > PRIORITY.render);
  assert.ok(PRIORITY.render > PRIORITY.cleanup);
  assert.ok(PRIORITY.cleanup > PRIORITY.notify);
});

test('the five live queues are the five with real work today', () => {
  /*
    Doc 31 §4.3 promoted the two safety fan-outs. They are named here rather
    than counted because the list is the assertion: a queue that goes live
    without a handler is a silent failure — jobs accumulate, nothing errors, and
    the dashboard shows a healthy zero-failure rate.
  */
  assert.deepEqual([...liveQueues()].sort(), [
    'edu.distill',
    'retention.sweep.media',
    'retention.sweep.transcripts',
    'safety.alert.guardian',
    'safety.review.enqueue',
  ]);
});

test('both safety fan-out queues are live, protected, and page on one dead letter', () => {
  /*
    The three properties doc 31 §4.3 needs together, and the reason they are
    asserted in one place: a safety queue that went live WITHOUT staying
    protected would become sheddable at exactly the load where a guardian most
    needs telling, and nothing at runtime would say so.
  */
  for (const name of ['safety.alert.guardian', 'safety.review.enqueue'] as const) {
    assert.equal(QUEUES[name].status, 'live');
    assert.equal(QUEUES[name].shed, 'protected');
    assert.equal(QUEUES[name].band, 'safety');
    assert.equal(deadLetterAlertThreshold(name), 1);
  }
});

test('liveQueues() is sorted by priority descending — the order pg-boss drains in', () => {
  const priorities = liveQueues().map((name) => QUEUES[name].priority);
  assert.deepEqual(priorities, [...priorities].sort((a, b) => b - a));
});

test('every declared queue says what it is blocked on, and every live one does not', () => {
  for (const name of declaredQueues()) {
    assert.equal(typeof QUEUES[name].blockedOn, 'string', `${name} is declared with no reason`);
    assert.notEqual(QUEUES[name].blockedOn, '');
  }
  for (const name of liveQueues()) {
    assert.equal(QUEUES[name].blockedOn, null, `${name} is live and still claims to be blocked`);
  }
});

test('no payroll queue is live — Stripe Connect does not exist in this repository', () => {
  for (const name of NAMES) {
    if (!name.startsWith('payroll.')) continue;
    assert.equal(QUEUES[name].status, 'declared', `${name} claims to run without a payroll domain`);
  }
});

test('§5 shed order: reminders before pay runs', () => {
  const order = shedOrder();
  const reminder = order.indexOf('notify.reminder.trial');
  const payRun = order.indexOf('payroll.payRun.execute');
  assert.ok(reminder >= 0 && payRun >= 0);
  assert.ok(reminder < payRun, 'doc 12 §7: reminders are shed BEFORE pay runs');
});

test('a safety queue can never be shed, at any depth or threshold', () => {
  const protectedQueues = NAMES.filter((name) => QUEUES[name].shed === 'protected');
  assert.ok(protectedQueues.includes('safety.alert.guardian'));
  assert.ok(protectedQueues.includes('safety.review.enqueue'));

  // Not in the order at all — the property doc 12 §7 needs is structural.
  for (const name of protectedQueues) {
    assert.ok(!shedOrder().includes(name), `${name} appears in the shed order`);
  }

  /*
    And unreachable through the planner, under every input shape that exists: an
    absurd backlog on the protected queue itself, and a threshold of zero, which
    is the configuration that sheds the most it is allowed to.
  */
  const depths: QueueDepths = {};
  for (const name of NAMES) depths[name] = 1_000_000;
  for (const threshold of [0, 1, BACKLOG_SHED_DEPTH]) {
    const plan = shedPlan(depths, threshold);
    for (const name of protectedQueues) {
      assert.ok(!isShed(plan, name), `${name} was shed at threshold ${threshold}`);
    }
  }
});

test('shedding starts at the reminders and stops as soon as the backlog fits', () => {
  const depths: QueueDepths = { 'notify.reminder.trial': BACKLOG_SHED_DEPTH + 10 };
  const plan = shedPlan(depths);

  assert.equal(plan.triggered, true);
  assert.ok(plan.shed.includes('notify.reminder.trial'));
  assert.equal(plan.depth, 1, 'a reminder backlog must never reach the pay-run band');
  assert.ok(!plan.shed.includes('payroll.payRun.execute'), 'money was made late by a reminder');
});

test('a backlog under the threshold sheds nothing', () => {
  const plan = shedPlan({ 'edu.distill': 10 });
  assert.equal(plan.triggered, false);
  assert.deepEqual(plan.shed, []);
  assert.equal(plan.depth, null);
});

test('JOB-3: one dead-lettered safety job pages, ten reminders ticket', () => {
  assert.equal(deadLetterAlertThreshold('safety.alert.guardian'), 1);
  assert.equal(deadLetterAlertThreshold('notify.reminder.trial'), 10);

  const alerts = deadLetterAlerts({ 'safety.alert.guardian': 1, 'notify.reminder.trial': 9 });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]?.queue, 'safety.alert.guardian');
  assert.equal(alerts[0]?.severity, 'page');

  const both = deadLetterAlerts({ 'safety.alert.guardian': 1, 'notify.reminder.trial': 10 });
  assert.equal(both.length, 2);
  assert.equal(both.find((alert) => alert.queue === 'notify.reminder.trial')?.severity, 'ticket');
});

test('§4.1: one dead-letter queue per queue, and a DLQ is never a drain target', () => {
  assert.equal(deadLetterFor('edu.distill'), 'edu.distill.dlq');
  assert.equal(DEAD_LETTER_RETENTION_DAYS, 30);
  for (const name of NAMES) {
    assert.ok(isDeadLetterQueue(deadLetterFor(name)));
    assert.ok(!isDeadLetterQueue(name), `${name} looks like a dead-letter queue`);
  }
});

test('isQueueName rejects a name from outside the topology', () => {
  assert.ok(isQueueName('edu.distill'));
  assert.ok(!isQueueName('edu.distill.dlq'));
  assert.ok(!isQueueName('drop table jobs.job'));
});

test('§3: keys are built from ids, never from the payload’s content', () => {
  // The sweep's key is the scheduled UTC DAY, so a cron that fires twice on the
  // same day enqueues once and a run tomorrow is a different job.
  assert.equal(sweepKey('transcripts', '2026-08-27'), 'retention:transcripts:2026-08-27');
  assert.notEqual(sweepKey('transcripts', '2026-08-27'), sweepKey('media', '2026-08-27'));
  assert.notEqual(sweepKey('media', '2026-08-27'), sweepKey('media', '2026-08-28'));

  // The distill key is the TRANSCRIPT, not the learner: keying on the learner
  // would collapse two transcripts from the same child in the same minute into
  // one job and silently lose the second one's facts.
  assert.equal(distillKey('transcript-a'), 'transcript-a');
  assert.notEqual(distillKey('transcript-a'), distillKey('transcript-b'));
});

test('utcDay is a calendar day, and the same one either side of a local midnight', () => {
  assert.equal(utcDay(new Date('2026-08-27T23:59:59.999Z')), '2026-08-27');
  assert.equal(utcDay(new Date('2026-08-28T00:00:00.000Z')), '2026-08-28');
});

test('an incident fan-out key names the LEG, not just the incident', () => {
  /*
    An S4 report fans out to both queues at once. A key that named only the
    incident would let the guardian alert and the on-call page collide on the one
    rung where doc 31 §4.3 requires both — and pg-boss would refuse the second
    enqueue as a duplicate, silently.
  */
  assert.notEqual(
    incidentFanOutKey('guardian', 'incident_1'),
    incidentFanOutKey('review', 'incident_1'),
  );
  assert.equal(incidentFanOutKey('guardian', 'incident_1'), 'incident:guardian:incident_1');
  // Deterministic, and derived from the id rather than from the row's content —
  // §3: hashing a payload turns "sent once" into "sent once per schema version".
  assert.equal(
    incidentFanOutKey('review', 'incident_2'),
    incidentFanOutKey('review', 'incident_2'),
  );
});

test('§6: the revisit trigger needs a SUSTAINED rate, or any latency breach', () => {
  // A spike is not a trend.
  assert.equal(
    revisitTriggered({ jobsPerSecond: 400, sustainedMinutes: 5, p95LatencySeconds: 1 }),
    false,
  );
  assert.equal(
    revisitTriggered({
      jobsPerSecond: REVISIT_JOBS_PER_SECOND + 1,
      sustainedMinutes: 60,
      p95LatencySeconds: 1,
    }),
    true,
  );
  // JOB-4 stands alone: latency is the number a family experiences.
  assert.equal(
    revisitTriggered({ jobsPerSecond: 0.6, sustainedMinutes: 0, p95LatencySeconds: 301 }),
    true,
  );
  // §6.1's modelled peak is two orders of magnitude below the trigger.
  assert.equal(
    revisitTriggered({ jobsPerSecond: 0.6, sustainedMinutes: 1_440, p95LatencySeconds: 4 }),
    false,
  );
});

test('§3 needs "queued OR active", which is exactly one pg-boss policy', () => {
  /*
    THIS TEST EXISTS BECAUSE THE FIRST VERSION WAS WRONG, and wrong in a way that
    compiled, typechecked and looked right in review. `singleton` reads like the
    policy a `singletonKey` belongs to; its unique index is
    `(name, singleton_key) WHERE state = 'active'`, so a second sweep for the same
    UTC day is ACCEPTED while the first is still queued. A live enqueue-twice
    check against the real `jobs` schema is what caught it.

    `exclusive` is `WHERE state <= 'active'` — created, retry and active — which
    is the sentence `docs/design/jobs.md` §3 actually wrote.
  */
  assert.equal(QUEUE_POLICY, 'exclusive');
});

test('only live queues and their dead letters are ever created in pg-boss', () => {
  const managed = managedQueueNames();
  assert.equal(managed.length, liveQueues().length * 2);
  for (const name of declaredQueues()) {
    assert.ok(!managed.includes(name), `${name} is declared-only and must not be created`);
    assert.ok(!managed.includes(deadLetterFor(name)));
  }
});
