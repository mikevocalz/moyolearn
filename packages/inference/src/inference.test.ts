// The four properties the gateway exists to hold, asserted against the real
// modules rather than against fixtures of them.
//
// The egress test in particular drives a REAL `AnthropicAdapter` through a fake
// socket and reads what came out. `packages/student-model` already asserts that
// the PREAMBLE contains no learner id, on the real `briefPreamble` and for
// exactly this reason — but nothing asserted what the adapter finally put on
// the wire, and the two are different claims: one is about a function, the
// other is about a boundary.
// SOT: docs/design/inference-gateway.md §3 §4.4 §7 · docs/pack/12-systems-design-prompt.md §7 · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: inference test routing capability egress pseudonymization budget nudge session complete adapter

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  budgetLedgerInstalled,
  budgetStateFor,
  createAnthropicAdapter,
  createInferenceGateway,
  dayKey,
  endedOnCeiling,
  inMemoryLedger,
  installBudgetLedger,
  modelFor,
  paramsFor,
  sharedBudgetLedger,
  priceUsd,
  profileFor,
  requestFor,
  ROUTING,
  scrubText,
  REDACTED,
  BREAK_NUDGE,
  DEFAULT_LEARNER_BUDGET,
  MODEL_PROFILES,
  ProviderUnavailable,
} from '../index.ts';
import type {
  AnthropicTransport,
  BudgetLedger,
  LedgerDay,
  InferencePayload,
  InferenceRequest,
  InferenceRole,
  LearnerBudget,
  ProviderAdapter,
  VendorMessage,
  VendorStream,
} from '../index.ts';

const ROLES: readonly InferenceRole[] = ['tutor-turn', 'classify-input', 'classify-output', 'topic-fence'];

const payload = (system: string, message: string): InferencePayload => ({ system, message });

const finalMessage = (overrides: Partial<VendorMessage> = {}): VendorMessage => ({
  content: [{ type: 'text', text: 'Which part did you try first?' }],
  model: 'claude-opus-5',
  stop_reason: 'end_turn',
  stop_details: null,
  usage: {
    input_tokens: 1_000,
    output_tokens: 100,
    cache_read_input_tokens: null,
    cache_creation_input_tokens: null,
  },
  ...overrides,
});

/**
 * A socket that records what it was given and replays a fixed turn. It is a
 * transport rather than a stubbed adapter so the assertions below are about the
 * adapter's own output.
 */
function fakeTransport(message: VendorMessage = finalMessage()): {
  transport: AnthropicTransport;
  sent: Parameters<AnthropicTransport['stream']>[0][];
  created: Parameters<AnthropicTransport['create']>[0][];
} {
  const sent: Parameters<AnthropicTransport['stream']>[0][] = [];
  const created: Parameters<AnthropicTransport['create']>[0][] = [];

  const stream = (): VendorStream => ({
    async *[Symbol.asyncIterator]() {
      yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: 'Hi. ' } };
      yield { type: 'message_delta' as const };
      yield { type: 'content_block_delta' as const, delta: { type: 'text_delta' as const, text: 'Where next?' } };
    },
    finalMessage: async () => message,
  });

  return {
    sent,
    created,
    transport: {
      stream: (params) => {
        sent.push(params);
        return stream();
      },
      create: async (params) => {
        created.push(params);
        return message;
      },
    },
  };
}

/**
 * The system half as the adapter sent it. The vendor param is
 * `string | BetaTextBlockParam[]` and the adapter always sends the array form —
 * a bare string cannot carry a cache breakpoint — so narrowing here is an
 * assertion about the adapter, not a convenience.
 */
const systemBlock = (
  params: Parameters<AnthropicTransport['stream']>[0],
): { text: string; cache_control?: { type: string } | null } => {
  const { system } = params;
  assert.ok(Array.isArray(system), 'the adapter must send the block form of `system`');
  const block = system[0];
  assert.ok(block && block.type === 'text', 'the system half must be one text block');
  return block;
};

const drain = async (adapter: ProviderAdapter, request: InferenceRequest): Promise<string> => {
  const stream = adapter.stream(request);
  let text = '';
  for await (const chunk of stream.text) text += chunk;
  await stream.settled;
  return text;
};

// ---------------------------------------------------------------------------

describe('the routing table', () => {
  it('sends the tutoring turn to the frontier tier and everything else to the small one', () => {
    // Doc 12 §7's binding cost control, stated as an assertion: "small model for
    // L3/L5 classification and topic fencing; frontier model only for the
    // tutoring turn."
    assert.equal(modelFor('tutor-turn'), 'claude-opus-5');
    assert.equal(modelFor('classify-input'), 'claude-haiku-4-5');
    assert.equal(modelFor('classify-output'), 'claude-haiku-4-5');
    assert.equal(modelFor('topic-fence'), 'claude-haiku-4-5');
  });

  it('has a cell for every role, so a new role cannot route nowhere', () => {
    for (const role of ROLES) assert.ok(ROUTING[role], `no routing cell for ${role}`);
  });

  it('gives the classifier a cap that could not hold a coaching turn', () => {
    // A classification is a label. A 64-token cap is what makes a cell that
    // starts generating prose fail loudly rather than quietly become a second,
    // unscreened tutor.
    assert.equal(ROUTING['tutor-turn'].maxTokens, 1024);
    assert.equal(ROUTING['classify-input'].maxTokens, 64);
  });

  it('only opts the tutoring turn into the vendor refusal fallback', () => {
    // A declined tutoring turn is a child watching Natalie stop mid-sentence, so
    // it is worth rescuing. A declined classification is a verdict.
    assert.equal(ROUTING['tutor-turn'].serverSideFallback, true);
    assert.equal(ROUTING['classify-output'].serverSideFallback, false);
  });
});

describe('model capability, as data', () => {
  it('records that the small tier rejects effort and adaptive thinking', () => {
    // The two facts everything else in this file depends on. If the vendor ever
    // changes them, this is the row that changes and nothing else does.
    assert.equal(MODEL_PROFILES['claude-haiku-4-5'].supportsEffort, false);
    assert.equal(MODEL_PROFILES['claude-haiku-4-5'].supportsAdaptiveThinking, false);
    assert.equal(MODEL_PROFILES['claude-opus-5'].supportsEffort, true);
    assert.equal(MODEL_PROFILES['claude-opus-5'].supportsAdaptiveThinking, true);
  });

  it('never puts effort or thinking on a classifier request', () => {
    // The 400 this prevents: Haiku 4.5 rejects `output_config.effort` outright,
    // so the frontier tier's flat request shape does not merely cost more on the
    // classifier cell — it fails.
    const params = paramsFor(requestFor('classify-input', payload('Classify this.', 'twelve plus five')));

    assert.equal('output_config' in params, false);
    assert.equal('thinking' in params, false);
    assert.equal('fallbacks' in params, false);
    assert.equal(params.model, 'claude-haiku-4-5');
  });

  it('drops effort even from a hand-built request aimed at the small tier', () => {
    // The routing table already makes this cell impossible to WRITE — the cell
    // union is discriminated on capability, so `{ model: 'claude-haiku-4-5',
    // effort: 'low' }` does not compile. This is the second guard: a request
    // assembled somewhere else still cannot send one.
    const smuggled: InferenceRequest = {
      modelId: 'claude-haiku-4-5',
      payload: payload('Classify this.', 'twelve plus five'),
      maxTokens: 64,
      effort: 'max',
      cacheSystem: true,
      serverSideFallback: true,
    };

    const params = paramsFor(smuggled);
    assert.equal('output_config' in params, false);
    assert.equal('thinking' in params, false);
  });

  it('does send effort and adaptive thinking on the tutoring turn', () => {
    const params = paramsFor(requestFor('tutor-turn', payload('contract', 'twelve plus five')));

    assert.deepEqual(params.output_config, { effort: 'low' });
    assert.deepEqual(params.thinking, { type: 'adaptive' });
    assert.equal(params.fallbacks, 'default');
  });

  it('withholds the cache breakpoint below the model’s own minimum', () => {
    // Under the minimum the vendor accepts `cache_control` and silently ignores
    // it, which reads in review as a caching strategy while being nothing.
    const short = paramsFor(requestFor('tutor-turn', payload('short contract', 'hi')));
    const long = paramsFor(
      requestFor('tutor-turn', payload('x'.repeat(profileFor('claude-opus-5').minCacheablePrefixTokens * 4), 'hi')),
    );

    assert.equal(systemBlock(short).cache_control, undefined);
    assert.deepEqual(systemBlock(long).cache_control, { type: 'ephemeral' });
  });

  it('refuses to build a request for a model with no capability row', () => {
    const unknown: InferenceRequest = {
      modelId: 'claude-sonnet-5',
      payload: payload('contract', 'hi'),
      maxTokens: 64,
      cacheSystem: false,
      serverSideFallback: false,
    };
    assert.throws(() => paramsFor(unknown), ProviderUnavailable);
  });
});

describe('the pseudonymization boundary', () => {
  it('strips the OCR’d worksheet header while leaving the label', () => {
    // The label stays so the model still sees that a header was there and does
    // not read the redaction as part of the problem.
    assert.equal(scrubText('Name: Ada Lovelace'), 'Name: [redacted]');
    assert.equal(scrubText("Pupil's name — Ada"), 'Pupil: [redacted]');
    assert.equal(scrubText('Student: Ada\n12 + 5 = ?'), 'Student: [redacted]\n12 + 5 = ?');
  });

  it('masks contact shapes anywhere in the turn', () => {
    assert.equal(scrubText('write to ada@example.com'), 'write to [redacted]');
    assert.equal(scrubText('call 555 010 9922 after four'), 'call [redacted] after four');
    assert.ok(!scrubText('she lives at 221 Baker Street').includes('Baker'));
    assert.ok(!scrubText('postcode SW1A 2AA').includes('SW1A'));
  });

  it('leaves arithmetic alone', () => {
    // Over-redaction is the safe direction, but not so far that it eats the
    // homework: a scrub that ate "12 + 5" would be a scrub nobody could keep.
    const problem = 'A bus holds 42 people. 3 buses leave at 9.15. How many seats in total?';
    assert.equal(scrubText(problem), problem);
  });

  it('leaves a chain of subtractions alone — a spaced minus is an operator', () => {
    /*
      The separator class used to swallow ` - `, so any subtraction chain read
      as one long digit run and became `[redacted]`. The child's actual
      worksheet reached the model with the numbers gone — the silent-blanking
      failure, on the half of the payload that carries the question.
    */
    for (const problem of ['1000 - 250 - 125', '45.75 - 12.50', '2.5 - 1.25 - 0.25']) {
      assert.equal(scrubText(problem), problem);
    }
  });

  it('still redacts the phone shapes, whose separators are not spaced', () => {
    assert.equal(scrubText('Call me at 555-123-4567'), 'Call me at [redacted]');
    assert.equal(scrubText('My number is +1 (555) 123-4567'), 'My number is [redacted]');
    assert.equal(scrubText('reach 5551234567'), 'reach [redacted]');
  });

  it('is idempotent, which is what lets it run twice on the same payload', () => {
    // The gateway scrubs on assembly and the adapter scrubs again at the socket.
    // Without idempotence the second pass would produce nested redactions.
    const once = scrubText('Name: Ada — reach me on ada@example.com');
    assert.equal(scrubText(once), once);
  });

  it('puts nothing identifying on the wire, asserted at the adapter', () => {
    // §4.4's owed test. The forbidden list is a fixture child, not a regex for
    // "PII" — a test that tried to define PII would pass by being vague.
    const forbidden = ['learner-9', 'Ada Lovelace', '2016-04-11', 'ada@example.com', '555 010 9922'];
    const { transport, sent } = fakeTransport();
    const adapter = createAnthropicAdapter(transport);

    const request = requestFor(
      'tutor-turn',
      payload(
        'You are tutoring one student. Working on: two-digit addition',
        'Name: Ada Lovelace\nDOB: 2016-04-11\nemail ada@example.com or 555 010 9922\n12 + 5 = ?',
      ),
    );

    return drain(adapter, request).then(() => {
      const wire = JSON.stringify(sent[0]);
      for (const token of forbidden) {
        assert.ok(!wire.includes(token), `"${token}" reached the wire`);
      }
      // The homework itself did survive — otherwise this test would pass on an
      // adapter that sent nothing at all.
      assert.ok(wire.includes('12 + 5'));
    });
  });
});

describe('the adapter', () => {
  it('yields text deltas and settles with usage, the model, and the stop reason', async () => {
    const { transport } = fakeTransport();
    const adapter = createAnthropicAdapter(transport);
    const stream = adapter.stream(requestFor('tutor-turn', payload('contract', 'hi')));

    let text = '';
    for await (const chunk of stream.text) text += chunk;
    const outcome = await stream.settled;

    assert.equal(text, 'Hi. Where next?');
    assert.equal(outcome.stop, 'end_turn');
    assert.equal(outcome.servedBy, 'claude-opus-5');
    assert.deepEqual(outcome.usage, {
      inputTokens: 1_000,
      outputTokens: 100,
      // Vendor nulls mean "no cache activity", so they collapse to zero rather
      // than leaking a nullable into the budget's arithmetic.
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
  });

  it('treats a stop reason this gateway cannot produce as a broken transport', async () => {
    // No tools are declared, so `tool_use` is not a turn to render.
    const { transport } = fakeTransport(finalMessage({ stop_reason: 'tool_use' }));
    const adapter = createAnthropicAdapter(transport);

    await assert.rejects(drain(adapter, requestFor('tutor-turn', payload('c', 'hi'))), ProviderUnavailable);
  });
});

describe('the per-learner budget', () => {
  const spentDay = { turns: DEFAULT_LEARNER_BUDGET.dailyTurns, usd: 0.1 };

  it('ends the session rather than raising an error', () => {
    // The whole point. Exhaustion is not a failure: it produces a STATE, and
    // there is no arm of that state carrying a stream, a frame, or a number a
    // learner surface could render as a price.
    const state = budgetStateFor(spentDay, DEFAULT_LEARNER_BUDGET);
    assert.deepEqual(state, { kind: 'session-complete' });
  });

  it('nudges toward a break before it ends anything', () => {
    const state = budgetStateFor({ turns: DEFAULT_LEARNER_BUDGET.breakNudgeAfterTurns, usd: 0.1 }, DEFAULT_LEARNER_BUDGET);
    assert.equal(state.kind, 'break-nudge');
  });

  it('stays open at the start of the day', () => {
    const state = budgetStateFor({ turns: 0, usd: 0 }, DEFAULT_LEARNER_BUDGET);
    assert.deepEqual(state, { kind: 'open', turnsRemaining: DEFAULT_LEARNER_BUDGET.dailyTurns });
  });

  it('shows the same face to a child when the dollar ceiling is what ended it', () => {
    // The difference is an operations signal — a turn costing far more than
    // `capacity.md` predicts — and is invisible to the learner by construction.
    const runaway = { turns: 2, usd: DEFAULT_LEARNER_BUDGET.dailyUsdCeiling };
    assert.deepEqual(budgetStateFor(runaway, DEFAULT_LEARNER_BUDGET), { kind: 'session-complete' });
    assert.equal(endedOnCeiling(runaway, DEFAULT_LEARNER_BUDGET), true);
    assert.equal(endedOnCeiling(spentDay, DEFAULT_LEARNER_BUDGET), false);
  });

  it('prices a settled turn against the model that served it', () => {
    const usd = priceUsd(profileFor('claude-opus-5'), {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
    });
    assert.equal(usd, 5);
  });
});

describe('the gateway', () => {
  const now = new Date('2026-08-27T10:00:00.000Z');

  const gatewayWith = (
    ledger: BudgetLedger,
    budget: LearnerBudget = DEFAULT_LEARNER_BUDGET,
  ): { gateway: ReturnType<typeof createInferenceGateway>; sent: Parameters<AnthropicTransport['stream']>[0][] } => {
    const { transport, sent } = fakeTransport();
    return { gateway: createInferenceGateway({ adapter: createAnthropicAdapter(transport), ledger, budget }), sent };
  };

  it('makes no provider call at all once the day is spent', async () => {
    const ledger = inMemoryLedger();
    for (let i = 0; i < DEFAULT_LEARNER_BUDGET.dailyTurns; i += 1) {
      await ledger.record('learner-9', dayKey(now), 0);
    }

    const { gateway, sent } = gatewayWith(ledger);
    const turn = await gateway.tutorTurn({ learnerId: 'learner-9', payload: payload('c', 'hi'), now });

    assert.equal(turn.kind, 'session-complete');
    // The cheapest possible enforcement, and the only one that stays true when
    // a second caller appears: the adapter is never reached.
    assert.equal(sent.length, 0);
  });

  it('appends the break nudge to the system half rather than to the child', async () => {
    const ledger = inMemoryLedger();
    for (let i = 0; i < DEFAULT_LEARNER_BUDGET.breakNudgeAfterTurns; i += 1) {
      await ledger.record('learner-9', dayKey(now), 0);
    }

    const { gateway, sent } = gatewayWith(ledger);
    const turn = await gateway.tutorTurn({ learnerId: 'learner-9', payload: payload('contract', 'hi'), now });
    assert.equal(turn.kind, 'stream');
    if (turn.kind !== 'stream') return;
    // The socket opens on first read, not on construction — a turn the child
    // abandons before it starts is a turn the vendor is never asked for.
    for await (const _chunk of turn.stream.text) void _chunk;

    // System half, not message half: it reaches the coach as policy rather than
    // as something the student said, and arrives to the child as coaching text.
    assert.ok(sent[0] && systemBlock(sent[0]).text.includes(BREAK_NUDGE));
    assert.equal(sent[0]?.messages[0]?.content, 'hi');
  });

  it('debits the turn after it settles, not before it starts', async () => {
    const ledger = inMemoryLedger();
    const { gateway } = gatewayWith(ledger);

    const turn = await gateway.tutorTurn({ learnerId: 'learner-9', payload: payload('c', 'hi'), now });
    assert.equal(turn.kind, 'stream');
    assert.deepEqual(await ledger.read('learner-9', dayKey(now)), { turns: 0, usd: 0 });

    if (turn.kind !== 'stream') return;
    for await (const _chunk of turn.stream.text) void _chunk;
    await turn.stream.settled;

    const day = await ledger.read('learner-9', dayKey(now));
    assert.equal(day.turns, 1);
    assert.ok(day.usd > 0);
  });

  it('reports the session state without touching a provider', async () => {
    const ledger = inMemoryLedger();
    const { gateway, sent } = gatewayWith(ledger);
    assert.equal((await gateway.budgetState('learner-9', now)).kind, 'open');
    assert.equal(sent.length, 0);
  });
});

/*
  THE REGRESSION THIS FILE EXISTS FOR MOST.

  The pseudonymizer redacts OCR'd worksheet headers by matching a label and
  consuming the rest of the line. The tutor prompt used `Student:` as its
  SPEAKER label, so the rule matched the scaffold the system had just written and
  redacted the child's entire answer — on every turn, for every learner.

  It failed silently and expensively: the request succeeded, the reply streamed,
  the turn persisted, and the model, handed `Student: [redacted]`, replied "I
  can't see what you wrote, it came through blank." Nothing was broken except the
  meaning.

  So this asserts the shape actually assembled by
  `coach.service.ts` / `student-model/src/inference.ts`, not a convenient one.
*/
/*
  The literal, not an import. `@acme/student-model` is not a dependency of this
  package and must not become one — the gateway is downstream of prompt assembly,
  not coupled to it. `student-model.test.ts` asserts `LEARNER_TURN_LABEL` still
  equals this string, so changing the label fails there and points here.
*/
const LEARNER_TURN_LABEL = 'Their answer:';

/* The header rule's own vocabulary. Any of these as a speaker label redacts the turn. */
const HEADER_WORDS = [
  'name', 'student', 'pupil', 'learner', 'child',
  'teacher', 'parent', 'guardian', 'class', 'school', 'dob',
] as const;

describe('the prompt the gateway is actually handed', () => {
  it('survives scrubbing with the answer intact', () => {
  const assembled = `Problem we are working on: What is 2 + 3 * 4 - 1?\n\n${LEARNER_TURN_LABEL} I multiplied three by four first`;
  const scrubbed = scrubText(assembled);

  assert.equal(scrubbed, assembled, 'the scrubber altered the prompt it was handed');
  assert.ok(scrubbed.includes('I multiplied three by four first'), "the child's answer was redacted");
    assert.ok(!scrubbed.includes(REDACTED), 'nothing in a normal turn should redact');
  });

/*
  The label must keep avoiding every word the header rule matches. Asserted
  against the rule's own vocabulary rather than against the current string, so
  renaming the label to another colliding word fails here rather than in
  production.
*/
  it('uses a label that cannot collide with a redacted header word', () => {
  for (const word of HEADER_WORDS) {
    assert.ok(
      !new RegExp(`\\b${word}\\b`, 'i').test(LEARNER_TURN_LABEL),
      `LEARNER_TURN_LABEL contains "${word}", which the header rule redacts`,
    );
  }
    assert.equal(scrubText(`${LEARNER_TURN_LABEL} 13`), `${LEARNER_TURN_LABEL} 13`);
  });

/* The rule must still do its job: a real OCR'd header is still redacted. */
  it('still redacts a real worksheet header', () => {
  assert.equal(scrubText('Name: Ada Lovelace'), `Name: ${REDACTED}`);
    assert.equal(scrubText('Student: Ada'), `Student: ${REDACTED}`);
  });
});

/*
  THE BUDGET SURVIVING A RESTART.

  `inMemoryLedger` is process-local and the file has always said so; what the
  suite never asserted is the property that makes the §7 ceiling real — that a
  SECOND reader of the same store sees the first one's turns. A deploy is exactly
  that: a new process reading a ledger it did not write.

  These tests are at the PORT, not at Postgres, because `packages/inference` may
  not reach a database and must not learn how to. The real-row proof is
  `packages/payload/src/retention/budget-ledger.integration.test.mjs`, which runs
  the same shape over two independent `pg` connections against
  `edu.inference_budget`. Between them: the port's contract here, the
  implementation's behaviour there.
*/
describe('the budget across a restart', () => {
  const now = new Date('2026-08-27T10:00:00.000Z');

  /**
   * A ledger backed by a store OUTSIDE the ledger object — which is what a table
   * is. Two instances built over one `store` are the fair proxy for two
   * processes over one row: they share no closure state, only the data.
   */
  const sharedStoreLedger = (store: Map<string, LedgerDay>): BudgetLedger => ({
    read: async (learnerId, day) => store.get(`${learnerId}/${day}`) ?? { turns: 0, usd: 0 },
    record: async (learnerId, day, usd) => {
      const current = store.get(`${learnerId}/${day}`) ?? { turns: 0, usd: 0 };
      store.set(`${learnerId}/${day}`, { turns: current.turns + 1, usd: current.usd + usd });
    },
  });

  it('a second process reads the turns the first one spent', async () => {
    const store = new Map<string, LedgerDay>();

    const before = sharedStoreLedger(store);
    for (let i = 0; i < DEFAULT_LEARNER_BUDGET.dailyTurns; i += 1) {
      await before.record('learner-9', dayKey(now), 0.01);
    }

    // The restart. Nothing of `before` survives except what it wrote.
    const after = sharedStoreLedger(store);
    const day = await after.read('learner-9', dayKey(now));

    assert.equal(day.turns, DEFAULT_LEARNER_BUDGET.dailyTurns);
    assert.deepEqual(budgetStateFor(day, DEFAULT_LEARNER_BUDGET), { kind: 'session-complete' });
  });

  it('the process-local ledger is what a restart used to forgive', async () => {
    // The bug, stated as a passing assertion so the fix cannot be undone
    // quietly: this is what the shared gateway did on every deploy.
    const before = inMemoryLedger();
    for (let i = 0; i < DEFAULT_LEARNER_BUDGET.dailyTurns; i += 1) {
      await before.record('learner-9', dayKey(now), 0.01);
    }

    const after = inMemoryLedger();
    assert.deepEqual(await after.read('learner-9', dayKey(now)), { turns: 0, usd: 0 });
  });

  it('installs a durable ledger under the shared gateway', async () => {
    const store = new Map<string, LedgerDay>();
    assert.equal(budgetLedgerInstalled(), false);

    installBudgetLedger(sharedStoreLedger(store));
    assert.equal(budgetLedgerInstalled(), true);

    // Late-bound: this ledger was taken BEFORE the next installation and still
    // follows it, which is what lets `inferenceGateway()` be constructed by
    // whichever route happens to run first.
    const shared = sharedBudgetLedger();
    await shared.record('learner-9', dayKey(now), 0.02);
    assert.deepEqual(store.get(`learner-9/${dayKey(now)}`), { turns: 1, usd: 0.02 });

    const second = new Map<string, LedgerDay>();
    installBudgetLedger(sharedStoreLedger(second));
    await shared.record('learner-9', dayKey(now), 0.03);
    assert.deepEqual(second.get(`learner-9/${dayKey(now)}`), { turns: 1, usd: 0.03 });
  });

  it('a gateway built on the shared ledger enforces the installed count', async () => {
    const store = new Map<string, LedgerDay>();
    installBudgetLedger(sharedStoreLedger(store));

    const { transport, sent } = fakeTransport();
    const gateway = createInferenceGateway({
      adapter: createAnthropicAdapter(transport),
      ledger: sharedBudgetLedger(),
      budget: DEFAULT_LEARNER_BUDGET,
    });

    // The day was spent by the PREVIOUS process. Nothing in this one recorded it.
    for (let i = 0; i < DEFAULT_LEARNER_BUDGET.dailyTurns; i += 1) {
      store.set(`learner-9/${dayKey(now)}`, { turns: i + 1, usd: 0 });
    }

    const turn = await gateway.tutorTurn({ learnerId: 'learner-9', payload: payload('c', 'hi'), now });
    assert.equal(turn.kind, 'session-complete');
    assert.equal(sent.length, 0);
  });
});
