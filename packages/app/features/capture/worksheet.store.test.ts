// The cache's promise: every local cursor move ends confirmed, reconciled, or
// still pending and visible. Driven through the real state creator with a fake
// server on Maps and a switch for the network.
// SOT: packages/app/features/capture/worksheet-cache.ts · docs/work/pr-100/contract.md §Client
// SOT-KEYWORDS: worksheet store test optimistic advance 409 reconcile offline pending flush learner key isolation v1 migration
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createStore } from 'zustand/vanilla';
import { ApiError } from '../../core/api-fetch.ts';
import { StaleCursorError, type HomeworkClient } from '../homework/homework.client.ts';
import type { AdvanceResult, HomeworkSubmissionView } from '../homework/homework.types.ts';
import type { ProblemStorage } from './problem-storage.shared.ts';
import { worksheetKeyFor, worksheetStateCreator, outcomeForAdvance, currentPrompt, isCurrentWorksheetQuestion, isLeftoverWorksheetProblem, applyMove } from './worksheet-cache.ts';
import { writeWorksheet } from './worksheet-session.ts';

function fakeStorage(): ProblemStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getString: (key) => values.get(key),
    set: (key, value) => { values.set(key, value); },
    remove: (key) => { values.delete(key); },
  };
}

function fakeServer() {
  const rows = new Map<string, HomeworkSubmissionView>();
  const net = { online: true, advanceCalls: 0, listCalls: 0, learnerId: 'learner-1', actorId: 'learner-1' };
  const reach = () => { if (!net.online) throw new TypeError('Failed to fetch'); };
  const cursor = (v: HomeworkSubmissionView): AdvanceResult =>
    ({ currentIndex: v.currentIndex, currentQuestionId: v.currentQuestionId, status: v.status });
  const client: HomeworkClient = {
    createSubmission: async (input) => {
      reach();
      const existing = rows.get(input.submissionId);
      if (existing) return existing;
      const at = '2026-10-15T12:00:00.000Z';
      const view: HomeworkSubmissionView = {
        submissionId: input.submissionId,
        learnerAuthId: input.forLearnerAuthId ?? net.learnerId,
        createdByAuthId: net.actorId,
        subject: input.subject,
        title: input.title,
        instructions: input.instructions,
        localDate: input.localDate,
        status: 'ready',
        pipelineStatus: 'extracted',
        pipelineError: null,
        currentIndex: 0,
        currentQuestionId: input.submissionId + ':q1',
        tutorSessionId: null,
        questions: input.questions.map((q, i) => ({
          questionId: `${input.submissionId}:q${String(i + 1)}`,
          orderIndex: i,
          sourcePage: q.sourcePage,
          sourceNumber: q.sourceNumber,
          currentRevision: 'r1',
          text: q.text,
          revisions: [],
          crop: null,
          outcome: 'unattempted',
          attempts: 0,
          hintsUsed: 0,
          misconceptionTags: [],
          startedAt: null,
          completedAt: null,
        })),
        createdAt: at,
        updatedAt: at,
      };
      rows.set(view.submissionId, view);
      return view;
    },
    listSubmissions: async () => {
      reach();
      net.listCalls += 1;
      return [...rows.values()]
        .filter((view) => view.learnerAuthId === net.learnerId)
        .reverse()
        .map((view) => ({
          submissionId: view.submissionId,
          learnerAuthId: view.learnerAuthId,
          subject: view.subject,
          title: view.title,
          localDate: view.localDate,
          status: view.status,
          questionCount: view.questions.length,
          alreadyDoneCount: view.questions.filter((q) => q.priorWork === 'complete').length,
          currentIndex: view.currentIndex,
          outcomes: {
            unattempted: 0, skipped: 0, attempted: 0,
            'supported-with-hints': 0, 'solved-independently': 0, unresolved: 0,
          },
          tutorSessionId: view.tutorSessionId,
          createdAt: view.createdAt,
        }));
    },
    getSubmission: async (id) => {
      reach();
      const row = rows.get(id);
      if (!row) throw new ApiError(404);
      return row;
    },
    reviseQuestion: async () => { throw new ApiError(400); },
    startSubmission: async (id, input) => {
      reach();
      const row = { ...rows.get(id)!, tutorSessionId: input.tutorSessionId };
      rows.set(id, row);
      return row;
    },
    advance: async (id, input) => {
      reach();
      net.advanceCalls += 1;
      const row = rows.get(id)!;
      if (row.currentIndex !== input.expectedIndex) throw new StaleCursorError(cursor(row));
      const questions = row.questions.map((q) =>
        q.questionId === input.fromQuestionId ? { ...q, outcome: input.outcome, attempts: input.attempts } : q);
      const next = questions[input.expectedIndex + 1];
      const moved: HomeworkSubmissionView = next
        ? { ...row, questions, currentIndex: input.expectedIndex + 1, currentQuestionId: next.questionId, status: 'in-progress' }
        : { ...row, questions, status: 'complete' };
      rows.set(id, moved);
      return cursor(moved);
    },
  };
  /** Another device moves the server cursor directly. */
  const moveElsewhere = (id: string, toIndex: number) => {
    const row = rows.get(id)!;
    rows.set(id, { ...row, currentIndex: toIndex, currentQuestionId: row.questions[toIndex]!.questionId, status: 'in-progress' });
  };
  return { client, rows, net, moveElsewhere };
}

const input = (submissionId = 'sub-1') => ({
  submissionId,
  subject: 'Math',
  title: 'Math worksheet',
  instructions: 'Solve each.',
  localDate: '2026-10-15',
  questions: ['2+2=', '3+3=', '4+4='].map((text, i) => ({
    clientId: 'question-' + String(i + 1),
    sourcePage: 1,
    sourceNumber: i + 1,
    text,
    confidence: null,
    crop: null,
  })),
});

const step = { outcome: 'attempted' as const, attempts: 1, hintsUsed: 0, misconceptionTags: [] };

test('offline cursor skips prior-complete questions and never changes their learning outcomes', async () => {
  const { store } = setup();
  const initial = await store.getState().begin('learner-1', input());
  const questions = initial.questions.map((question, index) => ({ ...question, priorWork: index === 1 ? 'complete' as const : 'none' as const }));
  const view = { ...initial, questions };
  const moved = applyMove(view, { ...step, fromQuestionId: questions[0]!.questionId, expectedIndex: 0 }, '2026-11-14T12:00:00Z');
  assert.equal(moved.currentIndex, 2);
  assert.equal(moved.questions[1]!.outcome, 'unattempted');
  const lastMarked = { ...view, questions: questions.map((question, index) => index > 0 ? { ...question, priorWork: 'complete' as const } : question) };
  const complete = applyMove(lastMarked, { ...step, fromQuestionId: questions[0]!.questionId, expectedIndex: 0 }, '2026-11-14T12:00:00Z');
  assert.equal(complete.status, 'complete');
  assert.equal(currentPrompt(complete), null);
  assert.equal(currentPrompt({ ...view, currentIndex: 1 }), null);
});

test('starting adopts guardian marks and the authoritative cursor instead of only the session id', async () => {
  const { store, server } = setup();
  const initial = await store.getState().begin('learner-1', input());
  const questions = initial.questions.map((question, index) => ({ ...question, priorWork: index === 0 ? 'complete' as const : 'none' as const }));
  server.rows.set(initial.submissionId, { ...initial, questions, currentIndex: 1, currentQuestionId: questions[1]!.questionId });
  await store.getState().start('session-1');
  assert.equal(store.getState().current?.currentIndex, 1);
  assert.equal(store.getState().current?.questions[0]!.priorWork, 'complete');
  server.rows.set(initial.submissionId, { ...initial, status: 'complete', questions: questions.map((question) => ({ ...question, priorWork: 'complete' })) });
  await store.getState().start('session-2');
  assert.equal(store.getState().current?.status, 'complete');
  assert.equal(currentPrompt(store.getState().current!), null);
});

test('an advance cannot race the start response and overwrite guardian cursor selection', async () => {
  const { store, server } = setup();
  const initial = await store.getState().begin('learner-1', input());
  let resolveStart: ((view: HomeworkSubmissionView) => void) | undefined;
  let requestStarted: (() => void) | undefined;
  const requested = new Promise<void>((resolve) => { requestStarted = resolve; });
  server.client.startSubmission = async () => new Promise<HomeworkSubmissionView>((resolve) => { resolveStart = resolve; requestStarted!(); });
  const starting = store.getState().start('session-1');
  await requested;
  await store.getState().advance(step);
  assert.equal(server.net.advanceCalls, 0);
  assert.equal(store.getState().current?.currentIndex, 0);
  resolveStart!({ ...initial, tutorSessionId: 'session-1' });
  await starting;
  assert.equal(store.getState().current?.tutorSessionId, 'session-1');
});

test('a hydrate started before tutoring cannot restore marks and cursor from before start', async () => {
  const { store, server } = setup();
  const initial = await store.getState().begin('learner-1', input());
  let resolveRead!: (view: HomeworkSubmissionView) => void;
  let readRequested!: () => void;
  const requested = new Promise<void>((resolve) => { readRequested = resolve; });
  server.client.getSubmission = async () => new Promise<HomeworkSubmissionView>((resolve) => {
    resolveRead = resolve;
    readRequested();
  });
  const hydrating = store.getState().hydrate('learner-1');
  await requested;
  const questions = initial.questions.map((question, index) => ({
    ...question,
    priorWork: index === 0 ? 'complete' as const : 'none' as const,
  }));
  server.rows.set(initial.submissionId, {
    ...initial, questions, currentIndex: 1, currentQuestionId: questions[1]!.questionId,
  });
  await store.getState().start('session-1');
  resolveRead(initial);
  await hydrating;
  assert.equal(store.getState().current?.tutorSessionId, 'session-1');
  assert.equal(store.getState().current?.currentIndex, 1);
  assert.equal(store.getState().current?.questions[0]!.priorWork, 'complete');
});

test('a delayed hydrate cannot discard an offline cursor move or its pending sync feedback', async () => {
  const { store, server } = setup();
  const initial = await store.getState().begin('learner-1', input());
  let resolveRead!: (view: HomeworkSubmissionView) => void;
  let readRequested!: () => void;
  const requested = new Promise<void>((resolve) => { readRequested = resolve; });
  server.client.getSubmission = async () => new Promise<HomeworkSubmissionView>((resolve) => {
    resolveRead = resolve;
    readRequested();
  });
  const hydrating = store.getState().hydrate('learner-1');
  await requested;
  server.net.online = false;
  await store.getState().advance(step);
  resolveRead(initial);
  await hydrating;
  assert.equal(store.getState().current?.currentIndex, 1);
  assert.equal(store.getState().pending.length, 1);
  assert.equal(store.getState().status, 'pending');
});

test('moves queued while an earlier advance is awaiting confirmation are all sent in order', async () => {
  const { store, server } = setup();
  await store.getState().begin('learner-1', input());
  const advance = server.client.advance;
  let resumeFirst!: () => void;
  const waiting = new Promise<void>((resolve) => { resumeFirst = resolve; });
  let first = true;
  server.client.advance = async (id, move) => {
    if (first) { first = false; await waiting; }
    return advance(id, move);
  };
  const firstMove = store.getState().advance(step);
  const secondMove = store.getState().advance(step);
  assert.equal(store.getState().current?.currentIndex, 2);
  assert.equal(store.getState().pending.length, 2);
  resumeFirst();
  await Promise.all([firstMove, secondMove]);
  assert.equal(server.net.advanceCalls, 2);
  assert.equal(server.rows.get('sub-1')?.currentIndex, 2);
  assert.equal(store.getState().current?.currentIndex, 2);
  assert.equal(store.getState().pending.length, 0);
});

test('a delayed failed advance retains every move queued during the request', async () => {
  const { store, server } = setup();
  await store.getState().begin('learner-1', input());
  const advance = server.client.advance;
  let failFirst!: (reason: Error) => void;
  server.client.advance = async () => new Promise<AdvanceResult>((_, reject) => { failFirst = reject; });
  const firstMove = store.getState().advance(step);
  const secondMove = store.getState().advance(step);
  failFirst(new TypeError('Failed to fetch'));
  await Promise.all([firstMove, secondMove]);
  assert.equal(store.getState().current?.currentIndex, 2);
  assert.equal(store.getState().pending.length, 2);
  assert.equal(store.getState().status, 'pending');
  server.client.advance = advance;
  await store.getState().hydrate('learner-1');
  assert.equal(server.net.advanceCalls, 2);
  assert.equal(store.getState().pending.length, 0);
  assert.equal(store.getState().current?.currentIndex, 2);
});

function setup() {
  const storage = fakeStorage();
  const server = fakeServer();
  const store = createStore(worksheetStateCreator({ storage, client: server.client }));
  return { storage, server, store };
}

test('advance moves the local cursor at once and the server confirms it', async () => {
  const { store, server } = setup();
  await store.getState().begin('learner-1', input());
  const sent = store.getState().advance(step);
  // Before the server answers, the screen already shows question 2 as unconfirmed.
  assert.equal(store.getState().current?.currentIndex, 1);
  assert.equal(store.getState().status, 'pending');
  assert.equal(await sent, 'confirmed');
  assert.equal(store.getState().pending.length, 0);
  assert.equal(server.rows.get('sub-1')?.currentIndex, 1);
});

test('a 409 replaces the optimistic cursor with the server cursor and says reconciled', async () => {
  const { store, server, storage } = setup();
  await store.getState().begin('learner-1', input());
  server.moveElsewhere('sub-1', 2);
  const sent = store.getState().advance(step);
  assert.equal(store.getState().current?.currentIndex, 1);
  assert.equal(await sent, 'reconciled');
  assert.equal(store.getState().current?.currentIndex, 2);
  assert.equal(store.getState().current?.currentQuestionId, 'sub-1:q3');
  assert.equal(store.getState().pending.length, 0);
  // The refused move's outcome is not left on the local copy of question 1.
  assert.equal(store.getState().current?.questions[0]?.outcome, 'unattempted');
  const saved = JSON.parse(storage.getString(worksheetKeyFor('learner-1'))!);
  assert.equal(saved.confirmed.currentIndex, 2);
});

test('offline advances stay pending across a restart, then flush in order on hydrate', async () => {
  const { store, server, storage } = setup();
  await store.getState().begin('learner-1', input());
  server.net.online = false;
  assert.equal(await store.getState().advance(step), 'pending');
  assert.equal(await store.getState().advance({ ...step, outcome: 'skipped', attempts: 0 }), 'pending');
  assert.equal(store.getState().current?.currentIndex, 2);
  assert.equal(server.rows.get('sub-1')?.currentIndex, 0);

  // A fresh process reads the same storage: the pending moves are still there and visible.
  const reopened = createStore(worksheetStateCreator({ storage, client: server.client }));
  reopened.getState().restore('learner-1');
  assert.equal(reopened.getState().status, 'pending');
  assert.equal(reopened.getState().pending.length, 2);
  assert.equal(reopened.getState().current?.currentIndex, 2);

  server.net.online = true;
  await reopened.getState().hydrate('learner-1');
  assert.equal(reopened.getState().status, 'confirmed');
  assert.equal(reopened.getState().pending.length, 0);
  assert.equal(server.rows.get('sub-1')?.currentIndex, 2);
  assert.equal(server.rows.get('sub-1')?.questions[1]?.outcome, 'skipped');
});

test('a sibling learner on the same device never sees or moves another learner’s worksheet', async () => {
  const { store, storage, server } = setup();
  await store.getState().begin('learner-1', input('sub-1'));
  assert.equal(store.getState().restore('learner-2'), null);
  assert.equal(await store.getState().advance(step), 'idle');
  assert.equal(server.net.advanceCalls, 0);
  server.net.learnerId = 'learner-2';
  await store.getState().begin('learner-2', input('sub-2'));
  assert.equal(store.getState().restore('learner-1')?.submissionId, 'sub-1');
  assert.ok(storage.values.has(worksheetKeyFor('learner-1')));
  assert.ok(storage.values.has(worksheetKeyFor('learner-2')));
});

test('an empty device discovers a guardian-assigned worksheet and the server cursor', async () => {
  const { server } = setup();
  server.net.actorId = 'guardian-1';
  await server.client.createSubmission({ ...input('ward-sheet'), forLearnerAuthId: 'learner-1' });
  server.net.actorId = 'learner-1';
  server.moveElsewhere('ward-sheet', 1);

  const fresh = createStore(worksheetStateCreator({ storage: fakeStorage(), client: server.client }));
  const view = await fresh.getState().hydrate('learner-1');
  assert.equal(view?.submissionId, 'ward-sheet');
  assert.equal(view?.currentIndex, 1);
  assert.equal(fresh.getState().status, 'confirmed');
  assert.equal(server.net.listCalls, 1);
});

test('a cache miss chooses the open worksheet and leaves finished work alone', async () => {
  const { server } = setup();
  await server.client.createSubmission(input('active-sheet'));
  await server.client.createSubmission(input('finished-sheet'));
  const finished = server.rows.get('finished-sheet')!;
  server.rows.set(finished.submissionId, { ...finished, status: 'complete' });
  const fresh = createStore(worksheetStateCreator({ storage: fakeStorage(), client: server.client }));
  assert.equal((await fresh.getState().hydrate('learner-1'))?.submissionId, 'active-sheet');

  server.rows.set('active-sheet', { ...server.rows.get('active-sheet')!, status: 'complete' });
  const other = createStore(worksheetStateCreator({ storage: fakeStorage(), client: server.client }));
  assert.equal(await other.getState().hydrate('learner-1'), null);
  assert.equal(other.getState().status, 'idle');
});

/** A guardian upload with every problem marked done: the server stores it complete, untutored. */
function markAllDone(server: ReturnType<typeof fakeServer>, id: string, createdAt: string) {
  const row = server.rows.get(id)!;
  server.rows.set(id, {
    ...row,
    status: 'complete',
    createdAt,
    questions: row.questions.map((q) => ({ ...q, priorWork: 'complete' as const })),
  });
}

test('an empty device discovers a guardian’s all-marked upload instead of falling back to practice', async () => {
  const { server } = setup();
  server.net.actorId = 'guardian-1';
  await server.client.createSubmission({ ...input('all-marked'), forLearnerAuthId: 'learner-1' });
  server.net.actorId = 'learner-1';
  markAllDone(server, 'all-marked', '2026-10-16T12:00:00.000Z');

  const fresh = createStore(worksheetStateCreator({ storage: fakeStorage(), client: server.client }));
  const view = await fresh.getState().hydrate('learner-1');
  assert.equal(view?.submissionId, 'all-marked');
  assert.equal(view?.status, 'complete');
  assert.ok(view?.questions.every((q) => q.priorWork === 'complete'));
  assert.equal(fresh.getState().status, 'confirmed');
});

test('open work keeps precedence over a newer all-marked upload, and old all-marked sheets stay history', async () => {
  const { server } = setup();
  await server.client.createSubmission(input('open-sheet'));
  await server.client.createSubmission(input('all-marked'));
  markAllDone(server, 'all-marked', '2026-10-16T12:00:00.000Z');
  const first = createStore(worksheetStateCreator({ storage: fakeStorage(), client: server.client }));
  assert.equal((await first.getState().hydrate('learner-1'))?.submissionId, 'open-sheet');

  // The open sheet is finished normally afterwards and a newer one finished too:
  // the older all-marked sheet is no longer what was just assigned.
  server.rows.set('open-sheet', { ...server.rows.get('open-sheet')!, status: 'complete', createdAt: '2026-10-17T12:00:00.000Z' });
  const second = createStore(worksheetStateCreator({ storage: fakeStorage(), client: server.client }));
  assert.equal(await second.getState().hydrate('learner-1'), null);
  assert.equal(second.getState().status, 'idle');

  // A tutored sheet is never "all-marked on arrival", even if every mark is prior work.
  server.rows.delete('open-sheet');
  server.rows.set('all-marked', { ...server.rows.get('all-marked')!, tutorSessionId: 'session-1' });
  const third = createStore(worksheetStateCreator({ storage: fakeStorage(), client: server.client }));
  assert.equal(await third.getState().hydrate('learner-1'), null);
});

test('a cached finished sheet gives way to a newer assignment on the next hydrate', async () => {
  const { server } = setup();
  server.net.actorId = 'guardian-1';
  await server.client.createSubmission({ ...input('all-marked'), forLearnerAuthId: 'learner-1' });
  markAllDone(server, 'all-marked', '2026-10-16T12:00:00.000Z');
  server.net.actorId = 'learner-1';
  const storage = fakeStorage();
  const device = createStore(worksheetStateCreator({ storage, client: server.client }));
  assert.equal((await device.getState().hydrate('learner-1'))?.submissionId, 'all-marked');

  // Nothing newer: the finished sheet stays, and is refreshed as before.
  assert.equal((await device.getState().hydrate('learner-1'))?.submissionId, 'all-marked');

  // An older sheet still open is history; it never replaces the finished one.
  await server.client.createSubmission(input('older-open'));
  server.rows.set('older-open', { ...server.rows.get('older-open')!, status: 'in-progress', createdAt: '2026-10-14T12:00:00.000Z' });
  assert.equal((await device.getState().hydrate('learner-1'))?.submissionId, 'all-marked');

  server.net.actorId = 'guardian-1';
  await server.client.createSubmission({ ...input('next-sheet'), forLearnerAuthId: 'learner-1' });
  server.rows.set('next-sheet', { ...server.rows.get('next-sheet')!, createdAt: '2026-10-17T12:00:00.000Z' });
  server.net.actorId = 'learner-1';
  const view = await device.getState().hydrate('learner-1');
  assert.equal(view?.submissionId, 'next-sheet');
  assert.equal(view?.status, 'ready');
  assert.equal(device.getState().status, 'confirmed');

  // Open work is never displaced by rediscovery.
  assert.equal((await device.getState().hydrate('learner-1'))?.submissionId, 'next-sheet');
});

test('a finished sheet’s last question is a leftover once the worksheet rolls over', async () => {
  const { server } = setup();
  await server.client.createSubmission(input('old-sheet'));
  await server.client.createSubmission({ ...input('new-sheet'), questions: input().questions.map((q) => ({ ...q, text: '15 ÷ 3 =' })) });
  const old = server.rows.get('old-sheet')!;
  const next = server.rows.get('new-sheet')!;
  const lastOld = old.questions[2]!;
  const evidence = { questionId: lastOld.questionId, revision: lastOld.currentRevision };
  const prompt = currentPrompt({ ...old, currentIndex: 2, currentQuestionId: lastOld.questionId })!;

  assert.equal(isLeftoverWorksheetProblem(next, prompt, true, evidence), true);
  // Still the shown sheet's own question: never a leftover.
  assert.equal(isLeftoverWorksheetProblem(old, prompt, true, evidence), false);
  // A served practice problem, or one with no worksheet evidence, is not the worksheet's to replace.
  assert.equal(isLeftoverWorksheetProblem(next, prompt, false, evidence), false);
  assert.equal(isLeftoverWorksheetProblem(next, prompt, true, null), false);
  assert.equal(isLeftoverWorksheetProblem(next, null, true, evidence), false);
});

test('offline discovery waits without inventing a worksheet or losing another learner’s cache', async () => {
  const { server, storage, store } = setup();
  server.net.online = false;
  assert.equal(await store.getState().hydrate('learner-1'), null);
  assert.equal(store.getState().status, 'pending');
  assert.equal(storage.getString(worksheetKeyFor('learner-1')), undefined);
  assert.equal(server.net.listCalls, 0);
});

test('a late hydrate cannot replace a sibling’s selected worksheet', async () => {
  const { server, storage } = setup();
  const view = await server.client.createSubmission(input('remote-sheet'));
  let finish: (result: HomeworkSubmissionView) => void = () => {};
  const pending = new Promise<HomeworkSubmissionView>((resolve) => { finish = resolve; });
  let requested = 0;
  const client = { ...server.client, getSubmission: async () => { requested += 1; return pending; } };
  const fresh = createStore(worksheetStateCreator({ storage, client }));
  const loading = fresh.getState().hydrate('learner-1');
  for (let attempt = 0; attempt < 5 && requested === 0; attempt += 1) await Promise.resolve();
  assert.equal(requested, 1);
  fresh.getState().restore('learner-2');
  finish(view);
  await loading;
  assert.equal(fresh.getState().ownerId, 'learner-2');
  assert.equal(fresh.getState().current, null);
  assert.equal(storage.getString(worksheetKeyFor('learner-1')), undefined);
});

test('clearing an owner while discovery is in flight cannot resurrect their worksheet', async () => {
  const { server, storage } = setup();
  const view = await server.client.createSubmission(input('erased-sheet'));
  let finish: (result: HomeworkSubmissionView) => void = () => {};
  const pending = new Promise<HomeworkSubmissionView>((resolve) => { finish = resolve; });
  let requested = 0;
  const client = { ...server.client, getSubmission: async () => { requested += 1; return pending; } };
  const fresh = createStore(worksheetStateCreator({ storage, client }));
  const loading = fresh.getState().hydrate('learner-1');
  for (let attempt = 0; attempt < 5 && requested === 0; attempt += 1) await Promise.resolve();
  assert.equal(requested, 1);
  fresh.getState().clear('learner-1');
  finish(view);
  await loading;
  assert.equal(fresh.getState().status, 'idle');
  assert.equal(fresh.getState().current, null);
  assert.equal(storage.getString(worksheetKeyFor('learner-1')), undefined);
});

test('a v1 worksheet migrates once, keeps its place, and the v1 key is removed', async () => {
  const { store, storage, server } = setup();
  writeWorksheet(storage, {
    schemaVersion: 1,
    id: 'legacy-1',
    ownerId: 'learner-1',
    subject: 'Math',
    title: 'Old',
    instructions: '',
    createdAt: '2026-10-14T12:00:00.000Z',
    questions: [
      { id: 'question-1', text: '1+1=', sourcePage: 1, sourceNumber: 1 },
      { id: 'question-2', text: '2+2=', sourcePage: 1, sourceNumber: 2 },
    ],
    currentIndex: 1,
  });
  server.net.online = false;
  assert.equal(await store.getState().hydrate('learner-1'), null);
  assert.ok(storage.getString('capture-worksheet-v1:learner-1'), 'v1 kept while offline');

  server.net.online = true;
  const view = await store.getState().hydrate('learner-1');
  assert.equal(view?.submissionId, 'legacy-1');
  assert.equal(view?.currentIndex, 1);
  assert.equal(server.rows.get('legacy-1')?.questions[0]?.outcome, 'unresolved');
  assert.equal(storage.getString('capture-worksheet-v1:learner-1'), undefined);
  assert.equal(currentPrompt(view!), 'Subject: Math\nQuestion 2:\n2+2=');
});

test('a photographed page never records solved-independently without a verdict', () => {
  assert.equal(outcomeForAdvance({ learnerTurns: 0, hintDepth: 0, evaluatedCorrect: false }), 'skipped');
  assert.equal(outcomeForAdvance({ learnerTurns: 2, hintDepth: 0, evaluatedCorrect: false }), 'attempted');
  assert.equal(outcomeForAdvance({ learnerTurns: 1, hintDepth: 2, evaluatedCorrect: false }), 'supported-with-hints');
  assert.equal(outcomeForAdvance({ learnerTurns: 1, hintDepth: 1, evaluatedCorrect: true }), 'supported-with-hints');
  assert.equal(outcomeForAdvance({ learnerTurns: 1, hintDepth: 0, evaluatedCorrect: true }), 'solved-independently');
});

test('identical question wording still requires the server question identity', async () => {
  const { store } = setup();
  const view = await store.getState().begin('learner-1', input('repeated-sheet'));
  const questions = view.questions.map((question) => ({ ...question, sourceNumber: 1, text: '2 + 2 =' }));
  const repeated = { ...view, questions, currentIndex: 1, currentQuestionId: questions[1]!.questionId };
  const prompt = currentPrompt(repeated)!;
  assert.equal(prompt, currentPrompt({ ...repeated, currentIndex: 0 }));
  assert.equal(isCurrentWorksheetQuestion(repeated, prompt, {
    questionId: questions[0]!.questionId, revision: questions[0]!.currentRevision,
  }), false);
  assert.equal(isCurrentWorksheetQuestion(repeated, prompt, {
    questionId: questions[1]!.questionId, revision: questions[1]!.currentRevision,
  }), true);
  assert.equal(isCurrentWorksheetQuestion(repeated, prompt, null), false);
  assert.equal(isCurrentWorksheetQuestion(repeated, prompt, {
    questionId: questions[1]!.questionId, revision: 'superseded',
  }), false);
});
