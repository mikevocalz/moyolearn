// The homework record a server owns and a device caches.
//
// A worksheet lives in `homeworkSubmissions`; each question is its own row in
// `homeworkQuestions` with an append-only revision list. Identity is absent
// from every shape here: `learnerAuthId` is set from `ctx` at the service
// boundary (CONTRIBUTING.md §The block). A guardian uploading for a child names
// the child by `forLearnerAuthId` on the request, and the server accepts it only
// when an ACTIVE guardianship exists for the caller.
//
// A revision is a transcription the learner or guardian confirmed. It is not a
// grade. `evaluationReady` on the issued `edu.questions` row stays false for a
// photographed page (ADR-119), so the evaluator refuses to grade it.
// SOT: docs/design/homework-end-to-end-2026.md · docs/work/pr-100/contract.md · docs/decisions/adr-119-graded-turns-need-a-locked-revision.md
// SOT-KEYWORDS: homework submission question revision cursor outcome crop retention guardian ward

/** Who authored a transcription revision. */
export type RevisionAuthor = 'ocr' | 'learner' | 'guardian';

/** Work present before tutoring; never a learning outcome or a correctness claim. */
export type PriorWork = 'none' | 'partial' | 'complete';

/** A guardian-confirmed mark in {@linkcode HomeworkQuestionView.priorWorkRevisions}. */
export interface PriorWorkRevision {
  /** Work the guardian saw before tutoring. */
  readonly priorWork: PriorWork;
  /** Set by the server after checking guardian access. */
  readonly source: 'guardian';
  /** Server timestamp in ISO 8601 format. */
  readonly createdAt: string;
}

/** One transcription of one question. Append-only; the newest is current. */
export interface QuestionRevision {
  readonly revision: string;
  readonly text: string;
  readonly author: RevisionAuthor;
  /** OCR confidence in [0,1] for `ocr` revisions; null for human ones. */
  readonly confidence: number | null;
  readonly createdAt: string;
}

/**
 * The six states the acceptance contract distinguishes. There is no
 * `graded` arm: a confirmed transcription never becomes a score.
 */
export type QuestionOutcome =
  | 'unattempted'
  | 'skipped'
  | 'attempted'
  | 'supported-with-hints'
  | 'solved-independently'
  | 'unresolved';

/** The source crop a question was read from. Expires 7 days after capture. */
export interface QuestionCrop {
  readonly storageKey: string;
  readonly width: number;
  readonly height: number;
  readonly expiresAt: string;
}

export interface HomeworkQuestionView {
  readonly questionId: string;
  readonly orderIndex: number;
  readonly sourcePage: number;
  readonly sourceNumber: number | null;
  readonly currentRevision: string;
  readonly text: string;
  readonly revisions: readonly QuestionRevision[];
  /** null once the crop expired or when the question was typed. */
  readonly crop: QuestionCrop | null;
  /** Optional only for caches saved before prior-work marks existed; absent means none. */
  readonly priorWork?: PriorWork;
  /** null for guardian marks; no detection confidence is invented. */
  readonly priorWorkConfidence?: number | null;
  /** Origin of the current mark, separate from transcription authorship. */
  readonly priorWorkSource?: 'guardian' | 'detected' | null;
  /** Append-only mark history; contains no images or guardian identity. */
  readonly priorWorkRevisions?: readonly PriorWorkRevision[];
  readonly outcome: QuestionOutcome;
  readonly attempts: number;
  readonly hintsUsed: number;
  readonly misconceptionTags: readonly string[];
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export type SubmissionStatus = 'reviewing' | 'ready' | 'in-progress' | 'complete' | 'abandoned';

/** OCR pipeline state, per submission. `failed` keeps the pages for retry. */
export type PipelineStatus = 'pending' | 'extracting' | 'extracted' | 'failed';

export interface HomeworkSubmissionView {
  readonly submissionId: string;
  readonly learnerAuthId: string;
  readonly createdByAuthId: string;
  readonly subject: string;
  readonly title: string;
  readonly instructions: string;
  /** The learner's local calendar date, `YYYY-MM-DD`. */
  readonly localDate: string;
  readonly status: SubmissionStatus;
  readonly pipelineStatus: PipelineStatus;
  readonly pipelineError: string | null;
  /** Server-owned cursor. The only thing `advance` moves. */
  readonly currentIndex: number;
  readonly currentQuestionId: string;
  readonly tutorSessionId: string | null;
  readonly questions: readonly HomeworkQuestionView[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** One row of a guardian's or learner's dated timeline. */
export interface HomeworkSubmissionSummary {
  readonly submissionId: string;
  readonly learnerAuthId: string;
  readonly subject: string;
  readonly title: string;
  readonly localDate: string;
  readonly status: SubmissionStatus;
  readonly questionCount: number;
  /** Problems marked complete before tutoring; absent in older cached timelines. */
  readonly alreadyDoneCount?: number;
  readonly currentIndex: number;
  readonly outcomes: Readonly<Record<QuestionOutcome, number>>;
  readonly tutorSessionId: string | null;
  readonly createdAt: string;
}

export interface QuestionToCreate {
  /** Client-minted, used to make `POST /submissions` idempotent per question. */
  readonly clientId: string;
  readonly sourcePage: number;
  readonly sourceNumber: number | null;
  readonly text: string;
  readonly confidence: number | null;
  readonly crop: Omit<QuestionCrop, 'expiresAt'> | null;
  /** Accepted only from an authenticated guardian acting for an active ward. */
  readonly priorWork?: PriorWork;
}

export interface CreateSubmissionInput {
  /** Client-minted UUID. A retry with the same id returns the existing row. */
  readonly submissionId: string;
  readonly subject: string;
  readonly title: string;
  readonly instructions: string;
  readonly localDate: string;
  readonly questions: readonly QuestionToCreate[];
  /** Guardian upload: the ward. Omitted means the caller is the learner. */
  readonly forLearnerAuthId?: string;
}

/** Revise a transcription or a guardian mark separately; marks are prestart-only. */
export type ReviseQuestionInput =
  | { readonly text: string; readonly author: Exclude<RevisionAuthor, 'ocr'> }
  | { readonly priorWork: PriorWork; readonly author: 'guardian' };

/**
 * Atomic cursor move. The server records `fromQuestionId`'s outcome and
 * advances `currentIndex` in one transaction, or rejects with `409` when
 * `expectedIndex` no longer matches (another device moved first).
 */
export interface AdvanceInput {
  readonly fromQuestionId: string;
  readonly expectedIndex: number;
  readonly outcome: Exclude<QuestionOutcome, 'unattempted'>;
  readonly attempts: number;
  readonly hintsUsed: number;
  readonly misconceptionTags: readonly string[];
}

export interface AdvanceResult {
  readonly currentIndex: number;
  readonly currentQuestionId: string;
  readonly status: SubmissionStatus;
}

export interface StartSubmissionInput {
  readonly tutorSessionId: string;
}

/** An item in a guardian-reviewed practice set. The key is guardian-only. */
export interface PracticeItem {
  readonly id: string;
  readonly skillTag: string;
  readonly prompt: string;
  /** Exact answer in the form `checkExactMath` accepts. */
  readonly answer: string;
  readonly checkerVersion: string;
}

export type PracticeSetStatus = 'draft' | 'approved';

export interface PracticeSetView {
  readonly practiceSetId: string;
  readonly submissionId: string;
  readonly learnerAuthId: string;
  readonly status: PracticeSetStatus;
  readonly seed: string;
  readonly targetedTags: readonly string[];
  readonly items: readonly PracticeItem[];
  readonly createdAt: string;
}
