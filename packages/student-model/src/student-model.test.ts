// What this suite holds, and what it does not.
//
// It holds the promises a guardian is given in words on S27 and doc 07 §4:
// a crisis never becomes a personalization feature, a deleted line is gone from
// the brief in the same tick, a transcript takes its sole-source facts with it,
// an interest the family never approved never enters the model, and nothing
// carrying a name or an id ever reaches a prompt. Those are the assertions a
// regulator or a parent would actually ask us to prove.
//
// It does NOT prove pedagogy. That `traceAttempt` moves a probability the right
// way is checked here; that the resulting mastery estimate matches how a real
// child learns fractions is an efficacy question doc 19 §6 answers with a
// dosage-vs-growth study, not with a unit test. Stating that here so nobody
// reads a green suite as evidence of learning gains.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 · docs/pack/19-learning-outcomes-spec.md §1
// SOT-KEYWORDS: student model tests erasure cascade brief pseudonymous distill storable

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { compileLearnerBrief } from './brief.ts';
import { distill, transcriptExpiry, type SessionTranscript, type SessionTurn } from './distill.ts';
import {
  cascadePreview,
  eraseFact,
  eraseTranscript,
  expireTranscripts,
  withoutBlockedTags,
} from './erasure.ts';
import { FACT_TTL_DAYS, TRANSCRIPT_TTL_DAYS, addDays, type DerivedFact } from './facts.ts';
import { briefPreamble, withLearnerBrief, LEARNER_TURN_LABEL } from './inference.ts';
import { DEFAULT_TRACING, decayMastery, traceAttempt } from './mastery.ts';
import { REVIEW_LADDER, scheduleReview } from './review.ts';

const NOW = new Date('2026-03-01T10:00:00.000Z');

const turn = (over: Partial<SessionTurn> = {}): SessionTurn => ({
  skillId: 'fraction-addition',
  skillTitle: 'adding fractions',
  correct: true,
  hintDepth: 1,
  storable: true,
  ...over,
});

const transcript = (over: Partial<SessionTranscript> = {}): SessionTranscript => ({
  id: 't1',
  learnerId: 'learner-9',
  capturedAt: NOW.toISOString(),
  expiresAt: transcriptExpiry(NOW),
  turns: [turn()],
  ...over,
});

test('a non-storable turn contributes nothing — a crisis is not a personalization feature', () => {
  const facts = distill(
    transcript({
      turns: [
        turn({ storable: false, misconceptionTag: 'adds-denominators', interestTags: ['basketball'] }),
      ],
    }),
    [],
    NOW,
    { guardianApprovedInterests: ['basketball'] },
  );
  assert.deepEqual(facts, []);
});

test('a storable turn produces mastery, review and scaffolding for the skill', () => {
  const facts = distill(transcript(), [], NOW);
  const kinds = facts.map((f) => f.kind).sort();
  assert.deepEqual(kinds, ['mastery', 'review', 'scaffolding']);
});

test('distillation upserts one fact per learner+skill+kind rather than appending', () => {
  const first = distill(transcript(), [], NOW);
  const second = distill(transcript({ id: 't2' }), first, NOW);
  assert.equal(second.filter((f) => f.kind === 'mastery').length, 1);
  const mastery = second.find((f) => f.kind === 'mastery');
  assert.ok(mastery);
  assert.equal(mastery.attempts, 2);
  assert.deepEqual([...mastery.derivedFrom], ['t1', 't2']);
});

test('an unapproved interest never becomes a fact', () => {
  const facts = distill(transcript({ turns: [turn({ interestTags: ['basketball'] })] }), [], NOW);
  assert.equal(facts.some((f) => f.kind === 'interest'), false);
});

test('an approved interest does, and says so in parent language', () => {
  const facts = distill(transcript({ turns: [turn({ interestTags: ['basketball'] })] }), [], NOW, {
    guardianApprovedInterests: ['basketball'],
  });
  const interest = facts.find((f) => f.kind === 'interest');
  assert.ok(interest);
  assert.equal(interest.sentence, 'Likes examples about basketball');
});

test('a misconception tag outside the curated taxonomy is discarded, not stored as free text', () => {
  const facts = distill(
    transcript({ turns: [turn({ correct: false, misconceptionTag: 'seems-anxious-about-math' })] }),
    [],
    NOW,
  );
  assert.equal(facts.some((f) => f.kind === 'misconception'), false);
});

test('getting it right retires a misconception instead of leaving it active', () => {
  const wrong = distill(
    transcript({ turns: [turn({ correct: false, misconceptionTag: 'adds-denominators' })] }),
    [],
    NOW,
  );
  const before = wrong.find((f) => f.kind === 'misconception');
  assert.equal(before?.active, true);

  const right = distill(
    transcript({ id: 't2', turns: [turn({ correct: true, misconceptionTag: 'adds-denominators' })] }),
    wrong,
    NOW,
  );
  const after = right.find((f) => f.kind === 'misconception');
  assert.equal(after?.active, false);
});

test('knowledge tracing moves toward mastery on a correct answer and away on a wrong one', () => {
  const up = traceAttempt(0.5, true);
  const down = traceAttempt(0.5, false);
  assert.ok(up > 0.5);
  assert.ok(down < 0.5);
  // Never certain in either direction: a tutor that cannot be surprised is the
  // failure mode, so the clamps hold at both ends.
  assert.ok(traceAttempt(0.99, true) <= 0.99);
  assert.ok(traceAttempt(0.01, false) >= 0.01);
});

test('mastery decays toward the prior, never toward zero', () => {
  const stale = decayMastery(0.9, NOW, new Date('2027-03-01T10:00:00.000Z'));
  assert.ok(stale < 0.9);
  assert.ok(stale > DEFAULT_TRACING.prior - 0.001);
});

test('the review ladder advances on success and steps down one rung on a miss', () => {
  const first = scheduleReview(null, true, NOW);
  assert.equal(first.intervalDays, REVIEW_LADDER[0]);
  const second = scheduleReview(first, true, NOW);
  assert.equal(second.intervalDays, REVIEW_LADDER[1]);
  const missed = scheduleReview(second, false, NOW);
  assert.equal(missed.intervalDays, REVIEW_LADDER[0]);
});

test('the brief carries no identifier — the type has nowhere to put one', () => {
  const facts = distill(transcript({ turns: [turn({ interestTags: ['basketball'] })] }), [], NOW, {
    guardianApprovedInterests: ['basketball'],
  });
  const brief = compileLearnerBrief(facts, 'young', NOW);
  const serialized = JSON.stringify(brief);
  assert.equal(serialized.includes('learner-9'), false);
  assert.equal(serialized.includes('t1'), false);
  assert.equal(briefPreamble(brief).includes('learner-9'), false);
});

test('the brief holds only frontier skills — mastered and not-started are both noise', () => {
  const facts: DerivedFact[] = [
    {
      kind: 'mastery', id: 'a', learnerId: 'l', skillId: 's1', skillTitle: 'mastered thing',
      p: 0.95, attempts: 9, sentence: 'Has mastered thing down',
      derivedFrom: ['t1'], observedAt: NOW.toISOString(), expiresAt: addDays(NOW, FACT_TTL_DAYS),
    },
    {
      kind: 'mastery', id: 'b', learnerId: 'l', skillId: 's2', skillTitle: 'frontier thing',
      p: 0.6, attempts: 5, sentence: 'Getting there on frontier thing',
      derivedFrom: ['t1'], observedAt: NOW.toISOString(), expiresAt: addDays(NOW, FACT_TTL_DAYS),
    },
  ];
  const brief = compileLearnerBrief(facts, 'older', NOW);
  assert.deepEqual(brief.frontier.map((f) => f.skillTitle), ['frontier thing']);
});

test('a resolved misconception leaves the brief even though it stays on the record', () => {
  const facts = distill(
    transcript({ turns: [turn({ correct: true, misconceptionTag: 'adds-denominators' })] }),
    distill(
      transcript({ turns: [turn({ correct: false, misconceptionTag: 'adds-denominators' })] }),
      [],
      NOW,
    ),
    NOW,
  );
  assert.ok(facts.some((f) => f.kind === 'misconception'));
  assert.deepEqual(compileLearnerBrief(facts, 'young', NOW).misconceptions, []);
});

test('an expired fact never reaches the brief', () => {
  const facts = distill(transcript(), [], NOW);
  const later = new Date(NOW.getTime() + (FACT_TTL_DAYS + 1) * 86_400_000);
  const brief = compileLearnerBrief(facts, 'young', later);
  assert.deepEqual(brief.frontier, []);
  assert.deepEqual(brief.reviewDue, []);
});

test('deleting one line deletes exactly that line', () => {
  const facts = distill(transcript(), [], NOW);
  const target = facts[0];
  assert.ok(target);
  const result = eraseFact(facts, target.id);
  assert.deepEqual(result.erasedFactIds, [target.id]);
  assert.equal(result.facts.length, facts.length - 1);
});

test('a deleted line is out of the brief in the same tick — no stale belief', () => {
  const facts = distill(transcript({ turns: [turn({ interestTags: ['basketball'] })] }), [], NOW, {
    guardianApprovedInterests: ['basketball'],
  });
  const interest = facts.find((f) => f.kind === 'interest');
  assert.ok(interest);
  const after = eraseFact(facts, interest.id).facts;
  assert.deepEqual(compileLearnerBrief(after, 'young', NOW).interests, []);
});

test('erasing a transcript takes every fact it is the sole source of', () => {
  const facts = distill(transcript(), [], NOW);
  const preview = cascadePreview(facts, 't1');
  assert.equal(preview.length, facts.length);
  const result = eraseTranscript(facts, 't1');
  assert.deepEqual(result.facts, []);
  assert.equal(result.erasedFactIds.length, facts.length);
});

test('a fact with two sources survives one erasure, minus that provenance', () => {
  const first = distill(transcript(), [], NOW);
  const both = distill(transcript({ id: 't2' }), first, NOW);
  const result = eraseTranscript(both, 't1');
  assert.equal(result.erasedFactIds.length, 0);
  for (const fact of result.facts) assert.deepEqual([...fact.derivedFrom], ['t2']);
});

test('the TTL sweep drops expired transcripts and cascades into their facts', () => {
  const facts = distill(transcript(), [], NOW);
  const after = new Date(NOW.getTime() + (TRANSCRIPT_TTL_DAYS + 1) * 86_400_000);
  const swept = expireTranscripts([transcript()], facts, after);
  assert.deepEqual(swept.transcripts, []);
  assert.deepEqual(swept.facts, []);
  assert.equal(swept.erasedFactIds.length, facts.length);
});

test('a blocked tag cannot be re-derived by the next session', () => {
  const turns = withoutBlockedTags([turn({ interestTags: ['basketball'] })], ['basketball']);
  const facts = distill(transcript({ turns }), [], NOW, {
    guardianApprovedInterests: ['basketball'],
  });
  assert.equal(facts.some((f) => f.kind === 'interest'), false);
});

test('mastery is not blockable — a record of work the child did cannot be suppressed forever', () => {
  const turns = withoutBlockedTags([turn()], ['fraction-addition']);
  const facts = distill(transcript({ turns }), [], NOW);
  assert.ok(facts.some((f) => f.kind === 'mastery'));
});

test('a misconception reaches the model with its strategy attached, never alone', () => {
  const facts = distill(
    transcript({ turns: [turn({ correct: false, misconceptionTag: 'adds-denominators' })] }),
    [],
    NOW,
  );
  const preamble = briefPreamble(compileLearnerBrief(facts, 'young', NOW));
  assert.match(preamble, /Watch for: .+\. Approach: .+/);
});

test('the generator retrieves on the plane identity, not on anything a caller passed', async () => {
  let seen: string | null = null;
  let prompt = '';
  const generator = withLearnerBrief(
    async (text) => {
      prompt = text;
      return 'ok';
    },
    async (context) => {
      seen = context.learnerId;
      return compileLearnerBrief(distill(transcript(), [], NOW), context.gradeBand, NOW);
    },
  );

  const reply = await generator.generate('how do I add 1/2 and 1/3?', {
    learnerId: 'learner-9',
    gradeBand: 'young',
    isMinor: true,
    aiEnabled: true,
  });

  assert.equal(reply, 'ok');
  assert.equal(seen, 'learner-9');
  // Derived from the constant, not the literal it used to be. This assertion
  // pinned `Student:` — the very label the gateway's header rule redacted, so
  // the test was holding the bug in place.
  assert.ok(prompt.endsWith(`${LEARNER_TURN_LABEL} how do I add 1/2 and 1/3?`), prompt);
  assert.equal(prompt.includes('learner-9'), false);
});

/*
  The gateway's pseudonymizer redacts OCR'd worksheet headers by matching a label
  and consuming the rest of the line. This prompt's speaker label used to be
  `Student:`, so the rule matched the scaffold and redacted the child's entire
  answer on every turn — silently, because the request still succeeded and the
  model simply replied that it could not see anything.

  Pinned here because the constant lives here. `@acme/inference` cannot import it
  (the gateway is downstream of prompt assembly and must not depend on it), so it
  asserts the same literal; changing the label fails HERE and names that file.
*/
test('LEARNER_TURN_LABEL matches the literal the inference package pins', () => {
  assert.equal(LEARNER_TURN_LABEL, 'Their answer:');
});

test('LEARNER_TURN_LABEL avoids every word the gateway redacts a header on', () => {
    for (const word of ['name', 'student', 'pupil', 'learner', 'child', 'teacher', 'parent', 'guardian', 'class', 'school', 'dob']) {
      assert.ok(
        !new RegExp(`\\b${word}\\b`, 'i').test(LEARNER_TURN_LABEL),
      `label contains "${word}" — the gateway would redact the turn`,
    );
  }
});
