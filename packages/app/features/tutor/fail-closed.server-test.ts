// Doc 12 §5's fail-closed rule, held at the surface a child actually sees: if
// any safety layer is unavailable, tutoring PAUSES — "Natalie is taking a
// break" — and a retry into an unscreened tutor is the exact inversion of it.
//
// It lives beside `coach.service.ts` rather than in `@acme/safety` because the
// rule is only real end to end. The plane knows a layer is down; the store
// knows what `paused` looks like; the thing in between is this service's catch,
// and that is the piece a refactor can quietly invert.
//
// It also holds the two things that catch had wrong. A PROVIDER REFUSAL is a
// safety verdict and must pause rather than offer a retry, and every stopped
// turn — including the pause itself — must leave a `safetyEvents` row behind,
// because doc 12 §5 asks for guardian-visible status and a verdict nobody
// records is visible to nobody.
//
// `.server-test.ts`, not `.test.ts`: every module on the coaching path opens
// with `import 'server-only'`, which needs node's `react-server` condition to
// resolve to the no-op. That condition also makes `react` resolve to its
// server build, which breaks the kit tests — so the two suites cannot share a
// process, and the file name is what keeps them apart.
// SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3 §7
// SOT-KEYWORDS: fail closed test coach service safety layer unavailable paused retry blocked boundary refusal safety event guardian ai enabled refused

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ModelDeclined } from '@acme/inference';
import { SafetyLayerUnavailable, type SafetyEvent } from '@acme/safety';
import { coachStream, type CoachEvent, type CoachPorts } from './coach.service.ts';
import type { ProtectedCtx } from '../../core/protected-operation.ts';

const ctx: ProtectedCtx = { learnerId: 'learner_1', isLearner: true };

/** The turn under test is the OPENING one, so nothing depends on prior facts. */
const noPriorFacts = async (): Promise<[]> => [];

/**
 * A refusal arriving at the boundary the way a real one does.
 *
 * `ModelDeclined` is thrown by the vendor stream, which the plane deliberately
 * does NOT wrap in `safetyLayer` — "the model is not a layer". The brief
 * compiler is invoked from inside that same unwrapped generator, so a throw here
 * reaches the catch by the identical route and through the identical frames.
 * Throwing it from `loadGradeBand` instead would prove nothing: that call sits
 * inside `safetyLayer('1-identity')`, which would rename it
 * `SafetyLayerUnavailable` before the catch ever saw it — and the whole question
 * is what the catch does with a refusal it CAN see.
 *
 * The alternative was a fake vendor transport, which `inferenceGateway()`'s
 * process-wide singleton gives no seam for.
 */
const declines = (): Promise<never> => {
  throw new ModelDeclined('claude-opus-5', 'general_harms');
};

/**
 * A recorder that keeps what it was given, so a test can assert on the row a
 * guardian would eventually read rather than on the fact that a function ran.
 */
const recorder = (): { record: CoachPorts['recordSafetyEvent']; written: SafetyEvent[] } => {
  const written: SafetyEvent[] = [];
  return { record: (_ctx, event) => void written.push(event), written };
};

/**
 * The default composition: band resolves, AI is on, nothing is recorded unless
 * the test looks. Each case overrides exactly the port it is about.
 */
const ports = (over: Partial<CoachPorts> = {}): CoachPorts => ({
  loadPriorFacts: noPriorFacts,
  loadGradeBand: async () => 'older',
  loadLearnerFlags: async () => ({ aiEnabled: true }),
  recordSafetyEvent: () => {},
  ...over,
});

const drain = async (events: AsyncGenerator<CoachEvent>): Promise<CoachEvent[]> => {
  const seen: CoachEvent[] = [];
  for await (const event of events) seen.push(event);
  return seen;
};

const turn = { problem: '12 + 5', message: '', sessionId: 'sess_1' };

describe('the coaching turn’s fail-closed boundary', () => {
  it('pauses when a safety layer is down, rather than offering a retry', async () => {
    const events = await drain(
      coachStream(
        turn,
        ctx,
        ports({
          loadGradeBand: () => {
            throw new SafetyLayerUnavailable('1-identity');
          },
        }),
      ),
    );

    // `blocked` is what the store maps to `paused`. `unavailable` maps to
    // `retry`, and a retry here would send the child back into a tutor whose
    // band — and therefore whose crisis register — nothing could resolve.
    assert.deepEqual(events, [{ kind: 'blocked' }]);
  });

  it('still offers a retry when it is the model that is missing', async () => {
    // The documented `unavailable` case, reproduced rather than mocked: no API
    // key is exactly the unconfigured dev environment that must not read to a
    // child as Natalie having withdrawn.
    delete process.env.ANTHROPIC_API_KEY;

    const events = await drain(coachStream(turn, ctx, ports()));

    assert.deepEqual(events, [{ kind: 'unavailable' }]);
  });

  it('pauses on a bare layer failure too, not only on a named one', async () => {
    // A layer that throws something ordinary is still a layer that is down.
    // Requiring it to announce itself correctly would make the rule depend on
    // the failing component being well behaved.
    const events = await drain(
      coachStream(
        turn,
        ctx,
        ports({
          loadGradeBand: () => {
            throw new Error('grade band lookup timed out');
          },
        }),
      ),
    );

    assert.deepEqual(events, [{ kind: 'blocked' }]);
  });

  it('pauses when the guardian policy cannot be resolved', async () => {
    // `aiEnabled` is layer 1 as much as the band is. A flags read that failed
    // open would run the tutor for a child whose parent had switched it off,
    // every time the read failed.
    const events = await drain(
      coachStream(
        turn,
        ctx,
        ports({
          loadLearnerFlags: () => {
            throw new Error('auth store unreachable');
          },
        }),
      ),
    );

    assert.deepEqual(events, [{ kind: 'blocked' }]);
  });
});

describe('a provider refusal', () => {
  it('pauses instead of offering a child another go at the same refusal', async () => {
    // Doc 12 §5 routes a surviving refusal to the fail-closed pause: the
    // provider's own safety classifier reached a DECISION, and a retry asks the
    // same classifier the same question — or gets a different answer, which is a
    // child rerolling a safety verdict until it goes their way.
    const events = await drain(
      coachStream(
        turn,
        ctx,
        ports({
          loadPriorFacts: declines,
        }),
      ),
    );

    assert.deepEqual(events, [{ kind: 'blocked' }]);
  });

  it('is filed as a safety verdict, not as a tutor that has stopped working', async () => {
    const { record, written } = recorder();

    await drain(
      coachStream(
        turn,
        ctx,
        ports({
          recordSafetyEvent: record,
          loadPriorFacts: declines,
        }),
      ),
    );

    assert.equal(written.length, 1);
    assert.equal(written[0]?.category, 'safety');
    // A refusal stops ONE turn; a down layer stops every turn until it is back.
    // Filing them the same way would make the guardian's status line lie in one
    // direction or the other.
    assert.notEqual(written[0]?.category, 'paused');
    assert.equal(written[0]?.disposition, 'blocked');
    assert.equal(written[0]?.stoppedAt, 'provider');
    assert.equal(written[0]?.learnerId, ctx.learnerId);
    assert.equal(written[0]?.sessionId, 'sess_1');
  });
});

describe('what a guardian is left with', () => {
  it('writes the pause down, so an adult can tell a stopped tutor from a quiet child', async () => {
    const { record, written } = recorder();

    await drain(
      coachStream(
        turn,
        ctx,
        ports({
          recordSafetyEvent: record,
          loadGradeBand: () => {
            throw new SafetyLayerUnavailable('3-input');
          },
        }),
      ),
    );

    assert.equal(written.length, 1, 'the pause left no record at all');
    assert.equal(written[0]?.category, 'paused');
    assert.equal(written[0]?.stoppedAt, '3-input');
    assert.equal(written[0]?.guardianVisible, true);
    // Its own window, and not the transcript's 30 days — the row holds a verdict
    // and no words, so the clock that governs a child's words does not apply.
    const days =
      (Date.parse(written[0]?.expiresAt ?? '') - Date.parse(written[0]?.occurredAt ?? '')) / 86_400_000;
    assert.equal(days, 90);
  });

  it('says nothing about an ordinary vendor outage', async () => {
    // Availability, not safety. A guardian's feed filled with the operations
    // team's problems is a feed a guardian learns to skim.
    delete process.env.ANTHROPIC_API_KEY;
    const { record, written } = recorder();

    const events = await drain(coachStream(turn, ctx, ports({ recordSafetyEvent: record })));

    assert.deepEqual(events, [{ kind: 'unavailable' }]);
    assert.deepEqual(written, []);
  });
});

describe('a learner whose guardian switched AI tutoring off', () => {
  it('is refused, calmly, and no model is ever asked', async () => {
    /*
      The branch that was unreachable. `coachIdentity` hardcoded `aiEnabled: true`,
      so `screenInput`'s `refused` arm could not be entered in production no
      matter what a guardian chose — the switch doc 06 §110 promises did nothing.

      `loadPriorFacts` doubles as the tripwire: it is the first thing the turn
      does after layer 1, so a run that touches it is a run that got past the
      identity gate it should have stopped at.
    */
    let reachedTheModelPath = 0;
    const events = await drain(
      coachStream(
        turn,
        ctx,
        ports({
          loadLearnerFlags: async () => ({ aiEnabled: false }),
          loadPriorFacts: async () => {
            reachedTheModelPath += 1;
            return [];
          },
        }),
      ),
    );

    assert.equal(events.length, 1);
    assert.equal(events[0]?.kind, 'replace');
    assert.match(
      events[0]?.kind === 'replace' ? events[0].text : '',
      /turned off/,
      'the child is owed a plain sentence, not an error',
    );
    assert.equal(reachedTheModelPath, 0, 'a refused turn still compiled a brief for a model');
  });

  it('is not reported to the guardian as a safety incident', async () => {
    // The refusal IS the guardian's own setting working. Telling them their
    // choice took effect is noise in the one feed that has to stay worth reading.
    const { record, written } = recorder();

    await drain(
      coachStream(
        turn,
        ctx,
        ports({ recordSafetyEvent: record, loadLearnerFlags: async () => ({ aiEnabled: false }) }),
      ),
    );

    assert.deepEqual(written, []);
  });
});
