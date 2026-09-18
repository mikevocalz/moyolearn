// Provider approval boundaries exercised with fake transports and synthetic records.
// SOT-KEYWORDS: provider policy test fail closed refusal approval revocation
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInferenceGateway } from './gateway.ts';
import { inMemoryLedger, DEFAULT_LEARNER_BUDGET } from './budget.ts';
import { createAnthropicAdapter, type AnthropicTransport } from './anthropic.ts';
import { ModelDeclined } from './errors.ts';
import { fixtureApproval } from './provider-policy.fixture.ts';
import { ProviderPolicyDenied, requireLearnerProviderApproval, type ProviderApproval, type ProviderProduct } from './provider-policy.ts';

const now = new Date('2026-09-16T12:00:00.000Z');
const payload = { system: 'Synthetic test policy', message: 'Synthetic fixture' };
const requireApproval = (records: readonly ProviderApproval[], product: ProviderProduct = 'anthropic-api') =>
  requireLearnerProviderApproval(records, product, 'tutor-turn', 'claude-opus-5', now);

test('missing, ambiguous, malformed and incompatible approvals deny', () => {
  assert.throws(() => requireApproval([]), ProviderPolicyDenied);
  const approved = fixtureApproval();
  assert.doesNotThrow(() => requireApproval([approved]));
  assert.throws(() => requireApproval([approved, approved]), ProviderPolicyDenied);
  const mismatches: Partial<ProviderApproval>[] = [
    { reference: ' ' }, { endpoint: 'https://different.invalid' },
    { effectiveAt: 'invalid' }, { reviewAt: 'invalid' },
    { effectiveAt: '2027-01-01T00:00:00.000Z' }, { reviewAt: now.toISOString() },
    { ageScopes: ['18-plus'] }, { tasks: ['classify-input'] },
    { models: ['claude-haiku-4-5'] }, { regions: ['EU'] },
    { retention: 'unspecified' }, { training: true },
    { safetyVersion: 'obsolete' }, { permittedTools: ['shell'] },
  ];
  for (const mismatch of mismatches) {
    assert.throws(() => requireApproval([{ ...approved, ...mismatch }]), ProviderPolicyDenied);
  }
});

test('Gemini evaluation scope and local/specialist products never authorize a learner route', () => {
  for (const product of ['gemini-developer-api', 'gemini-nano', 'gemini-vertex', 'apple-foundation-models', 'mathpix', 'myscript'] as const) {
    assert.throws(() => requireApproval([{ ...fixtureApproval(), product }], product), ProviderPolicyDenied);
  }
});

test('gateway rechecks approvals on every call and never reaches a transport after revocation', async () => {
  let records: readonly ProviderApproval[] = [fixtureApproval()];
  let calls = 0;
  const transport: AnthropicTransport = {
    stream: () => { throw new Error('Unexpected stream'); },
    create: async () => {
      calls += 1;
      return { content: [{ type: 'text', text: 'safe' }], model: 'claude-haiku-4-5', stop_reason: 'end_turn', stop_details: null,
        usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } };
    },
  };
  const gateway = createInferenceGateway({ adapter: createAnthropicAdapter(transport), ledger: inMemoryLedger(),
    budget: DEFAULT_LEARNER_BUDGET, loadProviderApprovals: async () => records });
  await gateway.classify('summary-narrative', payload);
  assert.equal(calls, 1);
  records = [];
  for (const role of ['classify-input', 'classify-output', 'topic-fence', 'summary-narrative'] as const) {
    await assert.rejects(gateway.classify(role, payload), ProviderPolicyDenied);
  }
  await assert.rejects(gateway.tutorTurn({ learnerId: 'synthetic', payload, now }), ProviderPolicyDenied);
  assert.equal(calls, 1);
});

test('default gateway approval loader denies despite an available transport', async () => {
  let calls = 0;
  const adapter = createAnthropicAdapter({
    stream: () => { calls += 1; throw new Error('Must not call'); },
    create: async () => { calls += 1; throw new Error('Must not call'); },
  });
  const gateway = createInferenceGateway({ adapter, ledger: inMemoryLedger(), budget: DEFAULT_LEARNER_BUDGET });
  await assert.rejects(gateway.tutorTurn({ learnerId: 'synthetic', payload, now }), ProviderPolicyDenied);
  await assert.rejects(gateway.classify('summary-narrative', payload), ProviderPolicyDenied);
  assert.equal(calls, 0);
});

test('a provider refusal invokes no fallback and still settles usage', async () => {
  let calls = 0;
  const adapter = createAnthropicAdapter({
    stream: (params) => {
      calls += 1;
      assert.equal('fallbacks' in params, false);
      assert.equal('betas' in params, false);
      return {
        async *[Symbol.asyncIterator]() {},
        finalMessage: async () => ({ content: [], model: 'claude-opus-5', stop_reason: 'refusal', stop_details: null,
          usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }),
      };
    },
    create: async () => { throw new Error('No classifier fallback'); },
  });
  const ledger = inMemoryLedger();
  const gateway = createInferenceGateway({ adapter, ledger, budget: DEFAULT_LEARNER_BUDGET,
    loadProviderApprovals: async () => [fixtureApproval()] });
  const turn = await gateway.tutorTurn({ learnerId: 'synthetic', payload, now });
  assert.equal(turn.kind, 'stream');
  if (turn.kind !== 'stream') return;
  for await (const text of turn.stream.text) assert.fail(text);
  await assert.rejects(turn.stream.settled, ModelDeclined);
  assert.equal(calls, 1);
});

test('a historical budget timestamp cannot resurrect an expired approval', async () => {
  let calls = 0;
  const adapter = createAnthropicAdapter({
    stream: () => { calls++; throw new Error('Must not dispatch'); },
    create: async () => { calls++; throw new Error('Must not dispatch'); },
  });
  const gateway = createInferenceGateway({ adapter, ledger: inMemoryLedger(), budget: DEFAULT_LEARNER_BUDGET,
    loadProviderApprovals: async () => [{ ...fixtureApproval(),
      effectiveAt: '2020-01-01T00:00:00.000Z', reviewAt: '2021-01-01T00:00:00.000Z' }] });
  await assert.rejects(gateway.tutorTurn({ learnerId: 'synthetic', payload,
    now: new Date('2020-06-01T00:00:00.000Z') }), ProviderPolicyDenied);
  assert.equal(calls, 0);
});

test('revocation after stream creation is enforced before lazy transport dispatch', async () => {
  let records: readonly ProviderApproval[] = [fixtureApproval()];
  let calls = 0;
  const adapter = createAnthropicAdapter({
    stream: () => { calls++; throw new Error('Must not dispatch'); },
    create: async () => { calls++; throw new Error('Must not dispatch'); },
  });
  const gateway = createInferenceGateway({ adapter, ledger: inMemoryLedger(), budget: DEFAULT_LEARNER_BUDGET,
    loadProviderApprovals: async () => records });
  const turn = await gateway.tutorTurn({ learnerId: 'synthetic', payload });
  assert.equal(turn.kind, 'stream');
  if (turn.kind !== 'stream') return;
  records = [];
  await assert.rejects(async () => { for await (const text of turn.stream.text) assert.fail(text); }, ProviderPolicyDenied);
  await assert.rejects(turn.stream.settled, ProviderPolicyDenied);
  assert.equal(calls, 0);
});
