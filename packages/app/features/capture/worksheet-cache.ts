// The device's cache of one learner's current homework submission.
//
// The server owns the record and the cursor (`homeworkSubmissions`). This file
// keeps two things per learner: the last view the server confirmed, and the
// cursor moves the device made that the server has not yet confirmed. What the
// screen draws is the confirmed view with the pending moves replayed on top,
// so a move made offline shows at once and is still visibly unconfirmed.
//
// Every local write ends in exactly one of three places:
//   confirmed   the server accepted it;
//   reconciled  the server said another device moved first (409) and the
//               local copy now matches the server's cursor;
//   pending     no answer yet; retried on the next hydrate.
// A refusal that is neither (403/404/400) leaves the moves pending and the
// status `error`, on screen rather than quietly dropped.
//
// Pure over two ports (storage, client) so `node:test` can drive it with Maps
// and a fake client. `worksheet.store.ts` binds the real ones.
// SOT: docs/work/pr-100/contract.md §Client · packages/app/features/homework/homework.types.ts · packages/app/features/capture/worksheet-session.ts
// SOT-KEYWORDS: homework worksheet cache cursor advance optimistic reconcile pending offline migration v1 v2 learner key
import type { StateCreator } from 'zustand/vanilla';
import { ApiError, isRetryableError } from '../../core/api-fetch.ts';
import { StaleCursorError, type HomeworkClient } from '../homework/homework.client.ts';
import type {
  AdvanceInput,
  AdvanceResult,
  CreateSubmissionInput,
  HomeworkQuestionView,
  HomeworkSubmissionView,
  QuestionOutcome,
  ReviseQuestionInput,
} from '../homework/homework.types.ts';
import type { ProblemStorage } from './problem-storage.shared.ts';
import { questionForTutor, type WorksheetQuestion } from './worksheet-questions.ts';
import { clearWorksheet, readWorksheet, type WorksheetSession } from './worksheet-session.ts';

/** Where the device copy stands against the server. */
export type WorksheetSyncStatus = 'idle' | 'syncing' | 'confirmed' | 'pending' | 'reconciled' | 'error';

/** What the learner did on the question they are leaving. The cursor fields come from the cache. */
export type AdvanceOutcomeInput = Omit<AdvanceInput, 'fromQuestionId' | 'expectedIndex'>;

/** The persisted shape under `homework-submission-v2:<learnerAuthId>`. */
export interface WorksheetCacheRecord {
  readonly schemaVersion: 2;
  readonly learnerAuthId: string;
  /** The last view the server returned. Never edited by an unconfirmed move. */
  readonly confirmed: HomeworkSubmissionView;
  /** Moves made on this device, oldest first, not yet answered by the server. */
  readonly pending: readonly AdvanceInput[];
}

export interface WorksheetState {
  /** The confirmed view with pending moves replayed. What the screen draws. */
  current: HomeworkSubmissionView | null;
  /** The learner whose key `current` was read from. */
  ownerId: string | null;
  pending: readonly AdvanceInput[];
  status: WorksheetSyncStatus;
  /** Synchronous read of the device copy, so the first render knows the question. */
  restore: (learnerAuthId: string) => HomeworkSubmissionView | null;
  /** Flushes pending moves, migrates a v1 worksheet once, then reads the server's view. */
  hydrate: (learnerAuthId: string, submissionId?: string) => Promise<HomeworkSubmissionView | null>;
  /** Creates the submission. Idempotent on `input.submissionId`, so a retry reuses the same id. */
  begin: (learnerAuthId: string, input: CreateSubmissionInput) => Promise<HomeworkSubmissionView>;
  /** Links the tutor session once the tutor store has one. */
  start: (tutorSessionId: string) => Promise<void>;
  /** Optimistic: moves the local cursor now, then asks the server. */
  advance: (input: AdvanceOutcomeInput) => Promise<WorksheetSyncStatus>;
  /** Not optimistic: a new transcription is shown only once the server stored it. */
  revise: (questionId: string, input: ReviseQuestionInput) => Promise<HomeworkQuestionView>;
  clear: (learnerAuthId: string) => void;
}

export interface WorksheetCachePorts {
  readonly storage: ProblemStorage;
  readonly client: HomeworkClient;
  readonly now?: () => Date;
}

export const worksheetKeyFor = (learnerAuthId: string) =>
  'homework-submission-v2:' + encodeURIComponent(learnerAuthId);

function isQuestionView(value: unknown): value is HomeworkQuestionView {
  if (!value || typeof value !== 'object') return false;
  const q = value as Partial<HomeworkQuestionView>;
  return typeof q.questionId === 'string' && q.questionId.length > 0 &&
    Number.isInteger(q.orderIndex) && typeof q.text === 'string' && typeof q.outcome === 'string';
}

function isSubmissionView(value: unknown): value is HomeworkSubmissionView {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<HomeworkSubmissionView>;
  return typeof v.submissionId === 'string' && v.submissionId.length > 0 &&
    typeof v.learnerAuthId === 'string' && Array.isArray(v.questions) && v.questions.length > 0 &&
    v.questions.every(isQuestionView) && Number.isInteger(v.currentIndex) &&
    v.currentIndex! >= 0 && v.currentIndex! < v.questions.length && typeof v.status === 'string';
}

export function readCacheRecord(storage: ProblemStorage, learnerAuthId: string): WorksheetCacheRecord | null {
  if (!learnerAuthId) return null;
  const raw = storage.getString(worksheetKeyFor(learnerAuthId));
  if (!raw) return null;
  try {
    const decoded = JSON.parse(raw) as Partial<WorksheetCacheRecord>;
    if (decoded.schemaVersion !== 2 || decoded.learnerAuthId !== learnerAuthId) return null;
    if (!isSubmissionView(decoded.confirmed) || !Array.isArray(decoded.pending)) return null;
    return decoded as WorksheetCacheRecord;
  } catch {
    return null;
  }
}

function writeCacheRecord(storage: ProblemStorage, record: WorksheetCacheRecord): void {
  storage.set(worksheetKeyFor(record.learnerAuthId), JSON.stringify(record));
}

/** One move applied to a view: the outcome lands on the question, the cursor steps or the work completes. */
export function applyMove(
  view: HomeworkSubmissionView,
  move: AdvanceInput,
  at: string,
): HomeworkSubmissionView {
  const questions = view.questions.map((q) =>
    q.questionId === move.fromQuestionId
      ? {
          ...q,
          outcome: move.outcome,
          attempts: move.attempts,
          hintsUsed: move.hintsUsed,
          misconceptionTags: [...move.misconceptionTags],
          startedAt: q.startedAt ?? at,
          completedAt: at,
        }
      : q,
  );
  const next = questions[move.expectedIndex + 1];
  // Past the last question the server keeps the cursor on it and marks the work complete.
  return next
    ? { ...view, questions, currentIndex: move.expectedIndex + 1, currentQuestionId: next.questionId, status: 'in-progress' }
    : { ...view, questions, status: 'complete' };
}

function replay(record: WorksheetCacheRecord, at: string): HomeworkSubmissionView {
  return record.pending.reduce((view, move) => applyMove(view, move, at), record.confirmed);
}

function adoptCursor(view: HomeworkSubmissionView, cursor: AdvanceResult): HomeworkSubmissionView {
  return { ...view, ...cursor };
}

/**
 * The outcome a cursor move records. `solved-independently` needs the
 * evaluator's verdict with no hints; a photographed page never gets one
 * (ADR-119), so worksheets record `attempted`, `supported-with-hints` or
 * `skipped`. Leaving without a single learner turn or hint is a skip.
 */
export function outcomeForAdvance(input: {
  learnerTurns: number;
  hintDepth: number;
  evaluatedCorrect: boolean;
}): Exclude<QuestionOutcome, 'unattempted'> {
  if (input.evaluatedCorrect && input.hintDepth === 0) return 'solved-independently';
  if (input.hintDepth > 0) return 'supported-with-hints';
  if (input.learnerTurns === 0) return 'skipped';
  return 'attempted';
}

/** The tutor's view of a server question: same shape the v1 worksheet sent, so prompts match byte for byte. */
export function toWorksheetQuestion(question: HomeworkQuestionView): WorksheetQuestion {
  return {
    id: 'question-' + String(question.orderIndex + 1),
    sourcePage: question.sourcePage,
    sourceNumber: question.sourceNumber,
    text: question.text,
  };
}

/** The exact text handed to `setProblem` for the view's current question. */
export function currentPrompt(view: HomeworkSubmissionView): string | null {
  const question = view.questions[view.currentIndex];
  return question ? questionForTutor(toWorksheetQuestion(question), view) : null;
}

/** Which question of this worksheet a tutor problem is, or -1 when it is none of them. */
export function questionIndexForPrompt(view: HomeworkSubmissionView, prompt: string | null): number {
  const wanted = prompt?.trim();
  if (!wanted) return -1;
  return view.questions.findIndex((q) => questionForTutor(toWorksheetQuestion(q), view).trim() === wanted);
}

function localDateOf(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(d.getFullYear())}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * A v1 worksheet carried no outcomes, only a cursor. The questions it already
 * passed are recorded `unresolved`: the learner moved on, and nothing on the
 * device says how it went.
 */
function migrationFrom(v1: WorksheetSession): CreateSubmissionInput {
  return {
    submissionId: v1.id,
    subject: v1.subject,
    title: v1.title,
    instructions: v1.instructions,
    localDate: localDateOf(v1.createdAt),
    questions: v1.questions.map((q) => ({
      clientId: q.id,
      sourcePage: q.sourcePage,
      sourceNumber: q.sourceNumber,
      text: q.text,
      confidence: null,
      crop: null,
    })),
  };
}

export function worksheetStateCreator(ports: WorksheetCachePorts): StateCreator<WorksheetState> {
  const { storage, client } = ports;
  const now = () => (ports.now ? ports.now() : new Date()).toISOString();
  // One flush at a time: two overlapping flushes would send the same move twice.
  const flushing = new Map<string, Promise<void>>();

  return (set, get) => {
    const load = (learnerAuthId: string): WorksheetCacheRecord | null => readCacheRecord(storage, learnerAuthId);

    const commit = (record: WorksheetCacheRecord | null, learnerAuthId: string, status: WorksheetSyncStatus) => {
      if (record === null) {
        storage.remove(worksheetKeyFor(learnerAuthId));
        set({ current: null, ownerId: learnerAuthId, pending: [], status });
        return;
      }
      writeCacheRecord(storage, record);
      set({ current: replay(record, now()), ownerId: learnerAuthId, pending: record.pending, status });
    };

    const flushOnce = async (learnerAuthId: string): Promise<void> => {
      let record = load(learnerAuthId);
      while (record !== null && record.pending.length > 0) {
        const move = record.pending[0]!;
        try {
          const result = await client.advance(record.confirmed.submissionId, move);
          const rest = record.pending.slice(1);
          const confirmed = adoptCursor(applyMove(record.confirmed, move, now()), result);
          record = { ...record, confirmed, pending: rest };
          commit(record, learnerAuthId, rest.length === 0 ? 'confirmed' : 'pending');
        } catch (error) {
          if (error instanceof StaleCursorError) {
            // Another device moved first. Its cursor wins; every local move after
            // the refused one assumed the old cursor, so they go too.
            record = { ...record, confirmed: adoptCursor(record.confirmed, error.current), pending: [] };
            commit(record, learnerAuthId, 'reconciled');
            try {
              const fresh = await client.getSubmission(record.confirmed.submissionId);
              record = { ...record, confirmed: fresh };
              commit(record, learnerAuthId, 'reconciled');
            } catch {
              // The cursor is already the server's; the outcomes refresh on the next hydrate.
            }
            return;
          }
          commit(record, learnerAuthId, isRetryableError(error) ? 'pending' : 'error');
          return;
        }
      }
    };

    const flush = (learnerAuthId: string): Promise<void> => {
      const inFlight = flushing.get(learnerAuthId);
      if (inFlight !== undefined) return inFlight;
      const run = flushOnce(learnerAuthId).finally(() => {
        flushing.delete(learnerAuthId);
      });
      flushing.set(learnerAuthId, run);
      return run;
    };

    const migrateV1 = async (learnerAuthId: string): Promise<WorksheetCacheRecord | null> => {
      const v1 = readWorksheet(storage, learnerAuthId);
      if (v1 === null) return null;
      // Throws offline; the v1 key stays for the next hydrate.
      const view = await client.createSubmission(migrationFrom(v1));
      const pending: AdvanceInput[] = [];
      for (let i = view.currentIndex; i < v1.currentIndex && i < view.questions.length - 1; i += 1) {
        pending.push({
          fromQuestionId: view.questions[i]!.questionId,
          expectedIndex: i,
          outcome: 'unresolved',
          attempts: 0,
          hintsUsed: 0,
          misconceptionTags: [],
        });
      }
      const record: WorksheetCacheRecord = { schemaVersion: 2, learnerAuthId, confirmed: view, pending };
      writeCacheRecord(storage, record);
      clearWorksheet(storage, learnerAuthId);
      return record;
    };

    return {
      current: null,
      ownerId: null,
      pending: [],
      status: 'idle',

      restore: (learnerAuthId) => {
        const record = load(learnerAuthId);
        const current = record === null ? null : replay(record, now());
        set({
          current,
          ownerId: learnerAuthId,
          pending: record?.pending ?? [],
          status: record === null ? 'idle' : record.pending.length > 0 ? 'pending' : 'confirmed',
        });
        return current;
      },

      hydrate: async (learnerAuthId, submissionId) => {
        if (!learnerAuthId) return null;
        if (get().ownerId !== learnerAuthId) get().restore(learnerAuthId);
        let record = load(learnerAuthId);
        if (record === null) {
          try {
            record = await migrateV1(learnerAuthId);
          } catch {
            set({ status: 'pending' });
            return null;
          }
          if (record === null) return null;
          get().restore(learnerAuthId);
        }
        if (submissionId !== undefined && submissionId !== record.confirmed.submissionId) return get().current;

        await flush(learnerAuthId);
        record = load(learnerAuthId);
        if (record === null || record.pending.length > 0) return get().current;

        const before = get().status;
        try {
          const fresh = await client.getSubmission(record.confirmed.submissionId);
          commit({ ...record, confirmed: fresh }, learnerAuthId, before === 'reconciled' ? 'reconciled' : 'confirmed');
        } catch (error) {
          // The row is gone (erased, or never this learner's): the cache must not outlive it.
          if (error instanceof ApiError && error.status === 404) commit(null, learnerAuthId, 'idle');
        }
        return get().current;
      },

      begin: async (learnerAuthId, input) => {
        set({ status: 'syncing' });
        try {
          const view = await client.createSubmission(input);
          // A new worksheet replaces whatever this learner had on the device, v1 included.
          clearWorksheet(storage, learnerAuthId);
          commit({ schemaVersion: 2, learnerAuthId, confirmed: view, pending: [] }, learnerAuthId, 'confirmed');
          return view;
        } catch (error) {
          set({ status: 'error' });
          throw error;
        }
      },

      start: async (tutorSessionId) => {
        const { ownerId } = get();
        if (ownerId === null) return;
        const record = load(ownerId);
        if (record === null || record.confirmed.tutorSessionId === tutorSessionId) return;
        try {
          const view = await client.startSubmission(record.confirmed.submissionId, { tutorSessionId });
          const latest = load(ownerId) ?? record;
          commit({ ...latest, confirmed: { ...latest.confirmed, tutorSessionId: view.tutorSessionId } }, ownerId, get().status);
        } catch {
          // Unlinked is not wrong, only less useful to the report; the screen retries on its next session id.
        }
      },

      advance: async (input) => {
        const { ownerId, current } = get();
        if (ownerId === null || current === null || current.status === 'complete') return get().status;
        const record = load(ownerId);
        if (record === null) return get().status;
        const move: AdvanceInput = {
          ...input,
          fromQuestionId: current.currentQuestionId,
          expectedIndex: current.currentIndex,
        };
        commit({ ...record, pending: [...record.pending, move] }, ownerId, 'pending');
        await flush(ownerId);
        return get().status;
      },

      revise: async (questionId, input) => {
        const { ownerId } = get();
        const record = ownerId === null ? null : load(ownerId);
        if (ownerId === null || record === null) throw new Error('No homework submission is loaded');
        const question = await client.reviseQuestion(record.confirmed.submissionId, questionId, input);
        const latest = load(ownerId) ?? record;
        const confirmed = {
          ...latest.confirmed,
          questions: latest.confirmed.questions.map((q) => (q.questionId === questionId ? question : q)),
        };
        commit({ ...latest, confirmed }, ownerId, get().status);
        return question;
      },

      clear: (learnerAuthId) => {
        clearWorksheet(storage, learnerAuthId);
        storage.remove(worksheetKeyFor(learnerAuthId));
        set({ current: null, ownerId: learnerAuthId, pending: [], status: 'idle' });
      },
    };
  };
}
