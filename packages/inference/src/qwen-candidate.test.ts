import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qwenFallbackEligibleForReview, type FallbackReadiness } from './fallback-policy.ts';
import { QWEN_CANDIDATE, runSyntheticQwenEvaluation } from './qwen-candidate.ts';

test('the one Qwen candidate is not wired as a production fallback', () => {
  assert.equal(QWEN_CANDIDATE.model, 'qwen3.8-max');
  assert.equal(QWEN_CANDIDATE.rollout, 'synthetic-evaluation-only');
});

test('unknown evaluation ids and absent credentials fail without provider transport', async () => {
  let calls = 0;
  const transport = async () => { calls++; throw new Error('Should not dispatch'); };
  await assert.rejects(runSyntheticQwenEvaluation('not-a-fixture' as never, { apiKey: 'mock', transport }), /Unknown synthetic/);
  await assert.rejects(runSyntheticQwenEvaluation('spanish-past-tense', { apiKey: '', transport }), /not configured/);
  assert.equal(calls, 0);
});

test('Qwen evaluation uses only checked-in synthetic content at US endpoint', async () => {
  let seen: unknown;
  const transport = async (url: string, init: RequestInit): Promise<Response> => {
    assert.equal(url, QWEN_CANDIDATE.endpoint);
    assert.equal(init.method, 'POST');
    seen = JSON.parse(String(init.body));
    return new Response(JSON.stringify({
      model: 'qwen3.8-max',
      choices: [{ message: { content: 'Try finding a common denominator.' } }],
      usage: { prompt_tokens: 32, completion_tokens: 12 },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const result = await runSyntheticQwenEvaluation('math-guided-fractions', { apiKey: 'synthetic-key', transport });
  assert.equal(result.fixtureId, 'math-guided-fractions');
  assert.equal(result.outputTokens, 12);
  const request = seen as { model: string; messages: { role: string; content: string }[] };
  assert.equal(request.model, QWEN_CANDIDATE.model);
  assert.equal(request.messages.length, 2);
  assert.match(request.messages[1]!.content, /fictitious|1\/2/);
  assert.doesNotMatch(JSON.stringify(request), /learnerId|childId|sessionId/);
});

const ready: FallbackReadiness = {
  cause: 'provider-unavailable',
  providerApproved: true,
  gradeAndSubjectEvaluated: true,
  zeroRetentionVerified: true,
  safetyPlaneAvailable: true,
  guardianPermissionConfirmed: true,
  learnerBudgetAvailable: true,
};

test('fallback requires every approval and is never used after refusal or safety block', () => {
  assert.equal(qwenFallbackEligibleForReview(ready), true);
  for (const cause of ['provider-refusal', 'safety-block', 'budget-complete', 'learner-disabled'] as const) {
    assert.equal(qwenFallbackEligibleForReview({ ...ready, cause }), false);
  }
  for (const field of ['providerApproved', 'gradeAndSubjectEvaluated', 'zeroRetentionVerified',
    'safetyPlaneAvailable', 'guardianPermissionConfirmed', 'learnerBudgetAvailable'] as const) {
    assert.equal(qwenFallbackEligibleForReview({ ...ready, [field]: false }), false, field);
  }
});
