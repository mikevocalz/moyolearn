/**
 * Regression tests for the XR question probe's choreographed transitions.
 *
 * The component itself is native/Viro-heavy and cannot be rendered in Node,
 * so this module test exercises the extracted transition logic in
 * `xr-question-probe-transitions.ts`: distinct timers for the initial entrance
 * sequence and `onNext`'s exit sequence, a fallback timeout if the hosted
 * texture never binds, and the phase progression from `loading-initial` through
 * `entering` to `idle`.
 *
 * SOT: ./xr-question-probe-transitions.ts · ./xr-question-probe-store.ts
 * SOT-KEYWORDS: xr question probe regression test timers bound timeout entrance exit
 */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useXrQuestionFlow } from '@acme/app/features/tutor/xr-question.store.ts';
import { xrQuestionProbe } from './xr-question-probe-store.ts';
import {
  openInitialEntrance,
  scheduleExit,
  scheduleNextEntrance,
  clearAllTransitionTimers,
  EXIT_MS,
  LOADER_DWELL_MS,
  ENTRANCE_MS,
  BIND_TIMEOUT_MS,
} from './xr-question-probe-transitions.ts';

const resetFlowAndProbe = () => {
  useXrQuestionFlow.getState().reset();
  xrQuestionProbe.setState({
    bound: false,
    boundReason: null,
    contentReady: false,
    grabbed: false,
    panelOffset: null,
    sequenceIndex: 0,
    chromeFailed: false,
    chromeBytes: null,
  });
  clearAllTransitionTimers();
};

beforeEach(() => {
  resetFlowAndProbe();
});

test('openInitialEntrance runs loading-initial -> entering -> idle when already bound', (context) => {
  context.mock.timers.enable();
  xrQuestionProbe.setState({ bound: true });

  openInitialEntrance();

  assert.equal(useXrQuestionFlow.getState().phase, 'loading-initial');
  context.mock.timers.tick(LOADER_DWELL_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'entering');
  context.mock.timers.tick(ENTRANCE_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'idle');
});

test('openInitialEntrance runs loading-initial -> entering -> idle when bound arrives later', (context) => {
  context.mock.timers.enable();

  openInitialEntrance();

  assert.equal(useXrQuestionFlow.getState().phase, 'loading-initial');
  xrQuestionProbe.setState({ bound: true });
  context.mock.timers.tick(LOADER_DWELL_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'entering');
  context.mock.timers.tick(ENTRANCE_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'idle');
});

test('openInitialEntrance fails after the bind timeout if bound never reports', (context) => {
  context.mock.timers.enable();

  openInitialEntrance();

  assert.equal(useXrQuestionFlow.getState().phase, 'loading-initial');
  context.mock.timers.tick(BIND_TIMEOUT_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'error');
  assert.equal(
    useXrQuestionFlow.getState().status,
    'Board surface did not bind in time',
  );
});

test('scheduling an exit while the initial entrance is pending does not cancel it', (context) => {
  context.mock.timers.enable();
  xrQuestionProbe.setState({ bound: true });

  openInitialEntrance();
  assert.equal(useXrQuestionFlow.getState().phase, 'loading-initial');

  /* Advance most of the loader dwell, then trigger the equivalent of the
     `onNext` handler scheduling its own exit timer. With the old single
     shared `transitionTimer`, this would clobber the loader timer and leave
     the flow stuck in `loading-initial`. */
  context.mock.timers.tick(LOADER_DWELL_MS - 1);
  let exitFired = false;
  scheduleExit(() => {
    exitFired = true;
  });

  context.mock.timers.tick(1);
  assert.equal(useXrQuestionFlow.getState().phase, 'entering');
  context.mock.timers.tick(ENTRANCE_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'idle');

  /* The exit timer is independent and still fires later. */
  context.mock.timers.tick(ENTRANCE_MS + EXIT_MS);
  assert.equal(exitFired, true);
});

test('scheduleNextEntrance runs independently of the initial entrance timers', (context) => {
  context.mock.timers.enable();
  xrQuestionProbe.setState({ bound: true });

  openInitialEntrance();
  context.mock.timers.tick(LOADER_DWELL_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'entering');

  let nextEntranceFired = false;
  scheduleNextEntrance(() => {
    nextEntranceFired = true;
  });

  context.mock.timers.tick(ENTRANCE_MS);
  assert.equal(useXrQuestionFlow.getState().phase, 'idle');
  assert.equal(nextEntranceFired, true);
});
