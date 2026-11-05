// The CI gate over every registered motion: no ownership conflicts, and
// storyboard frames that match the committed snapshot. The fixture tests below
// prove the gate trips; the registry tests are the gate itself.
//
// Refresh the snapshot after an intended change with
//   UPDATE_MOTION_SNAPSHOTS=1 pnpm --filter @acme/motion test
// and review the diff: every changed number is a frame that now looks different.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { KINETRELL_DIAGNOSTIC_CODES, defineMotion } from 'kinetrell/core';
import { auditMotion, registeredMotions, storyboardFrames, track } from './index.ts';

const SNAPSHOT = new URL('./storyboards.snapshot.json', import.meta.url);

const conflicting = defineMotion({
  id: 'fixture.conflict',
  initial: { card: { opacity: 0, translateY: 12 } },
  tracks: [
    track('entrance', { target: 'card', to: { opacity: 1, translateY: 0 } }),
    track('feedback', { target: 'card', to: { opacity: 0.5 }, after: ['entrance'], overlap: 0.5 }),
  ],
});

const clean = defineMotion({
  id: 'fixture.clean',
  initial: { card: { opacity: 0, translateY: 12 }, edge: { opacity: 0 } },
  labels: { landed: 300 },
  tracks: [
    track('entrance', { target: 'card', to: { opacity: 1, translateY: 0 } }),
    track('feedback', { target: 'edge', to: { opacity: 1 }, after: ['entrance'] }),
  ],
});

test('the gate reports two tracks writing one property at once', () => {
  const { diagnostics } = auditMotion(conflicting);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0]!.code, KINETRELL_DIAGNOSTIC_CODES.CONFLICTING_OWNER);
  assert.equal(diagnostics[0]!.property, 'opacity');
});

test('the gate passes split ownership', () => {
  assert.deepEqual(auditMotion(clean).diagnostics, []);
});

test('storyboard frames are start, every label and the end, and are pure', () => {
  const { compiled } = auditMotion(clean);
  const frames = storyboardFrames(compiled);
  assert.deepEqual(frames.map((f) => [f.name, f.timeMs]), [['start', 0], ['landed', 300], ['end', 500]]);
  assert.deepEqual(frames.at(-1)!.state, { card: { opacity: 1, translateY: 0 }, edge: { opacity: 1 } });
  assert.deepEqual(storyboardFrames(auditMotion(clean).compiled), frames);
});

test('every registered motion has no ownership conflict', () => {
  for (const definition of registeredMotions()) {
    const { id, diagnostics } = auditMotion(definition);
    assert.deepEqual(diagnostics.map((d) => d.message), [], `${id} has conflicting writers`);
  }
});

test('every registered motion matches its committed storyboard frames', () => {
  const live = Object.fromEntries(
    registeredMotions().map((definition) => [definition.id, storyboardFrames(auditMotion(definition).compiled)]),
  );
  if (process.env.UPDATE_MOTION_SNAPSHOTS === '1') {
    writeFileSync(SNAPSHOT, `${JSON.stringify(live, null, 2)}\n`);
  }
  const committed = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as unknown;
  assert.deepEqual(JSON.parse(JSON.stringify(live)), committed);
});
