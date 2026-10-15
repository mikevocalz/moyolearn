'use client';
// GuardianHomeworkTimeline — one child's homework, as a dated list.
//
// A date header, then one row per worksheet: subject and title first, the
// question count beside the date, and the six outcome counts written as words
// underneath. No bar, no percentage, no grade (docs/design/mobbin/parent-home.md
// §Refuse: "a percentage delta on a child's learning is a movement claim dressed
// as precision"). A parent reads "4 solved on their own · 2 solved with hints ·
// 1 still working on it" and knows what happened without a legend.
//
// Error before empty, the law `ReportsScreen` already keeps: "No homework yet"
// is a claim about a child's history and may only be made about an ANSWERED
// read. A failed fetch takes the failure branch, with a retry and a sentence
// about what did not happen.
//
// Pure helpers (grouping, outcome words, date headings) live in
// ./timeline-groups.ts so `node --test` can hold them without React.
// Mobbin: https://mobbin.com/screens/0f44880e-aa99-4055-89e2-056c52867c8f (Careem — activity list under "Today / Tuesday, 2 Sep" date headers, each row title then one-line detail) ·
//   https://mobbin.com/screens/e779c6a0-bcdf-47e5-ad1b-77d69d21efa0 (Headspace — history grouped by date rail, every row a title plus a small typed descriptor) ·
//   https://mobbin.com/screens/c20a7fbc-a50f-4f54-8d4f-4fec4bf84ca1 (Nike Run Club — month headers with a one-line roll-up, cards carry labelled counts rather than a bar). Structure only.
// SOT: docs/work/pr-100/contract.md §Routes · docs/design/homework-end-to-end-2026.md §Screen contract (Parent Daily Work) · docs/design/mobbin/homework-timeline.md
// SOT-KEYWORDS: guardian homework timeline dated list outcomes words subject title question count

import {
  Button,
  Card,
  EmptyState,
  LoadingSkeleton,
  ReadFailure,
  Text,
} from '@acme/ui';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { readFailureCopy } from '../../core/read-failure-copy.ts';
import type { HomeworkSubmissionSummary } from './homework.types.ts';
import {
  OUTCOME_WORDS,
  dateHeading,
  groupByLocalDate,
  outcomeLines,
  questionCountText,
} from './timeline-groups.ts';
import { useGuardianWards } from './use-guardian-wards.ts';
import { useHomeworkTimeline } from './use-homework-timeline.ts';

export interface GuardianHomeworkTimelineProps {
  /** The ward's auth id. Undefined renders the "pick a child" state. */
  learnerAuthId: string | undefined;
  /** The ward's display name, for the empty and failure sentences. */
  childName: string | undefined;
  /** Cap the rows (the home feed shows a few; the route shows all). */
  limit?: number;
  /** Rendered after the rows when `limit` cut the list. */
  onSeeAll?: () => void;
  /** Rendered inside the empty state. */
  onUpload?: () => void;
}

export function GuardianHomeworkTimeline({
  learnerAuthId,
  childName,
  limit,
  onSeeAll,
  onUpload,
}: GuardianHomeworkTimelineProps) {
  const { submissions, loading, error, retry } = useHomeworkTimeline(learnerAuthId);
  // Same query key as the header's read, so this is a cache subscription, not
  // a second request. It exists so "No child linked yet" is only said after
  // the wards read has ANSWERED with nobody: while it loads the row shows a
  // skeleton, and when it fails the header above already shows the failure.
  const wards = useGuardianWards();
  const name = childName ?? 'your child';

  if (learnerAuthId === undefined) {
    if (wards.loading) return <LoadingSkeleton variant="card" count={1} />;
    if (wards.error !== null) return null;
    return (
      <Card className="gap-stack">
        <TWText className="text-base text-text">No child linked yet</TWText>
        <TWText className="text-sm text-text-muted">
          Homework appears here once a child is linked to your account.
        </TWText>
      </Card>
    );
  }

  if (loading) {
    return <LoadingSkeleton variant="card" count={2} />;
  }

  if (error !== null && submissions.length === 0) {
    const copy = readFailureCopy(
      error,
      `${name}’s homework`,
      `Nothing has changed. Every worksheet ${name} has worked on is still on file.`,
    );
    return <ReadFailure title={copy.title} description={copy.description} onRetry={retry} />;
  }

  if (submissions.length === 0) {
    return (
      <EmptyState
        icon={<Text className="text-title">✎</Text>}
        title={`No homework for ${name} yet`}
        description={`When a worksheet is uploaded for ${name}, each day’s work lands here, question by question.`}
        action={
          onUpload ? (
            <Button title={`Upload work for ${name}`} variant="outline" onPress={onUpload} />
          ) : undefined
        }
      />
    );
  }

  const shown = limit === undefined ? submissions : submissions.slice(0, limit);
  const groups = groupByLocalDate(shown);
  const today = new Date();
  const truncated = shown.length < submissions.length;

  /*
    One list per date, each named by its heading, rather than one list wrapping
    sections: ARIA owns a listitem only from its parent list, and a section in
    between breaks that on web. A screen reader user hears "Today, heading",
    then "list, 2 items", then each worksheet as one sentence.
  */
  return (
    <View className="gap-group">
      {groups.map((group) => {
        const heading = dateHeading(group.localDate, today);
        return (
          <Section key={group.localDate} className="gap-stack">
            <TWText
              role="heading"
              aria-level={3}
              className="text-label uppercase tracking-wide text-text-muted"
            >
              {heading}
            </TWText>
            <View role="list" aria-label={`${name}’s homework, ${heading}`} className="gap-stack">
              {group.rows.map((row) => (
                <TimelineRow key={row.submissionId} row={row} />
              ))}
            </View>
          </Section>
        );
      })}
      {truncated && onSeeAll ? (
        <Button title="All homework" variant="ghost" className="self-start" onPress={onSeeAll} />
      ) : null}
    </View>
  );
}

/**
 * One worksheet. Reading order for a screen reader is the visual order:
 * subject and title, the count, then the outcome lines as one sentence, so
 * "Math. Fractions, page 12. 10 questions. 4 solved on their own, 2 solved with
 * hints, 1 still working on it." arrives in one swipe.
 */
function TimelineRow({ row }: { row: HomeworkSubmissionSummary }) {
  const lines = outcomeLines(row.outcomes);
  const outcomesSentence = lines.map((l) => l.text).join(', ');
  return (
    <Card
      role="listitem"
      className="gap-element"
      aria-label={`${row.subject}. ${row.title}. ${questionCountText(row.questionCount)}. ${
        outcomesSentence.length > 0 ? outcomesSentence : 'Not started'
      }.`}
    >
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-stack gap-y-0.5">
        <View className="min-w-0 flex-1 gap-0.5">
          <Text variant="label" tone="muted">{row.subject}</Text>
          <TWText className="text-base font-semibold text-text" numberOfLines={2}>
            {row.title}
          </TWText>
        </View>
        <Text variant="data" tone="muted">{questionCountText(row.questionCount)}</Text>
      </View>
      {lines.length > 0 ? (
        <View className="flex-row flex-wrap gap-x-stack gap-y-0.5">
          {lines.map((line) => (
            <TWText key={line.outcome} className="text-sm text-text">
              <TWText className="font-mono text-data text-text">{String(line.count)}</TWText>{' '}
              {OUTCOME_WORDS[line.outcome]}
            </TWText>
          ))}
        </View>
      ) : (
        <TWText className="text-sm text-text-muted">Not started</TWText>
      )}
    </Card>
  );
}
