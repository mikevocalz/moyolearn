// Doc 34 §4 steps 1–3, pinned. Three claims this file holds still:
//
//  1. The evidence extractor is deterministic arithmetic — statuses, attempt
//     counts, effort events and the BKT inverse all follow from the inputs,
//     and the `untraceAttempt` round-trip against the real `traceAttempt` is
//     what licenses reporting a "before" nothing stored.
//  2. The honesty lint refuses the B-plus machine: ability praise, empty
//     praise, minutes-as-achievement, invented numbers, invented skills,
//     inflated mastery and uncited effort each trip a named rule.
//  3. The deterministic fallback narrative passes the lint on the same
//     evidence it words — the fail-safe path can never itself be the flattery.
// SOT: docs/pack/34-session-summary-reports.md §1 §2 §4
// SOT-KEYWORDS: summary tests evidence extractor honesty lint untrace round trip deterministic narrative fallback
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { traceAttempt, DEFAULT_TRACING } from '@acme/student-model/pure';
import {
  extractEvidence,
  masteryLevel,
  untraceAttempt,
  type EvidencedTurn,
  type SessionEvidenceInput,
} from './evidence.ts';
import { lintNarrative, type NarrativeCandidate } from './honesty.ts';
import { assembleNarrative, deterministicNarrative, parseModelCopy } from './narrative.ts';
import type { StoredMessage } from '../tutor/session.types.ts';

const turn = (over: Partial<EvidencedTurn> = {}): EvidencedTurn => ({
  transcriptId: 't-1',
  index: 0,
  skillId: 'Fractions',
  skillTitle: 'Fractions',
  correct: true,
  hintDepth: 0,
  storable: true,
  ...over,
});

const message = (over: Partial<StoredMessage> = {}): StoredMessage => ({
  id: 'm-1',
  role: 'learner',
  text: '12',
  attachments: [],
  createdAt: '2026-08-27T10:00:00.000Z',
  ...over,
});

const input = (over: Partial<SessionEvidenceInput> = {}): SessionEvidenceInput => ({
  sessionId: 's-1',
  problem: '1/2 + 1/4',
  openedAt: '2026-08-27T10:00:00.000Z',
  closedAt: '2026-08-27T10:20:00.000Z',
  messages: [],
  turns: [],
  masteryFacts: [],
  ...over,
});

describe('untraceAttempt', () => {
  it('inverts traceAttempt away from the clamps — the reconstructed "before" is real', () => {
    for (const p of [0.15, 0.25, 0.4, 0.6, 0.8]) {
      for (const correct of [true, false]) {
        const after = traceAttempt(p, correct, DEFAULT_TRACING);
        // Only invertible when the clamp did not fire — which these priors avoid.
        if (after > 0.01 && after < 0.99) {
          assert.ok(
            Math.abs(untraceAttempt(after, correct) - p) < 1e-9,
            `round trip drifted at p=${String(p)} correct=${String(correct)} — the reported delta would be fiction`,
          );
        }
      }
    }
  });

  it('answers the clamp with the clamp, not with an extrapolation', () => {
    const before = untraceAttempt(0.99, true);
    assert.ok(before >= 0.01 && before <= 0.99, 'the inverse escaped the band the model itself never leaves');
  });

  it('walking a whole session backwards recovers the session-start estimate', () => {
    const sequence = [true, false, true, true];
    const start = 0.3;
    const end = sequence.reduce((p, correct) => traceAttempt(p, correct), start);
    const recovered = sequence.reduceRight((p, correct) => untraceAttempt(p, correct), end);
    assert.ok(Math.abs(recovered - start) < 1e-9, 'the multi-turn walk is not the inverse of the trace');
  });
});

describe('extractEvidence', () => {
  it('grades the graded turns: independence needs a clean first solve', () => {
    const evidence = extractEvidence(
      input({
        turns: [
          turn({ index: 0, correct: false, hintDepth: 0 }),
          turn({ transcriptId: 't-2', index: 0, correct: false, hintDepth: 1 }),
          turn({ transcriptId: 't-3', index: 0, correct: true, hintDepth: 1 }),
        ],
      }),
    );
    const skill = evidence.skills[0];
    assert.ok(skill, 'three turns on one skill produced no skill evidence');
    assert.equal(skill.attempts, 3);
    assert.equal(skill.solved, true);
    assert.equal(skill.independent, false, 'a hinted third-attempt solve was reported as "on their own"');
    assert.equal(skill.missesBeforeSolve, 2);
    assert.equal(evidence.problems[0]?.status, 'solved-with-help');
    // §2.3: a solved problem never carries the redpen flag.
    assert.equal(evidence.problems[0]?.submittedIncorrect, false);
  });

  it('a first-try no-hint solve is "solved on their own"', () => {
    const evidence = extractEvidence(input({ turns: [turn()] }));
    assert.equal(evidence.problems[0]?.status, 'solved-independently');
    assert.equal(evidence.facts.solvedIndependently, 1);
  });

  it('an unsolved skill is still-working with the redpen flag — the one honest "marked wrong"', () => {
    const evidence = extractEvidence(
      input({ turns: [turn({ correct: false }), turn({ transcriptId: 't-2', correct: false })] }),
    );
    assert.equal(evidence.problems[0]?.status, 'still-working');
    assert.equal(evidence.problems[0]?.submittedIncorrect, true);
  });

  it('a safety-blocked turn evidences nothing (doc 07 §4)', () => {
    const evidence = extractEvidence(input({ turns: [turn({ storable: false })] }));
    assert.equal(evidence.skills.length, 0, 'an unstorable turn leaked into a parent-facing report');
  });

  it('reconstructs before/after from the stored post-session estimate', () => {
    const start = 0.4;
    const afterMiss = traceAttempt(start, false);
    const afterSolve = traceAttempt(afterMiss, true);
    const evidence = extractEvidence(
      input({
        turns: [
          turn({ index: 0, correct: false }),
          turn({ transcriptId: 't-2', index: 0, correct: true }),
        ],
        masteryFacts: [{ skillId: 'Fractions', p: afterSolve, attempts: 12 }],
      }),
    );
    const skill = evidence.skills[0];
    assert.ok(skill, 'no skill evidence at all');
    assert.ok(skill.afterP !== null && skill.beforeP !== null, 'a stored estimate produced no delta');
    assert.equal(skill.afterP, afterSolve);
    assert.ok(Math.abs(skill.beforeP - start) < 1e-9, 'the reconstructed before is not where the session started');
  });

  it('quotes the child verbatim from the chat, and only from the chat', () => {
    const evidence = extractEvidence(
      input({
        messages: [
          message({ id: 'm-1', text: 'i think fractions are hard' }),
          message({ id: 'm-2', text: '6/8' }),
        ],
      }),
    );
    const row = evidence.problems[0];
    assert.ok(row, 'a chat-only session produced no problem row');
    assert.equal(row.childAnswer, '6/8', 'the verbatim final answer was not the answer-shaped message');
    // The chat message about fractions being hard is talk, not a submission.
    assert.equal(row.attempts, 1, 'a chat sentence was counted as an attempt');
  });

  it('the graded store wins over the chat, and evaluate-only answers stay unrecorded rather than invented', () => {
    const evidence = extractEvidence(input({ turns: [turn()] }));
    assert.equal(evidence.problems[0]?.childAnswer, null, 'an answer nobody stored was invented for the report');
  });

  it('a sole-skill session quotes the chat answer onto its graded row, with the citation', () => {
    const evidence = extractEvidence(
      input({
        turns: [turn({ correct: false }), turn({ transcriptId: 't-2', correct: true, hintDepth: 1 })],
        messages: [message({ id: 'm-1', text: '14' }), message({ id: 'm-2', text: '13' })],
      }),
    );
    const row = evidence.problems[0];
    assert.equal(row?.childAnswer, '13', 'the verbatim final chat answer was not attributed to the one problem');
    // Attempts stay the GRADED count — chat answers quote, they do not grade.
    assert.equal(row?.attempts, 2);
    assert.ok(
      evidence.evidenceRefs.some((ref) => ref.kind === 'message' && ref.id === 'm-2'),
      'the quoted answer has no citation',
    );
  });

  it('a multi-skill session attributes no chat answer — quoting across problems is misquoting', () => {
    const evidence = extractEvidence(
      input({
        turns: [
          turn({ skillId: 'Fractions', skillTitle: 'Fractions' }),
          turn({ transcriptId: 't-2', skillId: 'Decimals', skillTitle: 'Decimals' }),
        ],
        messages: [message({ id: 'm-1', text: '13' })],
      }),
    );
    for (const row of evidence.problems) {
      assert.equal(row.childAnswer, null, `${row.skillId} was quoted an answer nobody attributed`);
    }
  });

  it('gives the capture crop only to the skill the photographed problem IS', () => {
    /*
      The failure this pins: one worksheet photo becoming the question image on
      every row of a multi-skill session, so a parent reads a fractions photo
      above the decimals row and above the order-of-operations row too. The
      crop belongs to the session's OWN problem; generated practice never had a
      picture and claims its problem text instead.
    */
    const evidence = extractEvidence(
      input({
        problem: '1/2 + 1/4',
        turns: [
          turn({ skillId: '1/2 + 1/4', skillTitle: 'Fractions' }),
          turn({ transcriptId: 't-2', skillId: 'Decimals', skillTitle: 'Decimals' }),
        ],
        messages: [
          message({
            id: 'm-photo',
            attachments: [
              { id: 'att-1', kind: 'image', name: 'worksheet.jpg', mimeType: 'image/jpeg' },
            ],
          }),
        ],
      }),
    );
    const crops = evidence.problems.filter((row) => row.questionRef.kind === 'capture-crop');
    assert.equal(crops.length, 1, 'the one photo was handed to more than one problem');
    assert.equal(crops[0]?.skillId, '1/2 + 1/4');
    const decimals = evidence.problems.find((row) => row.skillId === 'Decimals');
    assert.equal(decimals?.questionRef.kind, 'problem-text');
  });

  it('extracts persistence-after-miss as the strongest effort story', () => {
    const evidence = extractEvidence(
      input({
        turns: [
          turn({ index: 0, correct: false }),
          turn({ transcriptId: 't-2', correct: false }),
          turn({ transcriptId: 't-3', correct: true, hintDepth: 1 }),
        ],
      }),
    );
    assert.equal(evidence.effortEvents[0]?.kind, 'persistence-after-miss');
    assert.equal(evidence.effortEvents[0]?.count, 2);
  });

  it('duration is a fact, computed, never negative', () => {
    const evidence = extractEvidence(input());
    assert.equal(evidence.facts.durationMin, 20);
  });

  it('is deterministic — same input, same evidence', () => {
    const fixture = input({
      turns: [turn({ correct: false }), turn({ transcriptId: 't-2', correct: true })],
      masteryFacts: [{ skillId: 'Fractions', p: 0.5, attempts: 5 }],
    });
    assert.deepEqual(extractEvidence(fixture), extractEvidence(fixture));
  });
});

const solvedEvidence = () =>
  extractEvidence(
    input({
      turns: [
        turn({ index: 0, correct: false }),
        turn({ transcriptId: 't-2', correct: false, hintDepth: 1 }),
        turn({ transcriptId: 't-3', correct: true, hintDepth: 1 }),
      ],
      masteryFacts: [{ skillId: 'Fractions', p: 0.55, attempts: 9 }],
    }),
  );

describe('the honesty lint', () => {
  const clean = (): NarrativeCandidate => deterministicNarrative(solvedEvidence());

  it('passes the deterministic narrative — the fail-safe can never be the flattery', () => {
    const violations = lintNarrative(clean(), solvedEvidence());
    assert.deepEqual(violations, [], `the fallback narrative violates its own lint: ${JSON.stringify(violations)}`);
  });

  it('refuses ability praise — Dweck is a rule here, not a style note', () => {
    const candidate = { ...clean(), headline: 'Maya is so smart — she solved it!' };
    assert.ok(
      lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'ability-praise'),
      '"smart" survived the lint',
    );
  });

  it('refuses the B-plus machine sentence verbatim', () => {
    const candidate = { ...clean(), headline: 'Had a great session today!' };
    assert.ok(lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'empty-praise'));
  });

  it('refuses minutes framed as achievement — minutes are not learning (doc 19)', () => {
    const candidate = { ...clean(), nextUp: '20 minutes of hard work — so proud!' };
    assert.ok(lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'minutes-as-achievement'));
  });

  it('refuses a number the evidence never measured', () => {
    const candidate = { ...clean(), headline: 'Solved 7 problems in a row on Fractions.' };
    assert.ok(lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'unevidenced-number'));
  });

  it('refuses a skill the session never touched', () => {
    const candidate = {
      ...clean(),
      workedOn: [{ skillId: 'Trigonometry', parentLabel: 'Trigonometry', whyItMatters: 'later.' }],
    };
    assert.ok(lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'unevidenced-skill'));
  });

  it('refuses an inflated mastery delta — the model phrases, it never measures', () => {
    const base = clean();
    const row = base.mastery[0];
    assert.ok(row, 'the clean narrative carries no mastery row to tamper with');
    const candidate = { ...base, mastery: [{ ...row, afterP: 0.95 }] };
    assert.ok(lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'tampered-mastery'));
  });

  it('refuses an effort moment with no citation behind it', () => {
    const candidate = {
      ...clean(),
      effortMoment: { copy: 'Tried three strategies and stuck with it.', evidenceRef: { kind: 'event', id: 'nope#0' } as const },
    };
    assert.ok(lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'uncited-effort'));
  });

  it('refuses grade-speak on the position axis', () => {
    const base = clean();
    const row = base.mastery[0];
    assert.ok(row);
    const candidate = { ...base, mastery: [{ ...row, positionCopy: 'She gets an A for this one.' }] };
    assert.ok(lintNarrative(candidate, solvedEvidence()).some((v) => v.rule === 'grade-speak'));
  });
});

describe('the narrative pass plumbing', () => {
  it('parses well-shaped model JSON, fenced or bare', () => {
    const json = JSON.stringify({
      headline: 'Worked through 2 misses on Fractions and solved it.',
      workedOn: [{ skillId: 'Fractions', parentLabel: 'Fractions', whyItMatters: 'ratios lean on it.' }],
      positionCopy: { Fractions: 'Right in the band where practice moves the needle for their grade.' },
      effortCopy: 'Stayed with it through 2 misses.',
      nextUp: 'Next session pushes Fractions one step further.',
    });
    assert.ok(parseModelCopy(json));
    assert.ok(parseModelCopy('```json\n' + json + '\n```'));
    assert.equal(parseModelCopy('The session went well!'), null, 'prose was accepted as a narrative');
    assert.equal(parseModelCopy('{"headline": ""}'), null, 'an empty headline was accepted');
  });

  it('the assembled narrative takes numbers from evidence, never from the model', () => {
    const evidence = solvedEvidence();
    const copy = parseModelCopy(
      JSON.stringify({
        headline: 'Worked through 2 misses on Fractions and solved it.',
        workedOn: [
          { skillId: 'Fractions', parentLabel: 'Fractions', whyItMatters: 'ratios lean on it.' },
          { skillId: 'Trigonometry', parentLabel: 'Trig', whyItMatters: 'not this session.' },
        ],
        positionCopy: { Fractions: 'Right where the work should be for their grade.' },
        effortCopy: 'Stayed with it through 2 misses and finished.',
        nextUp: 'Next session pushes Fractions one step further.',
      }),
    );
    assert.ok(copy);
    const narrative = assembleNarrative(evidence, copy);
    assert.equal(narrative.workedOn.length, 1, 'an unevidenced skill survived assembly');
    const row = narrative.mastery[0];
    assert.ok(row);
    assert.equal(row.afterP, evidence.skills[0]?.afterP, 'the movement figure is not the measured one');
    assert.equal(row.before, masteryLevel(evidence.skills[0]!.beforeP!));
    assert.deepEqual(lintNarrative(narrative, evidence), []);
  });
});
