// /share/report/[token] — doc 34 §5's teacher share view, as a page.
//
// A SERVER component end to end: the token is verified and the report loaded
// here, crops signed under the token's authority (`signCdnUrl` directly — the
// `/api/media/view` door authenticates a session this reader does not have),
// and the client half receives only what it may show. Every failure renders
// the same quiet not-found body the API route answers with, for the same
// oracle reason.
// SOT: docs/pack/34-session-summary-reports.md §3 §5 · docs/pack/29-bunny-media-spec.md §5
// SOT-KEYWORDS: share report page token server render teacher view sign crops not found
import { sharedSummaryView } from '@acme/app/server';
import { ShareReportContent } from '@acme/app';
import { loadSummaryBySession, resolveCaptureCrop } from '@/lib/summary.repository';
import { signCdnUrl } from '@/lib/bunny-token';

export const dynamic = 'force-dynamic';

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await sharedSummaryView(token, {
    loadSummary: loadSummaryBySession,
    resolveCaptureCrop: async (messageId, attachmentId) => {
      const url = await resolveCaptureCrop(messageId, attachmentId);
      return url === null ? null : signCdnUrl(url);
    },
  });

  if (report === null) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="text-display-sm text-text">This link isn&rsquo;t active</h1>
        <p className="mt-4 text-body text-text-muted">
          It may have expired or been turned off by the family. Ask them for a fresh link.
        </p>
      </main>
    );
  }

  return <ShareReportContent report={report} />;
}
