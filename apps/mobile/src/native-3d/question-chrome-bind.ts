/**
 * The LearningQuestion binding — the seam between the `Question` view model
 * and the application's question-flow store. Same shape as
 * `board-chrome-bind.ts`: the Rive runtime owns the chrome presentation,
 * the store owns question truth, and this file moves values across in both
 * directions. It names no store and no evaluator — the probe route and the
 * tutor scene each bind it to their own handlers.
 *
 * JS → RIVE (presentation): `push` writes the whole snapshot every time —
 * tap cadence, not frame cadence, and a diff mask is one more place for a
 * property to silently go stale. `revision` bumps on every push so the
 * artboard's data-driven states always see an edge.
 *
 * RIVE → JS (intent): control listeners write `command` + `commandArg` and
 * bump `commandSeq`; the observer on `commandSeq` is the edge detector,
 * `decodeQuestionCommand` decodes, and `command` is written back to 0
 * before dispatch so a restarted runtime never replays a stale press.
 *
 * SOT: packages/ui/xr/question-commands.ts · packages/ui/xr/question-contract.ts ·
 *      packages/ui/xr/question-chrome-layout.ts · probes/rive-panel/rive-question/scene.rml
 * SOT-KEYWORDS: xr rive question chrome bind command observe dispatch view model zustand bridge
 */

import type { RivePanel } from 'nitro-canvas-in-Vision';
import {
  decodeQuestionCommand,
  MAX_RIVE_CHOICES,
  type QuestionInteraction,
} from '@acme/ui/xr';

/** `interactionKind` ordinals — informational on the artboard (the chip
    label is `interactionLabel`); a number exists so the runtime never
    renders a control kind it was not told about. */
const INTERACTION_KIND: Record<QuestionInteraction, number> = {
  'multiple-choice': 0,
  'multi-select': 1,
  'short-text': 2,
  'long-text': 3,
  numeric: 4,
  expression: 5,
  'true-false': 6,
  ordering: 7,
  matching: 8,
  'diagram-label': 9,
  'board-work': 10,
  voice: 11,
  'tutor-conversation': 12,
};

/** The application state the chrome shows — a snapshot, not a subscription. */
export interface QuestionChromePresentation {
  questionId: string;
  subjectLabel: string;
  skillLabel: string;
  progressLabel: string;
  localeLabel: string;
  /** Chrome-level copy only — dynamic content renders in the native window. */
  interactionLabel: string;
  interaction: QuestionInteraction;
  /** Up to MAX_RIVE_CHOICES labels for the rail; `count` bounds visibility. */
  choiceLabels: readonly string[];
  selectedChoices: readonly number[];
  /** phase → `QuestionFlow` state-machine number (question-commands table). */
  phase: number;
  questionNumber: number;
  questionTotal: number;
  answerValid: boolean;
  answerText: string;
  hintAvailable: boolean;
  hintVisible: boolean;
  hintText: string;
  submitLabel: string;
  continueLabel: string;
  skipLabel: string;
  listenLabel: string;
  hintLabel: string;
  feedbackTitle: string;
  feedbackBody: string;
  correct: boolean;
  incorrect: boolean;
  ungraded: boolean;
  answered: boolean;
  loading: boolean;
  submitting: boolean;
  disabled: boolean;
  grabbed: boolean;
  reducedMotion: boolean;
  status: string;
  errorCode: number;
  uiOpacity?: number;
}

export interface QuestionChromeHandlers {
  onSelectChoice(index: number): void;
  onToggleChoice(index: number): void;
  onSubmit(): void;
  onNext(): void;
  onHint(): void;
  onVoice(): void;
  onBoard(): void;
  onRetry(): void;
  onSkip(): void;
}

export interface QuestionChromeBinding {
  push(state: QuestionChromePresentation): void;
  dispose(): void;
}

export function bindQuestionChrome(
  runtime: RivePanel,
  handlers: QuestionChromeHandlers,
): QuestionChromeBinding {
  let lastSeq = runtime.getNumber('commandSeq');
  runtime.observeNumber('commandSeq', (seq) => {
    if (seq === lastSeq) return;
    lastSeq = seq;
    const intent = decodeQuestionCommand(
      runtime.getNumber('command'),
      runtime.getNumber('commandArg'),
    );
    /* Acknowledge before dispatch: a throwing handler must not leave the
       press armed for a phantom replay on the next unrelated bump. */
    runtime.setNumber('command', 0);
    switch (intent.kind) {
      case 'selectChoice': handlers.onSelectChoice(intent.index); break;
      case 'toggleChoice': handlers.onToggleChoice(intent.index); break;
      case 'submit': handlers.onSubmit(); break;
      case 'next': handlers.onNext(); break;
      case 'requestHint': handlers.onHint(); break;
      case 'startVoice': handlers.onVoice(); break;
      case 'openBoard': handlers.onBoard(); break;
      case 'retry': handlers.onRetry(); break;
      case 'skip': handlers.onSkip(); break;
      case 'none': break;
    }
  });
  return {
    push(state) {
      runtime.setString('questionId', state.questionId);
      runtime.setString('subjectLabel', state.subjectLabel);
      runtime.setString('skillLabel', state.skillLabel);
      runtime.setString('progressLabel', state.progressLabel);
      runtime.setString('localeLabel', state.localeLabel);
      runtime.setString('interactionLabel', state.interactionLabel);
      runtime.setNumber('interactionKind', INTERACTION_KIND[state.interaction]);
      runtime.setNumber('choiceCount', Math.min(state.choiceLabels.length, MAX_RIVE_CHOICES));
      for (let i = 0; i < MAX_RIVE_CHOICES; i++) {
        runtime.setString(`choice${i}Label`, state.choiceLabels[i] ?? '');
        runtime.setBoolean(`choice${i}Visible`, i < state.choiceLabels.length);
        runtime.setBoolean(`choice${i}Selected`, state.selectedChoices.includes(i));
      }
      runtime.setNumber('phase', state.phase);
      runtime.setNumber('questionNumber', state.questionNumber);
      runtime.setNumber('questionTotal', state.questionTotal);
      runtime.setBoolean('answerValid', state.answerValid);
      runtime.setString('answerText', state.answerText);
      runtime.setBoolean('hintAvailable', state.hintAvailable);
      runtime.setBoolean('hintVisible', state.hintVisible);
      runtime.setString('hintLabel', state.hintLabel);
      runtime.setString('hintText', state.hintText);
      runtime.setString('submitLabel', state.submitLabel);
      runtime.setString('continueLabel', state.continueLabel);
      runtime.setString('skipLabel', state.skipLabel);
      runtime.setString('listenLabel', state.listenLabel);
      runtime.setString('feedbackTitle', state.feedbackTitle);
      runtime.setString('feedbackBody', state.feedbackBody);
      runtime.setBoolean('correct', state.correct);
      runtime.setBoolean('incorrect', state.incorrect);
      runtime.setBoolean('ungraded', state.ungraded);
      runtime.setBoolean('answered', state.answered);
      runtime.setBoolean('loading', state.loading);
      runtime.setBoolean('submitting', state.submitting);
      runtime.setBoolean('disabled', state.disabled);
      runtime.setBoolean('grabbed', state.grabbed);
      runtime.setBoolean('reducedMotion', state.reducedMotion);
      runtime.setString('status', state.status);
      runtime.setNumber('errorCode', state.errorCode);
      runtime.setNumber('uiOpacity', state.uiOpacity ?? 1);
      runtime.setNumber('revision', runtime.getNumber('revision') + 1);
    },
    dispose() {
      runtime.observeNumber('commandSeq', undefined);
    },
  };
}
