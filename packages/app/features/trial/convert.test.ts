// S17's pitch, asserted. The engine already guarantees the milestone counts are
// honest; these hold the two things a screen could still get wrong — arguing the
// other side's case with a zero, and dropping the grace promise from the copy.
// SOT: docs/pack/05-monetization-access-spec.md §6 S17
// SOT-KEYWORDS: trial convert test stats zero plural sentence weekday gate

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tierGateNote, trialSentence, trialStats } from './convert.ts';
import { EMPTY_ACTIVATION, type ActivationState } from './milestones.ts';

const activation = (over: Partial<ActivationState> = {}): ActivationState => ({
  ...EMPTY_ACTIVATION,
  ...over,
});

describe('the stats we sell with', () => {
  it('leaves out anything that did not happen — a zero argues the other side', () => {
    const stats = trialStats(activation({ bookings: 3 }));
    assert.deepEqual(stats, [{ value: 3, label: 'sessions booked' }]);
  });

  it('shows nothing at all for a business that did nothing', () => {
    assert.deepEqual(trialStats(EMPTY_ACTIVATION), []);
  });

  it('gets the singular right', () => {
    assert.deepEqual(trialStats(activation({ tutorsInvited: 1 })), [
      { value: 1, label: 'tutor onboarded' },
    ]);
  });

  it('orders them the way the business did them', () => {
    const stats = trialStats(
      activation({ learnersImported: 40, tutorsInvited: 2, bookings: 14, invoices: 3 }),
    );
    assert.deepEqual(
      stats.map((s) => s.label),
      ['students imported', 'tutors onboarded', 'sessions booked', 'invoices sent'],
    );
  });
});

describe('the sentence', () => {
  const friday = '2026-09-25T12:00:00Z';

  it('names the weekday inside a week — doc 05 §6’s own line', () => {
    assert.equal(
      trialSentence(3, friday),
      'Your trial ends Friday — everything you’ve set up stays.',
    );
  });

  it('counts days once a weekday stops meaning anything', () => {
    assert.match(trialSentence(19, friday), /^19 days left/);
  });

  it('says tomorrow rather than "1 day"', () => {
    assert.match(trialSentence(1, friday), /tomorrow/);
  });

  it('stops being about time once the trial has ended', () => {
    assert.match(trialSentence(0, friday), /has ended/);
    assert.doesNotMatch(trialSentence(0, friday), /left/);
  });

  it('never drops the promise, in any state', () => {
    for (const days of [null, 0, 1, 3, 19]) {
      assert.match(
        trialSentence(days, friday),
        /everything you’ve set up stays|Everything you’ve set up stays/,
        `days=${days}`,
      );
    }
  });

  it('falls back to a count when the date is unusable', () => {
    assert.match(trialSentence(3, 'not-a-date'), /^3 days left/);
  });
});

describe('the tier gate', () => {
  it('states the limit on the card rather than leaving it to be discovered', () => {
    assert.match(tierGateNote(0), /manual on this tier/);
    assert.match(tierGateNote(1), /Includes automated pay runs/);
  });
});
