// ADR-125's denials, held as tests over fake ports built on Maps.
//
// Four claims, each a way a family's data could leak or a child could be
// graded on a photograph:
//
//  1. A REVOKED GUARDIANSHIP IS NO GUARDIANSHIP. `loadGuardianWards` returns
//     ACTIVE rows only; once a ward drops out of it, every path refuses.
//  2. A LEARNER CANNOT READ A SIBLING. Two children in one family are two
//     learners; neither appears in the other's ward list.
//  3. A STALE CURSOR WRITES NOTHING. When the repository answers `stale`, the
//     service returns it untouched and no question row changes.
//  4. A REVISE ISSUES UNREADY EVIDENCE. The new revision is bound in
//     `edu.questions` with `evaluationReady: false`, to the CHILD.
//
// `.server-test.ts` because the service opens with `import 'server-only'`.
// SOT: docs/decisions/adr-125-homework-submissions-persistence.md · docs/work/pr-100/contract.md §Routes
// SOT-KEYWORDS: homework service test ward revoked forbidden sibling stale cursor evaluation ready false evidence
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProtectedCtx } from '../../core/protected-operation.ts';
import {
  advanceSubmissionFor,
  createSubmissionFor,
  listSubmissionsFor,
  loadSubmissionFor,
  reviseQuestionFor,
  startSubmissionFor,
  type AdvanceOutcome,
  type HomeworkEvidence,
  type HomeworkPorts,
  type NewSubmissionRow,
} from './homework.service.ts';
import type { HomeworkQuestionView, HomeworkSubmissionView } from './homework.types.ts';

const NOW = new Date('2026-10-15T15:00:00.000Z');
const guardian: ProtectedCtx = { learnerId: 'guardian_1', isLearner: false };
const ada: ProtectedCtx = { learnerId: 'ada_1', isLearner: true };
const ben: ProtectedCtx = { learnerId: 'ben_1', isLearner: true };

const body = (submissionId: string, forLearnerAuthId?: string) => ({
  submissionId,
  subject: 'Math',
  title: 'Fractions sheet',
  instructions: '',
  localDate: '2026-10-15',
  questions: [
    { clientId: 'c1', sourcePage: 1, sourceNumber: 1, text: '1/2 + 1/4', confidence: 0.92, crop: null },
    { clientId: 'c2', sourcePage: 1, sourceNumber: 2, text: '3/4 - 1/8', confidence: null, crop: null },
  ],
  ...(forLearnerAuthId ? { forLearnerAuthId } : {}),
});

function viewFrom(row: NewSubmissionRow): HomeworkSubmissionView {
  const questions: HomeworkQuestionView[] = row.questions.map((q) => ({
    questionId: q.questionId,
    orderIndex: q.orderIndex,
    sourcePage: q.sourcePage,
    sourceNumber: q.sourceNumber,
    currentRevision: q.currentRevision,
    text: q.text,
    revisions: q.revisions,
    crop: q.crop,
    priorWork: q.priorWork,
    priorWorkConfidence: null,
    priorWorkSource: q.priorWorkRevisions.length ? 'guardian' : null,
    priorWorkRevisions: q.priorWorkRevisions,
    outcome: 'unattempted',
    attempts: 0,
    hintsUsed: 0,
    misconceptionTags: [],
    startedAt: null,
    completedAt: null,
  }));
  return {
    submissionId: row.submissionId,
    learnerAuthId: row.learnerAuthId,
    createdByAuthId: row.createdByAuthId,
    subject: row.subject,
    title: row.title,
    instructions: row.instructions,
    localDate: row.localDate,
    status: 'ready',
    pipelineStatus: 'extracted',
    pipelineError: null,
    currentIndex: 0,
    currentQuestionId: questions[0]!.questionId,
    tutorSessionId: null,
    questions,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

/** A store of submissions keyed by id, a ward map, and a log of issued evidence. */
function fakePorts(wards: Map<string, string[]>) {
  const rows = new Map<string, HomeworkSubmissionView>();
  const issued: { learnerAuthId: string; evidence: HomeworkEvidence }[] = [];
  const writes: string[] = [];
  let advanceAnswer: AdvanceOutcome | null = null;

  const ports: HomeworkPorts = {
    loadGuardianWards: async (ctx) => wards.get(ctx.learnerId) ?? [],
    loadSubmissionOwner: async (id) => rows.get(id)?.learnerAuthId ?? null,
    createSubmission: async (_ctx, row) => {
      const existing = rows.get(row.submissionId);
      if (existing) {
        return existing.learnerAuthId === row.learnerAuthId
          ? { kind: 'existing', submission: existing }
          : { kind: 'conflict' };
      }
      const view = viewFrom(row);
      rows.set(row.submissionId, view);
      return { kind: 'created', submission: view };
    },
    loadSubmission: async (learner, id) => {
      const row = rows.get(id);
      return row && row.learnerAuthId === learner ? row : null;
    },
    listSubmissions: async (learner) =>
      [...rows.values()]
        .filter((row) => row.learnerAuthId === learner)
        .map((row) => ({
          submissionId: row.submissionId,
          learnerAuthId: row.learnerAuthId,
          subject: row.subject,
          title: row.title,
          localDate: row.localDate,
          status: row.status,
          questionCount: row.questions.length,
          currentIndex: row.currentIndex,
          outcomes: {
            unattempted: row.questions.length,
            skipped: 0,
            attempted: 0,
            'supported-with-hints': 0,
            'solved-independently': 0,
            unresolved: 0,
          },
          tutorSessionId: null,
          createdAt: row.createdAt,
        })),
    reviseQuestion: async (learner, id, questionId, revision) => {
      const row = rows.get(id);
      const question = row?.learnerAuthId === learner ? row.questions.find((q) => q.questionId === questionId) : undefined;
      if (!question) return null;
      writes.push(`revise:${questionId}`);
      return { ...question, currentRevision: revision.revision, text: revision.text, revisions: [...question.revisions, revision] };
    },
    revisePriorWork: async (learner, id, questionId, revision) => {
      const row = rows.get(id);
      const question = row?.learnerAuthId === learner ? row.questions.find((q) => q.questionId === questionId) : undefined;
      if (!row || !question) return { kind: 'not-found' };
      if (row.tutorSessionId || row.status === 'in-progress') return { kind: 'locked' };
      const updated = { ...question, priorWork: revision.priorWork, priorWorkSource: 'guardian' as const,
        priorWorkConfidence: null, priorWorkRevisions: [...(question.priorWorkRevisions ?? []), revision] };
      rows.set(id, { ...row, questions: row.questions.map((q) => q.questionId === questionId ? updated : q) });
      writes.push(`prior-work:${questionId}`);
      return { kind: 'revised', question: updated };
    },
    startSubmission: async () => null,
    advanceSubmission: async () => {
      if (!advanceAnswer) throw new Error('no advance answer set');
      if (advanceAnswer.kind === 'advanced') writes.push('advance');
      return advanceAnswer;
    },
    issueEvidence: async (_ctx, learnerAuthId, evidence) => {
      issued.push({ learnerAuthId, evidence });
    },
  };
  return {
    ports,
    rows,
    issued,
    writes,
    answerAdvance: (answer: AdvanceOutcome) => {
      advanceAnswer = answer;
    },
  };
}

describe('homework ward rule', () => {
  it('lets a guardian upload for an active ward, and refuses once the guardianship is revoked', async () => {
    const wards = new Map([['guardian_1', ['ada_1']]]);
    const fake = fakePorts(wards);
    const created = await createSubmissionFor(guardian, body('sub-ada-0001', 'ada_1'), fake.ports, NOW);
    assert.equal(created.submission.learnerAuthId, 'ada_1');
    assert.equal(created.submission.createdByAuthId, 'guardian_1');

    wards.set('guardian_1', []); // revoked: the ACTIVE list no longer names Ada
    await assert.rejects(loadSubmissionFor(guardian, 'sub-ada-0001', fake.ports), /Forbidden/);
    await assert.rejects(listSubmissionsFor(guardian, 'ada_1', fake.ports), /Forbidden/);
    await assert.rejects(
      createSubmissionFor(guardian, body('sub-ada-0002', 'ada_1'), fake.ports, NOW),
      /Forbidden/,
    );
    assert.equal(fake.rows.has('sub-ada-0002'), false);
  });

  it('refuses a learner reading or revising a sibling submission', async () => {
    const fake = fakePorts(new Map());
    const created = await createSubmissionFor(ada, body('sub-ada-0003'), fake.ports, NOW);
    const questionId = created.submission.questions[0]!.questionId;

    await assert.rejects(loadSubmissionFor(ben, 'sub-ada-0003', fake.ports), /Forbidden/);
    await assert.rejects(listSubmissionsFor(ben, 'ada_1', fake.ports), /Forbidden/);
    await assert.rejects(
      reviseQuestionFor(ben, 'sub-ada-0003', questionId, { text: '1/2 + 1/3', author: 'learner' }, fake.ports, NOW),
      /Forbidden/,
    );
    assert.deepEqual(fake.writes, []);
  });

  it('answers a retry with the first row and a foreign id with a conflict', async () => {
    const fake = fakePorts(new Map());
    const first = await createSubmissionFor(ada, body('sub-ada-0004'), fake.ports, NOW);
    const retry = await createSubmissionFor(ada, body('sub-ada-0004'), fake.ports, NOW);
    assert.equal(retry.kind, 'existing');
    assert.equal(retry.submission.currentQuestionId, first.submission.currentQuestionId);
    // Evidence was issued once, for the first attempt only.
    assert.equal(fake.issued.length, 2);
    await assert.rejects(createSubmissionFor(ben, body('sub-ada-0004'), fake.ports, NOW), /submission-conflict/);
  });
});

describe('homework cursor', () => {
  it('returns stale with the current row and writes nothing', async () => {
    const fake = fakePorts(new Map());
    const created = await createSubmissionFor(ada, body('sub-ada-0005'), fake.ports, NOW);
    const current = { currentIndex: 1, currentQuestionId: created.submission.questions[1]!.questionId, status: 'in-progress' as const };
    fake.answerAdvance({ kind: 'stale', current });

    const outcome = await advanceSubmissionFor(
      ada,
      'sub-ada-0005',
      {
        fromQuestionId: created.submission.questions[0]!.questionId,
        expectedIndex: 0,
        outcome: 'attempted',
        attempts: 1,
        hintsUsed: 0,
        misconceptionTags: [],
      },
      fake.ports,
      NOW,
    );
    assert.deepEqual(outcome, { kind: 'stale', current });
    assert.deepEqual(fake.writes, []);
  });

  it('rejects an unattempted outcome before touching the store', async () => {
    const fake = fakePorts(new Map());
    await createSubmissionFor(ada, body('sub-ada-0006'), fake.ports, NOW);
    await assert.rejects(
      advanceSubmissionFor(ada, 'sub-ada-0006', { fromQuestionId: 'x', expectedIndex: 0, outcome: 'unattempted' }, fake.ports, NOW),
      /outcome/,
    );
  });
});

describe('homework evidence', () => {
  it('issues the revised revision with evaluationReady false, bound to the child', async () => {
    const wards = new Map([['guardian_1', ['ada_1']]]);
    const fake = fakePorts(wards);
    const created = await createSubmissionFor(ada, body('sub-ada-0007'), fake.ports, NOW);
    for (const entry of fake.issued) assert.equal(entry.evidence.evaluationReady, false);

    const questionId = created.submission.questions[0]!.questionId;
    const revised = await reviseQuestionFor(
      guardian,
      'sub-ada-0007',
      questionId,
      { text: '1/2 + 1/3', author: 'guardian' },
      fake.ports,
      NOW,
    );
    const last = fake.issued.at(-1)!;
    assert.equal(last.learnerAuthId, 'ada_1');
    assert.equal(last.evidence.questionId, questionId);
    assert.equal(last.evidence.revision, revised.currentRevision);
    assert.equal(last.evidence.evaluationReady, false);
    assert.notEqual(revised.currentRevision, created.submission.questions[0]!.currentRevision);
  });
});

describe('guardian prior-work marks', () => {
  it('records a guardian mark separately from transcription and issued evidence', async () => {
    const fake = fakePorts(new Map([['guardian_1', ['ada_1']]]));
    const created = await createSubmissionFor(ada, body('sub-marks-001'), fake.ports, NOW);
    const original = created.submission.questions[0]!;
    const revised = await reviseQuestionFor(guardian, 'sub-marks-001', original.questionId,
      { priorWork: 'complete', author: 'guardian' }, fake.ports, NOW);
    assert.equal(revised.priorWork, 'complete');
    assert.equal(revised.currentRevision, original.currentRevision);
    assert.deepEqual(revised.revisions, original.revisions);
    assert.equal(revised.outcome, 'unattempted');
    assert.equal(revised.priorWorkConfidence, null);
    assert.deepEqual(revised.priorWorkRevisions, [{ priorWork: 'complete', source: 'guardian', createdAt: NOW.toISOString() }]);
    assert.equal(fake.issued.length, 2, 'marking must not issue transcription evidence');
  });

  it('refuses a learner claiming guardian authorship and another family', async () => {
    const fake = fakePorts(new Map());
    const created = await createSubmissionFor(ada, body('sub-marks-002'), fake.ports, NOW);
    const question = created.submission.questions[0]!;
    const mark = { priorWork: 'complete', author: 'guardian' };
    await assert.rejects(reviseQuestionFor(ada, 'sub-marks-002', question.questionId, mark, fake.ports, NOW), /Forbidden/);
    await assert.rejects(reviseQuestionFor(guardian, 'sub-marks-002', question.questionId, mark, fake.ports, NOW), /Forbidden/);
    await assert.rejects(createSubmissionFor(ada, {
      ...body('sub-marks-003'), questions: [{ ...body('unused').questions[0], priorWork: 'complete' }],
    }, fake.ports, NOW), /Forbidden/);
    assert.deepEqual(fake.writes, []);
  });

  it('accepts a guardian initial mark with server-owned source and attribution', async () => {
    const fake = fakePorts(new Map([['guardian_1', ['ada_1']]]));
    const created = await createSubmissionFor(guardian, {
      ...body('sub-marks-004', 'ada_1'), questions: [{ ...body('unused').questions[0], priorWork: 'complete', priorWorkSource: 'detected' }],
    }, fake.ports, NOW);
    const question = created.submission.questions[0]!;
    assert.equal(question.priorWork, 'complete');
    assert.equal(question.priorWorkSource, 'guardian');
    assert.equal(question.priorWorkRevisions?.[0]?.source, 'guardian');
  });

  it('returns the repository refusal when start won the revision race', async () => {
    const fake = fakePorts(new Map([['guardian_1', ['ada_1']]]));
    const created = await createSubmissionFor(ada, body('sub-marks-005'), fake.ports, NOW);
    fake.rows.set('sub-marks-005', { ...created.submission, status: 'in-progress', tutorSessionId: 'running-session' });
    await assert.rejects(reviseQuestionFor(guardian, 'sub-marks-005', created.submission.questions[0]!.questionId,
      { priorWork: 'complete', author: 'guardian' }, fake.ports, NOW), /before tutoring starts/);
    assert.deepEqual(fake.writes, []);
  });

  it('rejects invalid marks and combined transcription/mark edits', async () => {
    const fake = fakePorts(new Map([['guardian_1', ['ada_1']]]));
    const created = await createSubmissionFor(ada, body('sub-marks-006'), fake.ports, NOW);
    const questionId = created.submission.questions[0]!.questionId;
    await assert.rejects(reviseQuestionFor(guardian, 'sub-marks-006', questionId,
      { priorWork: 'correct', author: 'guardian' }, fake.ports, NOW), /priorWork/);
    await assert.rejects(reviseQuestionFor(guardian, 'sub-marks-006', questionId,
      { text: 'changed', priorWork: 'complete', author: 'guardian' }, fake.ports, NOW), /separately/);
    assert.deepEqual(fake.writes, []);
  });
});


describe('homework tutor-session resume', () => {
  it('passes the new session to the scoped writer and preserves its existing cursor', async () => {
    const fake = fakePorts(new Map());
    const created = await createSubmissionFor(ada, body('sub-resume-001'), fake.ports, NOW);
    const resumed: HomeworkSubmissionView = {
      ...created.submission, status: 'in-progress', currentIndex: 1,
      currentQuestionId: created.submission.questions[1]!.questionId, tutorSessionId: 'new-session',
    };
    const calls: string[][] = [];
    const ports: HomeworkPorts = { ...fake.ports, startSubmission: async (learner, submissionId, sessionId) => {
      calls.push([learner, submissionId, sessionId]);
      return resumed;
    } };
    const result = await startSubmissionFor(ada, 'sub-resume-001', { tutorSessionId: 'new-session' }, ports);
    assert.deepEqual(calls, [['ada_1', 'sub-resume-001', 'new-session']]);
    assert.equal(result.currentIndex, 1);
    assert.equal(result.currentQuestionId, created.submission.questions[1]!.questionId);
    assert.equal(result.tutorSessionId, 'new-session');
    await assert.rejects(startSubmissionFor(ben, 'sub-resume-001', { tutorSessionId: 'foreign' }, ports), /Forbidden/);
    assert.equal(calls.length, 1, 'a foreign learner must never reach the writer');
  });
});
