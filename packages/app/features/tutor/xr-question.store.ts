'use client';
/**
 * The XR question-flow store — question truth, answer draft, sequencing,
 * evidence and async results. Rive owns transient animation state; this
 * owns everything a child can be graded on.
 *
 * TWO BUFFERS, ONE TOKEN. `current` is what the panel shows; `next` is the
 * prefetched question staged behind it. The swap happens only at the
 * transition's hidden midpoint (`commitNext` from `loading-next`), never
 * while the exiting question is still visible. `transitionToken` is the
 * stale-response guard: every async resolution captures the token at
 * dispatch and is dropped if the store has since moved on — a slow
 * evaluation for question N can never overwrite N+1.
 *
 * EVALUATION IS NEVER DONE HERE. `submit` produces a token and a phase;
 * the route's evaluator (server-objective → /api/tutor/evaluate,
 * coach-review → tutor turn, ungraded → local ack) resolves it. A question
 * carrying no evidence can only ever resolve `ungraded` — there is no
 * path from this store to invented correctness.
 *
 * SOT: spec §12 state machine · packages/ui/xr/question-contract.ts ·
 *      packages/ui/xr/question-commands.ts · xr-session.store.ts
 * SOT-KEYWORDS: xr question flow store zustand two buffer transition token answer draft feedback sequencing evidence
 */

import { create } from 'zustand';
import type {
  XrAnswerDraft,
  XrLearningQuestion,
  XrQuestionFeedback,
  XrQuestionOutcome,
  XrQuestionPhase,
} from '@acme/ui/xr';

/** `phase` values the `QuestionFlow` state machine is authored around —
    feedback states resolve to 5/6/7 via `rivePhase`, not stored. */
export const QUESTION_RIVE_PHASE = {
  entranceLoading: 0,
  entering: 1,
  idle: 2,
  selecting: 3,
  submitting: 4,
  feedbackCorrect: 5,
  feedbackIncorrect: 6,
  feedbackUngraded: 7,
  exiting: 8,
  loadingNext: 9,
  enteringNext: 10,
  error: 11,
} as const;

const TRANSITIONS: Record<XrQuestionPhase, readonly XrQuestionPhase[]> = {
  'loading-initial': ['entering', 'error'],
  entering: ['idle', 'error'],
  idle: ['submitting', 'exiting', 'loading-next', 'error'],
  submitting: ['feedback', 'error', 'idle'],
  feedback: ['exiting', 'idle', 'error'],
  exiting: ['loading-next', 'entering', 'idle', 'error'],
  'loading-next': ['entering', 'error'],
  error: ['loading-initial', 'idle'],
};

export interface XrQuestionFlowState {
  current: XrLearningQuestion | null;
  next: XrLearningQuestion | null;
  phase: XrQuestionPhase;
  answer: XrAnswerDraft;
  feedback: XrQuestionFeedback | null;
  /** Monotonic; captured by async callers, checked at resolution. */
  transitionToken: number;
  grabbed: boolean;
  status: string;
  /** Whether the hint sheet is open on the current question. */
  hintVisible: boolean;

  /** The first question arrives — enters at `loading-initial`. */
  loadInitial(question: XrLearningQuestion): void;
  /** Prefetch lands in the `next` buffer; never disturbs `current`. */
  stageNext(question: XrLearningQuestion | null): void;
  /** Entrance finished — the panel is interactive. */
  arrive(): void;
  /** A Rive select/toggle on the bounded choice rail. */
  toggleChoice(choiceId: string): void;
  selectChoice(choiceId: string): void;
  setTextAnswer(text: string): void;
  /** Begin evaluation. Returns the token the resolver must quote back. */
  submit(): number | null;
  /** Evaluation resolved — accepted only if `token` is still current. */
  resolveSubmit(token: number, feedback: XrQuestionFeedback): boolean;
  /** Show the hint sheet on the current question. */
  showHint(): void;
  /** Feedback → back to the question with a clean draft — the "try again"
      a wrong answer owes the child. */
  retryAnswer(): void;
  /** Begin the exit for the next question (or a skip — same motion). */
  beginExit(): void;
  /** The exit finished but the next question is not staged yet — the
      loader holds the hidden midpoint while the fetch lands. */
  toLoadingNext(): void;
  /** The hidden midpoint: swap buffers, then let the entrance play. */
  commitNext(): void;
  /** A recoverable failure — the error state carries the message. */
  fail(message: string): void;
  /** Retry from `error` — restarts the initial load path. */
  retry(): void;
  setGrabbed(grabbed: boolean): void;
  /** Hard reset — route unmount / session end. */
  reset(): void;
}

/** Does the draft carry an answerable selection? */
export function answerReady(answer: XrAnswerDraft): boolean {
  switch (answer.kind) {
    case 'choices': return answer.selectedIds.length > 0;
    case 'text': return answer.text.trim().length > 0;
    case 'expression': return answer.expression.trim().length > 0;
    case 'labels': return answer.placements.length > 0;
    case 'ordering': return answer.order.length > 0;
    case 'board': return true;
    case 'voice': return answer.transcript.trim().length > 0;
    default: return false;
  }
}

export const useXrQuestionFlow = create<XrQuestionFlowState>((set, get) => ({
  current: null,
  next: null,
  phase: 'loading-initial',
  answer: { kind: 'none' },
  feedback: null,
  transitionToken: 0,
  grabbed: false,
  status: '',
  hintVisible: false,

  loadInitial: (question) =>
    set({
      current: question,
      next: null,
      answer: { kind: 'none' },
      feedback: null,
      hintVisible: false,
      phase: 'loading-initial',
      transitionToken: get().transitionToken + 1,
      status: '',
    }),

  stageNext: (question) => set({ next: question }),

  arrive: () => {
    if (get().phase === 'entering') set({ phase: 'idle' });
  },

  toggleChoice: (choiceId) => {
    const { phase, answer, current } = get();
    if (phase !== 'idle' || !current) return;
    const selected =
      answer.kind === 'choices'
        ? answer.selectedIds.includes(choiceId)
          ? answer.selectedIds.filter((id) => id !== choiceId)
          : [...answer.selectedIds, choiceId]
        : [choiceId];
    set({ answer: { kind: 'choices', selectedIds: selected } });
  },

  selectChoice: (choiceId) => {
    const { phase } = get();
    if (phase !== 'idle') return;
    set({ answer: { kind: 'choices', selectedIds: [choiceId] } });
  },

  setTextAnswer: (text) => {
    if (get().phase !== 'idle') return;
    set({ answer: { kind: 'text', text } });
  },

  submit: () => {
    const { phase, answer, transitionToken } = get();
    if (phase !== 'idle' || !answerReady(answer)) return null;
    const token = transitionToken + 1;
    set({ phase: 'submitting', transitionToken: token });
    return token;
  },

  resolveSubmit: (token, feedback) => {
    const { phase, transitionToken, current } = get();
    /* Stale or out-of-phase resolution — a slow evaluate for a question
       the child already left. Dropped, never applied. */
    if (token !== transitionToken || phase !== 'submitting' || !current) return false;
    /* No evidence on the question = nothing server-gradable; a resolved
       correct/incorrect here would be invented truth. */
    if (current.evaluation.kind === 'ungraded' && feedback.outcome !== 'ungraded') return false;
    set({ phase: 'feedback', feedback });
    return true;
  },

  showHint: () => {
    const { phase, current } = get();
    if (phase === 'idle' && current?.hint?.available) set({ hintVisible: true });
  },

  retryAnswer: () => {
    const { phase, feedback } = get();
    if (phase === 'feedback' && feedback?.outcome === 'incorrect') {
      set({ phase: 'idle', answer: { kind: 'none' }, feedback: null });
    }
  },

  beginExit: () => {
    const { phase } = get();
    if (phase === 'feedback' || phase === 'idle') {
      set({ phase: 'exiting', transitionToken: get().transitionToken + 1 });
    }
  },

  toLoadingNext: () => {
    if (get().phase === 'exiting') set({ phase: 'loading-next' });
  },

  commitNext: () => {
    const { phase, next } = get();
    if (phase !== 'exiting' && phase !== 'loading-next') return;
    if (next) {
      set({
        current: next,
        next: null,
        answer: { kind: 'none' },
        feedback: null,
        hintVisible: false,
        phase: 'entering',
      });
    } else {
      set({ phase: 'idle' });
    }
  },

  fail: (message) => set({ phase: 'error', status: message }),
  retry: () => {
    if (get().phase === 'error') set({ phase: 'loading-initial', status: '' });
  },
  setGrabbed: (grabbed) => set({ grabbed }),

  reset: () =>
    set({
      current: null,
      next: null,
      phase: 'loading-initial',
      answer: { kind: 'none' },
      feedback: null,
      transitionToken: get().transitionToken + 1,
      grabbed: false,
      status: '',
      hintVisible: false,
    }),
}));

/**
 * The store's app-level phase → the number the `QuestionFlow` state
 * machine reads. Feedback splits by outcome; `idle` becomes `selecting`
 * the moment a draft exists, which is what the staggered choice-state is
 * authored around.
 */
export function rivePhaseOf(
  phase: XrQuestionPhase,
  feedback: XrQuestionFeedback | null,
  hasAnswer: boolean,
): number {
  switch (phase) {
    case 'loading-initial': return QUESTION_RIVE_PHASE.entranceLoading;
    case 'entering': return QUESTION_RIVE_PHASE.entering;
    case 'idle': return hasAnswer ? QUESTION_RIVE_PHASE.selecting : QUESTION_RIVE_PHASE.idle;
    case 'submitting': return QUESTION_RIVE_PHASE.submitting;
    case 'feedback':
      return feedback?.outcome === 'correct'
        ? QUESTION_RIVE_PHASE.feedbackCorrect
        : feedback?.outcome === 'incorrect'
          ? QUESTION_RIVE_PHASE.feedbackIncorrect
          : QUESTION_RIVE_PHASE.feedbackUngraded;
    case 'exiting': return QUESTION_RIVE_PHASE.exiting;
    case 'loading-next': return QUESTION_RIVE_PHASE.loadingNext;
    case 'error': return QUESTION_RIVE_PHASE.error;
  }
}
