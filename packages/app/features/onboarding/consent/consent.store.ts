'use client';
// ConsentFlow state. Zustand, not useState — the challenge outlives the step that
// started it (a guardian can leave the app to fetch the code and come back), and
// the finished record is read by the step that creates the child.
//
// The record's ID is the thing that leaves this store: the children step sends
// `consentId` to /api/family/learners and the server reads the grant from its
// own row. The `record` object is for the screen's copy, not for the wire.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1
// SOT-KEYWORDS: consent store zustand challenge kba record guardian live channel

import { create } from 'zustand';
import {
  completeConsent,
  confirm,
  scoreKba,
  startChallenge,
  verifyCode,
  DEFAULT_CONSENT_ENVIRONMENT,
  MAX_CODE_ATTEMPTS,
  type ConsentChallenge,
  type ConsentEnvironment,
  type ConsentMethod,
  type ConsentRecord,
  type KbaQuestion,
} from '@acme/auth';
import { getAuthMode } from '../../../providers/session/auth-mode.ts';
import { createConsentChannel, type ConsentChannel } from './consent-channel';

export type ConsentStage = 'notice' | 'method' | 'challenge' | 'done';

/**
 * What the live server can deliver: an email sender and nothing else. No SMS
 * provider, no bought KBA source, no card on file until billing says so. The
 * dev channel mints codes for anything, so it keeps the permissive default.
 */
export const LIVE_CONSENT_ENVIRONMENT: ConsentEnvironment = {
  disclosesToThirdParties: false,
  hasVerifiedCard: false,
  canSendText: false,
  hasKbaProvider: false,
};

const environmentFor = (): ConsentEnvironment =>
  getAuthMode() === 'live' ? LIVE_CONSENT_ENVIRONMENT : DEFAULT_CONSENT_ENVIRONMENT;

interface ConsentState {
  stage: ConsentStage;
  env: ConsentEnvironment;
  /** Live in live mode, in-memory in a dev build (consent-channel.ts). */
  channel: ConsentChannel;
  challenge: ConsentChallenge | null;
  /** The server's id for the challenge; null for a KBA set, which has no server row. */
  challengeId: string | null;
  questions: KbaQuestion[];
  answers: number[];
  record: ConsentRecord | null;
  /** The server's id for the recorded consent — what the children step sends. */
  consentId: string | null;
  /** The refusal to show — never thrown, because a guardian can fix all of them. */
  problem: string | null;
  setStage: (stage: ConsentStage) => void;
  setEnv: (env: Partial<ConsentEnvironment>) => void;
  setChannel: (channel: ConsentChannel) => void;
  begin: (method: ConsentMethod, sentTo: string, questions?: KbaQuestion[]) => Promise<void>;
  enterCode: (code: string) => Promise<void>;
  acknowledge: () => void;
  answer: (index: number, choice: number) => void;
  submitKba: () => void;
  finish: (scope: string, policyVersion: string) => Promise<void>;
  reset: () => void;
}

/** One message per verdict — a burnt challenge must not read like a typo. */
const CODE_PROBLEMS: Record<string, string | null> = {
  verified: null,
  wrong: 'That code didn’t match. Check the message and try again.',
  expired: 'That code has expired. Send a new one.',
  burnt: `That's ${MAX_CODE_ATTEMPTS} wrong tries — send a new code to start again.`,
};

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

const BLANK = {
  stage: 'notice' as ConsentStage,
  challenge: null,
  challengeId: null,
  questions: [],
  answers: [],
  record: null,
  consentId: null,
  problem: null,
};

export const useConsentFlow = create<ConsentState>((set, get) => ({
  ...BLANK,
  env: environmentFor(),
  channel: createConsentChannel(),
  setStage: (stage) => set({ stage, problem: null }),
  setChannel: (channel) => set({ channel }),
  setEnv: (env) => set((s) => ({ env: { ...s.env, ...env } })),
  begin: async (method, sentTo, questions = []) => {
    const started = startChallenge(method, sentTo, get().env);
    if (!started.ok) {
      set({ problem: started.reason });
      return;
    }
    // KBA has nothing to send; every other method's code is minted by the
    // channel, and a send that fails is a refusal to show, not a step forward.
    let challengeId: string | null = null;
    if (method !== 'kba') {
      try {
        ({ challengeId } = await get().channel.send(method, started.challenge.sentTo));
      } catch (error) {
        set({ problem: messageOf(error, 'We couldn’t send the code. Try again.') });
        return;
      }
    }
    set({
      challenge: started.challenge,
      challengeId,
      questions,
      answers: questions.map(() => -1),
      stage: 'challenge',
      problem: null,
    });
  },
  enterCode: async (code) => {
    const { challenge, challengeId, channel } = get();
    if (!challenge || !challengeId) return;
    // The channel says whether it matches; the machine says whether a match
    // still counts. Neither question is answerable by the other.
    let matched: boolean;
    try {
      matched = await channel.verify(challengeId, code);
    } catch (error) {
      set({ problem: messageOf(error, 'We couldn’t check the code. Try again.') });
      return;
    }
    const result = verifyCode(challenge, matched);
    set({
      challenge: result.challenge,
      problem: CODE_PROBLEMS[result.verdict],
    });
    if (result.verdict === 'verified') {
      try {
        await channel.sendConfirmation(challengeId);
      } catch (error) {
        set({ problem: messageOf(error, 'We couldn’t send the confirmation. Try again.') });
      }
    }
  },
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
  finish: async (scope, policyVersion) => {
    const { challenge, challengeId, channel } = get();
    if (!challenge) return;
    // The machine refuses a half-finished challenge before the server is asked;
    // the server refuses again on its own row. Both answers are the same.
    const result = completeConsent(challenge, { scope, policyVersion });
    if (!result.ok) {
      set({ problem: result.reason });
      return;
    }
    try {
      const { consentId } = await channel.record(challengeId, { scope, policyVersion });
      set({ record: result.record, consentId, stage: 'done', problem: null });
    } catch (error) {
      set({ problem: messageOf(error, 'We couldn’t record the permission. Try again.') });
    }
  },
  reset: () => set({ ...BLANK, env: environmentFor() }),
}));
