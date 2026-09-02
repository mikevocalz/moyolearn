'use client';
// SummaryQueuePaneScreen — doc 37 §3.3's tutor surface: Notes queue|draft.
// The AdaptivePanes host around the EXISTING SummaryQueueScreen (primary —
// the doc 34 §5 DataTable queue, diffed and moved, never rebuilt) with the
// selected draft in the detail pane on expanded widths. On compact the host
// collapses to the queue alone — exactly today's single-column screen; the
// headline press affordance only exists where the detail pane does.
//
// The draft pane renders what the queue KNOWS (headline as the family will
// see it, evidence counts, viewed state, status) plus the Approve action.
// Suppression deliberately stays on the queue's own inline form — one
// suppression surface, one logged reason (doc 34 §3), not two.
//
// The `tutor-notes` CoachMark is doc 37 §1.2 taught at the point of use: it is
// what REPLACES the front-loaded `preview` step in tutor onboarding, so it
// mounts on the queue column (which exists at every width) rather than on the
// detail pane (which does not exist on compact).
//
// Mobbin: https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   support queue list beside the open item, triage actions on the detail) ·
//   https://mobbin.com/screens/0b8a7848-7bbb-4b35-8999-d71b47f469c3 (Featurebase —
//   inbox table with the conversation pane trailing it) ·
//   https://mobbin.com/screens/9dae9f31-b569-44e1-948b-5dcae49c1e7a (Zillow —
//   selected list row highlighted while its detail stays open). Structure only.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 §3.3 · docs/pack/34-session-summary-reports.md §5
// SOT-KEYWORDS: summary queue pane screen tutor notes draft detail adaptive panes selection
import {
  AdaptivePanes,
  Badge,
  Button,
  CoachMark,
  DetailNavbar,
  EmptyState,
  Heading,
  Text,
  notify,
  useAdaptivePaneSelection,
} from '@acme/ui';
import { ScrollView, View } from '@acme/ui/primitives';
import { SummaryQueueScreen, approvedNote } from './draft-queue-content.tsx';
import { useSummaryQueue } from './use-reports.ts';

const STATUS_TONE = {
  generating: 'neutral',
  draft: 'attention',
  published: 'success',
  suppressed: 'neutral',
} as const;

/**
 * The draft pane. Same query key as the queue (`useSummaryQueue`), so the
 * row is already in cache and approving from here invalidates the one
 * surface both panes read.
 */
function SelectedDraftPane() {
  const { selectedId, select } = useAdaptivePaneSelection();
  const { rows, act } = useSummaryQueue();
  const row = rows.find((candidate) => candidate.sessionId === selectedId) ?? null;

  if (selectedId === null || row === null) {
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <EmptyState
          icon={<Text className="text-title">✎</Text>}
          title="Pick a draft"
          description="Choose a report from the queue to review it here."
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="border-b-2 border-border px-inset py-2">
        <DetailNavbar
          title="Draft review"
          onDismiss={() => {
            select?.(null);
          }}
        >
          <Badge label={row.status} tone={STATUS_TONE[row.status]} />
        </DetailNavbar>
      </View>

      <ScrollView className="flex-1">
        <View className="gap-section p-inset">
          {/* The headline exactly as the family will read it — the thing the
              human is approving (doc 34 §1: evidence, never adjectives). */}
          <View className="gap-element">
            <Text variant="label" className="text-text-muted">
              Family-facing headline
            </Text>
            <Heading level={2} size="display-sm" className="text-text">
              {row.headline}
            </Heading>
          </View>

          <View className="flex-row gap-section">
            <View className="gap-element">
              <Text variant="label" className="text-text-muted">
                Attempted
              </Text>
              <Text variant="data" className="font-mono text-text">
                {row.attempted}
              </Text>
            </View>
            <View className="gap-element">
              <Text variant="label" className="text-text-muted">
                On own
              </Text>
              <Text variant="data" className="font-mono text-text">
                {row.solvedIndependently}
              </Text>
            </View>
            <View className="gap-element">
              <Text variant="label" className="text-text-muted">
                Viewed
              </Text>
              <Text variant="data" className="font-mono text-text-muted">
                {row.guardianViewedAt !== null ? 'viewed' : '—'}
              </Text>
            </View>
          </View>

          <View className="gap-element">
            <Text variant="label" className="text-text-muted">
              Created
            </Text>
            <Text variant="data" className="font-mono text-text">
              {new Date(row.createdAt).toLocaleDateString()}
            </Text>
            {row.publishedAt !== null ? (
              <>
                <Text variant="label" className="text-text-muted">
                  Published
                </Text>
                <Text variant="data" className="font-mono text-text">
                  {new Date(row.publishedAt).toLocaleDateString()}
                </Text>
              </>
            ) : null}
          </View>

          {row.status === 'draft' ? (
            <Button
              title="Approve"
              variant="primary"
              loading={act.isPending}
              onPress={() => {
                const { sessionId, learnerId } = row;
                act.mutate(
                  { action: 'approve', sessionId },
                  // Same propagation-naming confirm as the queue's row action
                  // — one sentence, shared, so the two never drift.
                  { onSuccess: () => notify.success(approvedNote(learnerId)) },
                );
              }}
            />
          ) : (
            <Text variant="caption" tone="muted">
              {row.status === 'suppressed'
                ? 'Suppressed — the logged reason lives with the record.'
                : 'Published — the family can read it. Suppress from the queue if it must come down.'}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export function SummaryQueuePaneScreen() {
  return (
    <AdaptivePanes detail={<SelectedDraftPane />}>
      <AdaptivePanes.Column>
        <CoachMark
          id="tutor-notes"
          title="How session notes work"
          body="Write the note while the session is fresh. It becomes the family's report once you approve it, so say what happened and what comes next — nothing a parent would have to decode."
          placement="below"
          align="start"
        />
        <ScrollView className="flex-1">
          <SummaryQueueScreen />
        </ScrollView>
      </AdaptivePanes.Column>
    </AdaptivePanes>
  );
}
