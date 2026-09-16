// Exact-cell eligibility, distinct from model capability or presentation age.
// SOT-KEYWORDS: tutor capabilities test evaluation fail closed grade tools grounding
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INFERENCE_SAFETY_VERSION } from '@acme/inference';
import { ageBandForVoiceBand } from '../capture/age-band.ts';
import { tutorCellFor, TUTOR_MANUAL_HELP, type TutorCell } from './tutor-capabilities.ts';
import { coachStream, type CoachPorts } from './coach.service.ts';

// Synthetic cell for dependency checks only; not installed in the live registry.
const cell = {
  primary: 'tutor-turn', allowedFallbacks: [], tools: ['arithmetic'], vision: false,
  grounding: true, safety: INFERENCE_SAFETY_VERSION, maxLatencyMs: 5000, costCeiling: 0.05,
  enabled: true,
  evaluation: { runReference: 'test-fixture-not-an-evaluation', model: 'claude-opus-5', language: 'en', safetyVersion: INFERENCE_SAFETY_VERSION },
} satisfies TutorCell;
const available = { tools: ['arithmetic'], grounding: true, language: 'en', model: 'claude-opus-5', safetyVersion: INFERENCE_SAFETY_VERSION } as const;

test('unknown, absent and unevaluated cells never become a general tutor', () => {
  for (const subject of [undefined, 'missing', 'math', '__proto__']) {
    for (const task of [undefined, 'missing', 'understand', 'constructor']) {
      assert.equal(tutorCellFor(subject, 'young', task, available), null);
    }
  }
});

test('enabled alone does not authorize a cell and required dependencies must match', () => {
  const cells = { math: { young: { understand: cell } } };
  assert.equal(tutorCellFor('math', 'young', 'understand', available, cells), cell);
  for (const changed of [{ enabled: false }, { evaluation: null }, { evaluation: { ...cell.evaluation, runReference: ' ' } }]) {
    assert.equal(tutorCellFor('math', 'young', 'understand', available,
      { math: { young: { understand: { ...cell, ...changed } } } }), null);
  }
  for (const changed of [{ tools: [] }, { grounding: false }, { language: 'es' }, { safetyVersion: 'obsolete' }, { model: 'claude-haiku-4-5' as const }]) {
    assert.equal(tutorCellFor('math', 'young', 'understand', { ...available, ...changed }, cells), null);
  }
  assert.equal(tutorCellFor('math', 'young', 'understand', undefined, cells), null);
  assert.equal(tutorCellFor('math', 'adult', 'understand', available, cells), null);
});

test('high-school presentation band remains distinct from legal adult eligibility', () => {
  assert.equal(ageBandForVoiceBand('9-12'), 'adult');
  // No provider eligibility is inferred from this UI label.
  assert.equal(tutorCellFor('math', 'adult', 'understand', available), null);
});

test('actual coach denies before loading learner facts and emits only manual recovery text', async () => {
  let facts = 0;
  let contexts = 0;
  const ports: CoachPorts = {
    loadGradeBand: async () => 'k-2', loadLearnerFlags: async () => ({ aiEnabled: true }),
    recordSafetyEvent: () => {}, loadPriorFacts: async () => { facts += 1; return []; },
    loadCapabilityContext: async (ctx) => {
      assert.equal(ctx.learnerId, 'synthetic-learner');
      contexts += 1;
      return { subject: 'math', task: 'understand', available };
    },
  };
  const events = [];
  for await (const event of coachStream({ problem: '12 + 5', message: '' }, { learnerId: 'synthetic-learner', isLearner: true }, ports)) events.push(event);
  assert.deepEqual(events, [{ kind: 'replace', text: TUTOR_MANUAL_HELP }]);
  assert.equal(facts, 0);
  assert.equal(contexts, 1);
});
