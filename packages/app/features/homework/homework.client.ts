// Typed calls to the homework submission routes, shared by phone and browser.
//
// Failures keep their status as data (`ApiError`), the same convention as
// `core/api-fetch.ts`, so the worksheet cache can tell a settled refusal from a
// dropped connection. A transport failure is rethrown untouched: it has no
// status, and `isRetryableError` already reads that as "try again later".
//
// The advance route has one 409 that is not an error to the learner: another
// device moved the cursor first. It becomes `StaleCursorError` carrying the
// server's cursor, so the caller can adopt it instead of guessing. The create
// route's 409 (`submission-conflict`, an id owned by someone else) stays an
// `ApiError`, because there is nothing to adopt.
//
// No identity in any body. `forLearnerAuthId` names the ward on a guardian
// upload; the server accepts it only for an active guardianship.
// SOT: docs/work/pr-100/contract.md §Routes · packages/app/features/homework/homework.types.ts · packages/app/core/api-fetch.ts
// SOT-KEYWORDS: homework client fetch submission create start advance revise stale cursor 409 reconcile practice print authorization
import { ApiError } from '../../core/api-fetch.ts';
import { API_URL } from '../../core/api-url.ts';
import type {
  AdvanceInput,
  AdvanceResult,
  CreateSubmissionInput,
  HomeworkQuestionView,
  HomeworkSubmissionSummary,
  HomeworkSubmissionView,
  ReviseQuestionInput,
  StartSubmissionInput,
} from './homework.types.ts';
import type { PracticeSheetMode } from './practice-sheet-html.ts';

/** The advance route refused because the cursor moved since `expectedIndex` was read. */
export class StaleCursorError extends Error {
  /** Where the server's cursor actually is. Nothing was written for the refused move. */
  readonly current: AdvanceResult;

  constructor(current: AdvanceResult) {
    super('stale-cursor');
    this.name = 'StaleCursorError';
    this.current = current;
  }
}

export interface HomeworkClient {
  createSubmission: (input: CreateSubmissionInput) => Promise<HomeworkSubmissionView>;
  /** The current learner's server-owned worksheets, newest first; no identity argument. */
  listSubmissions: () => Promise<HomeworkSubmissionSummary[]>;
  getSubmission: (submissionId: string) => Promise<HomeworkSubmissionView>;
  reviseQuestion: (
    submissionId: string,
    questionId: string,
    input: ReviseQuestionInput,
  ) => Promise<HomeworkQuestionView>;
  startSubmission: (submissionId: string, input: StartSubmissionInput) => Promise<HomeworkSubmissionView>;
  /** Rejects with {@link StaleCursorError} on a stale cursor, {@link ApiError} on any other non-2xx. */
  advance: (submissionId: string, input: AdvanceInput) => Promise<AdvanceResult>;
}

type FetchPort = (url: string, init: RequestInit) => Promise<Response>;

function isAdvanceResult(value: unknown): value is AdvanceResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<AdvanceResult>;
  return Number.isInteger(v.currentIndex) && typeof v.currentQuestionId === 'string' &&
    typeof v.status === 'string';
}

async function readStaleCursor(response: Response): Promise<AdvanceResult | null> {
  try {
    const body = (await response.json()) as { error?: unknown; current?: unknown };
    return body.error === 'stale-cursor' && isAdvanceResult(body.current) ? body.current : null;
  } catch {
    return null;
  }
}

const segment = (id: string) => encodeURIComponent(id);

export const practicePrintPath = (practiceSetId: string, mode: PracticeSheetMode): string =>
  `/api/guardian/practice-sets/${segment(practiceSetId)}/print?mode=${mode}`;

/**
 * Native printing uses the same fresh guardianship and approval check as web.
 * A cached preview is not authority to export a key after access is revoked.
 */
export async function loadPracticePrintHtml(
  practiceSetId: string,
  mode: PracticeSheetMode,
  fetchPort: FetchPort = (url, init) => fetch(url, init),
  baseUrl: string = API_URL,
): Promise<string> {
  const response = await fetchPort(`${baseUrl}${practicePrintPath(practiceSetId, mode)}`, {
    credentials: 'include',
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok) throw new ApiError(response.status);
  if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'text/html') {
    throw new Error('Expected practice print HTML');
  }
  return response.text();
}

export function createHomeworkClient(
  fetchPort: FetchPort = (url, init) => fetch(url, init),
  baseUrl: string = API_URL,
): HomeworkClient {
  const submissions = `${baseUrl}/api/homework/submissions`;

  async function send<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetchPort(url, body === undefined
      ? { credentials: 'include' }
      : {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
    if (!response.ok) throw new ApiError(response.status);
    return (await response.json()) as T;
  }

  return {
    createSubmission: (input) => send(submissions, input),
    listSubmissions: () => send(submissions),
    getSubmission: (submissionId) => send(`${submissions}/${segment(submissionId)}`),
    reviseQuestion: (submissionId, questionId, input) =>
      send(`${submissions}/${segment(submissionId)}/questions/${segment(questionId)}/revise`, input),
    startSubmission: (submissionId, input) => send(`${submissions}/${segment(submissionId)}/start`, input),
    advance: async (submissionId, input) => {
      const response = await fetchPort(`${submissions}/${segment(submissionId)}/advance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (response.status === 409) {
        const current = await readStaleCursor(response);
        if (current !== null) throw new StaleCursorError(current);
      }
      if (!response.ok) throw new ApiError(response.status);
      return (await response.json()) as AdvanceResult;
    },
  };
}

export const homeworkClient: HomeworkClient = createHomeworkClient();
