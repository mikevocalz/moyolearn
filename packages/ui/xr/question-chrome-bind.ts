/**
 * The LearningQuestion binding — the seam between the `Question` view model
 * and the application's question-flow store. Same shape as
 * `board-chrome-bind.ts`: the Rive runtime owns the chrome presentation,
 * the store owns question truth, and this file moves values across in both
 * directions. It names no store and no evaluator — the probe route and the
 * tutor scene each bind it to their own handlers.
 *
 * JS → RIVE: push accepts a complete snapshot; the shared writer sends
 * only changed properties and advances revision once per changed snapshot.
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

import { chromePresentation } from './chrome-presentation.ts';
import type { ChromeRuntime } from './chrome-runtime.types.ts';
import { decodeQuestionCommand } from './question-commands.ts';
import { MAX_RIVE_CHOICES, type QuestionInteraction } from './question-contract.ts';

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
  /** The LISTEN button's up/exit edge — push-to-talk pairs down/up. */
  onVoiceEnd?(): void;
  onBoard(): void;
  onRetry(): void;
  onSkip(): void;
}

export interface QuestionChromeBinding {
  push(state: QuestionChromePresentation): void;
  dispose(): void;
}

export function bindQuestionChrome(
  runtime: ChromeRuntime,
  handlers: QuestionChromeHandlers,
): QuestionChromeBinding {
  const presentation = chromePresentation(runtime);
  let lastSeq = runtime.getNumber('commandSeq');
  let current: QuestionChromePresentation | null = null;
  let disposed = false;
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
    if (disposed || !current || current.grabbed) return;
    /* A release edge must ALWAYS reach the handler — gates below would
       swallow it (e.g. `submitting` flipped mid-hold) and leave the mic
       hot until the recorder's own timeout. */
    if (intent.kind === 'releaseVoice') { handlers.onVoiceEnd?.(); return; }
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[chrome] question cmd', intent.kind, 'loading:', current.loading, 'submitting:', current.submitting, 'disabled:', current.disabled);
    if (intent.kind === 'selectChoice' || intent.kind === 'toggleChoice') {
      if (current.disabled || current.submitting || intent.index >= Math.min(current.choiceLabels.length, MAX_RIVE_CHOICES)) return;
    }
    if (intent.kind === 'submit' && (!current.answerValid || current.disabled || current.submitting)) return;
    if (intent.kind === 'requestHint' && (!current.hintAvailable || current.loading || current.submitting)) return;
    if (['next', 'skip', 'startVoice'].includes(intent.kind) && (current.loading || current.submitting)) return;
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
      if (disposed) return;
      current = state;
      presentation.setString('questionId', state.questionId);
      presentation.setString('subjectLabel', state.subjectLabel);
      presentation.setString('skillLabel', state.skillLabel);
      presentation.setString('progressLabel', state.progressLabel);
      presentation.setString('localeLabel', state.localeLabel);
      presentation.setString('interactionLabel', state.interactionLabel);
      presentation.setNumber('interactionKind', INTERACTION_KIND[state.interaction]);
      presentation.setNumber('choiceCount', Math.min(state.choiceLabels.length, MAX_RIVE_CHOICES));
      for (let i = 0; i < MAX_RIVE_CHOICES; i++) {
        presentation.setString(`choice${i}Label`, state.choiceLabels[i] ?? '');
        presentation.setBoolean(`choice${i}Visible`, i < state.choiceLabels.length);
        presentation.setBoolean(`choice${i}Selected`, state.selectedChoices.includes(i));
      }
      presentation.setNumber('phase', state.phase);
      presentation.setNumber('questionNumber', state.questionNumber);
      presentation.setNumber('questionTotal', state.questionTotal);
      presentation.setBoolean('answerValid', state.answerValid);
      presentation.setString('answerText', state.answerText);
      presentation.setBoolean('hintAvailable', state.hintAvailable);
      presentation.setBoolean('hintVisible', state.hintVisible);
      presentation.setString('hintLabel', state.hintLabel);
      presentation.setString('hintText', state.hintText);
      presentation.setString('submitLabel', state.submitLabel);
      presentation.setString('continueLabel', state.continueLabel);
      presentation.setString('skipLabel', state.skipLabel);
      presentation.setString('listenLabel', state.listenLabel);
      presentation.setString('feedbackTitle', state.feedbackTitle);
      presentation.setString('feedbackBody', state.feedbackBody);
      presentation.setBoolean('correct', state.correct);
      presentation.setBoolean('incorrect', state.incorrect);
      presentation.setBoolean('ungraded', state.ungraded);
      presentation.setBoolean('answered', state.answered);
      presentation.setBoolean('loading', state.loading);
      presentation.setBoolean('submitting', state.submitting);
      presentation.setBoolean('disabled', state.disabled);
      presentation.setBoolean('grabbed', state.grabbed);
      presentation.setBoolean('reducedMotion', state.reducedMotion);
      presentation.setString('status', state.status);
      presentation.setNumber('errorCode', state.errorCode);
      presentation.setNumber('uiOpacity', state.uiOpacity ?? 1);
      presentation.commit();

    },
    dispose() {
      disposed = true;
      runtime.observeNumber('commandSeq', undefined);
    },
  };
}
