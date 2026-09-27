import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bindBoardChrome } from './board-chrome-bind.ts';
import { bindQuestionChrome, type QuestionChromePresentation } from './question-chrome-bind.ts';
import type { BoardChromePresentation } from './board-chrome.types.ts';
import type { ChromeRuntime } from './chrome-runtime.types.ts';

function runtime() {
  const numbers = new Map<string, number>();
  const observers = new Map<string, ((value: number) => void) | undefined>();
  const api: ChromeRuntime = {
    getNumber: (key) => numbers.get(key) ?? 0,
    setNumber: (key, value) => { numbers.set(key, value); },
    setBoolean: () => {}, setString: () => {},
    observeNumber: (key, callback) => { observers.set(key, callback); },
  };
  let sequence = 0;
  return { api, observers, command(value: number, arg = 0) {
    api.setNumber('command', value); api.setNumber('commandArg', arg);
    observers.get('commandSeq')?.(++sequence);
    assert.equal(api.getNumber('command'), 0, 'acknowledge before calling application code');
  } };
}
const board: BoardChromePresentation = {
  tool: 'draw', ink: 'black', canUndo: true, canRedo: true, hasMarks: true,
  asking: false, paletteOpen: false, clearArmed: false, grabbed: false,
  reducedMotion: true, status: '',
};
test('Rive board commands reach the engine verbs, including all inks and voice on empty paper', () => {
  const rt = runtime(); const calls: unknown[] = [];
  const binding = bindBoardChrome(rt.api, {
    onTool: (v) => calls.push(['tool', v]), onInk: (v) => calls.push(['ink', v]),
    onPalette: (v) => calls.push(['palette', v]), onUndo: () => calls.push('undo'),
    onRedo: () => calls.push('redo'), onClear: () => calls.push('clear'), onAsk: () => calls.push('ask'),
  });
  binding.push(board);
  for (const id of [1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17]) rt.command(id);
  assert.deepEqual(calls, [['tool','draw'],['tool','highlight'],['tool','eraser'],['palette',true],
    'undo','redo','clear','ask', ...['black','blue','red','green','yellow','orange','violet'].map(v=>['ink',v]), ['palette',false]]);
  calls.length = 0;
  binding.push({ ...board, canUndo: false, canRedo: false, hasMarks: false });
  for (const id of [5,6,7,8]) rt.command(id);
  assert.deepEqual(calls, ['ask']);
  binding.push({ ...board, asking: true }); rt.command(8);
  binding.push({ ...board, grabbed: true }); rt.command(1);
  assert.deepEqual(calls, ['ask']);
  const late = rt.observers.get('commandSeq');
  binding.dispose(); rt.api.setNumber('command', 8); late?.(100);
  assert.deepEqual(calls, ['ask'], 'queued native callback cannot revive an unmounted panel');
});

test('sequence replay is ignored and throwing handlers cannot leave an armed command', () => {
  const rt = runtime(); let asks = 0;
  const noop = () => {};
  const binding = bindBoardChrome(rt.api, { onTool: noop, onInk: noop, onPalette: noop,
    onUndo: noop, onRedo: noop, onClear: noop, onAsk: () => { asks++; throw Error('host failed'); } });
  binding.push(board);
  assert.throws(() => rt.command(8));
  assert.equal(rt.api.getNumber('command'), 0);
  rt.observers.get('commandSeq')?.(1);
  assert.equal(asks, 1);
  binding.dispose();
});

test('question controls dispatch every footer action and reject busy or out-of-range answers', () => {
  const rt = runtime(); const calls: unknown[] = [];
  const binding = bindQuestionChrome(rt.api, {
    onSelectChoice: (i) => calls.push(['select',i]), onToggleChoice: (i) => calls.push(['toggle',i]),
    onSubmit: () => calls.push('submit'), onNext: () => calls.push('next'), onHint: () => calls.push('hint'),
    onVoice: () => calls.push('voice'), onBoard: () => calls.push('board'), onRetry: () => calls.push('retry'), onSkip: () => calls.push('skip'),
  });
  const state: QuestionChromePresentation = {
    questionId:'q', subjectLabel:'Math', skillLabel:'', progressLabel:'', localeLabel:'EN',
    interactionLabel:'', interaction:'multiple-choice', choiceLabels:['A','B'], selectedChoices:[],
    phase:2, questionNumber:1, questionTotal:1, answerValid:true, answerText:'A', hintAvailable:true,
    hintVisible:false, hintText:'', submitLabel:'SUBMIT', continueLabel:'NEXT', skipLabel:'SKIP',
    listenLabel:'LISTEN', hintLabel:'HINT', feedbackTitle:'', feedbackBody:'', correct:false,
    incorrect:false, ungraded:false, answered:false, loading:false, submitting:false, disabled:false,
    grabbed:false, reducedMotion:true, status:'', errorCode:0,
  };
  binding.push(state);
  for (let id=1;id<=9;id++) rt.command(id,1);
  assert.deepEqual(calls,[['select',1],['toggle',1],'submit','next','hint','voice','board','retry','skip']);
  calls.length=0;
  rt.command(1,2); rt.command(2,99);
  binding.push({...state, submitting:true});
  for (const id of [1,2,3,4,5,6,9]) rt.command(id);
  assert.deepEqual(calls,[]);
  binding.dispose();
  assert.equal(rt.observers.get('commandSeq'),undefined);
});
