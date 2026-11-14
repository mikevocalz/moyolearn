'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Text, useInstanceStore, useStore } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { homeworkClient } from './homework.client.ts';
import type { HomeworkSubmissionView, PriorWork } from './homework.types.ts';
import { PriorWorkMark } from './prior-work-mark';
import { homeworkTimelineQueryKey } from './use-homework-timeline.ts';

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
        <Text variant="body" aria-live="polite">{submission.questions.length} problems, {submission.questions.filter((q) => q.priorWork === 'complete').length} already done.</Text>
        {submission.status === 'complete' && submission.tutorSessionId === null ? <Text variant="body">
          All problems were marked already done. Untick any problem your child still needs to work on.
        </Text> : null}
        <Text variant="caption" tone="muted">These marks skip work finished before upload. They do not check answers. You can change them before tutoring starts.</Text>
        {submission.tutorSessionId !== null ? <Text variant="body">This worksheet has started. Already-done marks can’t be changed here.</Text> : null}
        {revision.isPending ? <Text variant="body">Saving change…</Text> : null}
        {submission.questions.map((question) => <View key={question.questionId} className="gap-element rounded-card border-2 border-border p-3">
          <Text variant="label">Problem {question.sourceNumber ?? question.orderIndex + 1}</Text>
          <Text variant="body">{question.text}</Text>
          <PriorWorkMark value={question.priorWork ?? 'none'} questionNumber={question.sourceNumber ?? question.orderIndex + 1}
            disabled={revision.isPending || submission.tutorSessionId !== null}
            onChange={(priorWork) => revision.mutate({ questionId: question.questionId, priorWork })} />
        </View>)}
      </> : null}
      {revision.isError ? <Text variant="body">The mark was not saved. Tutoring may have started. Reload the review before trying again.</Text> : null}
    </View> : null}
  </View>;
}
