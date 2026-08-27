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
import {
  bandExamplesBlock,
  briefPreamble,
  withLearnerBrief,
  COACH_TURN_LABEL,
  LEARNER_TURN_LABEL,
} from './inference.ts';
import {
  asVoiceBand,
  planeRegisterFor,
  BAND_EXAMPLES,
  BAND_FRAMES,
  VOICE_BANDS,
  type VoiceBand,
} from './voice-band.ts';
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

test('replaying ONE transcript changes nothing — the second run is not a second session', () => {
  /*
    §4.1's replay is a human re-running a dead-lettered job by hand, and
    `singletonKey` has long since stopped protecting. Every accumulating value
    here advances from the stored one, so the replay used to trace `p` forward
    a second time, count a second attempt and move the review rung — turning
    one correct turn into "Has this down" and dropping the skill out of the
    frontier brief.
  */
  const first = distill(transcript(), [], NOW);
  const replayed = distill(transcript(), first, NOW);
  assert.deepEqual(replayed, first);
});

test('a transcript with two turns on one skill still counts both, on its first run', () => {
  // The guard reads `priorFacts`, not the running map — otherwise it would
  // swallow the second turn of the very transcript it is distilling.
  const twice = distill(transcript({ turns: [turn(), turn()] }), [], NOW);
  const mastery = twice.find((f) => f.kind === 'mastery');
  assert.ok(mastery);
  assert.equal(mastery.attempts, 2);
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
  const brief = compileLearnerBrief(facts, 'k-2', NOW);
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
  const brief = compileLearnerBrief(facts, '9-12', NOW);
  assert.deepEqual(brief.frontier.map((f) => f.skillTitle), ['frontier thing']);
});

test('a resolved misconception leaves the brief even though it stays on the record', () => {
  // Two SESSIONS, so two transcript ids — the fixture used to reuse `t1` for
  // both, which is a replay of one session rather than the second session it
  // models, and `distill` now tells them apart.
  const facts = distill(
    transcript({ id: 't2', turns: [turn({ correct: true, misconceptionTag: 'adds-denominators' })] }),
    distill(
      transcript({ turns: [turn({ correct: false, misconceptionTag: 'adds-denominators' })] }),
      [],
      NOW,
    ),
    NOW,
  );
  assert.ok(facts.some((f) => f.kind === 'misconception'));
  assert.deepEqual(compileLearnerBrief(facts, 'k-2', NOW).misconceptions, []);
});

test('an expired fact never reaches the brief', () => {
  const facts = distill(transcript(), [], NOW);
  const later = new Date(NOW.getTime() + (FACT_TTL_DAYS + 1) * 86_400_000);
  const brief = compileLearnerBrief(facts, 'k-2', later);
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
  assert.deepEqual(compileLearnerBrief(after, 'k-2', NOW).interests, []);
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
  const preamble = briefPreamble(compileLearnerBrief(facts, 'k-2', NOW));
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
      // The plane hands over a two-value policy register; the brief wants the
      // four-value voice band, and `asVoiceBand` is the sanctioned widening.
      return compileLearnerBrief(distill(transcript(), [], NOW), asVoiceBand(context.gradeBand), NOW);
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

/*
  DOC 31 §2 — THE BAND VOICE SYSTEM.

  Doc 31 opens on a measured failure rather than an anecdote: frontier models
  answer a first grader at or above 10th-grade reading level by default, and
  asking politely for "first grade level" in the prompt does not fix it. What
  works is metric-guided frames (layer 1) and graded few-shots (layer 2), which
  is what this package now ships. Layer 3, the readability gate that measures
  the actual reply, is platform work (doc 31 PR-112) and is deliberately not
  asserted here — a test that pretended to cover it would be worse than its
  absence.

  These assertions are on CONTENT, because doc 31 §2.3 is explicit that the
  frames and few-shots are content: versioned, committed, and re-evaluated when
  they change. Content that is committed is content a test can hold.
*/

test('there are four bands, exactly the ones doc 31 §2.1 names', () => {
  assert.deepEqual([...VOICE_BANDS], ['k-2', '3-5', '6-8', '9-12']);
});

test('every band has a frame and a graded example set', () => {
  for (const band of VOICE_BANDS) {
    assert.ok(BAND_FRAMES[band].length > 0, `${band} has no frame`);
    // Doc 31 §2.3: "Each band frame ships with 3–4 exemplar exchanges."
    const examples = BAND_EXAMPLES[band];
    assert.ok(examples.length >= 3 && examples.length <= 4, `${band} has ${examples.length}`);
  }
});

test('every band frame names its readability target, not a vibe', () => {
  // Doc 31 §1's finding: metric-guided prompts beat "keep it simple" prose.
  // A frame that stopped naming a number would be the thing that already failed.
  for (const band of VOICE_BANDS) {
    assert.match(BAND_FRAMES[band], /Flesch-Kincaid/i, `${band} frame names no metric`);
  }
});

/*
  The word cap is checked on clauses rather than on sentences, and the em dash
  counts as a boundary. That is not a loophole around doc 31's "sentences of N
  words or fewer" — it is what the rule is for. The cap exists so one idea
  arrives per breath, and doc 26b's own 3-5 anchor ("the bottoms tell us the
  size of the pieces — what size pieces would let us add these?") is two ideas
  with a dash between them, at 9 and 8 words. Counting it as one 18-word
  sentence would fail an exemplar the doc ships as correct.
*/
const clauses = (text: string): string[] =>
  text
    .split(/[.!?;]+|\s[—–-]\s/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const wordsIn = (clause: string): number => clause.split(/\s+/).filter(Boolean).length;

test('the graded few-shots actually sit at their band, per doc 31 §2.3', () => {
  // Only the bands whose frame states a hard word cap. 9-12 states a ceiling on
  // reading level and explicitly refuses artificial simplification, so a word
  // cap there would enforce the condescension doc 31 §2.2 calls a failure.
  const caps: Partial<Record<VoiceBand, number>> = { 'k-2': 8, '3-5': 12, '6-8': 17 };

  for (const [band, cap] of Object.entries(caps) as [VoiceBand, number][]) {
    for (const example of BAND_EXAMPLES[band]) {
      for (const clause of clauses(example.tutor)) {
        assert.ok(
          wordsIn(clause) <= cap,
          `${band} exemplar clause is ${wordsIn(clause)} words, cap ${cap}: "${clause}"`,
        );
      }
    }
  }
});

test('every exemplar asks at most one question — doc 31 §2.2, all four bands', () => {
  for (const band of VOICE_BANDS) {
    for (const example of BAND_EXAMPLES[band]) {
      const asked = (example.tutor.match(/\?/g) ?? []).length;
      assert.ok(asked <= 1, `${band} exemplar asks ${asked} questions: "${example.tutor}"`);
    }
  }
});

test('every band rehearses the refusal, because that exchange IS the product', () => {
  /*
    Doc 26b's wiring notes: "Type 'just tell me the answer' during dress
    rehearsal at least five times — if it ever caves, fix it before anything
    else." A band whose few-shots never show the refusal is a band where the
    only anchor for the hardest moment is prose in the frame above it.
  */
  for (const band of VOICE_BANDS) {
    const asks = BAND_EXAMPLES[band].filter((example) =>
      /tell me the answer|what'?s the answer|just give me/i.test(example.learner),
    );
    const refusal = asks[0];
    assert.ok(refusal, `${band} has no answer-demand exemplar to rehearse`);
    assert.equal(asks.length, 1, `${band} has ${asks.length} answer-demand exemplars`);
    // The refusal has to hand the work back, not just say no. A "no" with no
    // question is where a stuck child leaves the session.
    assert.ok(refusal.tutor.includes('?'), `${band} refusal offers no next step`);
  }
});

/*
  THE LABEL DIVERGENCE FROM DOC 26b, PINNED.

  Doc 26b writes its few-shots with `Student:` as the speaker label. Shipping
  that literal is the bug this package already fixed once: the gateway's
  pseudonymizer matches `student` plus a separator and eats the rest of the
  line, so every exemplar answer would reach the model as `Student: [redacted]`
  — and the few-shots, whose entire job is to show the model what a child's
  wrong answer looks like, would show it nothing at all. The examples are
  therefore rendered with `LEARNER_TURN_LABEL`, and this test is why nobody can
  quietly "fix" them back to match the doc.
*/
test('the rendered few-shots use the label the gateway survives, not doc 26b’s', () => {
  const block = bandExamplesBlock('k-2');
  assert.ok(block.includes(LEARNER_TURN_LABEL), block);
  assert.doesNotMatch(block, /^\s*Student\s*:/im, 'doc 26b’s label would be redacted');
});

test('no prompt text trips the header rule that redacted the turn once already', () => {
  /*
    The same trigger list `LEARNER_TURN_LABEL` is held against, applied to every
    string that reaches the model from this package. `scrubOutbound` scrubs the
    SYSTEM half too, so a frame line reading "child - " would lose everything
    after it, silently, exactly as the speaker label did.

    Re-declared rather than imported: `@acme/inference` is downstream of prompt
    assembly and this package must not depend on it, which is the same reason
    the label literal is pinned in both places.
  */
  const HEADER_RULE =
    /\b(name|student|pupil|learner|child|teacher|parent|guardian|class|school|dob)(?:'s)?\s*(?:name)?\s*[:\-–—]/i;

  for (const band of VOICE_BANDS) {
    assert.doesNotMatch(BAND_FRAMES[band], HEADER_RULE, `${band} frame would be redacted`);
    assert.doesNotMatch(bandExamplesBlock(band), HEADER_RULE, `${band} examples would be redacted`);
  }
  assert.doesNotMatch(COACH_TURN_LABEL, HEADER_RULE);
});

test('the four voice bands collapse to the plane’s two-value register', () => {
  // The Safety Plane's `IdentityContext` carries a policy register, not a voice:
  // it picks the crisis wording. Doc 31 §2.1 splits elementary for VOICE, which
  // does not make a third crisis script — so the register stays two-valued and
  // is derived here rather than stored twice.
  assert.equal(planeRegisterFor('k-2'), 'young');
  assert.equal(planeRegisterFor('3-5'), 'young');
  assert.equal(planeRegisterFor('6-8'), 'older');
  assert.equal(planeRegisterFor('9-12'), 'older');
});

test('an unreadable band falls back rather than guessing a young register', () => {
  assert.equal(asVoiceBand('3-5'), '3-5');
  assert.equal(asVoiceBand('undergrad'), '9-12');
  assert.equal(asVoiceBand(null), '9-12');
  // The two values the field held before doc 31 still read, so a row written by
  // the old build is a band rather than a fallback.
  assert.equal(asVoiceBand('young'), 'k-2');
  assert.equal(asVoiceBand('older'), '9-12');
});

test('the preamble carries the band frame and its few-shots into the prompt', () => {
  const preamble = briefPreamble(compileLearnerBrief([], 'k-2', NOW));
  assert.ok(preamble.includes(BAND_FRAMES['k-2']), 'the frame never reached the prompt');
  const first = BAND_EXAMPLES['k-2'][0];
  assert.ok(first);
  assert.ok(preamble.includes(first.tutor), 'the few-shots never reached the prompt');
  // Still pseudonymous: doc 07 §4's promise does not bend for a band.
  assert.equal(preamble.includes('learner-9'), false);
});
