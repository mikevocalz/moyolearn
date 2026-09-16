// Exercise the authenticated service: uncertain source cannot write learning data.
// SOT-KEYWORDS: tutor source readiness server assessment distillation regression
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Auth } from '@acme/auth/server';
import { evaluateTutorTurn } from './tutor.service.ts';

test('client source claims, including forged verified, never authorize learning writes', async () => {
  const previous = process.env.NEXT_PUBLIC_AUTH_MODE;
  const environment = process.env.NODE_ENV;
  process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
  process.env.NODE_ENV = 'development';
  try {
    for (const sourceReadiness of [undefined, 'unresolved', 'verified'] as const) {
      const calls: string[] = [];
      const result = await evaluateTutorTurn(
        {} as Auth,
        new Headers(),
        {
          problem: '12 + 4',
          answer: '3',
          hintDepth: 0,
          sourceReadiness,
        },
        {
          saveTranscript: async () => {
            calls.push('saveTranscript');
          },
          distillation: {
            loadPriorFacts: async () => {
              calls.push('loadPriorFacts');
              return [];
            },
            saveFacts: async () => {
              calls.push('saveFacts');
            },
            loadBlockedTags: async () => {
              calls.push('loadBlockedTags');
              return [];
            },
          },
        },
      );
      assert.equal(result.isCorrect, null);
      assert.deepEqual(calls, []);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_AUTH_MODE;
    else process.env.NEXT_PUBLIC_AUTH_MODE = previous;
    if (environment === undefined)
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    else process.env.NODE_ENV = environment;
  }
});

test('the server rejects mismatched, stale, expired and unresolved evidence inside the repository boundary', async () => {
  const previous = process.env.NEXT_PUBLIC_AUTH_MODE;
  const environment = process.env.NODE_ENV;
  process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
  process.env.NODE_ENV = 'development';
  try {
    const valid = {
      questionId: 'question-1', revision: 'revision-2', learnerId: 'dev-learner-1',
      orgId: 'riverside-unified', problem: '1/2+1/3', evaluationReady: true,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    };
    for (const change of [
      { learnerId: 'another-learner' }, { orgId: 'another-org' },
      { questionId: 'another-question' }, { revision: 'revision-1' },
      { problem: '1/2+1/2' }, { evaluationReady: false },
      { expiresAt: 'invalid' }, { expiresAt: '2020-01-01T00:00:00.000Z' },
    ]) {
      let writes = 0;
      const result = await evaluateTutorTurn({} as Auth, new Headers(), {
        problem: valid.problem, answer: '5/6', hintDepth: 0,
        sourceReadiness: 'verified', evidence: { questionId: valid.questionId, revision: valid.revision },
      }, {
        withCurrentEvidence: async (_ctx, _reference, assess) =>
          assess({ ...valid, ...change }, async () => { writes++; }),
      });
      assert.equal(result.isCorrect, null, JSON.stringify(change));
      assert.equal(writes, 0);
    }
    let savedRevision = '';
    const checked = await evaluateTutorTurn({} as Auth, new Headers(), {
      problem: valid.problem, answer: '5/6', hintDepth: 0,
      evidence: { questionId: valid.questionId, revision: valid.revision },
    }, {
      withCurrentEvidence: async (_ctx, _reference, assess) => assess(valid, async (_ctx, transcript) => {
        savedRevision = transcript.evidence.revision;
      }),
    });
    assert.equal(checked.isCorrect, true);
    assert.equal(savedRevision, valid.revision);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_AUTH_MODE;
    else process.env.NEXT_PUBLIC_AUTH_MODE = previous;
    if (environment === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else process.env.NODE_ENV = environment;
  }
});
