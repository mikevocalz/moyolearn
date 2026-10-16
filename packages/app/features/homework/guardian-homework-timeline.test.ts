import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { homeworkTimelineOptions, homeworkTimelineQueryKey } from './use-homework-timeline.ts';
import type { HomeworkSubmissionSummary, QuestionOutcome } from './homework.types.ts';
import {
  OUTCOME_ORDER,
  OUTCOME_WORDS,
  dateHeading,
  groupByLocalDate,
  outcomeLines,
  parseLocalDate,
  questionCountText,
  toLocalDateKey,
} from './timeline-groups.ts';

const zero: Record<QuestionOutcome, number> = {
  unattempted: 0,
  skipped: 0,
  attempted: 0,
  'supported-with-hints': 0,
  'solved-independently': 0,
  unresolved: 0,
};

const row = (
  submissionId: string,
  localDate: string,
  outcomes: Partial<Record<QuestionOutcome, number>> = {},
): HomeworkSubmissionSummary => ({
  submissionId,
  learnerAuthId: 'ward-1',
  subject: 'Math',
  title: 'Fractions, page 12',
  localDate,
  status: 'in-progress',
  questionCount: 10,
  currentIndex: 3,
  outcomes: { ...zero, ...outcomes },
  tutorSessionId: null,
  createdAt: `${localDate}T20:00:00.000Z`,
});

test('switching children never shows the previous child’s rows while the new request is pending', async (t) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(homeworkTimelineQueryKey('ward-1'), [row('first-child-work', '2026-10-16')]);
  let finish: ((response: Response) => void) | undefined;
  const response = new Promise<Response>((resolve) => { finish = resolve; });
  t.mock.method(globalThis, 'fetch', () => response);
  const observer = new QueryObserver(client, homeworkTimelineOptions('ward-1'));
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => { unsubscribe(); client.clear(); });
  assert.equal(observer.getCurrentResult().data?.[0]?.submissionId, 'first-child-work');

  observer.setOptions(homeworkTimelineOptions('ward-2'));
  assert.equal(observer.getCurrentResult().data, undefined);
  assert.equal(observer.getCurrentResult().isPending, true);
  finish!(new Response('[]', { headers: { 'Content-Type': 'application/json' } }));
  const loaded = await observer.refetch();
  assert.deepEqual(loaded.data, []);
});

test('groups by localDate and keeps the server order inside and across groups', () => {
  const rows = [
    row('c', '2026-10-15'),
    row('b', '2026-10-15'),
    row('a', '2026-10-13'),
    row('z', '2026-10-15'),
  ];
  const groups = groupByLocalDate(rows);
  assert.deepEqual(
    groups.map((g) => [g.localDate, g.rows.map((r) => r.submissionId)]),
    [
      ['2026-10-15', ['c', 'b', 'z']],
      ['2026-10-13', ['a']],
    ],
  );
  assert.deepEqual(groupByLocalDate([]), []);
});

test('a malformed localDate keeps its row under its own key instead of dropping it', () => {
  const groups = groupByLocalDate([row('x', 'not-a-date')]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.rows[0]?.submissionId, 'x');
  assert.equal(dateHeading('not-a-date', new Date(2026, 9, 15)), 'not-a-date');
});

test('every outcome maps to words with no percentage, grade or "correct"', () => {
  const banned = /%|grade|correct|wrong|score|right/i;
  for (const outcome of OUTCOME_ORDER) {
    assert.ok(OUTCOME_WORDS[outcome].length > 0, outcome);
    assert.doesNotMatch(OUTCOME_WORDS[outcome], banned, outcome);
  }
  // All six arms are covered, in the order a parent reads them.
  assert.deepEqual(
    [...OUTCOME_ORDER].sort(),
    (Object.keys(OUTCOME_WORDS) as QuestionOutcome[]).sort(),
  );
});

test('outcome lines drop zero counts and read as count plus phrase', () => {
  const lines = outcomeLines({
    'solved-independently': 4,
    'supported-with-hints': 2,
    unresolved: 1,
    unattempted: 3,
  });
  assert.deepEqual(
    lines.map((l) => l.text),
    ['4 solved on their own', '2 solved with hints', '1 still working on it', '3 not started'],
  );
  assert.deepEqual(outcomeLines(zero), []);
  assert.deepEqual(outcomeLines({ unattempted: 10 }).map((l) => l.text), ['10 not started']);
});

test('question count pluralises', () => {
  assert.equal(questionCountText(1), '1 question');
  assert.equal(questionCountText(10), '10 questions');
});

test('date headings: today, yesterday, then weekday and date; year only when it differs', () => {
  const today = new Date(2026, 9, 15); // Thursday 15 October 2026, local
  assert.equal(dateHeading('2026-10-15', today), 'Today');
  assert.equal(dateHeading('2026-10-14', today), 'Yesterday');
  assert.equal(dateHeading('2026-10-13', today, 'en-US'), 'Tuesday, October 13');
  assert.equal(dateHeading('2025-12-31', today, 'en-US'), 'Wednesday, December 31, 2025');
});

test('local dates round-trip in the reader zone and never shift a day', () => {
  const parsed = parseLocalDate('2026-03-01');
  assert.ok(parsed);
  assert.equal(parsed.getDate(), 1);
  assert.equal(parsed.getMonth(), 2);
  assert.equal(toLocalDateKey(parsed), '2026-03-01');
  assert.equal(parseLocalDate('2026-13-45'), null);
  assert.equal(parseLocalDate('2026/03/01'), null);
});
