'use client';
// ShareReportContent — the teacher's read of a shared report (doc 34 §5):
// blocks 1–6 + 8 through the SAME `ReportBody` the guardian sees, with the
// home-support block swapped for one classroom-context line. Moyo-branded,
// read-only, and deliberately inert: no session, no hooks, no fetching — the
// server page verified the token and handed this component everything it may
// show, so there is nothing on the client to escalate.
//
// Crop URLs arrive ALREADY SIGNED (the share route minted them under the
// token's authority), so `cropSrc` is identity here — the one difference
// between the two audiences' pipelines, isolated to one prop.
//
// Mobbin: https://mobbin.com/screens/77482a04-a3e4-4978-9ab6-1cbeeb89f667 (Tana —
//   a shared document page: brand mark, title, fixed sections, no chrome) ·
//   https://mobbin.com/screens/1ba00325-1eb4-4bae-973c-249c2ff8ab8c (SchoolAI —
//   the session insights column a teacher actually reads) ·
//   https://mobbin.com/screens/3658eb91-9a82-4bbe-9583-2c9dccca81dc (Semrush —
//   generated report shared as a standalone branded page). Structure only.
// SOT: docs/pack/34-session-summary-reports.md §3 §5
// SOT-KEYWORDS: teacher share content read only branded classroom context signed crops no session
import { Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import type { TeacherShareView } from './summary.service.ts';
import { ReportBody } from './report-blocks.tsx';

export function ShareReportContent({ report }: { report: TeacherShareView }) {
  return (
    <View className="mx-auto w-full max-w-2xl gap-section px-inset py-section">
      <View className="flex-row items-center justify-between">
        <Text variant="label" className="text-text-muted">Moyo · Session report</Text>
        <Text variant="caption" tone="muted">Shared by a guardian · read-only</Text>
      </View>
      <ReportBody
        headline={report.headline}
        workedOn={report.workedOn}
        problems={report.problems}
        mastery={report.mastery}
        effortMoment={report.effortMoment}
        nextUp={report.nextUp}
        aid={{ kind: 'classroom', line: report.classroomContext }}
        facts={report.facts}
        publishedAt={report.publishedAt}
        cropSrc={(url) => url}
      />
    </View>
  );
}
