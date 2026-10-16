// The advance route's 409 is the one refusal the client must turn into data.
// SOT: packages/app/features/homework/homework.client.ts · docs/work/pr-100/contract.md §Routes
// SOT-KEYWORDS: homework client test advance stale cursor 409 api error
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError } from '../../core/api-fetch.ts';
import { createHomeworkClient, StaleCursorError } from './homework.client.ts';
import type { AdvanceInput } from './homework.types.ts';

const move: AdvanceInput = {
  fromQuestionId: 'q1',
  expectedIndex: 0,
  outcome: 'attempted',
  attempts: 1,
  hintsUsed: 0,
  misconceptionTags: [],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('a stale-cursor 409 becomes StaleCursorError carrying the server cursor', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const client = createHomeworkClient(async (url, init) => {
    seen.push({ url, init });
    return json(409, { error: 'stale-cursor', current: { currentIndex: 2, currentQuestionId: 'q3', status: 'in-progress' } });
  }, 'https://api.test');
  await assert.rejects(client.advance('sub/1', move), (error: unknown) => {
    assert.ok(error instanceof StaleCursorError);
    assert.deepEqual(error.current, { currentIndex: 2, currentQuestionId: 'q3', status: 'in-progress' });
    return true;
  });
  assert.equal(seen[0]?.url, 'https://api.test/api/homework/submissions/sub%2F1/advance');
  assert.equal(seen[0]?.init.credentials, 'include');
  assert.deepEqual(JSON.parse(String(seen[0]?.init.body)), move);
});

test('any other 409 or failure keeps its status as an ApiError', async () => {
  const conflict = createHomeworkClient(async () => json(409, { error: 'submission-conflict' }), '');
  await assert.rejects(conflict.advance('s', move), (e: unknown) => e instanceof ApiError && e.status === 409);
  const forbidden = createHomeworkClient(async () => json(403, { error: 'Forbidden' }), '');
  await assert.rejects(forbidden.advance('s', move), (e: unknown) => e instanceof ApiError && e.status === 403);
  await assert.rejects(forbidden.getSubmission('s'), (e: unknown) => e instanceof ApiError && e.status === 403);
});

test('a 200 advance returns the new cursor; a dropped connection stays a transport error', async () => {
  const ok = createHomeworkClient(async () => json(200, { currentIndex: 1, currentQuestionId: 'q2', status: 'in-progress' }), '');
  assert.deepEqual(await ok.advance('s', move), { currentIndex: 1, currentQuestionId: 'q2', status: 'in-progress' });
  const offline = createHomeworkClient(async () => { throw new TypeError('Failed to fetch'); }, '');
  await assert.rejects(offline.advance('s', move), (e: unknown) => e instanceof TypeError);
});
