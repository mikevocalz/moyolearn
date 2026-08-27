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
import { briefPreamble, compileLearnerBrief, VOICE_BANDS } from '@acme/student-model';
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
    // Doc 26b makes it a named section for the same reason, so the assertion is
    // on the section rather than on a sentence someone may legitimately reword.
    const neverReveal = PEDAGOGY_CONTRACT.indexOf('Never give the final answer');
    const diagnose = PEDAGOGY_CONTRACT.indexOf('WHEN THEY ANSWER WRONG');
    assert.ok(neverReveal > 0, 'the contract no longer states the never-reveal rule');
    assert.ok(neverReveal < diagnose, 'the never-reveal rule is no longer stated first');
  });

  it('replaces a caught reveal with a question, never with a scolding', () => {
    assert.match(REVEAL_WITHHELD, /\?$/);
    assert.doesNotMatch(REVEAL_WITHHELD, /\b(can'?t|won'?t|not allowed|sorry)\b/i);
  });
});

/*
  DOC 26b — THE PROMPT OF RECORD.

  Doc 26b is blunt about what it is for: "the wow is not the camera; it's the
  first reply refusing to answer and asking a good question instead." Every
  assertion below is one of the moves that reply is made of, and each one names
  the doc section it comes from so a future edit can tell a rewrite from a
  regression.

  These are content assertions on a string. They prove the instruction is
  present and ordered, not that a model obeyed it — obedience is doc 18 §3
  layer 5's eval registry against a live model, and the `revealsAnswer` backstop
  above is what holds when it does not.
*/
describe('the tutor prompt doc 26b binds', () => {
  const section = (name: string) => {
    const at = PEDAGOGY_CONTRACT.indexOf(name);
    assert.ok(at >= 0, `the contract no longer has a ${name} section`);
    const next = PEDAGOGY_CONTRACT.indexOf('\n\n', at);
    return PEDAGOGY_CONTRACT.slice(at, next < 0 ? undefined : next);
  };

  it('says who the tutor is and whose homework this is', () => {
    // Doc 26b line 1 of the system prompt. "Their own homework" is the frame
    // that makes the refusal make sense: it is not our problem to solve.
    assert.match(PEDAGOGY_CONTRACT.slice(0, 200), /tutor/i);
    assert.match(PEDAGOGY_CONTRACT.slice(0, 200), /their own homework/i);
  });

  it('states the one rule first, and states what to do instead', () => {
    // Ordering is load-bearing: this is the instruction the model will be
    // pushed hardest to break, and a rule buried under five others is a rule
    // that loses.
    const one = PEDAGOGY_CONTRACT.indexOf('THE ONE RULE');
    assert.ok(one >= 0 && one < 200, 'the one rule is no longer stated first');

    const rule = section('THE ONE RULE');
    assert.match(rule, /never give the final answer/i);
    // Doc 26b: "never perform the full solution" — the second half people drop.
    assert.match(rule, /never perform the full solution/i);
    assert.match(rule, /offer the next step instead/i);
    // The four refusal shapes the doc enumerates, each one a door someone tried.
    assert.match(rule, /asked\s+directly/i);
    assert.match(rule, /frustrated/i);
    assert.match(rule, /just this once/i);
    assert.match(rule, /as a "check"/i);
  });

  it('binds the opening move: name the problem, then ask exactly one question', () => {
    const open = section('HOW YOU OPEN');
    assert.match(open, /one short sentence/i);
    assert.match(open, /ONE question/);
    assert.match(open, /never open with a lecture/i);
  });

  it('binds diagnosis before correction, silently worked out first', () => {
    const wrong = section('WHEN THEY ANSWER WRONG');
    assert.match(wrong, /silently/i);
    assert.match(wrong, /misconception/i);
    assert.match(wrong, /naming the mistake precisely/i);
  });

  it('binds naming the right part first when they are partly right', () => {
    assert.match(section('WHEN THEY ARE PARTLY RIGHT'), /what was right first/i);
  });

  it('binds the hint ladder, including the third-attempt rung', () => {
    /*
      The rung that was missing. The shipped contract said "change strategy if
      the same approach fails twice" and then stopped, which leaves a stuck
      child in a loop with no floor. Doc 26b puts a floor under it: on a third
      failure the tutor gives the single next move — ONE move, never the rest —
      and hands the work straight back.
    */
    const stuck = section('WHEN THEY ARE STUCK TWICE ON THE SAME STEP');
    assert.match(stuck, /change strategy/i);
    assert.match(stuck, /do not repeat yourself louder/i);
    assert.match(stuck, /third attempt/i);
    assert.match(stuck, /single next move/i);
    assert.match(stuck, /never the rest of the solution/i);
  });

  it('binds specific credit rather than praise when they get it', () => {
    const got = section('WHEN THEY GET IT');
    assert.match(got, /specific/i);
    assert.match(got, /great job/i, 'the doc names the praise it is ruling out');
  });

  it('binds the arithmetic discipline that keeps a wrong number out of a turn', () => {
    /*
      Doc 26b's ARITHMETIC section is a pedagogy rule, not a math one: a tutor
      that asserts an unchecked result teaches the child to trust it. The
      instruction to hand the computation back when unsure is what makes the
      uncertain case still a teaching move.
    */
    const arithmetic = section('ARITHMETIC');
    assert.match(arithmetic, /step by step/i);
    assert.match(arithmetic, /ask (them|the student) to do it/i);
    assert.match(arithmetic, /never state a numeric result you have not checked/i);
  });

  it('binds the boundaries: not schoolwork, distress, and no personal details', () => {
    const boundaries = section('BOUNDARIES');
    assert.match(boundaries, /not schoolwork/i);
    assert.match(boundaries, /trusted adult/i);
    // Doc 31 §3.1: the tutor stops tutoring rather than counselling.
    assert.match(boundaries, /drop the tutoring/i);
    assert.match(boundaries, /never ask for or repeat personal details/i);
  });

  it('leaves voice and reading level to the band frame, and says nothing about them', () => {
    /*
      Doc 26b hard-sets K-2 because the demo is one band. Doc 31 §2.2 ships four,
      and they arrive with the learner brief — voice is a property of the child,
      teaching is a property of the contract. A word cap or a reading target
      written in here would be a second place to change one thing, and the one
      that never gets changed.
    */
    assert.doesNotMatch(PEDAGOGY_CONTRACT, /Flesch/i);
    assert.doesNotMatch(PEDAGOGY_CONTRACT, /words or fewer/i);
    assert.doesNotMatch(PEDAGOGY_CONTRACT, /6-year-old/i);
  });

  it('survives the gateway pseudonymizer with every instruction intact', () => {
    /*
      `scrubOutbound` scrubs the SYSTEM half as well as the message half, and its
      header rule eats everything after `student:` or `child - ` to the end of
      the line. That rule already redacted the child's answer once, silently,
      when the speaker label was `Student:`. A contract line that trips it would
      lose an instruction the same way — no error, no log, just a rule the model
      never read.

      The trigger list is re-declared rather than imported: this package must not
      start depending on the gateway to state a property of its own prompt.
    */
    const HEADER_RULE =
      /\b(name|student|pupil|learner|child|teacher|parent|guardian|class|school|dob)(?:'s)?\s*(?:name)?\s*[:\-–—]/i;
    assert.doesNotMatch(PEDAGOGY_CONTRACT, HEADER_RULE);

    // And the whole assembled system prompt, contract plus band frame plus the
    // graded few-shots, which is what actually reaches the wire.
    for (const band of VOICE_BANDS) {
      const system = `${PEDAGOGY_CONTRACT}\n\n${briefPreamble(compileLearnerBrief([], band, new Date()))}`;
      assert.doesNotMatch(system, HEADER_RULE, `the ${band} system prompt would be redacted`);
    }
  });
});
