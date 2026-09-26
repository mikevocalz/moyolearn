// The question-flow store's sequencing, asserted rather than assumed: the
// two-buffer swap, the stale-token guard, and the rule that a question with
// no grading route can never come back marked correct.
// SOT: packages/app/features/tutor/xr-question.store.ts
// SOT-KEYWORDS: xr question flow store test two buffer transition token stale evidence ungraded

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { answerReady, rivePhaseOf, useXrQuestionFlow } from './xr-question.store.ts';
import type { XrLearningQuestion } from '@acme/ui/xr';

const question = (id: string, over: Partial<XrLearningQuestion> = {}): XrLearningQuestion => ({
  id,
  subject: 'math',
  subjectLabel: 'MATH',
  uiLocale: 'en-US',
  questionLocale: 'en-US',
  textDirection: 'ltr',
  prompt: `${id} prompt`,
  content: [],
  interaction: 'multiple-choice',
  choices: [{ id: 'a', label: '1' }, { id: 'b', label: '2' }],
  source: 'practice',
  evaluation: { kind: 'server-objective' },
  evidence: { questionId: id, revision: 'r1' },
  ...over,
});

const reset = () => useXrQuestionFlow.getState().reset();
const state = () => useXrQuestionFlow.getState();

test('submit is gated on a real answer, then resolves once', () => {
  reset();
  state().loadInitial(question('q1'));
  assert.equal(state().phase, 'loading-initial');
  /* The entrance gate is the renderer's `arrive`, not the data landing. */
  useXrQuestionFlow.setState({ phase: 'entering' });
  state().arrive();
  assert.equal(state().phase, 'idle');
  assert.equal(state().submit(), null, 'no answer, no submit');
  state().selectChoice('a');
  const token = state().submit();
  assert.ok(token !== null);
  assert.equal(state().phase, 'submitting');
  assert.equal(
    state().resolveSubmit(token, { outcome: 'correct', title: 't', body: 'b' }),
    true,
  );
  assert.equal(state().phase, 'feedback');
  assert.equal(state().feedback?.outcome, 'correct');
});

test('a stale token can never overwrite the live submission', () => {
  reset();
  state().loadInitial(question('q1'));
  useXrQuestionFlow.setState({ phase: 'idle' });
  state().selectChoice('a');
  const token = state().submit();
  /* Out-of-phase resolution: already settled, nowhere to land. */
  assert.equal(state().resolveSubmit(token!, { outcome: 'correct', title: 't', body: 'b' }), true);
  state().beginExit();
  /* The exit bumped the token — the same evaluation arriving late now
     finds its token dead and is dropped, never applied. */
  assert.equal(
    state().resolveSubmit(token!, { outcome: 'incorrect', title: 't', body: 'b' }),
    false,
    'stale resolution dropped',
  );
});

test('an ungraded question can never resolve to a correctness verdict', () => {
  reset();
  state().loadInitial(question('q1', { evaluation: { kind: 'ungraded' }, evidence: undefined }));
  useXrQuestionFlow.setState({ phase: 'idle' });
  state().selectChoice('a');
  const token = state().submit();
  assert.ok(token !== null);
  assert.equal(
    state().resolveSubmit(token, { outcome: 'correct', title: 't', body: 'b' }),
    false,
    'invented verdict refused',
  );
  assert.equal(
    state().resolveSubmit(token, { outcome: 'ungraded', title: 't', body: 'b' }),
    true,
  );
});

test('the next buffer swaps only at the hidden midpoint', () => {
  reset();
  state().loadInitial(question('q1'));
  state().stageNext(question('q2'));
  /* Staging never disturbs what is on screen. */
  assert.equal(state().current?.id, 'q1');
  assert.equal(state().next?.id, 'q2');
  useXrQuestionFlow.setState({ phase: 'idle' });
  state().beginExit();
  state().commitNext();
  assert.equal(state().current?.id, 'q2');
  assert.equal(state().next, null);
  assert.equal(state().phase, 'entering');
  /* The draft reset with the swap — a stale answer can never ride along. */
  assert.equal(state().answer.kind, 'none');
});

test('commitNext with no staged question settles back to idle', () => {
  reset();
  state().loadInitial(question('q1'));
  useXrQuestionFlow.setState({ phase: 'idle' });
  state().beginExit();
  state().commitNext();
  assert.equal(state().phase, 'idle');
});

test('rivePhaseOf maps the app lifecycle to the authored numbers', () => {
  assert.equal(rivePhaseOf('loading-initial', null, false), 0);
  assert.equal(rivePhaseOf('entering', null, false), 1);
  assert.equal(rivePhaseOf('idle', null, false), 2);
  assert.equal(rivePhaseOf('idle', null, true), 3);
  assert.equal(rivePhaseOf('submitting', null, true), 4);
  assert.equal(rivePhaseOf('feedback', { outcome: 'correct', title: '', body: '' }, true), 5);
  assert.equal(rivePhaseOf('feedback', { outcome: 'incorrect', title: '', body: '' }, true), 6);
  assert.equal(rivePhaseOf('feedback', { outcome: 'ungraded', title: '', body: '' }, true), 7);
  assert.equal(rivePhaseOf('exiting', null, true), 8);
  assert.equal(rivePhaseOf('loading-next', null, false), 9);
  assert.equal(rivePhaseOf('error', null, false), 11);
});

test('answerReady discriminates the draft union honestly', () => {
  assert.equal(answerReady({ kind: 'none' }), false);
  assert.equal(answerReady({ kind: 'choices', selectedIds: [] }), false);
  assert.equal(answerReady({ kind: 'choices', selectedIds: ['a'] }), true);
  assert.equal(answerReady({ kind: 'text', text: '  ' }), false);
  assert.equal(answerReady({ kind: 'text', text: '42' }), true);
  assert.equal(answerReady({ kind: 'board', boardId: 'b' }), true);
});
