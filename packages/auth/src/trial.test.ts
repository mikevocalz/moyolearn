// The trial's dates and the ARL contract. Doc 05 §6 measures cancellation in
// seconds, which is a step-count ceiling, so the ceiling is a test.
// SOT: docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: trial test schedule reminder charge cancel arl steps disclosure

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cancellationOutcome,
  cancellationSummary,
  trialSchedule,
  CANCEL_STEPS,
  MAX_CANCEL_STEPS,
  TRIAL_REMINDER_DAYS_BEFORE,
} from './trial.ts';
import { NO_SUBSCRIPTION, type SubscriptionState } from './entitlements.ts';

const START = new Date('2026-08-24T12:00:00Z');
const sub = (over: Partial<SubscriptionState> = {}): SubscriptionState => ({
  ...NO_SUBSCRIPTION,
  ...over,
});

describe('the trial schedule', () => {
  const schedule = trialSchedule('family', START);

  it('starts access immediately', () => {
    assert.equal(schedule.accessFrom, START.toISOString());
  });

  it('warns before it charges, never after', () => {
    assert.ok(new Date(schedule.reminderAt) < new Date(schedule.firstChargeAt));
    const gapDays =
      (new Date(schedule.endsAt).getTime() - new Date(schedule.reminderAt).getTime()) / 86_400_000;
    assert.equal(gapDays, TRIAL_REMINDER_DAYS_BEFORE);
  });

  it('answers "when does it end" and "when am I charged" with the same instant', () => {
    assert.equal(schedule.endsAt, schedule.firstChargeAt);
  });

  it('runs the full 30 days the plan promises', () => {
    assert.equal(schedule.days, 30);
    assert.equal(schedule.endsAt, '2026-09-23T12:00:00.000Z');
  });
});

describe('cancelling', () => {
  it('is never routed through support', () => {
    assert.equal(cancellationOutcome(sub({ status: 'active' })).requiresContactingSupport, false);
  });

  it('keeps access to the end of the period already paid for', () => {
    const outcome = cancellationOutcome(
      sub({ status: 'active', periodEnd: '2026-09-23T12:00:00.000Z' }),
    );
    assert.equal(outcome.accessUntil, '2026-09-23T12:00:00.000Z');
    assert.equal(outcome.duringTrial, false);
  });

  it('says plainly that a cancelled trial is not charged', () => {
    const outcome = cancellationOutcome(
      sub({ status: 'trialing', periodEnd: '2026-09-23T12:00:00.000Z' }),
    );
    assert.equal(outcome.duringTrial, true);
    const copy = cancellationSummary(outcome, () => '23 September');
    assert.match(copy, /won't be charged/);
  });

  it('promises what it keeps, with the date as the evidence', () => {
    const copy = cancellationSummary(
      cancellationOutcome(sub({ status: 'active', periodEnd: '2026-09-23T12:00:00.000Z' })),
      () => '23 September',
    );
    assert.match(copy, /23 September/);
    assert.doesNotMatch(copy, /immediately|lose|forfeit/i);
  });

  it('never forfeits export, whatever the state', () => {
    for (const status of ['trialing', 'active', 'past_due'] as const) {
      assert.equal(cancellationOutcome(sub({ status })).keepsExport, true, status);
    }
  });

  it('holds the two-step ceiling — a third step is where retention offers live', () => {
    assert.equal(CANCEL_STEPS.length, MAX_CANCEL_STEPS);
    assert.deepEqual([...CANCEL_STEPS], ['confirm', 'done']);
  });
});
