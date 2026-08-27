// What a guardian is told, and what they are deliberately not told.
//
// Doc 12 §5's rule ends "guardian-visible status", and the status is only worth
// having if it is honest in three directions at once: a live pause has to show,
// a stale one must not, and doc 07 §3 layer 4's boundary-testing must never be
// forwarded to a parent as an incident.
//
// `.server-test.ts` because the service opens with `import 'server-only'`.
// SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3 §S26
// SOT-KEYWORDS: guardian safety status test paused alerts boundary crisis stale window feed
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pausedSafetyEvent, safetyEventFor, type SafetyEvent } from '@acme/safety';
import { safetyStatusFrom } from './safety-status.service.ts';

const NOW = new Date('2026-08-27T16:00:00.000Z');
const at = (minutesAgo: number): Date => new Date(NOW.getTime() - minutesAgo * 60_000);
const identity = { learnerId: 'learner_1', sessionId: 'sess_1' };

const stopped = (
  outcome: Parameters<typeof safetyEventFor>[0],
  trace: Parameters<typeof safetyEventFor>[1],
  minutesAgo: number,
): SafetyEvent => {
  const event = safetyEventFor(outcome, trace, identity, at(minutesAgo));
  assert.ok(event, 'this outcome was supposed to produce an event');
  return event;
};

describe('the guardian safety status', () => {
  it('says the tutor is running when nothing has stopped it', () => {
    const status = safetyStatusFrom([], NOW);
    assert.equal(status.paused, false);
    assert.equal(status.pausedSince, null);
    assert.deepEqual(status.alerts, []);
  });

  it('dates a live pause from when it STARTED, not from the last retry', () => {
    /*
      Every turn attempted while a layer is down writes its own row, so the
      newest is always seconds old. Reading the newest would tell a parent the
      tutor "just stopped" ten minutes into an outage — which is the difference
      between "wait a moment" and "something is wrong".
    */
    const status = safetyStatusFrom(
      [
        pausedSafetyEvent('3-input', identity, at(1)),
        pausedSafetyEvent('3-input', identity, at(4)),
        pausedSafetyEvent('3-input', identity, at(9)),
      ],
      NOW,
    );

    assert.equal(status.paused, true);
    assert.equal(status.pausedSince, at(9).toISOString());
  });

  it('does not report yesterday’s outage as a tutor that is down now', () => {
    const status = safetyStatusFrom([pausedSafetyEvent('5-output', identity, at(60))], NOW);
    assert.equal(status.paused, false);
    assert.equal(status.pausedSince, null);
    // Still not an alert either: a pause is a fact about the system, and filing
    // it under the child's alerts would say they set something off.
    assert.deepEqual(status.alerts, []);
  });

  it('never forwards a child poking at the topic fence', () => {
    // Doc 07 §3 layer 4: "repeated boundary-testing is logged (never punished —
    // a curious kid probing the AI is normal)". A parent handed every off-task
    // line is a parent handed a surveillance feed.
    const fence = stopped(
      { kind: 'redirect', text: 'not my thing', storeInStudentModel: false },
      [{ layer: '4-fence', detail: 'redirect' }],
      5,
    );
    const status = safetyStatusFrom([fence], NOW);
    assert.deepEqual(status.alerts, []);
  });

  it('tells a parent what the SYSTEM did, never what the child did', () => {
    const blocked = stopped(
      { kind: 'blocked', broke: ['secrecy'], storeInStudentModel: false },
      [{ layer: '5-output', detail: 'secrecy' }],
      5,
    );

    const [alert] = safetyStatusFrom([blocked], NOW).alerts;
    assert.ok(alert);
    assert.equal(alert.alert.category, 'safety');
    assert.deepEqual(alert.alert.whatWeDid, ['Blocked the reply', 'Logged it for review']);
    // S26: the safety excerpt is readable even inside a transcript-privacy
    // window, and the session handle is what the link hangs off.
    assert.equal(alert.alert.excerptAvailable, true);
    assert.equal(alert.sessionId, 'sess_1');

    // The copy carries no fragment of the turn — the words live in the
    // transcript, on the transcript's clock.
    assert.ok(!JSON.stringify(alert).includes('secret'), JSON.stringify(alert));
  });

  it('shows a crisis and a live pause at the same time without confusing them', () => {
    const crisisRow = stopped(
      {
        kind: 'crisis',
        response: {
          sessionEnded: true,
          message: 'stopping here',
          resources: [],
          alertGuardian: true,
          storeInStudentModel: false,
          steps: [],
          // Doc 31 §3.2's S4 tier: the response is a looked-up script and the
          // session stays in safe mode until a human clears it. Both are on the
          // fixture because both are on the type — a crisis frame a test can
          // build without them is a frame that could reach a child without them.
          safeMode: 'until-human-clears',
          scripted: true,
        },
        storeInStudentModel: false,
      },
      [{ layer: '6-crisis' }],
      30,
    );

    const status = safetyStatusFrom(
      [pausedSafetyEvent('3-input', identity, at(2)), crisisRow],
      NOW,
    );

    assert.equal(status.paused, true);
    assert.equal(status.alerts.length, 1);
    assert.equal(status.alerts[0]?.alert.category, 'crisis');
  });
});
