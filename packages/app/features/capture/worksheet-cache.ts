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
    if (!isSubmissionView(decoded.confirmed) ||
        decoded.confirmed.learnerAuthId !== learnerAuthId || !Array.isArray(decoded.pending)) return null;
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

/**
 * Whether the live tutor problem is this worksheet's CURRENT question.
 * Prompt text alone cannot decide: one worksheet can carry the same wording
 * twice, and "2 + 2 =" under a later question's cursor is not question 1.
 * When the prompt is ambiguous the server-issued evidence handle
 * (questionId + currentRevision, written by `presentWorksheetQuestion`) is the
 * only reliable identity. An unambiguous prompt still matches without evidence
 * so a session started before evidence existed keeps working.
 */
export function isCurrentWorksheetQuestion(
  view: HomeworkSubmissionView,
  prompt: string | null,
  evidence: { questionId: string; revision: string } | null | undefined,
): boolean {
  const wanted = prompt?.trim();
  if (!wanted) return false;
  const current = view.questions[view.currentIndex];
  if (!current || view.status === 'complete') return false;
  if (questionForTutor(toWorksheetQuestion(current), view).trim() !== wanted) return false;
  const ambiguous = view.questions.some(
    (question, index) =>
      index !== view.currentIndex &&
      questionForTutor(toWorksheetQuestion(question), view).trim() === wanted,
  );
  if (!ambiguous) return true;
  return (
    evidence != null &&
    evidence.questionId === current.questionId &&
    evidence.revision === current.currentRevision
  );
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
  const flushing = new Map<number, Promise<void>>();

  return (set, get) => {
    let selectionEpoch = 0;
    const load = (learnerAuthId: string): WorksheetCacheRecord | null => readCacheRecord(storage, learnerAuthId);
    const isSelected = (learnerAuthId: string, epoch: number) =>
      selectionEpoch === epoch && get().ownerId === learnerAuthId;

    const commit = (record: WorksheetCacheRecord | null, learnerAuthId: string, status: WorksheetSyncStatus, epoch: number) => {
      if (!isSelected(learnerAuthId, epoch)) return;
      if (record === null) {
        storage.remove(worksheetKeyFor(learnerAuthId));
        set({ current: null, ownerId: learnerAuthId, pending: [], status });
        return;
      }
      writeCacheRecord(storage, record);
      set({ current: replay(record, now()), ownerId: learnerAuthId, pending: record.pending, status });
    };

    const flushOnce = async (learnerAuthId: string, epoch: number): Promise<void> => {
      let record = load(learnerAuthId);
      while (isSelected(learnerAuthId, epoch) && record !== null && record.pending.length > 0) {
        const move = record.pending[0]!;
        try {
          const result = await client.advance(record.confirmed.submissionId, move);
          if (!isSelected(learnerAuthId, epoch)) return;
          const rest = record.pending.slice(1);
          const confirmed = adoptCursor(applyMove(record.confirmed, move, now()), result);
          record = { ...record, confirmed, pending: rest };
          commit(record, learnerAuthId, rest.length === 0 ? 'confirmed' : 'pending', epoch);
        } catch (error) {
          if (!isSelected(learnerAuthId, epoch)) return;
          if (error instanceof StaleCursorError) {
            // Another device moved first. Its cursor wins; every local move after
            // the refused one assumed the old cursor, so they go too.
            record = { ...record, confirmed: adoptCursor(record.confirmed, error.current), pending: [] };
            commit(record, learnerAuthId, 'reconciled', epoch);
            try {
              const fresh = await client.getSubmission(record.confirmed.submissionId);
              if (!isSelected(learnerAuthId, epoch)) return;
              record = { ...record, confirmed: fresh };
              commit(record, learnerAuthId, 'reconciled', epoch);
            } catch {
              // The cursor is already the server's; the outcomes refresh on the next hydrate.
            }
            return;
          }
          commit(record, learnerAuthId, isRetryableError(error) ? 'pending' : 'error', epoch);
          return;
        }
      }
    };

    const flush = (learnerAuthId: string, epoch: number): Promise<void> => {
      const inFlight = flushing.get(epoch);
      if (inFlight !== undefined) return inFlight;
      const run = flushOnce(learnerAuthId, epoch).finally(() => {
        flushing.delete(epoch);
      });
      flushing.set(epoch, run);
      return run;
    };

    const migrateV1 = async (learnerAuthId: string, epoch: number): Promise<WorksheetCacheRecord | null> => {
      const v1 = readWorksheet(storage, learnerAuthId);
      if (v1 === null) return null;
      // Throws offline; the v1 key stays for the next hydrate.
      const view = await client.createSubmission(migrationFrom(v1));
      if (!isSelected(learnerAuthId, epoch) || view.learnerAuthId !== learnerAuthId) return null;
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
        selectionEpoch += 1;
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
        const epoch = selectionEpoch;
        let record = load(learnerAuthId);
        if (record === null) {
          set({ status: 'syncing' });
          try {
            record = await migrateV1(learnerAuthId, epoch);
          } catch (error) {
            if (isSelected(learnerAuthId, epoch)) {
              set({ status: isRetryableError(error) ? 'pending' : 'error' });
            }
            return null;
          }
          if (!isSelected(learnerAuthId, epoch)) return null;
          if (record !== null) {
            commit(record, learnerAuthId, record.pending.length > 0 ? 'pending' : 'confirmed', epoch);
          } else {
            try {
              // A guardian assignment never visited this device; discover it
              // from the server rather than treating an empty cache as no work.
              const submissions = await client.listSubmissions();
              if (!isSelected(learnerAuthId, epoch)) return null;
              const owned = submissions.filter((s) => s.learnerAuthId === learnerAuthId);
              const selected = submissionId === undefined
                ? owned.find((s) => s.status === 'in-progress') ?? owned.find((s) => s.status === 'ready')
                : owned.find((s) => s.submissionId === submissionId);
              if (!selected) {
                set({ status: 'idle' });
                return null;
              }
              const fresh = await client.getSubmission(selected.submissionId);
              if (!isSelected(learnerAuthId, epoch)) return null;
              if (fresh.learnerAuthId !== learnerAuthId) throw new ApiError(403);
              commit({ schemaVersion: 2, learnerAuthId, confirmed: fresh, pending: [] }, learnerAuthId, 'confirmed', epoch);
              return get().current;
            } catch (error) {
              if (isSelected(learnerAuthId, epoch)) {
                set({ status: isRetryableError(error) ? 'pending' : 'error' });
              }
              return null;
            }
          }
        }
        if (submissionId !== undefined && submissionId !== record.confirmed.submissionId) return get().current;

        await flush(learnerAuthId, epoch);
        if (!isSelected(learnerAuthId, epoch)) return null;
        record = load(learnerAuthId);
        if (record === null || record.pending.length > 0) return get().current;

        const before = get().status;
        try {
          const fresh = await client.getSubmission(record.confirmed.submissionId);
          if (!isSelected(learnerAuthId, epoch)) return null;
          if (fresh.learnerAuthId !== learnerAuthId) throw new ApiError(403);
          commit({ ...record, confirmed: fresh }, learnerAuthId, before === 'reconciled' ? 'reconciled' : 'confirmed', epoch);
        } catch (error) {
          if (!isSelected(learnerAuthId, epoch)) return null;
          // The row is gone (erased, or never this learner's): the cache must not outlive it.
          if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
            commit(null, learnerAuthId, 'idle', epoch);
          } else {
            set({ status: isRetryableError(error) ? 'pending' : 'error' });
          }
        }
        return get().current;
      },

      begin: async (learnerAuthId, input) => {
        if (load(learnerAuthId)?.pending.length) throw new Error('The previous worksheet is still syncing');
        get().restore(learnerAuthId);
        const epoch = selectionEpoch;
        set({ status: 'syncing' });
        try {
          const view = await client.createSubmission(input);
          if (!isSelected(learnerAuthId, epoch)) throw new Error('The selected learner changed');
          if (view.learnerAuthId !== learnerAuthId) throw new ApiError(403);
          // A new worksheet replaces whatever this learner had on the device, v1 included.
          clearWorksheet(storage, learnerAuthId);
          commit({ schemaVersion: 2, learnerAuthId, confirmed: view, pending: [] }, learnerAuthId, 'confirmed', epoch);
          return view;
        } catch (error) {
          if (isSelected(learnerAuthId, epoch)) set({ status: 'error' });
          throw error;
        }
      },

      start: async (tutorSessionId) => {
        const { ownerId } = get();
        if (ownerId === null) return;
        const epoch = selectionEpoch;
        const record = load(ownerId);
        if (record === null || record.confirmed.tutorSessionId === tutorSessionId) return;
        try {
          const view = await client.startSubmission(record.confirmed.submissionId, { tutorSessionId });
          if (!isSelected(ownerId, epoch)) return;
          const latest = load(ownerId) ?? record;
          commit({ ...latest, confirmed: { ...latest.confirmed, tutorSessionId: view.tutorSessionId } }, ownerId, get().status, epoch);
        } catch {
          // Unlinked is not wrong, only less useful to the report; the screen retries on its next session id.
        }
      },

      advance: async (input) => {
        const { ownerId, current } = get();
        if (ownerId === null || current === null || current.status === 'complete') return get().status;
        const epoch = selectionEpoch;
        const record = load(ownerId);
        if (record === null) return get().status;
        const move: AdvanceInput = {
          ...input,
          fromQuestionId: current.currentQuestionId,
          expectedIndex: current.currentIndex,
        };
        commit({ ...record, pending: [...record.pending, move] }, ownerId, 'pending', epoch);
        await flush(ownerId, epoch);
        return get().status;
      },

      revise: async (questionId, input) => {
        const { ownerId } = get();
        const record = ownerId === null ? null : load(ownerId);
        if (ownerId === null || record === null) throw new Error('No homework submission is loaded');
        const epoch = selectionEpoch;
        const question = await client.reviseQuestion(record.confirmed.submissionId, questionId, input);
        if (!isSelected(ownerId, epoch)) throw new Error('The selected learner changed');
        const latest = load(ownerId) ?? record;
        const confirmed = {
          ...latest.confirmed,
          questions: latest.confirmed.questions.map((q) => (q.questionId === questionId ? question : q)),
        };
        commit({ ...latest, confirmed }, ownerId, get().status, epoch);
        return question;
      },

      clear: (learnerAuthId) => {
        clearWorksheet(storage, learnerAuthId);
        storage.remove(worksheetKeyFor(learnerAuthId));
        if (get().ownerId === learnerAuthId) {
          selectionEpoch += 1;
          set({ current: null, pending: [], status: 'idle' });
        }
      },
    };
  };
}
