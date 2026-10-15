// The pure half of the guardian homework timeline: date grouping and the
// outcome-to-words mapping. No React, no fetch, so `node --test` can hold it.
//
// Six outcomes become six phrases a parent can read without a legend. Every
// phrase describes what the child DID, never how well: there is no percentage,
// no grade, no "correct" (CONTRIBUTING.md §Children's surfaces; the honesty lint
// in ../summary/honesty.ts bans the same words in narratives). "Unresolved"
// stays "still working on it" rather than "wrong" because a question the
// tutor could not close is a question still open, not a verdict on the child.
//
// The server already orders summaries newest first (contract §Routes). Grouping
// keeps that order and only inserts the date boundaries, so a row never moves
// relative to its neighbours between the list and the server's answer.
// SOT: docs/work/pr-100/contract.md §Routes · docs/design/homework-end-to-end-2026.md §Accuracy · packages/app/features/homework/homework.types.ts
// SOT-KEYWORDS: homework timeline grouping local date outcome words guardian pure

import type { HomeworkSubmissionSummary, QuestionOutcome } from './homework.types.ts';

/**
 * Display order for the six counts. Finished work first because a parent
 * glancing at a row wants to know what got done, then what is still open.
 * `unattempted` is last: it is the remainder, and it is zero once a sheet is
 * complete.
 */
export const OUTCOME_ORDER: readonly QuestionOutcome[] = [
  'solved-independently',
  'supported-with-hints',
  'attempted',
  'skipped',
  'unresolved',
  'unattempted',
];

/**
 * One phrase per outcome in the guardian voice. Spelled out in full rather
 * than built from a suffix so a translator (or a reviewer) sees the sentence
 * that reaches the screen.
 */
export const OUTCOME_WORDS: Record<QuestionOutcome, string> = {
  'solved-independently': 'solved on their own',
  'supported-with-hints': 'solved with hints',
  attempted: 'tried, not finished',
  skipped: 'skipped',
  unresolved: 'still working on it',
  unattempted: 'not started',
};

export interface OutcomeLine {
  readonly outcome: QuestionOutcome;
  readonly count: number;
  /** e.g. "3 solved on their own". */
  readonly text: string;
}

/**
 * The counts a row shows, as sentences, in `OUTCOME_ORDER`, zero counts
 * dropped. A sheet with every question unattempted therefore shows one line,
 * "10 not started", and never a wall of zeros.
 */
export function outcomeLines(
  outcomes: Readonly<Partial<Record<QuestionOutcome, number>>>,
): OutcomeLine[] {
  const lines: OutcomeLine[] = [];
  for (const outcome of OUTCOME_ORDER) {
    const count = outcomes[outcome] ?? 0;
    if (count <= 0) continue;
    lines.push({ outcome, count, text: `${String(count)} ${OUTCOME_WORDS[outcome]}` });
  }
  return lines;
}

/** "10 questions" / "1 question". */
export function questionCountText(count: number): string {
  return `${String(count)} ${count === 1 ? 'question' : 'questions'}`;
}

export interface TimelineGroup {
  /** `YYYY-MM-DD`, the learner's local calendar date. */
  readonly localDate: string;
  readonly rows: readonly HomeworkSubmissionSummary[];
}

/**
 * Groups by `localDate`, preserving the incoming order of both dates and rows.
 * A summary whose `localDate` is not a `YYYY-MM-DD` string is kept under its
 * own key rather than dropped: a parent must never lose a row to a formatting
 * slip on the server.
 */
export function groupByLocalDate(
  rows: readonly HomeworkSubmissionSummary[],
): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  const index = new Map<string, HomeworkSubmissionSummary[]>();
  for (const row of rows) {
    let bucket = index.get(row.localDate);
    if (!bucket) {
      bucket = [];
      index.set(row.localDate, bucket);
      groups.push({ localDate: row.localDate, rows: bucket });
    }
    bucket.push(row);
  }
  return groups;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` of a Date in the reader's local zone. */
export function toLocalDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * A local calendar date (`YYYY-MM-DD`) as the reader's own wall-clock date, so
 * a sheet done on the 14th in Denver is never shown as the 15th on a parent's
 * phone in New York. Returns null for anything that is not a calendar date.
 */
export function parseLocalDate(localDate: string): Date | null {
  const m = ISO_DATE.exec(localDate);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  // `new Date(2026, 12, 45)` rolls over silently; a key that does not read
  // back as itself was never a calendar date.
  return toLocalDateKey(date) === localDate ? date : null;
}

/**
 * The date header a group gets. "Today" and "Yesterday" for the two days a
 * parent checks most; a full weekday and date for anything older, with the
 * year only once it differs from `today`'s. `today` is a parameter so the
 * mapping is testable and so a list rendered across midnight relabels on the
 * next render rather than freezing at mount.
 */
export function dateHeading(localDate: string, today: Date, locale?: string): string {
  const date = parseLocalDate(localDate);
  if (date === null) return localDate;
  const todayKey = toLocalDateKey(today);
  if (localDate === todayKey) return 'Today';
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (localDate === toLocalDateKey(yesterday)) return 'Yesterday';
  const sameYear = date.getFullYear() === today.getFullYear();
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(date);
}
