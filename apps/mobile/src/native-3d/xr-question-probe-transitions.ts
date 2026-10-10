/**
 * Choreographed transitions for the XR question probe: the loader dwell, the
 * entrance dwell, and the exit dwell. These are the JS half of the Rive
 * contract in `xr-question-probe.tsx`.
 *
 * TIMING SEAM: Rive does not call JS back when a state machine animation
 * finishes, so `beginExit`'s exit dwell and the entrance dwell are wall timers
 * matched to the `QuestionFlow` transitions (`EXIT_MS`, `ENTRANCE_MS`). They
 * are the choreography's half of the contract — if the RML's transition
 * durations change, these change with it.
 *
 * The single module-scope `transitionTimer` that used to be shared between the
 * initial entrance sequence and `onNext` has been replaced by distinct timer
 * refs so that calling `onNext` while the initial loader/entrance is pending
 * cannot cancel the entrance sequence and leave the flow stuck in
 * `loading-initial`.
 *
 * SOT: packages/app/features/tutor/xr-question.store.ts · ./xr-question-probe-store.ts
 * SOT-KEYWORDS: xr question probe transition timers entrance exit loader bound timeout
 */

import { useXrQuestionFlow } from '@acme/app/features/tutor/xr-question.store.ts';
import { xrQuestionProbe } from './xr-question-probe-store.ts';

/** Choreography halves of the Rive contract — exit dwell / entrance dwell. */
export const EXIT_MS = 550;
export const ENTRANCE_MS = 900;
/* The yellow loader's minimum face time once content is proven — long
   enough to read as an entrance, short enough not to feel stuck. */
export const LOADER_DWELL_MS = 450;

/* If the hosted texture never reports `bound`, the probe cannot wait forever —
   the surface either bound or it did not, and the child deserves an error
   message instead of a silent spinner. */
export const BIND_TIMEOUT_MS = 10_000;

type TimerRef = { current: ReturnType<typeof setTimeout> | null };

const clearTimer = (ref: TimerRef) => {
  if (ref.current) {
    clearTimeout(ref.current);
    ref.current = null;
  }
};

const setTimer = (ref: TimerRef, ms: number, fn: () => void) => {
  clearTimer(ref);
  ref.current = setTimeout(() => {
    ref.current = null;
    fn();
  }, ms);
};

const initialLoaderTimer: TimerRef = { current: null };
const initialEntranceTimer: TimerRef = { current: null };
const exitTimer: TimerRef = { current: null };
const nextEntranceTimer: TimerRef = { current: null };

interface BindWatch {
  unsub: (() => void) | null;
  timeout: ReturnType<typeof setTimeout> | null;
}

const bindWatch: BindWatch = { unsub: null, timeout: null };

const clearBindWatch = () => {
  if (bindWatch.unsub) {
    bindWatch.unsub();
    bindWatch.unsub = null;
  }
  if (bindWatch.timeout) {
    clearTimeout(bindWatch.timeout);
    bindWatch.timeout = null;
  }
};

/** Cancel every transition timer and any pending bound-texture watch. */
export const clearAllTransitionTimers = () => {
  clearTimer(initialLoaderTimer);
  clearTimer(initialEntranceTimer);
  clearTimer(exitTimer);
  clearTimer(nextEntranceTimer);
  clearBindWatch();
};

/** Schedule the exit dwell — used by `onNext` and `onSkip`. */
export const scheduleExit = (onComplete: () => void) => setTimer(exitTimer, EXIT_MS, onComplete);

/** Schedule the entrance dwell after the next question commits. */
export const scheduleNextEntrance = (onComplete: () => void) => setTimer(nextEntranceTimer, ENTRANCE_MS, onComplete);

/*
  The loader is the readiness gate, not a timer alone: the entrance starts
  only once the hosted texture has bound (the probe's one critical surface),
  then holds for the loader's dwell before the entrance plays.

  If `bound` is already true we proceed immediately; otherwise we subscribe
  to the probe store and wait. A 10s fallback timer ensures we fail loudly
  rather than hang forever if binding never reports success, and the
  subscription is always cleaned up.
*/
export const openInitialEntrance = () => {
  clearBindWatch();
  clearTimer(initialLoaderTimer);
  clearTimer(initialEntranceTimer);

  const whenBound = () => {
    setTimer(initialLoaderTimer, LOADER_DWELL_MS, () => {
      const s = useXrQuestionFlow.getState();
      if (s.phase !== 'loading-initial') return;
      s.beginEntrance();
      setTimer(initialEntranceTimer, ENTRANCE_MS, () => useXrQuestionFlow.getState().arrive());
    });
  };

  if (xrQuestionProbe.getState().bound) {
    whenBound();
    return;
  }

  bindWatch.timeout = setTimeout(() => {
    clearBindWatch();
    useXrQuestionFlow.getState().fail('Board surface did not bind in time');
  }, BIND_TIMEOUT_MS);

  bindWatch.unsub = xrQuestionProbe.subscribe((s) => {
    if (!s.bound) return;
    clearBindWatch();
    whenBound();
  });
};
