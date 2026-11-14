// Child of homework-prior-work.test.mjs, connected only to that test's private
// socket. Loads the real repository and Payload adapter; only unrelated auth,
// evidence and report imports are substituted. Never loads repository .env.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { buildConfig, getPayload } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { sql } from '@payloadcms/db-postgres/drizzle';
import { HomeworkQuestions } from '../../collections/HomeworkQuestions.ts';
import { HomeworkSubmissions } from '../../collections/HomeworkSubmissions.ts';
import { HomeworkPracticeSets } from '../../collections/HomeworkPracticeSets.ts';
import { canRevisePriorWork, homeworkQuestionCounts, nextUndoneIndex } from '../../../../app/features/homework/homework-prior-work.ts';

const [socket, portText] = process.argv.slice(2);
assert.ok(socket?.includes('/moyo-homework-') && socket.endsWith('/socket'), 'only the parent scratch socket is allowed');
assert.match(portText ?? '', /^\d{5}$/);
const connection = { host: socket, port: Number(portText), user: 'moyo_scratch', database: 'postgres' };
const config = await buildConfig({
  secret: 'moyo-isolated-homework-repository-test-only',
  telemetry: false,
  admin: { disable: true },
  typescript: { autoGenerate: false },
  db: postgresAdapter({ pool: connection, schemaName: 'payload', push: false }),
  collections: [HomeworkSubmissions, HomeworkQuestions, HomeworkPracticeSets],
});
const payload = await getPayload({ config });
const observer = new pg.Client(connection);
const blocker = new pg.Client(connection);
await observer.connect();
await blocker.connect();

const repositoryUrl = new URL('../../../../../apps/web/lib/homework.repository.ts', import.meta.url);
const source = stripTypeScriptTypes(readFileSync(repositoryUrl, 'utf8'));
const unexpected = () => { throw new Error('a non-homework integration was called by this repository test'); };
const imports = {
  'server-only': {},
  payload: { getPayload: async () => payload },
  '@payload-config': { default: config },
  '@payloadcms/db-postgres/drizzle': { sql },
  '@acme/app/server': { canRevisePriorWork, homeworkQuestionCounts, nextUndoneIndex },
  './auth': { auth: {} },
  './edu.repository': { issueEduQuestion: unexpected },
  './student-model.repository': { loadGradeBand: unexpected },
  './summary.repository': { loadGuardianWards: unexpected },
};
const module = new SourceTextModule(source, { identifier: repositoryUrl.href });
await module.link((specifier) => {
  const exports = imports[specifier];
  assert.ok(exports, `unexpected repository dependency ${specifier}`);
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  });
});
await module.evaluate();
const repository = module.namespace;
const learner = 'repository-scratch-learner';
const now = '2026-11-14T12:00:00.000Z';
const mark = (priorWork) => ({ priorWork, source: 'guardian', createdAt: now });

async function sheet(id, priorWork = ['none', 'none', 'none']) {
  const created = await repository.createSubmission({ learnerId: learner, isLearner: true }, {
    submissionId: id,
    learnerAuthId: learner,
    createdByAuthId: 'repository-scratch-guardian',
    subject: 'Math', title: 'Synthetic worksheet', instructions: '', localDate: '2026-11-14',
    questions: priorWork.map((value, index) => ({
      questionId: `${id}-q${index}`, orderIndex: index, sourcePage: 1, sourceNumber: index + 1,
      currentRevision: `${id}-r${index}`, text: `${index} + 1`, revisions: [], crop: null,
      priorWork: value, priorWorkRevisions: value === 'none' ? [] : [mark(value)],
    })),
  });
  assert.equal(created.kind, 'created');
  return created.submission;
}

async function blocked(count) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const { rows } = await observer.query(`select count(*)::int as n from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock' and state = 'active'`);
    if (rows[0].n >= count) return;
    await delay(20);
  }
  assert.fail(`expected ${count} repository transaction(s) to wait for the submission row lock`);
}

// Hold the row before launching either operation, then observe each real
// database transaction waiting. This makes both competing orders deterministic.
async function race(submissionId, first, second) {
  const pending = [];
  await blocker.query('BEGIN');
  try {
    await blocker.query('select 1 from payload.homework_submissions where submission_id = $1 for update', [submissionId]);
    pending.push(first());
    void pending[0].catch(() => {}); // Observed below; do not leak a rejection while checking locks.
    await blocked(1);
    pending.push(second());
    void pending[1].catch(() => {});
    await blocked(2);
    await blocker.query('COMMIT');
    return await Promise.all(pending);
  } finally {
    await blocker.query('ROLLBACK');
    await Promise.allSettled(pending);
  }
}

try {
  const markedFirst = await sheet('repository-mark-first');
  const [revision, startedAfterMark] = await race(markedFirst.submissionId,
    () => repository.revisePriorWork(learner, markedFirst.submissionId, markedFirst.questions[0].questionId, mark('complete')),
    () => repository.startSubmission(learner, markedFirst.submissionId, 'mark-first-session'));
  assert.equal(revision.kind, 'revised');
  assert.equal(startedAfterMark.currentIndex, 1);
  assert.equal(startedAfterMark.questions[0].priorWork, 'complete');
  assert.equal(startedAfterMark.questions[0].outcome, 'unattempted');
  console.log('PASS: guardian mark wins before start; start selects first unfinished question');

  const startedFirst = await sheet('repository-start-first');
  const [started, refused] = await race(startedFirst.submissionId,
    () => repository.startSubmission(learner, startedFirst.submissionId, 'start-first-session'),
    () => repository.revisePriorWork(learner, startedFirst.submissionId, startedFirst.questions[0].questionId, mark('complete')));
  assert.equal(started.currentIndex, 0);
  assert.equal(refused.kind, 'locked');
  const unchanged = await repository.loadSubmissionForLearner(learner, startedFirst.submissionId);
  assert.equal(unchanged.questions[0].priorWork, 'none');
  assert.deepEqual(unchanged.questions[0].priorWorkRevisions, []);
  console.log('PASS: start wins before guardian mark; late mark writes nothing');

  const simultaneous = await sheet('repository-two-marks');
  const [firstMark, secondMark] = await race(simultaneous.submissionId,
    () => repository.revisePriorWork(learner, simultaneous.submissionId, simultaneous.questions[0].questionId, mark('complete')),
    () => repository.revisePriorWork(learner, simultaneous.submissionId, simultaneous.questions[0].questionId, mark('none')));
  assert.equal(firstMark.kind, 'revised');
  assert.equal(secondMark.kind, 'revised');
  assert.equal(secondMark.question.priorWork, 'none');
  assert.deepEqual(secondMark.question.priorWorkRevisions.map((entry) => entry.priorWork), ['complete', 'none']);
  console.log('PASS: simultaneous guardian marks preserve both history entries');

  const advancing = await sheet('repository-two-advances', ['none', 'complete', 'none']);
  await repository.startSubmission(learner, advancing.submissionId, 'advance-session');
  const input = { fromQuestionId: advancing.questions[0].questionId, expectedIndex: 0,
    outcome: 'attempted', attempts: 1, hintsUsed: 0, misconceptionTags: [] };
  const [advanced, stale] = await race(advancing.submissionId,
    () => repository.advanceSubmission(learner, advancing.submissionId, input, now),
    () => repository.advanceSubmission(learner, advancing.submissionId, { ...input, attempts: 9 }, now));
  assert.equal(advanced.kind, 'advanced');
  assert.equal(advanced.result.currentIndex, 2);
  assert.equal(stale.kind, 'stale');
  assert.equal(stale.current.currentIndex, 2);
  const resumed = await repository.startSubmission(learner, advancing.submissionId, 'replacement-session');
  assert.equal(resumed.currentIndex, 2);
  assert.equal(resumed.tutorSessionId, 'replacement-session');
  assert.equal(resumed.questions[0].attempts, 1);
  assert.equal(resumed.questions[1].outcome, 'unattempted');
  console.log('PASS: concurrent advances skip marked work once; stale writer cannot overwrite; resume preserves cursor');

  const allDone = await sheet('repository-all-done', ['complete', 'complete']);
  assert.equal(allDone.status, 'complete');
  const nothingToStart = await repository.startSubmission(learner, allDone.submissionId, 'unused-session');
  assert.equal(nothingToStart.status, 'complete');
  assert.equal(nothingToStart.tutorSessionId, null);
  await repository.revisePriorWork(learner, allDone.submissionId, allDone.questions[1].questionId, mark('none'));
  const reopened = await repository.startSubmission(learner, allDone.submissionId, 'reopened-session');
  assert.equal(reopened.status, 'in-progress');
  assert.equal(reopened.currentIndex, 1);
  assert.equal(await repository.startSubmission('other-learner', allDone.submissionId, 'foreign-session'), null);
  assert.equal((await repository.revisePriorWork('other-learner', allDone.submissionId, allDone.questions[1].questionId, mark('complete'))).kind, 'not-found');
  console.log('PASS: all-marked sheet starts no session, can reopen, and remains learner-scoped');
} finally {
  await blocker.end();
  await observer.end();
  await payload.destroy();
}
