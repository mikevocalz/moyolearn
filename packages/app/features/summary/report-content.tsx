'use client';
// SessionReportScreen — doc 34 §2's full report for the guardian, plus §3's
// share controls. The blocks themselves render through `ReportBody` (one
// component, one order — see its header); what THIS file owns is the guardian
// chrome around them: the crop URLs routed through `/api/media/view` (the one
// authenticated signing door), and the guardian-initiated teacher share —
// mint, show once, revoke.
//
// The share link renders EXACTLY ONCE, from the mutation's own response. It is
// never cached, never refetched, never reconstructable from this screen — the
// row holds a hash. Losing it means minting a fresh one, which also retires
// the old link; rotation and revocation are the same mechanism.
//
// Mobbin: https://mobbin.com/screens/1ba00325-1eb4-4bae-973c-249c2ff8ab8c (SchoolAI —
//   full session report under the roster: verdict, outcome bars, narrative) ·
//   https://mobbin.com/screens/3658eb91-9a82-4bbe-9583-2c9dccca81dc (Semrush —
//   share/export affordance rides the report header, apart from the content) ·
//   https://mobbin.com/screens/228656fd-d38f-4c46-ac78-6b5ee83981cd (Zillow —
//   generated-document states listed plainly while pending). Structure only.
// SOT: docs/pack/34-session-summary-reports.md §2 §3 §5 · docs/pack/29-bunny-media-spec.md §5
// SOT-KEYWORDS: session report screen guardian eight blocks share teacher mint revoke crop media view door
import { Button, Card, EmptyState, Heading, LoadingSkeleton, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { ReportBody } from './report-blocks.tsx';
import { useGuardianReport, useTeacherShare } from './use-reports.ts';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

/** The authenticated signing door (doc 29 §5) — never a bare CDN URL. */
const cropSrc = (url: string) => `/api/media/view?url=${encodeURIComponent(url)}`;

export function SessionReportScreen({ sessionId }: { sessionId: string }) {
  const { report, loading } = useGuardianReport(sessionId);
  const { share, revoke } = useTeacherShare(sessionId);

  if (loading) {
    return (
      <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
        <LoadingSkeleton count={4} />
      </View>
    );
  }

  if (report === null) {
    return (
      <View className="mx-auto w-full max-w-2xl px-inset py-section">
        <EmptyState
          icon={<Text className="text-title">✎</Text>}
          title="Report not available"
          description="It may still be generating, or the link may be out of date."
        />
      </View>
    );
  }

  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      <ReportBody
        headline={report.headline}
        workedOn={report.workedOn}
        problems={report.problems}
        mastery={report.mastery}
        effortMoment={report.effortMoment}
        nextUp={report.nextUp}
        aid={{ kind: 'home', support: report.homeSupport }}
        facts={report.facts}
        publishedAt={report.publishedAt}
        cropSrc={cropSrc}
      />

      {/* §3 — guardian-initiated teacher share. Below the report: consent is a
          decision about the content, made after reading it. */}
      <Card className="gap-group">
        <Heading level={2} size="title" className="text-text">
          Share with a teacher
        </Heading>
        <Text variant="body" tone="muted">
          A read-only link to this report — no name, no home tips. It expires on its
          own, and you can stop sharing any time.
        </Text>
        {share.data !== undefined ? (
          <View className="gap-element">
            <Text variant="label" className="text-text-muted">Copy this link now — it is shown once</Text>
            <Text variant="data" className="font-mono text-text" selectable>
              {`${API_URL}${share.data.path}`}
            </Text>
            <Text variant="caption" tone="muted">
              Expires {new Date(share.data.expiresAt).toLocaleDateString()}
            </Text>
          </View>
        ) : null}
        <View className="flex-row gap-group">
          <Button
            title={share.data !== undefined ? 'Make a new link' : 'Create share link'}
            onPress={() => {
              share.mutate();
            }}
            loading={share.isPending}
            variant="primary"
            size="sm"
          />
          <Button
            title="Stop sharing"
            onPress={() => {
              revoke.mutate();
            }}
            loading={revoke.isPending}
            variant="outline"
            size="sm"
          />
        </View>
      </Card>
    </View>
  );
}
