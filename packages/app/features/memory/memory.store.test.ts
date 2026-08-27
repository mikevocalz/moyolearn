// The half of S27's eraser that no database can prove: that the screen ASKS.
//
// `packages/payload/src/retention/erasure.integration.test.mjs` proves what the
// `edu` schema does when the erasure statements run. It cannot prove they run,
// because it mirrors the SQL — `apps/web/lib/edu.repository.ts` begins with
// `import 'server-only'` and will not load outside a server bundle. So every
// version of this feature that was "correct in the database and never called"
// was green there, twice: `eraseLine` filtered a zustand array, and then
// `confirmEraseTranscript` and `confirmForgetAll` did the same after it was
// fixed.
//
// This is the test that goes red for that. It stubs `fetch`, drives the store's
// three destructive actions, and asserts each one reached its route — and that a
// refusal puts the rows BACK with something the guardian can read, because a
// screen showing data as erased when the server said no is the exact failure
// doc 07 §S27 exists to make impossible.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · packages/app/features/memory/memory.store.ts
// SOT-KEYWORDS: memory s27 store test erasure fetch route wiring optimistic reinstate forget all transcript
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { useMemoryStore } from './memory.store.ts';
import { MEMORY_FACTS, MEMORY_TRANSCRIPTS } from './memory.data.ts';

interface Call {
  url: string;
  body: string | null;
}

const realFetch = globalThis.fetch;

/**
 * Records every request and answers with `status`.
 *
 * Typed as the real `fetch` rather than through a cast, so a signature change in
 * lib.dom is a compile error here instead of a stub that quietly stops matching
 * what the store calls.
 */
function stubFetch(status: number, body: string = '{}'): Call[] {
  const calls: Call[] = [];
  const fake: typeof globalThis.fetch = (input, init) => {
    calls.push({
      url: String(input),
      body: typeof init?.body === 'string' ? init.body : null,
    });
    return Promise.resolve(new Response(body, { status }));
  };
  globalThis.fetch = fake;
  return calls;
}

/** A network outage, which the store must treat exactly as a refusal. */
function stubOffline(): Call[] {
  const calls: Call[] = [];
  const fake: typeof globalThis.fetch = (input, init) => {
    calls.push({ url: String(input), body: typeof init?.body === 'string' ? init.body : null });
    return Promise.reject(new Error('offline'));
  };
  globalThis.fetch = fake;
  return calls;
}

const reset = () =>
  useMemoryStore.setState({
    facts: [...MEMORY_FACTS],
    transcripts: [...MEMORY_TRANSCRIPTS],
    pendingTranscriptId: null,
    forgetAllOpen: false,
    eraseError: null,
  });

afterEach(() => {
  globalThis.fetch = realFetch;
  reset();
});

describe('S27 erasure reaches the server', () => {
  it('erases one line through the route, and sends only the fact id', async () => {
    const calls = stubFetch(200, '{"erased":true,"blockedTag":null}');
    const target = MEMORY_FACTS[0]!;

    await useMemoryStore.getState().eraseLine(target.id);

    assert.equal(calls.length, 1, 'erasing a line did not reach the server');
    assert.ok(calls[0]!.url.endsWith('/api/memory/erase'), calls[0]!.url);
    /*
      The whole body, compared exactly. A body that also carried the learner
      would be a delete endpoint for other people's children, and one that
      carried the tag would be a way to block part of a model without deleting
      anything a guardian can see — so "only the fact id" is asserted as an
      equality rather than as the presence of a key.
    */
    assert.equal(calls[0]!.body, JSON.stringify({ factId: target.id }));
    assert.equal(
      useMemoryStore.getState().facts.some((fact) => fact.id === target.id),
      false,
      'the line is still on screen after a successful erasure',
    );
  });

  it('erases a session through the route and takes its sole-source facts with it', async () => {
    const calls = stubFetch(200, '{"erased":true,"erasedFactIds":[],"trimmedFactIds":[]}');
    // `s-0211` is the sole source of `maya:mastery:decimal-sense` in the fixture,
    // which is what makes this a cascade rather than a row delete.
    const transcriptId = 's-0211';
    const doomed = MEMORY_FACTS.filter(
      (fact) => fact.derivedFrom.length === 1 && fact.derivedFrom[0] === transcriptId,
    );
    assert.ok(doomed.length > 0, 'the fixture no longer has a sole-source fact to cascade');

    useMemoryStore.getState().askEraseTranscript(transcriptId);
    await useMemoryStore.getState().confirmEraseTranscript();

    assert.equal(calls.length, 1, 'erasing a session did not reach the server');
    assert.ok(calls[0]!.url.endsWith('/api/memory/erase-transcript'), calls[0]!.url);
    assert.equal(calls[0]!.body, JSON.stringify({ transcriptId }));

    const state = useMemoryStore.getState();
    assert.equal(
      state.transcripts.some((transcript) => transcript.id === transcriptId),
      false,
      'the erased session is still listed',
    );
    for (const fact of doomed) {
      assert.equal(
        state.facts.some((kept) => kept.id === fact.id),
        false,
        `${fact.id} came only from the erased session and is still on screen`,
      );
    }
  });

  it('puts the session and its facts back when the server refuses', async () => {
    const calls = stubOffline();
    const transcriptId = 's-0211';

    useMemoryStore.getState().askEraseTranscript(transcriptId);
    await useMemoryStore.getState().confirmEraseTranscript();

    assert.equal(calls.length, 1, 'the store never tried');
    const state = useMemoryStore.getState();
    assert.equal(state.facts.length, MEMORY_FACTS.length, 'the cascade was not reinstated');
    assert.equal(state.transcripts.length, MEMORY_TRANSCRIPTS.length, 'the session was not reinstated');
    assert.notEqual(
      state.eraseError,
      null,
      'the guardian was shown a deletion that did not happen and told nothing',
    );
  });

  it('forgets everything through the route, and names nobody', async () => {
    const calls = stubFetch(
      200,
      '{"transcripts":3,"facts":6,"blockedTags":0,"media":{"scoped":true,"deleted":0,"failed":[]}}',
    );

    useMemoryStore.getState().askForgetAll();
    await useMemoryStore.getState().confirmForgetAll();

    assert.equal(calls.length, 1, 'forget-everything did not reach the server');
    assert.ok(calls[0]!.url.endsWith('/api/memory/forget-all'), calls[0]!.url);
    /*
      NO BODY AT ALL. The learner is `ctx.learnerId` on the server and there is
      nothing else to say — a request that could name whose record to destroy is
      the worst-shaped endpoint in the product.
    */
    assert.equal(calls[0]!.body, null, 'forget-everything sent a body naming something');

    const state = useMemoryStore.getState();
    assert.deepEqual(state.facts, []);
    assert.deepEqual(state.transcripts, []);
    assert.equal(state.eraseError, null);
  });

  it('puts everything back when forget-everything is refused', async () => {
    stubFetch(500, '{"error":"Server error"}');

    useMemoryStore.getState().askForgetAll();
    await useMemoryStore.getState().confirmForgetAll();

    const state = useMemoryStore.getState();
    assert.equal(state.facts.length, MEMORY_FACTS.length, 'the model was not reinstated');
    assert.equal(state.transcripts.length, MEMORY_TRANSCRIPTS.length, 'the sessions were not reinstated');
    assert.notEqual(state.eraseError, null, 'an empty screen was left standing on a failed request');
  });

  it('says so when the record went but the child’s files did not', async () => {
    /*
      A 200 the guardian must still be told about. The `edu` rows are gone and
      Bunny refused — "forget everything" is not true yet, and the one thing this
      screen may never do is report a deletion it cannot vouch for.
    */
    stubFetch(
      200,
      '{"transcripts":3,"facts":6,"blockedTags":1,"media":{"scoped":false,"reason":"school account"}}',
    );

    useMemoryStore.getState().askForgetAll();
    await useMemoryStore.getState().confirmForgetAll();

    const state = useMemoryStore.getState();
    assert.deepEqual(state.facts, [], 'the record was erased and the screen still shows it');
    assert.notEqual(
      state.eraseError,
      null,
      'files survived a request to forget everything and the guardian was not told',
    );
  });
});
