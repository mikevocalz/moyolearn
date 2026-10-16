import 'server-only';
// The homework service: who may touch which worksheet, decided once, here.
//
// THE WARD RULE. Every operation names a target learner, and that learner must
// be `ctx.learnerId` or appear in `loadGuardianWards(ctx)` (ACTIVE
// guardianships only). Anything else throws `Forbidden`. For a create the
// target is `forLearnerAuthId ?? ctx.learnerId`; for a by-id path it is the
// owner the repository reports for that id, read before the row itself, so the
// row read can be scoped to a learner the service already proved.
//
// EVIDENCE IS ISSUED HERE, NOT IN THE REPOSITORY. A confirmed transcription
// (create, or a later revise) issues an `edu.questions` row under the
// question's current revision with `evaluationReady: false`, a literal in this
// file and nowhere configurable. A photographed page is never server-composed,
// so the evaluator keeps refusing it (ADR-119); keeping the literal in the
// service lets a test with fake ports assert it. The write happens after the
// question row is persisted: if it fails, the edu row lags behind, the
// client's quoted revision no longer matches, and the evaluator refuses. Both
// failure orders end in a refusal, never a grade.
//
// THE CURSOR IS THE SERVER'S. `advance` hands the repository the index the
// client believed was current; the repository compares it inside one
// transaction and answers `stale` with the row as it stands when another
// device moved first.
// SOT: docs/work/pr-100/contract.md §Data §Routes · docs/decisions/adr-124-homework-submissions-persistence.md · docs/decisions/adr-119-graded-turns-need-a-locked-revision.md
// SOT-KEYWORDS: homework service ward rule guardian forbidden submission create revise advance stale cursor evidence evaluation ready false practice set
import { randomUUID } from 'node:crypto';
import type { Auth } from '@acme/auth/server';
import type { VoiceBand } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import { MAX_WORKSHEET_QUESTIONS } from '../capture/worksheet-questions.ts';
import { mediaExpiry } from '../media/retention.ts';
import type { LoadGuardianWards } from '../summary/summary.service.ts';
import { problemDigest } from '../tutor/tutor.service.ts';
import type {
  AdvanceInput,
  AdvanceResult,
  CreateSubmissionInput,
  HomeworkQuestionView,
  HomeworkSubmissionSummary,
  HomeworkSubmissionView,
  PracticeSetView,
  QuestionCrop,
  QuestionOutcome,
  QuestionRevision,
  ReviseQuestionInput,
  StartSubmissionInput,
} from './homework.types.ts';

/** No row with that id for a learner this caller may act for. 404. */
export class HomeworkNotFound extends Error {
  constructor() {
    super('Not found');
  }
}

/** The body failed validation. 400; the message names the field. */
export class HomeworkInputInvalid extends Error {}

/** A `submissionId` already owned by another learner. 409. */
export class HomeworkConflict extends Error {
  constructor() {
    super('submission-conflict');
  }
}

/**
 * Seven days, the same window `/api/tutor/next` gives a generated problem and
 * inside `questions_gradable_window` (8 days). The row is issued unready, so
 * the window bounds how long it lingers, not how long it may be graded.
 */
const EVIDENCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Fields the store writes on create. Ids are minted here, never by the client. */
export interface NewQuestionRow {
  readonly questionId: string;
  readonly orderIndex: number;
  readonly sourcePage: number;
  readonly sourceNumber: number | null;
  readonly currentRevision: string;
  readonly text: string;
  readonly revisions: readonly QuestionRevision[];
  readonly crop: QuestionCrop | null;
}

export interface NewSubmissionRow {
  readonly submissionId: string;
  readonly learnerAuthId: string;
  readonly createdByAuthId: string;
  readonly subject: string;
  readonly title: string;
  readonly instructions: string;
  readonly localDate: string;
  readonly questions: readonly NewQuestionRow[];
}

export type CreateSubmissionOutcome =
  | { readonly kind: 'created'; readonly submission: HomeworkSubmissionView }
  | { readonly kind: 'existing'; readonly submission: HomeworkSubmissionView }
  | { readonly kind: 'conflict' };

export type AdvanceOutcome =
  | { readonly kind: 'advanced'; readonly result: AdvanceResult }
  | { readonly kind: 'stale'; readonly current: AdvanceResult }
  | { readonly kind: 'not-current' }
  | { readonly kind: 'not-found' };

/** The `edu.questions` row a confirmed transcription issues (ADR-119). */
export interface HomeworkEvidence {
  readonly questionId: string;
  readonly revision: string;
  readonly problemDigest: string;
  readonly evaluationReady: false;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

/*
  Repository ports. Every read and write after the owner lookup carries the
  learner the service proved, so a mis-wired caller cannot widen the scope.
*/
export type LoadSubmissionOwner = (submissionId: string) => Promise<string | null>;
export type CreateHomeworkSubmission = (
  ctx: ProtectedCtx,
  row: NewSubmissionRow,
) => Promise<CreateSubmissionOutcome>;
export type LoadHomeworkSubmission = (
  learnerAuthId: string,
  submissionId: string,
) => Promise<HomeworkSubmissionView | null>;
export type ListHomeworkSubmissions = (
  learnerAuthId: string,
) => Promise<readonly HomeworkSubmissionSummary[]>;
export type ReviseHomeworkQuestion = (
  learnerAuthId: string,
  submissionId: string,
  questionId: string,
  revision: QuestionRevision,
) => Promise<HomeworkQuestionView | null>;
export type StartHomeworkSubmission = (
  learnerAuthId: string,
  submissionId: string,
  tutorSessionId: string,
) => Promise<HomeworkSubmissionView | null>;
export type AdvanceHomeworkSubmission = (
  learnerAuthId: string,
  submissionId: string,
  input: AdvanceInput,
  at: string,
) => Promise<AdvanceOutcome>;
/**
 * Issues evidence for `learnerAuthId`, the child, not the caller: a guardian
 * confirming a ward's transcription must bind the row to the ward, or the
 * ward's evaluator would never find it.
 */
export type IssueHomeworkEvidence = (
  ctx: ProtectedCtx,
  learnerAuthId: string,
  evidence: HomeworkEvidence,
) => Promise<void>;

export interface WardProfile {
  readonly learnerAuthId: string;
  readonly displayName: string;
  /** Doc 31 voice band; the read falls back to 9-12 as `loadGradeBand` does. */
  readonly gradeBand: VoiceBand;
}
export type LoadWardProfile = (learnerAuthId: string) => Promise<WardProfile>;

/** Practice sets are guardian-scoped: `guardianAuthId = ctx.learnerId` on every query. */
export type CreatePracticeSet = (ctx: ProtectedCtx, set: PracticeSetView) => Promise<PracticeSetView>;
export type ApprovePracticeSet = (
  ctx: ProtectedCtx,
  practiceSetId: string,
) => Promise<PracticeSetView | null>;
export type LoadPracticeSet = (ctx: ProtectedCtx, practiceSetId: string) => Promise<PracticeSetView | null>;

export interface HomeworkPorts {
  readonly loadGuardianWards: LoadGuardianWards;
  readonly loadSubmissionOwner: LoadSubmissionOwner;
  readonly createSubmission: CreateHomeworkSubmission;
  readonly loadSubmission: LoadHomeworkSubmission;
  readonly listSubmissions: ListHomeworkSubmissions;
  readonly reviseQuestion: ReviseHomeworkQuestion;
  readonly startSubmission: StartHomeworkSubmission;
  readonly advanceSubmission: AdvanceHomeworkSubmission;
  readonly issueEvidence: IssueHomeworkEvidence;
}

/**
 * The ward rule. Exported so the practice-set service (B5) asks the same
 * question rather than a second spelling of it.
 */
export async function assertCanActFor(
  ctx: ProtectedCtx,
  learnerAuthId: string,
  loadGuardianWards: LoadGuardianWards,
): Promise<void> {
  if (learnerAuthId === ctx.learnerId) return;
  const wards = await loadGuardianWards(ctx);
  if (!wards.includes(learnerAuthId)) throw new Error('Forbidden');
}

/** Owner lookup, then the ward rule. Unknown id is 404 before any ward read. */
async function ownerFor(
  ctx: ProtectedCtx,
  submissionId: string,
  ports: Pick<HomeworkPorts, 'loadSubmissionOwner' | 'loadGuardianWards'>,
): Promise<string> {
  const owner = await ports.loadSubmissionOwner(submissionId);
  if (owner === null) throw new HomeworkNotFound();
  await assertCanActFor(ctx, owner, ports.loadGuardianWards);
  return owner;
}

function evidenceFor(questionId: string, revision: string, text: string, now: Date): HomeworkEvidence {
  return {
    questionId,
    revision,
    problemDigest: problemDigest(text),
    evaluationReady: false,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EVIDENCE_TTL_MS).toISOString(),
  };
}

// ── input validation ────────────────────────────────────────────────────────

const ID = /^[A-Za-z0-9_-]{8,64}$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_TEXT = 4000;
const MAX_LABEL = 200;
const OUTCOMES: ReadonlySet<Exclude<QuestionOutcome, 'unattempted'>> = new Set([
  'skipped',
  'attempted',
  'supported-with-hints',
  'solved-independently',
  'unresolved',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, field: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string') throw new HomeworkInputInvalid(`${field} must be a string`);
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) throw new HomeworkInputInvalid(`${field} is empty`);
  if (trimmed.length > max) throw new HomeworkInputInvalid(`${field} is too long`);
  return trimmed;
}

function id(value: unknown, field: string): string {
  if (typeof value !== 'string' || !ID.test(value)) throw new HomeworkInputInvalid(`${field} is not an id`);
  return value;
}

function count(value: unknown, field: string, min: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > 10_000) {
    throw new HomeworkInputInvalid(`${field} must be an integer >= ${min}`);
  }
  return value;
}

function cropFrom(value: unknown, now: Date): QuestionCrop | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new HomeworkInputInvalid('crop must be an object');
  return {
    storageKey: text(value.storageKey, 'crop.storageKey', 512),
    width: count(value.width, 'crop.width', 1),
    height: count(value.height, 'crop.height', 1),
    // The image's clock is the server's: a client cannot ask for a longer one.
    expiresAt: mediaExpiry(now),
  };
}

/** Body → row. Exported for the test; the route never calls it directly. */
export function submissionRowFrom(
  ctx: ProtectedCtx,
  body: unknown,
  now: Date,
): NewSubmissionRow {
  if (!isRecord(body)) throw new HomeworkInputInvalid('body must be an object');
  const input = body as Partial<Record<keyof CreateSubmissionInput, unknown>>;
  const localDate = text(input.localDate, 'localDate', 10);
  if (!LOCAL_DATE.test(localDate)) throw new HomeworkInputInvalid('localDate must be YYYY-MM-DD');
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    throw new HomeworkInputInvalid('questions must be a non-empty array');
  }
  if (input.questions.length > MAX_WORKSHEET_QUESTIONS) {
    throw new HomeworkInputInvalid(`at most ${MAX_WORKSHEET_QUESTIONS} questions`);
  }
  const learnerAuthId =
    input.forLearnerAuthId === undefined || input.forLearnerAuthId === null
      ? ctx.learnerId
      : text(input.forLearnerAuthId, 'forLearnerAuthId', 128);
  const createdAt = now.toISOString();
  const author = learnerAuthId === ctx.learnerId ? 'learner' : 'guardian';

  const questions = input.questions.map((raw: unknown, orderIndex): NewQuestionRow => {
    if (!isRecord(raw)) throw new HomeworkInputInvalid(`questions[${orderIndex}] must be an object`);
    const body = text(raw.text, `questions[${orderIndex}].text`, MAX_TEXT);
    const sourceNumber =
      raw.sourceNumber === null || raw.sourceNumber === undefined
        ? null
        : count(raw.sourceNumber, `questions[${orderIndex}].sourceNumber`, 0);
    const confidence =
      typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1 ? raw.confidence : null;
    const revision = randomUUID();
    /*
      Two revisions when OCR read the page: the machine's reading and the
      human confirmation of it, so the history says who vouched for the text.
      The confirmed one is current. A typed question has only the human one.
    */
    const revisions: QuestionRevision[] = [];
    if (confidence !== null) {
      revisions.push({ revision: randomUUID(), text: body, author: 'ocr', confidence, createdAt });
    }
    revisions.push({ revision, text: body, author, confidence: null, createdAt });
    return {
      questionId: randomUUID(),
      orderIndex,
      sourcePage: count(raw.sourcePage, `questions[${orderIndex}].sourcePage`, 1),
      sourceNumber,
      currentRevision: revision,
      text: body,
      revisions,
      crop: cropFrom(raw.crop, now),
    };
  });

  return {
    submissionId: id(input.submissionId, 'submissionId'),
    learnerAuthId,
    createdByAuthId: ctx.learnerId,
    subject: text(input.subject, 'subject', MAX_LABEL),
    title: text(input.title, 'title', MAX_LABEL),
    instructions: text(input.instructions ?? '', 'instructions', MAX_TEXT, true),
    localDate,
    questions,
  };
}

function reviseFrom(body: unknown): ReviseQuestionInput {
  if (!isRecord(body)) throw new HomeworkInputInvalid('body must be an object');
  if (body.author !== 'learner' && body.author !== 'guardian') {
    throw new HomeworkInputInvalid('author must be learner or guardian');
  }
  return { text: text(body.text, 'text', MAX_TEXT), author: body.author };
}

function advanceFrom(body: unknown): AdvanceInput {
  if (!isRecord(body)) throw new HomeworkInputInvalid('body must be an object');
  if (typeof body.outcome !== 'string' || !OUTCOMES.has(body.outcome as never)) {
    throw new HomeworkInputInvalid('outcome is not a recordable outcome');
  }
  const tags = body.misconceptionTags ?? [];
  if (!Array.isArray(tags) || tags.length > 20) throw new HomeworkInputInvalid('misconceptionTags must be an array');
  return {
    fromQuestionId: text(body.fromQuestionId, 'fromQuestionId', 128),
    expectedIndex: count(body.expectedIndex, 'expectedIndex', 0),
    outcome: body.outcome as AdvanceInput['outcome'],
    attempts: count(body.attempts ?? 0, 'attempts', 0),
    hintsUsed: count(body.hintsUsed ?? 0, 'hintsUsed', 0),
    misconceptionTags: tags.map((tag, index) => text(tag, `misconceptionTags[${index}]`, 80)),
  };
}

// ── ctx-level operations (tested directly) ──────────────────────────────────

export async function createSubmissionFor(
  ctx: ProtectedCtx,
  body: unknown,
  ports: HomeworkPorts,
  now: Date = new Date(),
): Promise<CreateSubmissionOutcome & { kind: 'created' | 'existing' }> {
  const row = submissionRowFrom(ctx, body, now);
  await assertCanActFor(ctx, row.learnerAuthId, ports.loadGuardianWards);
  const outcome = await ports.createSubmission(ctx, row);
  if (outcome.kind === 'conflict') throw new HomeworkConflict();
  // A retry returns the first attempt's row; its evidence was issued then.
  if (outcome.kind === 'created') {
    for (const question of row.questions) {
      await ports.issueEvidence(
        ctx,
        row.learnerAuthId,
        evidenceFor(question.questionId, question.currentRevision, question.text, now),
      );
    }
  }
  return outcome;
}

export async function listSubmissionsFor(
  ctx: ProtectedCtx,
  learner: string | null,
  ports: HomeworkPorts,
): Promise<readonly HomeworkSubmissionSummary[]> {
  const target = learner && learner.length > 0 ? learner : ctx.learnerId;
  await assertCanActFor(ctx, target, ports.loadGuardianWards);
  return ports.listSubmissions(target);
}

export async function loadSubmissionFor(
  ctx: ProtectedCtx,
  submissionId: string,
  ports: HomeworkPorts,
): Promise<HomeworkSubmissionView> {
  const owner = await ownerFor(ctx, submissionId, ports);
  const submission = await ports.loadSubmission(owner, submissionId);
  if (!submission) throw new HomeworkNotFound();
  return submission;
}

export async function reviseQuestionFor(
  ctx: ProtectedCtx,
  submissionId: string,
  questionId: string,
  body: unknown,
  ports: HomeworkPorts,
  now: Date = new Date(),
): Promise<HomeworkQuestionView> {
  const input = reviseFrom(body);
  const owner = await ownerFor(ctx, submissionId, ports);
  const revision: QuestionRevision = {
    revision: randomUUID(),
    text: input.text,
    author: input.author,
    confidence: null,
    createdAt: now.toISOString(),
  };
  const question = await ports.reviseQuestion(owner, submissionId, questionId, revision);
  if (!question) throw new HomeworkNotFound();
  await ports.issueEvidence(ctx, owner, evidenceFor(question.questionId, revision.revision, revision.text, now));
  return question;
}

export async function startSubmissionFor(
  ctx: ProtectedCtx,
  submissionId: string,
  body: unknown,
  ports: HomeworkPorts,
): Promise<HomeworkSubmissionView> {
  if (!isRecord(body)) throw new HomeworkInputInvalid('body must be an object');
  const input: StartSubmissionInput = { tutorSessionId: text(body.tutorSessionId, 'tutorSessionId', 128) };
  const owner = await ownerFor(ctx, submissionId, ports);
  const submission = await ports.startSubmission(owner, submissionId, input.tutorSessionId);
  if (!submission) throw new HomeworkNotFound();
  return submission;
}

export async function advanceSubmissionFor(
  ctx: ProtectedCtx,
  submissionId: string,
  body: unknown,
  ports: HomeworkPorts,
  now: Date = new Date(),
): Promise<Extract<AdvanceOutcome, { kind: 'advanced' | 'stale' }>> {
  const input = advanceFrom(body);
  const owner = await ownerFor(ctx, submissionId, ports);
  const outcome = await ports.advanceSubmission(owner, submissionId, input, now.toISOString());
  if (outcome.kind === 'not-found') throw new HomeworkNotFound();
  if (outcome.kind === 'not-current') {
    throw new HomeworkInputInvalid('fromQuestionId is not the question at expectedIndex');
  }
  return outcome;
}

export async function guardianWardsFor(
  ctx: ProtectedCtx,
  ports: { readonly loadGuardianWards: LoadGuardianWards; readonly loadWardProfile: LoadWardProfile },
): Promise<readonly WardProfile[]> {
  const wards = await ports.loadGuardianWards(ctx);
  return Promise.all(wards.map((ward) => ports.loadWardProfile(ward)));
}

// ── protected entry points (the routes call these) ──────────────────────────

const write = (op: string, resource: string) => ({ telemetry: { op, resource, action: 'write' as const } });
const read = (op: string, resource: string) => ({ telemetry: { op, resource, action: 'read' as const } });

export const createHomeworkSubmission = (auth: Auth, headers: Headers, body: unknown, ports: HomeworkPorts) =>
  protectedOperation(auth, headers, (ctx) => createSubmissionFor(ctx, body, ports), write('homework.submission.create', 'homeworkSubmissions'));

export const listHomeworkSubmissions = (auth: Auth, headers: Headers, learner: string | null, ports: HomeworkPorts) =>
  protectedOperation(auth, headers, (ctx) => listSubmissionsFor(ctx, learner, ports), read('homework.submission.list', 'homeworkSubmissions'));

export const homeworkSubmission = (auth: Auth, headers: Headers, submissionId: string, ports: HomeworkPorts) =>
  protectedOperation(auth, headers, (ctx) => loadSubmissionFor(ctx, submissionId, ports), read('homework.submission.read', 'homeworkSubmissions'));

export const reviseHomeworkQuestion = (
  auth: Auth,
  headers: Headers,
  submissionId: string,
  questionId: string,
  body: unknown,
  ports: HomeworkPorts,
) =>
  protectedOperation(
    auth,
    headers,
    (ctx) => reviseQuestionFor(ctx, submissionId, questionId, body, ports),
    write('homework.question.revise', 'homeworkQuestions'),
  );

export const startHomeworkSubmission = (
  auth: Auth,
  headers: Headers,
  submissionId: string,
  body: unknown,
  ports: HomeworkPorts,
) =>
  protectedOperation(auth, headers, (ctx) => startSubmissionFor(ctx, submissionId, body, ports), write('homework.submission.start', 'homeworkSubmissions'));

export const advanceHomeworkSubmission = (
  auth: Auth,
  headers: Headers,
  submissionId: string,
  body: unknown,
  ports: HomeworkPorts,
) =>
  protectedOperation(auth, headers, (ctx) => advanceSubmissionFor(ctx, submissionId, body, ports), write('homework.submission.advance', 'homeworkSubmissions'));

export const guardianWards = (
  auth: Auth,
  headers: Headers,
  ports: { readonly loadGuardianWards: LoadGuardianWards; readonly loadWardProfile: LoadWardProfile },
) => protectedOperation(auth, headers, (ctx) => guardianWardsFor(ctx, ports), read('guardian.wards.list', 'guardianships'));
