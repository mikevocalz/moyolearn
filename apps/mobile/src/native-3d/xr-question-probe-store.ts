/**
 * Probe-local state for the XR question probe — what the flow store does not
 * own: whether the hosted texture bound, the carrier's persisted drag, and which
 * fixture index the sequence is on.
 *
 * Split out as a plain `.ts` module so timer/transition logic can be tested
 * without pulling in the JSX/Viro renderer surface.
 *
 * SOT: packages/app/features/tutor/xr-question.store.ts · ./xr-question-probe.tsx
 * SOT-KEYWORDS: xr question probe store bound contentReady grabbed panelOffset sequenceIndex chrome
 */

import { createStore } from 'zustand/vanilla';

export interface XrQuestionProbeState {
  bound: boolean;
  boundReason: string | null;
  contentReady: boolean;
  grabbed: boolean;
  panelOffset: {
    position: [number, number, number];
    rotation: [number, number, number];
  } | null;
  /** Index into XR_FIXTURE_SEQUENCE — the current question's place. */
  sequenceIndex: number;
  chromeFailed: boolean;
  chromeBytes: ArrayBuffer | null;
}

export const xrQuestionProbe = createStore<XrQuestionProbeState>(() => ({
  bound: false,
  boundReason: null,
  contentReady: false,
  grabbed: false,
  panelOffset: null,
  sequenceIndex: 0,
  chromeFailed: false,
  chromeBytes: null,
}));
