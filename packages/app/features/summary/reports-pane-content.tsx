'use client';
// ReportsPaneScreen — doc 37 §3.3's guardian tablet surface: Reports|report.
// The AdaptivePanes host around the EXISTING ReportsScreen (primary list) and
// SessionReportScreen (detail) — diffed and moved, never rebuilt. On expanded
// widths the selected report renders beside the list and the selection
// survives the fold (scoped store, doc 37 §3.2); on compact the host shows
// the list alone and cards keep today's navigate-to-detail behaviour via
// `(guardian)/reports/[sessionId]` — reports-content.tsx owns that branch.
//
// Mobbin: https://mobbin.com/screens/9dae9f31-b569-44e1-948b-5dcae49c1e7a (Zillow —
//   inbox list beside the open conversation, selected row highlighted) ·
//   https://mobbin.com/screens/beafa73d-3c43-4ddc-9949-b0b1c2f76d12 (Threads —
//   list column drives the detail column, one screen) ·
//   https://mobbin.com/screens/1764602c-b875-482f-a13f-059bf78c15b7 (Plain —
//   fixed list pane, flexible detail region). Structure only.
// SOT: docs/pack/37-onboarding-dual-pane.md §3.2 §3.3 · docs/pack/34-session-summary-reports.md §5
// SOT-KEYWORDS: reports pane screen guardian adaptive panes list detail selection tablet
import {
  AdaptivePanes,
  DetailNavbar,
  EmptyState,
  Text,
  useAdaptivePaneSelection,
} from '@acme/ui';
import { ScrollView, View } from '@acme/ui/primitives';
import { ReportsScreen } from './reports-content.tsx';
import { SessionReportScreen } from './report-content.tsx';
import { useGuardianReports } from './use-reports.ts';

/**
 * The detail pane: the full session report for the selected card, or an
 * instruction when nothing is selected. Reads the host's scoped selection —
 * the same store the list writes.
 */
function SelectedReportPane() {
  const { selectedId, select } = useAdaptivePaneSelection();
  /*
    Reads the SAME query the list pane does — one cache entry, no second
    request — because the idle instruction is only true if there is a list to
    obey it. "Choose a session from the list" printed beside a list that failed
    to load sends the reader to look for rows that are not there and reads as
    the app not knowing its own state. The list pane owns the failure and its
    retry; this pane just stops giving an impossible instruction.
  */
  const { reports, loading, error } = useGuardianReports();

  if (selectedId === null) {
    const listUnavailable = !loading && error !== null && reports.length === 0;
    return (
      <View className="flex-1 items-center justify-center p-inset">
        <EmptyState
          icon={<Text className="text-title">✎</Text>}
          title={listUnavailable ? 'Nothing to read yet' : 'Pick a report'}
          description={
            listUnavailable
              ? 'Your reports haven’t loaded, so there’s nothing to open here. The list beside this pane can try again.'
              : 'Choose a session from the list to read it here.'
          }
        />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="border-b-2 border-border px-inset py-2">
        <DetailNavbar
          title="Session report"
          onDismiss={() => {
            select?.(null);
          }}
        />
      </View>
      <ScrollView className="flex-1">
        <SessionReportScreen sessionId={selectedId} />
      </ScrollView>
    </View>
  );
}

export function ReportsPaneScreen() {
  return (
    <AdaptivePanes detail={<SelectedReportPane />}>
      <AdaptivePanes.Column>
        <ScrollView className="flex-1">
          <ReportsScreen />
        </ScrollView>
      </AdaptivePanes.Column>
    </AdaptivePanes>
  );
}
