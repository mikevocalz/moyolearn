/**
 * The dynamic-question probe: the `LearningQuestion` chrome at the centre
 * slot, fed by the fixture sequence through the real flow store — every
 * transition is `beginExit → commitNext → entering → idle`, the same path
 * a tutor session takes, so the probe proves the sequence and not just
 * the fixtures.
 *
 * MODULE-SCOPE WIRING, like `xr-layout-probe`: the scene is captured by
 * the navigator's constructor, so anything it reacts to reaches it through
 * the store — here `useXrQuestionFlow` itself, which the route writes
 * (hosted surface bound) and the scene reads.
 *
 * TIMING SEAM: Rive does not call JS back when a state machine animation
 * finishes, so `beginExit`'s exit dwell and the entrance dwell are wall
 * timers matched to the `QuestionFlow` transitions (`EXIT_MS`,
 * `ENTRANCE_MS`). They are the choreography's half of the contract — if
 * the RML's transition durations change, these change with it.
 *
 * SOT: packages/app/features/tutor/xr-question.store.ts ·
 *      packages/app/features/tutor/xr-question-evaluator.ts ·
 *      packages/ui/xr/question-fixtures.ts · ./xr-question-panel.tsx
 * SOT-KEYWORDS: xr question probe scene fixture sequence flow store evaluator transition timers
 */

import React, { useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { ViroNode } from '@reactvision/react-viro';
import {
  QUESTION_PANEL_HEIGHT_M,
  fixtureById,
  spatialSpacing,
  worldSlot,
  XR_FIXTURE_SEQUENCE,
} from '@acme/ui/xr';
import {
  useXrQuestionFlow,
} from '@acme/app/features/tutor/xr-question.store.ts';
import { evaluateXrAnswer } from '@acme/app/features/tutor/xr-question-evaluator.ts';
import { XrQuestionPanel } from './xr-question-panel';
import type { QuestionChromeHandlers } from './question-chrome-bind';
import { questionPresentationOf } from './xr-question-present';

/** Choreography halves of the Rive contract — exit dwell / entrance dwell. */
const EXIT_MS = 550;
const ENTRANCE_MS = 900;

/*
 * Probe-local state — what the flow store does not own: whether the hosted
 * texture bound, the carrier's persisted drag, and which fixture index the
 * sequence is on.
 */
export const xrQuestionProbe = createStore(() => ({
  bound: false,
  boundReason: null as string | null,
  contentReady: false,
  grabbed: false,
  panelOffset: null as {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null,
  /** Index into XR_FIXTURE_SEQUENCE — the current question's place. */
  sequenceIndex: 0,
  chromeFailed: false,
  chromeBytes: null as ArrayBuffer | null,
}));

let transitionTimer: ReturnType<typeof setTimeout> | null = null;
const later = (ms: number, fn: () => void) => {
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(fn, ms);
};

/** Load the fixture at `sequenceIndex` and stage the one after it. */
const loadFixture = (index: number) => {
  const flow = useXrQuestionFlow.getState();
  const current = fixtureById(XR_FIXTURE_SEQUENCE[index] ?? '');
  const next = fixtureById(XR_FIXTURE_SEQUENCE[index + 1] ?? '');
  if (!current) {
    flow.fail('Question sequence finished');
    return;
  }
  flow.loadInitial(current);
  flow.stageNext(next);
  xrQuestionProbe.setState({ sequenceIndex: index, contentReady: false });
};

/**
 * The chrome's verbs → the flow store. Every command lands here — the
 * binding names no store, so this is where command becomes consequence.
 */
const questionHandlers: QuestionChromeHandlers = {
  onSelectChoice: (index) => {
    const { current } = useXrQuestionFlow.getState();
    const id = current?.choices?.[index]?.id;
    if (id) useXrQuestionFlow.getState().selectChoice(id);
  },
  onToggleChoice: (index) => {
    const { current } = useXrQuestionFlow.getState();
    const id = current?.choices?.[index]?.id;
    if (id) useXrQuestionFlow.getState().toggleChoice(id);
  },
  onSubmit: () => {
    const flow = useXrQuestionFlow.getState();
    const { current, answer } = flow;
    const token = flow.submit();
    if (token === null || !current) return;
    void evaluateXrAnswer(current, answer)
      .then((feedback) => useXrQuestionFlow.getState().resolveSubmit(token, feedback))
      .catch(() => useXrQuestionFlow.getState().fail('Could not check that answer — try again'));
  },
  onNext: () => {
    const flow = useXrQuestionFlow.getState();
    flow.beginExit();
    later(EXIT_MS, () => {
      const s = useXrQuestionFlow.getState();
      if (s.phase !== 'exiting' && s.phase !== 'loading-next') return;
      if (s.next) {
        s.commitNext();
        later(ENTRANCE_MS, () => useXrQuestionFlow.getState().arrive());
      } else {
        /* Nothing staged — hold the hidden midpoint while the feed lands. */
        s.toLoadingNext();
      }
    });
  },
  onSkip: () => questionHandlers.onNext(),
  onHint: () => useXrQuestionFlow.getState().showHint(),
  onVoice: () => useXrQuestionFlow.setState({ status: 'Voice input is not wired in this probe yet' }),
  onBoard: () => useXrQuestionFlow.setState({ status: 'The board is beside you — draw there' }),
  onRetry: () => {
    const s = useXrQuestionFlow.getState();
    if (s.phase === 'error') s.retry();
    else s.retryAnswer();
  },
};

export function XrQuestionProbe({
  head,
  yawDeg,
  resetKey = 0,
}: {
  head: readonly [number, number, number];
  yawDeg: number;
  resetKey?: number;
}) {
  /* First mount arms the sequence — the route's bytes may land later, but
     the question is ready either way; the loader covers the gap. */
  const started = useRef(false);
  if (!started.current) {
    started.current = true;
    loadFixture(0);
  }

  const bound = useStore(xrQuestionProbe, (s) => s.bound);
  const boundReason = useStore(xrQuestionProbe, (s) => s.boundReason);
  const grabbed = useStore(xrQuestionProbe, (s) => s.grabbed);
  const panelOffset = useStore(xrQuestionProbe, (s) => s.panelOffset);
  const chromeFailed = useStore(xrQuestionProbe, (s) => s.chromeFailed);
  const chromeBytes = useStore(xrQuestionProbe, (s) => s.chromeBytes);

  const flow = useStore(useXrQuestionFlow);
  const centre = worldSlot('center', head, yawDeg);
  const gripY = centre.position[1] - QUESTION_PANEL_HEIGHT_M / 2 - spatialSpacing.sm - 0.045;

  if (!chromeBytes || chromeFailed) {
    /* No chrome bytes yet (or a dead runtime) — the carrier still exists so
       the surface can land, and the status surfaces honestly. */
    return (
      <ViroNode position={[centre.position[0], centre.position[1], centre.position[2]]} rotation={[0, centre.yaw, 0]} />
    );
  }

  const presentation = {
    ...questionPresentationOf(flow.current, flow),
    status: flow.status || (bound ? '' : boundReason ?? 'Preparing content…'),
  };

  return (
    <XrQuestionPanel
      chromeBytes={chromeBytes}
      slot={{ position: [centre.position[0], centre.position[1], centre.position[2]], yaw: centre.yaw }}
      carrier={panelOffset}
      grabbed={grabbed}
      bound={bound}
      opacity={0.8}
      resetKey={resetKey}
      onCarrierRelease={(pose) => xrQuestionProbe.setState({ panelOffset: pose })}
      onGrab={(v) => xrQuestionProbe.setState({ grabbed: v })}
      handlers={questionHandlers}
      presentation={presentation}
      gripWorld={{ position: [centre.position[0], gripY, centre.position[2]], yawDeg: centre.yaw }}
      onChromeError={(message) => {
        if (__DEV__) console.warn('[xr-question-probe]', message);
        xrQuestionProbe.setState({ chromeFailed: true });
      }}
    />
  );
}
