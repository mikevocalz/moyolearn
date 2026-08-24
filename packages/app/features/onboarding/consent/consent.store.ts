'use client';
// ConsentFlow state. Zustand, not useState — the challenge outlives the step that
// started it (a guardian can leave the app to fetch the code and come back), and
// the finished record is read by the step that creates the child.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent store zustand challenge kba record guardian

import { create } from 'zustand';
import {
  completeConsent,
  confirm,
  scoreKba,
  startChallenge,
  verifyCode,
  DEFAULT_CONSENT_ENVIRONMENT,
  type ConsentChallenge,
  type ConsentEnvironment,
  type ConsentMethod,
  type ConsentRecord,
  type KbaQuestion,
} from '@acme/auth';

export type ConsentStage = 'notice' | 'method' | 'challenge' | 'done';

interface ConsentState {
  stage: ConsentStage;
  env: ConsentEnvironment;
  challenge: ConsentChallenge | null;
  questions: KbaQuestion[];
  answers: number[];
  record: ConsentRecord | null;
  /** The refusal to show — never thrown, because a guardian can fix all of them. */
  problem: string | null;
  setStage: (stage: ConsentStage) => void;
  setEnv: (env: Partial<ConsentEnvironment>) => void;
  begin: (method: ConsentMethod, sentTo: string, questions?: KbaQuestion[]) => void;
  enterCode: (ok: boolean) => void;
  acknowledge: () => void;
  answer: (index: number, choice: number) => void;
  submitKba: () => void;
  finish: (scope: string, policyVersion: string) => void;
  reset: () => void;
}

const BLANK = {
  stage: 'notice' as ConsentStage,
  challenge: null,
  questions: [],
  answers: [],
  record: null,
  problem: null,
};

export const useConsentFlow = create<ConsentState>((set, get) => ({
  ...BLANK,
  env: DEFAULT_CONSENT_ENVIRONMENT,
  setStage: (stage) => set({ stage, problem: null }),
  setEnv: (env) => set((s) => ({ env: { ...s.env, ...env } })),
  begin: (method, sentTo, questions = []) => {
    const started = startChallenge(method, sentTo, get().env);
    if (!started.ok) {
      set({ problem: started.reason });
      return;
    }
    set({
      challenge: started.challenge,
      questions,
      answers: questions.map(() => -1),
      stage: 'challenge',
      problem: null,
    });
  },
  enterCode: (ok) =>
    set((s) => ({
      challenge: s.challenge ? verifyCode(s.challenge, ok) : null,
      problem: ok ? null : 'That code didn’t match. Check the message and try again.',
    })),
  acknowledge: () => set((s) => ({ challenge: s.challenge ? confirm(s.challenge) : null })),
  answer: (index, choice) =>
    set((s) => ({ answers: s.answers.map((a, i) => (i === index ? choice : a)) })),
  submitKba: () =>
    set((s) => {
      if (!s.challenge) return s;
      const scored = scoreKba(s.challenge, s.questions, s.answers);
      return {
        challenge: scored,
        // A spent set is gone: the guardian needs new questions, not another go.
        problem: scored.confirmed ? null : 'That didn’t check out. We’ll ask a different set.',
        answers: scored.confirmed ? s.answers : s.questions.map(() => -1),
      };
    }),
  finish: (scope, policyVersion) => {
    const challenge = get().challenge;
    if (!challenge) return;
    const result = completeConsent(challenge, { scope, policyVersion });
    if (!result.ok) {
      set({ problem: result.reason });
      return;
    }
    set({ record: result.record, stage: 'done', problem: null });
  },
  reset: () => set({ ...BLANK, env: DEFAULT_CONSENT_ENVIRONMENT }),
}));
