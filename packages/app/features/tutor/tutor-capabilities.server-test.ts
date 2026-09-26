// Exact-cell eligibility, distinct from model capability or presentation age.
// SOT-KEYWORDS: tutor capabilities test evaluation fail closed grade tools grounding
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INFERENCE_SAFETY_VERSION } from '@acme/inference';
import { ageBandForVoiceBand } from '../capture/age-band.ts';
import { OWNER_AUTHORIZED, tutorCellFor, TUTOR_MANUAL_HELP, type TutorCell } from './tutor-capabilities.ts';
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
  // `ela` stands in for math: math's cells are owner-authorized (below), every
  // other subject is still the unevaluated template and stays shut.
  for (const subject of [undefined, 'missing', 'ela', '__proto__']) {
    for (const task of [undefined, 'missing', 'understand', 'constructor']) {
      assert.equal(tutorCellFor(subject, 'young', task, available), null);
    }
  }
  for (const task of [undefined, 'missing', 'constructor', 'explore']) {
    assert.equal(tutorCellFor('math', 'young', task, available), null);
  }
});

test('the math cells are open under owner authorization, and the cell says so', () => {
  for (const band of ['young', 'child', 'teen', 'adult'] as const) {
    for (const task of ['understand', 'check-work', 'practice'] as const) {
      const opened = tutorCellFor('math', band, task, available);
      assert.ok(opened, `${band}/${task}`);
      assert.equal(opened.evaluation?.runReference, OWNER_AUTHORIZED);
      assert.deepEqual(opened.tools, []);
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
  // No provider eligibility is inferred from this UI label: the adult math cell
  // is open only under the owner's authorization, with no evaluated run of its own.
  assert.equal(tutorCellFor('math', 'adult', 'understand', available)?.evaluation?.runReference, OWNER_AUTHORIZED);
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
      // A subject with no open cell — math is owner-authorized, ela is not.
      return { subject: 'ela', task: 'understand', available };
    },
  };
  const events = [];
  for await (const event of coachStream({ problem: '12 + 5', message: '' }, { learnerId: 'synthetic-learner', isLearner: true }, ports)) events.push(event);
  assert.deepEqual(events, [{ kind: 'replace', text: TUTOR_MANUAL_HELP }]);
  assert.equal(facts, 0);
  assert.equal(contexts, 1);
});
