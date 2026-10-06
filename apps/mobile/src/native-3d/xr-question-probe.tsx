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
  XR_FIXTURE_SEQUENCE,
} from '@acme/ui/xr';
import {
  answerReady,
  useXrQuestionFlow,
} from '@acme/app/features/tutor/xr-question.store.ts';
import { draftAnswerText, evaluateXrAnswer } from '@acme/app/features/tutor/xr-question-evaluator.ts';
import { useTutorStore } from '@acme/app/features/tutor/tutor.store.ts';
import { xrLocalHint } from '@acme/app/features/tutor/xr-local-tutor.ts';
import { xrVoiceSession } from './xr-voice-session.ts';
import { XrQuestionPanel } from './xr-question-panel';
import { XrLayoutProbe } from './xr-layout-probe';
import type { QuestionChromeHandlers } from './question-chrome-bind';
import { questionPresentationOf } from './xr-question-present';

/** Choreography halves of the Rive contract — exit dwell / entrance dwell. */
const EXIT_MS = 550;
const ENTRANCE_MS = 900;
/* The yellow loader's minimum face time once content is proven — long
   enough to read as an entrance, short enough not to feel stuck. */
const LOADER_DWELL_MS = 450;

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

/*
  The loader is the readiness gate, not a timer alone: the entrance starts
  only once the hosted texture has bound (the probe's one critical surface),
  then holds for the loader's dwell before the entrance plays.
*/
const openInitialEntrance = () => {
  const whenBound = () =>
    later(LOADER_DWELL_MS, () => {
      const s = useXrQuestionFlow.getState();
      if (s.phase !== 'loading-initial') return;
      s.beginEntrance();
      later(ENTRANCE_MS, () => useXrQuestionFlow.getState().arrive());
    });
  if (xrQuestionProbe.getState().bound) {
    whenBound();
    return;
  }
  const unsub = xrQuestionProbe.subscribe((s) => {
    if (!s.bound) return;
    unsub();
    whenBound();
  });
};

/* A question renders in the learner's language or it is the language being
   taught — a science question in Spanish to an English-speaking learner is a
   fixture-matrix artefact, not a lesson. Foreign-language rows survive only
   when the subject itself is a language. */
const LEARNER_SEQUENCE = XR_FIXTURE_SEQUENCE.filter((id) => {
  const q = fixtureById(id);
  if (!q) return false;
  return q.questionLocale === q.uiLocale || q.subject === 'world-language';
});

/** Load the fixture at `sequenceIndex` and stage the one after it. */
const loadFixture = (index: number) => {
  const flow = useXrQuestionFlow.getState();
  const current = fixtureById(LEARNER_SEQUENCE[index] ?? '');
  const next = fixtureById(LEARNER_SEQUENCE[index + 1] ?? '');
  if (!current) {
    flow.fail('Question sequence finished');
    return;
  }
  flow.loadInitial(current);
  flow.stageNext(next);
  /* The question is also the tutor session's problem — every coach turn
     (Ask Natalie, the spoken verdict on submit) posts `problem` and the
     route refuses a turn without one. */
  useTutorStore.getState().start(current.prompt);
  xrQuestionProbe.setState({ sequenceIndex: index, contentReady: false });
  openInitialEntrance();
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
    const { current, phase } = useXrQuestionFlow.getState();
    const id = current?.choices?.[index]?.id;
    console.log('[question-probe] toggleChoice', index, 'phase', phase, 'id', id);
    if (id) useXrQuestionFlow.getState().toggleChoice(id);
  },
  onSubmit: () => {
    const flow = useXrQuestionFlow.getState();
    const { current, answer } = flow;
    const token = flow.submit();
    if (token === null || !current) {
      /* A silent no-op reads as a dead button — say why nothing happened. */
      if (flow.phase === 'idle' && !answerReady(answer)) {
        useXrQuestionFlow.setState({ status: 'Pick or say an answer first.' });
      }
      return;
    }
    void evaluateXrAnswer(current, answer)
      .then((feedback) => {
        useXrQuestionFlow.getState().resolveSubmit(token, feedback);
        /* Natalie speaks the verdict through the same signed coach stream Ask
           Natalie uses — the only path that carries a server-signed voice tag.
           An unreachable tutor API degrades to text-only on the panel rather
           than an error, and the turn stays inside the coach's safety plane. */
        const spoken = draftAnswerText(current, answer);
        void useTutorStore
          .getState()
          .coach(
            `The learner answered "${spoken ?? 'nothing'}" to "${current.prompt}". The verdict shown on their panel is ${feedback.outcome}: "${feedback.title}. ${feedback.body}" Say that verdict aloud to them in one or two short sentences, in your own words.`,
          )
          .catch(() => undefined);
      })
      .catch(() => useXrQuestionFlow.getState().fail('Could not check that answer — try again'));
  },
  onNext: () => {
    const flow = useXrQuestionFlow.getState();
    /* An error phase cannot `beginExit` — treat NEXT there as "move on past
       the broken question" rather than a dead button. */
    if (flow.phase === 'error') {
      const index = xrQuestionProbe.getState().sequenceIndex + 1;
      if (index >= LEARNER_SEQUENCE.length) {
        useXrQuestionFlow.getState().fail('That is the whole fixture sequence.');
        return;
      }
      flow.reset();
      loadFixture(index);
      return;
    }
    flow.beginExit();
    later(EXIT_MS, () => {
      const s = useXrQuestionFlow.getState();
      if (s.phase !== 'exiting' && s.phase !== 'loading-next') return;
      if (s.next) {
        s.commitNext();
        later(ENTRANCE_MS, () => {
          useXrQuestionFlow.getState().arrive();
          /* The committed question is now current — stage the fixture
             after it so the following Next never waits on a fetch the
             probe does not have. */
          const index = xrQuestionProbe.getState().sequenceIndex + 1;
          xrQuestionProbe.setState({ sequenceIndex: index });
          const upcoming = fixtureById(LEARNER_SEQUENCE[index + 1] ?? '');
          useXrQuestionFlow.getState().stageNext(upcoming ?? null);
        });
      } else if (xrQuestionProbe.getState().sequenceIndex >= LEARNER_SEQUENCE.length - 1) {
        s.fail('That is the whole fixture sequence.');
      } else {
        /* Nothing staged — hold the hidden midpoint while the feed lands. */
        s.toLoadingNext();
      }
    });
  },
  onSkip: () => questionHandlers.onNext(),
  onHint: () => {
    const flow = useXrQuestionFlow.getState();
    console.log('[question-probe] onHint phase', flow.phase, 'current', flow.current?.id);
    flow.showHint();
    const question = flow.current;
    /* Authored text wins; every other question asks the on-device tutor.
       `generatedHint` is cleared per question, so an unanswered `null` does
       not re-trigger a generation loop while the sheet sits open. */
    if (!question || question.hint?.text || flow.generatedHint !== null || flow.hintBusy) return;
    const questionId = question.id;
    useXrQuestionFlow.getState().setHintBusy(true);
    void xrLocalHint(question).then((text: string | null) => {
      const s = useXrQuestionFlow.getState();
      if (s.current?.id !== questionId) return;
      s.setGeneratedHint(text ?? 'Try reading the question once more, slowly.');
    });
  },
  onVoice: () => xrVoiceSession.getState().toggle(),
  onBoard: () => useXrQuestionFlow.setState({ status: 'The board is beside you — draw there' }),
  onRetry: () => {
    const s = useXrQuestionFlow.getState();
    if (s.phase === 'error') loadFixture(xrQuestionProbe.getState().sequenceIndex);
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

  const presentation = {
    ...questionPresentationOf(flow.current, flow),
    status: flow.status || (bound ? '' : boundReason ?? 'Preparing content…'),
  };

  /*
    The question panel is the LEFT seat of the proven arc — `XrLayoutProbe`
    still owns the centre board and Natalie on the right; only the lesson
    panel is swapped for `XrQuestionPanel` through `renderLeft`. The slot
    pose arrives from the composition, so the panel can never drift from
    the arc it replaces the lesson on.
  */
  return (
    <XrLayoutProbe
      bytes={null}
      head={head}
      yawDeg={yawDeg}
      resetKey={resetKey}
      natalieHeightCm={168}
      renderLeft={(left) => {
        if (!chromeBytes || chromeFailed) {
          /* No chrome bytes yet (or a dead runtime) — keep the carrier so
             the surface can still land. */
          return (
            <ViroNode
              position={[left.position[0], left.position[1], left.position[2]]}
              rotation={[0, left.yaw, 0]}
            />
          );
        }
        const gripY = left.position[1] - QUESTION_PANEL_HEIGHT_M / 2 - spatialSpacing.sm - 0.045;
        return (
          <XrQuestionPanel
            chromeBytes={chromeBytes}
            slot={{ position: [left.position[0], left.position[1], left.position[2]], yaw: left.yaw }}
            carrier={panelOffset}
            grabbed={grabbed}
            bound={bound}
            opacity={1}
            resetKey={resetKey}
            onCarrierRelease={(pose) => xrQuestionProbe.setState({ panelOffset: pose })}
            onGrab={(v) => xrQuestionProbe.setState({ grabbed: v })}
            handlers={questionHandlers}
            presentation={presentation}
            gripWorld={{ position: [left.position[0], gripY, left.position[2]], yawDeg: left.yaw }}
            onChromeError={(message) => {
              if (__DEV__) console.warn('[xr-question-probe]', message);
              xrQuestionProbe.setState({ chromeFailed: true });
            }}
          />
        );
      }}
    />
  );
}
