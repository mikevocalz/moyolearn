'use client';
// ReportsScreen — doc 34 §5's family feed: one card per published session
// report, headline + the mastery delta, newest first. The Hot dial surface a
// guardian opens to answer "is my child learning" — and the cards answer with
// evidence-backed headlines, never adjectives (§1's whole argument).
//
// Mobbin: https://mobbin.com/screens/1ba00325-1eb4-4bae-973c-249c2ff8ab8c (SchoolAI —
//   session rows lead with a per-student headline sentence, progress trails it) ·
//   https://mobbin.com/screens/77482a04-a3e4-4978-9ab6-1cbeeb89f667 (Tana — dated
//   report entries in one reading column, title first) ·
//   https://mobbin.com/screens/4af62471-60e6-43fd-9238-f8f8cfffda6f (Customer.io —
//   status chip sits on the row's trailing edge, subordinate to the title).
//   Structure only: card anatomy and the headline-leads hierarchy.
// SOT: docs/pack/34-session-summary-reports.md §5 · docs/pack/08-visual-hierarchy-spacing-spec.md
// SOT-KEYWORDS: reports feed screen guardian cards headline mastery delta viewed hot dial
import { useRouter } from 'solito/navigation';
import {
  Badge,
  Card,
  EmptyState,
  Heading,
  LoadingSkeleton,
  MasteryBar,
  Text,
  isCollapsed,
  useAdaptivePaneSelection,
  useWindowSizeClass,
} from '@acme/ui';
import { Pressable, View } from '@acme/ui/primitives';
import { LEVEL_LABEL } from './report-blocks.tsx';
import { useGuardianReports } from './use-reports.ts';

export function ReportsScreen() {
  const router = useRouter();
  const { reports, loading } = useGuardianReports();

  /*
    Pane-aware, route-safe (doc 37 §3.2/§3.3). Inside an AdaptivePanes host at
    an expanded width, a card SELECTS — the report opens in the detail pane
    beside this list and the selection survives the fold. On compact, and on
    every surface with no host (the web reports page), a card NAVIGATES to the
    detail route exactly as before. `useAdaptivePaneSelection` is null-safe
    outside a host, so this screen stays mountable anywhere.
  */
  const { selectedId, select } = useAdaptivePaneSelection();
  const sizeClass = useWindowSizeClass();
  const paneOpen = select !== null && !isCollapsed(sizeClass);

  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      <View className="gap-element">
        <Heading level={1} size="display-sm" className="text-text">
          Session reports
        </Heading>
        <Text variant="body" tone="muted">
          What happened in tutoring, with the work to show for it.
        </Text>
      </View>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<Text className="text-title">✎</Text>}
          title="No reports yet"
          description="A report lands here after each tutoring session ends."
        />
      ) : (
        <View className="gap-group">
          {reports.map((card) => (
            <Pressable
              key={card.sessionId}
              onPress={() => {
                if (paneOpen) {
                  select(card.sessionId);
                  return;
                }
                router.push(`/reports/${card.sessionId}`);
              }}
              aria-label={`Open report: ${card.headline}`}
              aria-selected={paneOpen ? card.sessionId === selectedId : undefined}
            >
              {/* Selected fill uses the doc 08 §4.6 selection token — the same
                  underlay the DataTable row uses, never a border colour. */}
              <Card
                className={`gap-group ${
                  paneOpen && card.sessionId === selectedId ? 'bg-highlighter-underlay' : ''
                }`}
              >
                <View className="flex-row items-start justify-between gap-group">
                  <Text variant="body" className="flex-1 font-semibold text-text">
                    {card.headline}
                  </Text>
                  {!card.viewed ? <Badge label="New" tone="primary" /> : null}
                </View>
                {card.topMovement !== null ? (
                  <View className="gap-element">
                    <MasteryBar
                      label={card.topMovement.parentLabel}
                      value={card.topMovement.afterP * 100}
                      state={card.topMovement.afterP < 0.5 ? 'needs-attention' : 'steady'}
                      size="sm"
                    />
                    <Text variant="data" className="font-mono text-text-muted">
                      {LEVEL_LABEL[card.topMovement.before]} → {LEVEL_LABEL[card.topMovement.after]}
                    </Text>
                  </View>
                ) : null}
                <Text variant="caption" tone="muted">
                  {new Date(card.publishedAt).toLocaleDateString()}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
