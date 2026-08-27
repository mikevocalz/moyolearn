// /reports/[sessionId] — one session report, doc 34 §2's eight blocks.
// A thin param unwrapper: the screen owns everything else.
// SOT: docs/pack/34-session-summary-reports.md §5
// SOT-KEYWORDS: report page route param session summary guardian
import { SessionReportScreen } from '@acme/app';

export default async function ReportPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <SessionReportScreen sessionId={sessionId} />;
}
