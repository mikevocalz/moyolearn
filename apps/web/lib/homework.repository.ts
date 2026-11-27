import 'server-only';
// The homework store (ADR-125), as a repository: the only code that reads or
// writes `homeworkSubmissions`, `homeworkQuestions` and `homeworkPracticeSets`.
//
// SCOPED BY THE LEARNER THE SERVICE PROVED. `homework.service.ts` resolves a
// submission's owner with `loadSubmissionOwner`, applies the ward rule, and
// only then calls in here with that learner id; every query below carries it.
// Practice sets are scoped by `guardianAuthId = ctx.learnerId` instead, because
// the answer key is the guardian's and a ward's id is not enough to read it.
//
// ONE TRANSACTION FOR ADVANCE. The outgoing question's outcome and the cursor
// move commit together or not at all. Inside the transaction the submission
// row is locked `FOR UPDATE` before the cursor is compared: Payload's read and
// update are two statements, and under READ COMMITTED two devices could both
// read index 2 and both write 3. The lock makes the second one wait, read 3,
// and come back `stale`.
//
// The JSON columns come back as Payload's wide `json` union. This file is
// their only writer, so the narrowing trusts the shapes it wrote and answers
// anything else with the empty value, as summary.repository.ts does.
// SOT: docs/decisions/adr-125-homework-submissions-persistence.md · docs/work/pr-100/contract.md §Data §Routes · apps/web/lib/summary.repository.ts
// SOT-KEYWORDS: homework repository submission question revision cursor advance transaction lock stale practice set guardian scope evidence
import { getPayload } from 'payload';
import { sql } from '@payloadcms/db-postgres/drizzle';
import config from '@payload-config';
import type { HomeworkPracticeSet, HomeworkQuestion, HomeworkSubmission } from '@acme/payload';
import type {
  AdvanceHomeworkSubmission,
  AdvanceResult,
  ApprovePracticeSet,
  CreateHomeworkSubmission,
  CreatePracticeSet,
  HomeworkQuestionView,
  HomeworkSubmissionSummary,
  HomeworkSubmissionView,
  IssueHomeworkEvidence,
  ListHomeworkSubmissions,
  LoadHomeworkSubmission,
  LoadPracticeSet,
  LoadSubmissionOwner,
  LoadWardProfile,
  PracticeItem,
  PracticeSetView,
  PriorWorkRevision,
  ReviseHomeworkPriorWork,
  ProtectedCtx,
  QuestionCrop,
  QuestionRevision,
  ReviseHomeworkQuestion,
  StartHomeworkSubmission,
  SubmissionStatus,
} from '@acme/app/server';
import { auth } from './auth';
import { canRevisePriorWork, homeworkQuestionCounts, nextUndoneIndex } from '@acme/app/server';
import { issueEduQuestion } from './edu.repository';
import { loadGradeBand } from './student-model.repository';
import { loadGuardianWards } from './summary.repository';

type Payload = Awaited<ReturnType<typeof getPayload>>;

async function withPayload<T>(fn: (payload: Payload) => Promise<T>): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

/** A timeline is a feed, bounded like the report feed. */
const TIMELINE_LIMIT = 100;

// ── narrowing ───────────────────────────────────────────────────────────────

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const asStrings = (value: unknown): string[] =>
  asArray(value).filter((item): item is string => typeof item === 'string');

const asRevisions = (value: unknown): QuestionRevision[] =>
  asArray(value).filter(
    (item): item is QuestionRevision =>
      typeof item === 'object' && item !== null && typeof (item as QuestionRevision).revision === 'string',
  );

function asCrop(value: unknown, expiresAt: string | null | undefined): QuestionCrop | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const crop = value as Partial<QuestionCrop>;
  if (typeof crop.storageKey !== 'string' || typeof expiresAt !== 'string') return null;
  // Expired but not yet swept reads as gone: the sweep is daily, the promise is not.
  if (Date.parse(expiresAt) <= Date.now()) return null;
  return {
    storageKey: crop.storageKey,
    width: Number(crop.width) || 0,
    height: Number(crop.height) || 0,
    expiresAt,
  };
}

const asItems = (value: unknown): PracticeItem[] =>
  asArray(value).filter(
    (item): item is PracticeItem =>
      typeof item === 'object' && item !== null && typeof (item as PracticeItem).id === 'string',
  );

const asPriorWorkRevisions = (value: unknown): PriorWorkRevision[] =>
  asArray(value).filter((item): item is PriorWorkRevision =>
    typeof item === 'object' && item !== null &&
    (item as PriorWorkRevision).source === 'guardian' &&
    typeof (item as PriorWorkRevision).createdAt === 'string' &&
    ['none', 'partial', 'complete'].includes((item as PriorWorkRevision).priorWork),
  );

function questionView(row: HomeworkQuestion): HomeworkQuestionView {
  return {
    questionId: row.questionId,
    orderIndex: Number(row.orderIndex),
    sourcePage: Number(row.sourcePage),
    sourceNumber: row.sourceNumber ?? null,
    currentRevision: row.currentRevision,
    text: row.text,
    revisions: asRevisions(row.revisions),
    crop: asCrop(row.crop, row.cropExpiresAt),
    priorWork: row.priorWork ?? 'none',
    priorWorkConfidence: row.priorWorkConfidence ?? null,
    priorWorkSource: row.priorWorkSource ?? null,
    priorWorkRevisions: asPriorWorkRevisions(row.priorWorkRevisions),
    outcome: row.outcome,
    attempts: Number(row.attempts),
    hintsUsed: Number(row.hintsUsed),
    misconceptionTags: asStrings(row.misconceptionTags),
    startedAt: row.startedAt ?? null,
    completedAt: row.completedAt ?? null,
  };
}

function submissionView(row: HomeworkSubmission, questions: readonly HomeworkQuestion[]): HomeworkSubmissionView {
  return {
    submissionId: row.submissionId,
    learnerAuthId: row.learnerAuthId,
    createdByAuthId: row.createdByAuthId,
    subject: row.subject,
    title: row.title,
    instructions: row.instructions ?? '',
    localDate: row.localDate,
    status: row.status,
    pipelineStatus: row.pipelineStatus,
    pipelineError: row.pipelineError ?? null,
    currentIndex: Number(row.currentIndex),
    currentQuestionId: row.currentQuestionId,
    tutorSessionId: row.tutorSessionId ?? null,
    questions: questions.map(questionView),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function practiceView(row: HomeworkPracticeSet): PracticeSetView {
  return {
    practiceSetId: row.practiceSetId,
    submissionId: row.submissionId,
    learnerAuthId: row.learnerAuthId,
    status: row.status,
    seed: row.seed,
    targetedTags: asStrings(row.targetedTags),
    items: asItems(row.items),
    createdAt: row.createdAt,
  };
}

const advanceResult = (row: HomeworkSubmission): AdvanceResult => ({
  currentIndex: Number(row.currentIndex),
  currentQuestionId: row.currentQuestionId,
  status: row.status,
});

// ── reads ───────────────────────────────────────────────────────────────────

async function findSubmission(
  payload: Payload,
  learnerAuthId: string,
  submissionId: string,
  transactionID?: string | number,
): Promise<HomeworkSubmission | null> {
  const { docs } = await payload.find({
    collection: 'homeworkSubmissions',
    where: { submissionId: { equals: submissionId }, learnerAuthId: { equals: learnerAuthId } },
    limit: 1,
    depth: 0,
    ...(transactionID === undefined ? {} : { req: { transactionID } }),
  });
  return docs[0] ?? null;
}

async function findQuestions(
  payload: Payload,
  learnerAuthId: string,
  submissionId: string,
  transactionID?: string | number,
): Promise<HomeworkQuestion[]> {
  const { docs } = await payload.find({
    collection: 'homeworkQuestions',
    where: { submissionId: { equals: submissionId }, learnerAuthId: { equals: learnerAuthId } },
    sort: 'orderIndex',
    pagination: false,
    depth: 0,
    ...(transactionID === undefined ? {} : { req: { transactionID } }),
  });
  return docs;
}

/**
 * Who owns this id, and nothing else. Unscoped by design: it is the input to
 * the ward rule, and it returns an id, never a row.
 */
export const loadSubmissionOwner: LoadSubmissionOwner = async (submissionId) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'homeworkSubmissions',
      where: { submissionId: { equals: submissionId } },
      select: { learnerAuthId: true },
      limit: 1,
      depth: 0,
    });
    return docs[0]?.learnerAuthId ?? null;
  });

export const loadSubmissionForLearner: LoadHomeworkSubmission = async (learnerAuthId, submissionId) =>
  withPayload(async (payload) => {
    const row = await findSubmission(payload, learnerAuthId, submissionId);
    if (!row) return null;
    return submissionView(row, await findQuestions(payload, learnerAuthId, submissionId));
  });

/**
 * The caller-shaped read the practice-set service (B5) binds as its
 * `loadSubmission(ctx, submissionId)` port. It applies the ward rule itself
 * (own, or an ACTIVE ward) and answers null otherwise, so a mis-wired caller
 * gets nothing; the practice service then checks key-holding on top.
 */
export async function loadSubmission(
  ctx: ProtectedCtx,
  submissionId: string,
): Promise<HomeworkSubmissionView | null> {
  const owner = await loadSubmissionOwner(submissionId);
  if (owner === null) return null;
  if (owner !== ctx.learnerId && !(await loadGuardianWards(ctx)).includes(owner)) return null;
  return loadSubmissionForLearner(owner, submissionId);
}

/**
 * The submission a tutor session was started on, for the report job (B4).
 * Scoped by `ctx.learnerId`, which the job builds from the session row it
 * loaded, never from the queue payload.
 */
export async function loadSubmissionByTutorSession(
  ctx: ProtectedCtx,
  tutorSessionId: string,
): Promise<HomeworkSubmissionView | null> {
  return withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'homeworkSubmissions',
      where: { tutorSessionId: { equals: tutorSessionId }, learnerAuthId: { equals: ctx.learnerId } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
    });
    const row = docs[0];
    if (!row) return null;
    return submissionView(row, await findQuestions(payload, ctx.learnerId, row.submissionId));
  });
}

export const listSubmissions: ListHomeworkSubmissions = async (learnerAuthId) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'homeworkSubmissions',
      where: { learnerAuthId: { equals: learnerAuthId } },
      sort: '-createdAt',
      limit: TIMELINE_LIMIT,
      depth: 0,
    });
    if (docs.length === 0) return [];

    // One read for every question on the page, counted per submission.
    const questions = await payload.find({
      collection: 'homeworkQuestions',
      where: {
        learnerAuthId: { equals: learnerAuthId },
        submissionId: { in: docs.map((doc) => doc.submissionId) },
      },
      select: { submissionId: true, outcome: true, priorWork: true },
      pagination: false,
      depth: 0,
    });
    const grouped = new Map<string, typeof questions.docs>();
    for (const question of questions.docs) {
      const group = grouped.get(question.submissionId) ?? [];
      group.push(question);
      grouped.set(question.submissionId, group);
    }

    return docs.map((row): HomeworkSubmissionSummary => {
      const counts = homeworkQuestionCounts(grouped.get(row.submissionId) ?? []);
      return {
        submissionId: row.submissionId,
        learnerAuthId: row.learnerAuthId,
        subject: row.subject,
        title: row.title,
        localDate: row.localDate,
        status: row.status,
        questionCount: counts.questionCount,
        currentIndex: Number(row.currentIndex),
        alreadyDoneCount: counts.alreadyDoneCount,
        outcomes: counts.outcomes,
        tutorSessionId: row.tutorSessionId ?? null,
        createdAt: row.createdAt,
      };
    });
  });

// ── writes ──────────────────────────────────────────────────────────────────

/**
 * Idempotent on `submissionId`. The same learner's retry gets the existing
 * row; another learner's row under that id is a conflict, never a merge.
 * Submission and questions land in one transaction, so a retry never finds a
 * submission with half its questions.
 */
export const createSubmission: CreateHomeworkSubmission = async (_ctx, row) =>
  withPayload(async (payload) => {
    const owner = await loadSubmissionOwner(row.submissionId);
    if (owner !== null) {
      if (owner !== row.learnerAuthId) return { kind: 'conflict' };
      const existing = await loadSubmissionForLearner(owner, row.submissionId);
      return existing ? { kind: 'existing', submission: existing } : { kind: 'conflict' };
    }

    const transactionID = (await payload.db.beginTransaction()) ?? undefined;
    const req = transactionID === undefined ? {} : { req: { transactionID } };
    try {
      const firstIndex = nextUndoneIndex(row.questions);
      const first = row.questions[firstIndex < 0 ? 0 : firstIndex];
      if (!first) throw new Error('A submission needs at least one question');
      const submission = await payload.create({
        collection: 'homeworkSubmissions',
        data: {
          submissionId: row.submissionId,
          learnerAuthId: row.learnerAuthId,
          createdByAuthId: row.createdByAuthId,
          subject: row.subject,
          title: row.title,
          instructions: row.instructions,
          localDate: row.localDate,
          // The questions arrive confirmed, so extraction is over and Natalie
          // may open on the first question still needing work.
          status: firstIndex < 0 ? 'complete' : 'ready',
          pipelineStatus: 'extracted',
          currentIndex: firstIndex < 0 ? 0 : firstIndex,
          currentQuestionId: first.questionId,
        },
        depth: 0,
        ...req,
      });
      const questions: HomeworkQuestion[] = [];
      for (const question of row.questions) {
        questions.push(
          await payload.create({
            collection: 'homeworkQuestions',
            data: {
              questionId: question.questionId,
              submissionId: row.submissionId,
              learnerAuthId: row.learnerAuthId,
              orderIndex: question.orderIndex,
              sourcePage: question.sourcePage,
              sourceNumber: question.sourceNumber,
              currentRevision: question.currentRevision,
              text: question.text,
              revisions: question.revisions.map((revision) => ({ ...revision })),
              crop:
                question.crop === null
                  ? null
                  : {
                      storageKey: question.crop.storageKey,
                      width: question.crop.width,
                      height: question.crop.height,
                      expiresAt: question.crop.expiresAt,
                    },
              cropExpiresAt: question.crop?.expiresAt ?? null,
              priorWork: question.priorWork,
              priorWorkConfidence: null,
              priorWorkSource: question.priorWorkRevisions.length > 0 ? 'guardian' : null,
              priorWorkRevisions: question.priorWorkRevisions.map((revision) => ({ ...revision })),
              outcome: 'unattempted',
              attempts: 0,
              hintsUsed: 0,
              misconceptionTags: [] as string[],
            },
            depth: 0,
            ...req,
          }),
        );
      }
      if (transactionID !== undefined) await payload.db.commitTransaction(transactionID);
      return { kind: 'created', submission: submissionView(submission, questions) };
    } catch (error) {
      if (transactionID !== undefined) await payload.db.rollbackTransaction(transactionID);
      /*
        A racing first attempt committed between the owner read and this
        insert; the unique constraint caught it. Answer as the retry would.
      */
      const raced = await loadSubmissionOwner(row.submissionId);
      if (raced === row.learnerAuthId) {
        const existing = await loadSubmissionForLearner(raced, row.submissionId);
        if (existing) return { kind: 'existing', submission: existing };
      }
      if (raced !== null) return { kind: 'conflict' };
      throw error;
    }
  });

/** Appends a revision and moves `currentRevision`. History is never rewritten. */
export const reviseQuestion: ReviseHomeworkQuestion = async (learnerAuthId, submissionId, questionId, revision) =>
  withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'homeworkQuestions',
      where: {
        questionId: { equals: questionId },
        submissionId: { equals: submissionId },
        learnerAuthId: { equals: learnerAuthId },
      },
      limit: 1,
      depth: 0,
    });
    const row = docs[0];
    if (!row) return null;
    const updated = await payload.update({
      collection: 'homeworkQuestions',
      id: row.id,
      data: {
        revisions: [...asRevisions(row.revisions), revision],
        currentRevision: revision.revision,
        text: revision.text,
      },
      depth: 0,
    });
    return questionView(updated);
  });

export const startSubmission: StartHomeworkSubmission = async (learnerAuthId, submissionId, tutorSessionId) =>
  withPayload(async (payload) => {
    const transactionID = await payload.db.beginTransaction();
    if (transactionID === null) throw new Error('start requires a database transaction');
    const req = { req: { transactionID } };
    try {
      await lockSubmission(payload, transactionID, learnerAuthId, submissionId);
      const row = await findSubmission(payload, learnerAuthId, submissionId, transactionID);
      if (!row) {
        await payload.db.rollbackTransaction(transactionID);
        return null;
      }
      const questions = await findQuestions(payload, learnerAuthId, submissionId, transactionID);
      // Resume may bind a new tutor session, but never resets a running cursor.
      if (row.status === 'in-progress') {
        const updated = row.tutorSessionId === tutorSessionId ? row : await payload.update({
          collection: 'homeworkSubmissions',
          id: row.id,
          data: { tutorSessionId },
          depth: 0,
          ...req,
        });
        await payload.db.commitTransaction(transactionID);
        return submissionView(updated, questions);
      }
      if (row.status === 'abandoned' || (row.status === 'complete' && row.tutorSessionId)) {
        await payload.db.commitTransaction(transactionID);
        return submissionView(row, questions);
      }
      const firstIndex = nextUndoneIndex(questions);
      const first = questions[firstIndex];
      const updated = await payload.update({
        collection: 'homeworkSubmissions',
        id: row.id,
        data: first
          ? { tutorSessionId, status: 'in-progress', currentIndex: firstIndex, currentQuestionId: first.questionId }
          : { status: 'complete' },
        depth: 0,
        ...req,
      });
      await payload.db.commitTransaction(transactionID);
      return submissionView(updated, questions);
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID);
      throw error;
    }
  });

/** Guardian marks serialize with start/advance; this fallback allows prestart edits only. */
export const revisePriorWork: ReviseHomeworkPriorWork = async (learnerAuthId, submissionId, questionId, revision) =>
  withPayload(async (payload) => {
    const transactionID = await payload.db.beginTransaction();
    if (transactionID === null) throw new Error('prior-work revision requires a database transaction');
    const req = { req: { transactionID } };
    try {
      await lockSubmission(payload, transactionID, learnerAuthId, submissionId);
      const row = await findSubmission(payload, learnerAuthId, submissionId, transactionID);
      if (!row) {
        await payload.db.rollbackTransaction(transactionID);
        return { kind: 'not-found' };
      }
      const questions = await findQuestions(payload, learnerAuthId, submissionId, transactionID);
      const question = questions.find((candidate) => candidate.questionId === questionId);
      if (!question) {
        await payload.db.rollbackTransaction(transactionID);
        return { kind: 'not-found' };
      }
      if (!canRevisePriorWork(row, questions)) {
        await payload.db.rollbackTransaction(transactionID);
        return { kind: 'locked' };
      }
      const updated = await payload.update({
        collection: 'homeworkQuestions',
        id: question.id,
        data: {
          priorWork: revision.priorWork,
          priorWorkSource: 'guardian',
          priorWorkConfidence: null,
          priorWorkRevisions: [...asPriorWorkRevisions(question.priorWorkRevisions), revision],
        },
        depth: 0,
        ...req,
      });
      const revisedQuestions = questions.map((candidate) => candidate.id === question.id ? updated : candidate);
      const firstIndex = nextUndoneIndex(revisedQuestions);
      const first = revisedQuestions[firstIndex];
      await payload.update({
        collection: 'homeworkSubmissions',
        id: row.id,
        data: first
          ? { status: 'ready', currentIndex: firstIndex, currentQuestionId: first.questionId }
          : { status: 'complete' },
        depth: 0,
        ...req,
      });
      await payload.db.commitTransaction(transactionID);
      return { kind: 'revised', question: questionView(updated) };
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID);
      throw error;
    }
  });

interface DrizzleSessions {
  sessions: Record<string, { db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> } }>;
}

async function lockSubmission(
  payload: Payload,
  transactionID: string | number,
  learnerAuthId: string,
  submissionId: string,
): Promise<void> {
  const session = (payload.db as unknown as DrizzleSessions).sessions[String(transactionID)];
  if (!session) throw new Error('transaction session missing');
  await session.db.execute(
    sql`select 1 from "payload"."homework_submissions" where "submission_id" = ${submissionId} and "learner_auth_id" = ${learnerAuthId} for update`,
  );
}

export const advanceSubmission: AdvanceHomeworkSubmission = async (learnerAuthId, submissionId, input, at) =>
  withPayload(async (payload) => {
    const transactionID = await payload.db.beginTransaction();
    if (transactionID === null) throw new Error('advance requires a database transaction');
    const req = { req: { transactionID } };
    try {
      // Serialises concurrent advances on this one row (see header).
      await lockSubmission(payload, transactionID, learnerAuthId, submissionId);

      const row = await findSubmission(payload, learnerAuthId, submissionId, transactionID);
      if (!row) {
        await payload.db.rollbackTransaction(transactionID);
        return { kind: 'not-found' };
      }
      // A finished worksheet keeps its cursor on the last question, so a repeat
      // advance would pass the index check and overwrite that question's outcome.
      // Answering `stale` hands the client the completed row to reconcile to.
      if (row.status === 'complete' || Number(row.currentIndex) !== input.expectedIndex) {
        await payload.db.rollbackTransaction(transactionID);
        return { kind: 'stale', current: advanceResult(row) };
      }

      const questions = await findQuestions(payload, learnerAuthId, submissionId, transactionID);
      const from = questions[input.expectedIndex];
      if (!from || from.questionId !== input.fromQuestionId) {
        await payload.db.rollbackTransaction(transactionID);
        return { kind: 'not-current' };
      }

      await payload.update({
        collection: 'homeworkQuestions',
        id: from.id,
        data: {
          outcome: input.outcome,
          attempts: input.attempts,
          hintsUsed: input.hintsUsed,
          misconceptionTags: [...input.misconceptionTags],
          startedAt: from.startedAt ?? at,
          completedAt: at,
        },
        depth: 0,
        ...req,
      });

      const nextIndex = nextUndoneIndex(questions, input.expectedIndex);
      const next = questions[nextIndex];
      const updated = await payload.update({
        collection: 'homeworkSubmissions',
        id: row.id,
        data: next
          ? { currentIndex: nextIndex, currentQuestionId: next.questionId, status: 'in-progress' }
          : // Past the last question the cursor stays on it and the work is done.
            { status: 'complete' },
        depth: 0,
        ...req,
      });
      if (next && !next.startedAt) {
        await payload.update({
          collection: 'homeworkQuestions',
          id: next.id,
          data: { startedAt: at },
          depth: 0,
          ...req,
        });
      }

      await payload.db.commitTransaction(transactionID);
      return { kind: 'advanced', result: advanceResult(updated) };
    } catch (error) {
      await payload.db.rollbackTransaction(transactionID);
      throw error;
    }
  });

/**
 * Binds the issued `edu.questions` row to the CHILD. `issueEduQuestion` writes
 * `ctx.learnerId` as `learner_id`, so the ctx it receives names the learner the
 * service already proved; the org stays the caller's.
 */
export const issueHomeworkEvidence: IssueHomeworkEvidence = async (ctx, learnerAuthId, evidence) =>
  issueEduQuestion({ learnerId: learnerAuthId, isLearner: true, orgId: ctx.orgId }, evidence);

// ── guardian reads ──────────────────────────────────────────────────────────

/** Name from Better Auth, band from the learner's record (`loadGradeBand`). */
export const loadWardProfile: LoadWardProfile = async (learnerAuthId) => {
  const context = await auth.$context;
  const user = (await context.internalAdapter.findUserById(learnerAuthId)) as { name?: string | null } | null;
  return {
    learnerAuthId,
    displayName: user?.name ?? learnerAuthId,
    gradeBand: await loadGradeBand({ learnerId: learnerAuthId, isLearner: true }),
  };
};

// ── practice sets (guardian-scoped) ─────────────────────────────────────────

export const createPracticeSet: CreatePracticeSet = async (ctx, set) =>
  withPayload(async (payload) => {
    const row = await payload.create({
      collection: 'homeworkPracticeSets',
      data: {
        practiceSetId: set.practiceSetId,
        submissionId: set.submissionId,
        learnerAuthId: set.learnerAuthId,
        guardianAuthId: ctx.learnerId,
        // A draft until the guardian approves it, whatever the caller passed.
        status: 'draft',
        seed: set.seed,
        targetedTags: [...set.targetedTags],
        items: set.items.map((item) => ({ ...item })),
      },
      depth: 0,
    });
    return practiceView(row);
  });

async function findPracticeSet(payload: Payload, ctx: ProtectedCtx, practiceSetId: string) {
  const { docs } = await payload.find({
    collection: 'homeworkPracticeSets',
    where: { practiceSetId: { equals: practiceSetId }, guardianAuthId: { equals: ctx.learnerId } },
    limit: 1,
    depth: 0,
  });
  return docs[0] ?? null;
}

export const loadPracticeSet: LoadPracticeSet = async (ctx, practiceSetId) =>
  withPayload(async (payload) => {
    const row = await findPracticeSet(payload, ctx, practiceSetId);
    return row ? practiceView(row) : null;
  });

export const approvePracticeSet: ApprovePracticeSet = async (ctx, practiceSetId) =>
  withPayload(async (payload) => {
    const row = await findPracticeSet(payload, ctx, practiceSetId);
    if (!row) return null;
    if (row.status === 'approved') return practiceView(row);
    const updated = await payload.update({
      collection: 'homeworkPracticeSets',
      id: row.id,
      data: { status: 'approved' },
      depth: 0,
    });
    return practiceView(updated);
  });
