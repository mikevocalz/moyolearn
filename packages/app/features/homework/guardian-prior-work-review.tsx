'use client';
// Mobbin: https://mobbin.com/screens/1f2a7306-e592-4627-9bd6-e5f943251b8c (Slack iOS: open and completed items retain their title and identifying detail) ·
// https://mobbin.com/screens/054dcddf-43f1-4e84-9d42-1ae63a06504b (Slack iOS: checked items remain readable and reviewable) ·
// https://mobbin.com/screens/9e6f7794-da2f-4315-ade0-4d498d46e253 (Slack iOS: a named item and its metadata stay beside the completion control).
// Previews inspected during PR completion; cross-domain structure only. Moyo
// keeps one question list and its semantic controls, without Slack's filter tabs.
// SOT: docs/design/homework-prior-work-handoff.md

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Text, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { homeworkClient } from './homework.client.ts';
import type { HomeworkSubmissionView, PriorWork } from './homework.types.ts';
import { PriorWorkMark } from './prior-work-mark';
import { homeworkTimelineQueryKey } from './use-homework-timeline.ts';
import { canRevisePriorWork } from './homework-prior-work.ts';

export function GuardianPriorWorkReview({ submissionId, learnerAuthId }: {
  submissionId: string;
  learnerAuthId: string;
}) {
  const store = useInstanceStore(() => ({ open: false }));
  const open = useStore(store, (state) => state.open);
  const queryClient = useQueryClient();
  const queryKey = ['guardian-prior-work', learnerAuthId, submissionId] as const;
  const review = useQuery({ queryKey, enabled: open, queryFn: () => homeworkClient.getSubmission(submissionId) });
  const revision = useMutation({
    mutationFn: ({ questionId, priorWork }: { questionId: string; priorWork: PriorWork }) =>
      homeworkClient.reviseQuestion(submissionId, questionId, { priorWork, author: 'guardian' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: homeworkTimelineQueryKey(learnerAuthId) }),
      ]);
    },
  });
  const submission: HomeworkSubmissionView | undefined = review.data?.learnerAuthId === learnerAuthId ? review.data : undefined;
  const canEdit = submission ? canRevisePriorWork(submission, submission.questions) : false;
  return <View className="gap-element">
    <Button title={open ? 'Close question review' : 'Review already-done marks'} variant="outline"
      onPress={() => store.setState({ open: !open })} />
    {open ? <View className="gap-element">
      {review.isPending ? <Text variant="body">Loading questions…</Text> : null}
      {review.isError ? <>
        <Text variant="body">Questions could not be loaded. Try again.</Text>
        <Button title="Retry question review" variant="outline" onPress={() => { void review.refetch(); }} />
      </> : null}
      {submission ? <>
        <Text variant="body" aria-live="polite">{submission.questions.length} {submission.questions.length === 1 ? 'problem' : 'problems'}, {submission.questions.filter((q) => q.priorWork === 'complete').length} already done.</Text>
        {submission.status === 'complete' && canEdit ? <Text variant="body">
          All problems were marked already done. Untick any problem your child still needs to work on.
        </Text> : null}
        <Text variant="caption" tone="muted">These marks skip work finished before upload. They do not check answers. You can change them before tutoring starts.</Text>
        {!canEdit ? <Text variant="body">Already-done marks can only be changed before tutoring starts.</Text> : null}
        {revision.isPending ? <Text variant="body">Saving change…</Text> : null}
        {submission.questions.map((question) => <View key={question.questionId} className="gap-element rounded-card border-2 border-border p-3">
          <Text variant="label">Problem {question.sourceNumber ?? question.orderIndex + 1}</Text>
          <Text variant="caption" tone="muted">Page {question.sourcePage}</Text>
          <Text variant="body">{question.text}</Text>
          <PriorWorkMark value={question.priorWork ?? 'none'} questionNumber={question.sourceNumber ?? question.orderIndex + 1}
            sourcePage={question.sourcePage}
            disabled={revision.isPending || review.isFetching || !canEdit}
            onChange={(priorWork) => revision.mutate({ questionId: question.questionId, priorWork })} />
        </View>)}
      </> : null}
      {revision.isError ? <>
        <Text variant="body">Your change wasn’t saved. Reload the review before trying again.</Text>
        <Button title="Reload question review" variant="outline" disabled={review.isFetching}
          onPress={() => { void review.refetch().then((result) => { if (result.isSuccess) revision.reset(); }); }} />
      </> : null}
    </View> : null}
  </View>;
}
