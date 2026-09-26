/**
 * `questionPresentationOf` — the one place the question-flow store's state
 * becomes the `Question` view model's snapshot. Pure, so the mapping is
 * testable without a runtime: selection ids → rail indices, phase → the
 * authored number, the answer draft → the rail's `answerText`, locales →
 * the chips Rive shows but never localizes.
 *
 * LABELS ARE UI-LOCALE COPY, AND TODAY THE TABLE IS ENGLISH. The strings
 * below are the chrome's button labels in the panel's `uiLocale`; the
 * copy-table seam is this one function, so when the locale tables land
 * they land here and nowhere else. `uiLocale` is pushed into the chip so
 * a non-English chrome is at least visibly marked rather than silently
 * wrong.
 *
 * SOT: ./question-chrome-bind.ts · packages/app/features/tutor/xr-question.store.ts
 * SOT-KEYWORDS: xr question presentation mapping rive view model labels locale answer text phase
 */

import type { XrLearningQuestion } from '@acme/ui/xr';
import { answerReady, rivePhaseOf, type XrQuestionFlowState } from '@acme/app/features/tutor/xr-question.store.ts';
import type { QuestionChromePresentation } from './question-chrome-bind';

const INTERACTION_LABEL: Record<XrLearningQuestion['interaction'], string> = {
  'multiple-choice': 'SELECT ONE ANSWER',
  'multi-select': 'SELECT ALL THAT APPLY',
  'short-text': 'TYPE YOUR ANSWER',
  'long-text': 'WRITE YOUR ANSWER',
  numeric: 'ENTER A NUMBER',
  expression: 'ENTER THE EXPRESSION',
  'true-false': 'TRUE OR FALSE',
  ordering: 'PUT IN ORDER',
  matching: 'MATCH THE PAIRS',
  'diagram-label': 'LABEL THE DIAGRAM',
  'board-work': 'WORK IT ON THE BOARD',
  voice: 'SAY YOUR ANSWER',
  'tutor-conversation': 'TALK WITH NATALIE',
};

/** The draft rendered as the rail's read-out — what the child picked, in
    the labels they picked it from. */
function answerTextOf(question: XrLearningQuestion, state: XrQuestionFlowState): string {
  const { answer } = state;
  if (answer.kind === 'choices') {
    return answer.selectedIds
      .map((id) => question.choices?.find((c) => c.id === id)?.label ?? id)
      .join('  ·  ');
  }
  if (answer.kind === 'text' || answer.kind === 'expression') {
    return answer.kind === 'text' ? answer.text : answer.expression;
  }
  if (answer.kind === 'voice') return answer.transcript;
  if (answer.kind === 'labels') return `${answer.placements.length} placed`;
  if (answer.kind === 'ordering') return `${answer.order.length} ordered`;
  if (answer.kind === 'board') return 'On the board';
  return '';
}

export function questionPresentationOf(
  question: XrLearningQuestion | null,
  state: Pick<
    XrQuestionFlowState,
    'phase' | 'answer' | 'feedback' | 'hintVisible' | 'grabbed' | 'status'
  >,
): QuestionChromePresentation {
  const choiceLabels = (question?.choices ?? []).map((c) => c.label);
  const selectedChoices = (question?.choices ?? [])
    .map((c, i) => ({ i, selected: state.answer.kind === 'choices' && state.answer.selectedIds.includes(c.id) }))
    .filter((c) => c.selected)
    .map((c) => c.i);
  const outcome = state.feedback?.outcome ?? null;
  return {
    questionId: question?.id ?? '',
    subjectLabel: question?.subjectLabel ?? '',
    skillLabel: question?.skillLabel ?? '',
    progressLabel: question?.progress
      ? `Q ${question.progress.index}${question.progress.total ? ` / ${question.progress.total}` : ''}`
      : '',
    localeLabel: question ? question.uiLocale.toUpperCase().replace('-', '·') : '',
    interactionLabel: question ? INTERACTION_LABEL[question.interaction] : '',
    interaction: question?.interaction ?? 'multiple-choice',
    choiceLabels,
    selectedChoices,
    phase: rivePhaseOf(state.phase, state.feedback, answerReady(state.answer)),
    questionNumber: question?.progress?.index ?? 0,
    questionTotal: question?.progress?.total ?? 0,
    answerValid: answerReady(state.answer),
    answerText: question ? answerTextOf(question, state as XrQuestionFlowState) : '',
    hintAvailable: question?.hint?.available ?? false,
    hintVisible: state.hintVisible,
    hintText: question?.hint?.text ?? '',
    submitLabel: 'SUBMIT',
    continueLabel: 'NEXT',
    skipLabel: 'SKIP',
    listenLabel: 'LISTEN',
    hintLabel: 'HINT',
    feedbackTitle: state.feedback?.title ?? '',
    feedbackBody: state.feedback?.body ?? '',
    correct: outcome === 'correct',
    incorrect: outcome === 'incorrect',
    ungraded: outcome === 'ungraded',
    answered: state.phase === 'feedback' || state.phase === 'submitting',
    loading: state.phase === 'loading-initial' || state.phase === 'loading-next',
    submitting: state.phase === 'submitting',
    disabled: state.phase !== 'idle',
    grabbed: state.grabbed,
    reducedMotion: false,
    status: state.status,
    errorCode: state.phase === 'error' ? 1 : 0,
  };
}
