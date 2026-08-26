// The never-reveal backstop, and the one rule the whole product rests on: if
// `revealsAnswer` ever lets a solved answer through, Moyo is an answer app with
// extra steps. This file is the check that it does not.
//
// What it can and cannot prove is worth being exact about. It proves the
// deterministic backstop on arithmetic — the class `evaluateArithmetic` can
// decide. It does not prove the pedagogy contract itself holds on a word
// problem or an algebraic derivation; that is doc 18 §3 layer 5's eval
// registry, which grades never-reveal probes per subject×band against a live
// model.
// SOT: docs/pack/18-tutor-ai-stack.md §3 · docs/pack/19-learning-outcomes-spec.md §1
// SOT-KEYWORDS: pedagogy test never reveal answer post-turn check contract

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PEDAGOGY_CONTRACT, REVEAL_WITHHELD, revealsAnswer } from './pedagogy.ts';

describe('the never-reveal check', () => {
  it('catches the answer stated outright', () => {
    assert.equal(revealsAnswer('12 + 5', 'So you end up with 17.'), true);
    assert.equal(revealsAnswer('12 + 5', 'The answer is 17'), true);
    assert.equal(revealsAnswer('40 / 8', 'That gives 5.'), true);
  });

  it('lets a real coaching turn through', () => {
    assert.equal(revealsAnswer('12 + 5', 'What do you get if you add the ones column first?'), false);
    assert.equal(
      revealsAnswer('12 + 5', 'You said 16, and you set it up right — check the ones column again.'),
      false,
    );
  });

  it('does not count the problem being quoted back as a reveal', () => {
    // Restating the question is what a good coaching turn opens with.
    assert.equal(revealsAnswer('5 + 12', 'We have 5 and 12 here. Which one is bigger?'), false);
  });

  it('does not fire on digits inside a longer number', () => {
    // 17 is the answer; 317 and 1.7 are not it.
    assert.equal(revealsAnswer('12 + 5', 'Look at line 317 of your worksheet.'), false);
    assert.equal(revealsAnswer('12 + 5', 'Try shifting by 1.7 instead.'), false);
  });

  it('stays quiet on problems it cannot decide, rather than guessing', () => {
    const wordProblem = 'Sarah has three apples and gives one away.';
    assert.equal(revealsAnswer(wordProblem, 'She has 2 left.'), false);
  });

  it('states the never-reveal rule before anything else it asks for', () => {
    // Ordering is load-bearing: this is the instruction the model will be pushed
    // hardest to break, and a rule buried under five others is a rule that loses.
    const neverReveal = PEDAGOGY_CONTRACT.indexOf('Never state, write, or compute the final answer');
    const diagnose = PEDAGOGY_CONTRACT.indexOf('diagnose before you correct');
    assert.ok(neverReveal > 0, 'the contract no longer states the never-reveal rule');
    assert.ok(neverReveal < diagnose, 'the never-reveal rule is no longer stated first');
  });

  it('replaces a caught reveal with a question, never with a scolding', () => {
    assert.match(REVEAL_WITHHELD, /\?$/);
    assert.doesNotMatch(REVEAL_WITHHELD, /\b(can'?t|won'?t|not allowed|sorry)\b/i);
  });
});
