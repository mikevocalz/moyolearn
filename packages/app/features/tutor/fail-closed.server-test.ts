// Doc 12 §5's fail-closed rule, held at the surface a child actually sees: if
// any safety layer is unavailable, tutoring PAUSES — "Natalie is taking a
// break" — and a retry into an unscreened tutor is the exact inversion of it.
//
// It lives beside `coach.service.ts` rather than in `@acme/safety` because the
// rule is only real end to end. The plane knows a layer is down; the store
// knows what `paused` looks like; the thing in between is this service's catch,
// and that is the piece a refactor can quietly invert.
//
// `.server-test.ts`, not `.test.ts`: every module on the coaching path opens
// with `import 'server-only'`, which needs node's `react-server` condition to
// resolve to the no-op. That condition also makes `react` resolve to its
// server build, which breaks the kit tests — so the two suites cannot share a
// process, and the file name is what keeps them apart.
// SOT: docs/pack/12-systems-design-prompt.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: fail closed test coach service safety layer unavailable paused retry blocked boundary

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SafetyLayerUnavailable } from '@acme/safety';
import { coachStream, type CoachEvent } from './coach.service.ts';
import type { ProtectedCtx } from '../../core/protected-operation.ts';

const ctx: ProtectedCtx = { learnerId: 'learner_1', isLearner: true };

/** The turn under test is the OPENING one, so nothing depends on prior facts. */
const noPriorFacts = async (): Promise<[]> => [];

const drain = async (events: AsyncGenerator<CoachEvent>): Promise<CoachEvent[]> => {
  const seen: CoachEvent[] = [];
  for await (const event of events) seen.push(event);
  return seen;
};

describe('the coaching turn’s fail-closed boundary', () => {
  it('pauses when a safety layer is down, rather than offering a retry', async () => {
    const events = await drain(
      coachStream({ problem: '12 + 5', message: '' }, ctx, noPriorFacts, () => {
        throw new SafetyLayerUnavailable('1-identity');
      }),
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

    const events = await drain(
      coachStream({ problem: '12 + 5', message: '' }, ctx, noPriorFacts, async () => 'older'),
    );

    assert.deepEqual(events, [{ kind: 'unavailable' }]);
  });

  it('pauses on a bare layer failure too, not only on a named one', async () => {
    // A layer that throws something ordinary is still a layer that is down.
    // Requiring it to announce itself correctly would make the rule depend on
    // the failing component being well behaved.
    const events = await drain(
      coachStream({ problem: '12 + 5', message: '' }, ctx, noPriorFacts, () => {
        throw new Error('grade band lookup timed out');
      }),
    );

    assert.deepEqual(events, [{ kind: 'blocked' }]);
  });
});
