'use client';
// PracticePreview — the guardian reads a generated practice set before any of
// it reaches paper: make a draft from one homework submission, read every
// item and its answer, approve, then print the sheet or the key.
//
// Approval comes before printing because the adult is the reviewer of record
// for these items, and the print route refuses a draft for the same reason.
// The answers are on this screen because it is the adult's screen; the sheet
// the child gets has none. Server state lives in TanStack Query mutations,
// and the screen holds no other state.
// Mobbin: https://mobbin.com/screens/9bd81451-bb74-49fe-8cd9-f447155f4900 (Luma — read the generated text, then accept it with one action) ·
//   https://mobbin.com/screens/72e44691-f3f0-415d-bfb1-6cab65a4ceb8 (Cash App — confirm the details, primary action pinned under them) ·
//   https://mobbin.com/screens/b7618c21-df09-46e5-99b5-62f2fa31498d (Polarsteps — "check your pages" before the output is produced). Structure only.
// SOT: docs/work/pr-100/contract.md §Practice sets §Routes · docs/design/homework-end-to-end-2026.md
// SOT-KEYWORDS: practice preview guardian approve print sheet key draft items answers
import { useMutation } from '@tanstack/react-query';
import { PRACTICE_SKILL_LABELS, isPracticeSkillTag } from '@acme/student-model/pure';
import { Badge, Button, Card, Container, Heading, Text } from '@acme/ui';
import { ScrollView, View } from '@acme/ui/tw';
import { API_URL } from '../../core/api-url.ts';
import { ApiError } from '../../core/api-fetch.ts';
import type { PracticeSetView } from './homework.types.ts';
import { printPracticeSet } from './practice-print';
import type { PracticeSheetMode } from './practice-sheet-html.ts';

async function postPractice(path: string, body?: unknown): Promise<PracticeSetView> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as PracticeSetView;
}

const skillLabel = (tag: string): string => (isPracticeSkillTag(tag) ? PRACTICE_SKILL_LABELS[tag] : tag);

function failureLine(error: unknown): string {
  if (error instanceof ApiError && error.status === 403) return 'This child is no longer linked to your account.';
  if (error instanceof ApiError && error.status === 404) return 'That homework could not be found.';
  if (error instanceof ApiError && error.status === 401) return 'Sign in again to continue.';
  return 'That did not go through. Nothing was saved. Try again.';
}

export interface PracticePreviewProps {
  readonly submissionId: string;
}

export function PracticePreview({ submissionId }: PracticePreviewProps) {
  const draft = useMutation({
    mutationFn: () => postPractice('/api/guardian/practice-sets', { submissionId }),
  });
  const approve = useMutation({
    mutationFn: (practiceSetId: string) =>
      postPractice(`/api/guardian/practice-sets/${encodeURIComponent(practiceSetId)}/approve`),
  });
  const print = useMutation({
    mutationFn: (input: { set: PracticeSetView; mode: PracticeSheetMode }) => printPracticeSet(input.set, input.mode),
  });

  const set = approve.data ?? draft.data ?? null;
  const approved = set?.status === 'approved';
  const failure = draft.error ?? approve.error ?? print.error;

  return (
    <View className="flex-1 bg-surface">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <Container width="detail" className="gap-group py-4 pb-48">
          <Heading level={1} size="title">
            Practice sheet
          </Heading>
          <Text tone="muted">
            Create math practice from this homework. Review the problems and answers before approving a printable set.
          </Text>

          {set === null ? (
            <Button
              title="Make a practice set"
              onPress={() => draft.mutate()}
              loading={draft.isPending}
              aria-label="Make a practice set from this homework"
            />
          ) : (
            <>
              <View className="flex-row flex-wrap items-center gap-element">
                <Badge label={approved ? 'Approved' : 'Draft, not approved'} tone={approved ? 'success' : 'attention'} />
                <Text variant="caption" tone="muted">
                  {set.items.length} problems
                </Text>
              </View>
              <Text>
                {set.targetedTags.length > 0
                  ? `Skills: ${set.targetedTags.map(skillLabel).join(', ')}`
                  : 'This homework did not point to a specific skill, so these are general practice for the grade band.'}
              </Text>

              {set.items.length === 0 ? (
                <Text>No problems passed the answer check this time. Make a new set to try again.</Text>
              ) : (
                <View className="gap-element" accessibilityRole="list">
                  {set.items.map((item, index) => (
                    <Card key={item.id} accessibilityLabel={`Problem ${index + 1}: ${item.prompt}. Answer: ${item.answer}`}>
                      <Text variant="caption" tone="muted">
                        {`${index + 1} · ${skillLabel(item.skillTag)}`}
                      </Text>
                      <Text variant="heading">{item.prompt}</Text>
                      <Text>{`Answer: ${item.answer}`}</Text>
                    </Card>
                  ))}
                </View>
              )}

              <Text variant="caption" tone="muted">
                Every answer was checked by exact arithmetic. The sheet your child gets shows the problems only.
              </Text>

              {approved ? (
                <View className="gap-element">
                  <Button
                    title="Print practice sheet"
                    onPress={() => print.mutate({ set, mode: 'sheet' })}
                    loading={print.isPending && print.variables?.mode === 'sheet'}
                    disabled={print.isPending}
                    fullWidth
                  />
                  <Button
                    title="Print answer key"
                    variant="outline"
                    onPress={() => print.mutate({ set, mode: 'key' })}
                    loading={print.isPending && print.variables?.mode === 'key'}
                    disabled={print.isPending}
                    fullWidth
                  />
                </View>
              ) : (
                <View className="gap-element">
                  <Button
                    title="Approve this set"
                    onPress={() => approve.mutate(set.practiceSetId)}
                    loading={approve.isPending}
                    disabled={set.items.length === 0 || draft.isPending}
                    fullWidth
                  />
                  <Button
                    title="Make a different set"
                    variant="ghost"
                    onPress={() => {
                      approve.reset();
                      draft.mutate();
                    }}
                    loading={draft.isPending}
                    disabled={approve.isPending}
                  />
                </View>
              )}
            </>
          )}

          {print.data === 'unavailable' ? (
            <Text tone="danger" accessibilityRole="alert">
              Printing is not available here. On a browser, allow pop-ups for this site and try again.
            </Text>
          ) : null}
          {failure ? (
            <Text tone="danger" accessibilityRole="alert">
              {failureLine(failure)}
            </Text>
          ) : null}
        </Container>
      </ScrollView>
    </View>
  );
}
