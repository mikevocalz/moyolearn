// Confirmed discovery-call/progress updates, billing association and withdrawal.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing update booking progress consent owner api
import { auth } from '@/lib/auth';
import { updateMarketingInquiry } from '@/lib/marketing/marketing.service';
import { MarketingError } from '@/lib/marketing/contract';
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json(
      { error: 'Open this inquiry in the Moyo app.' },
      { status: 403 },
    );
  try {
    return Response.json(
      await updateMarketingInquiry(
        auth,
        request.headers,
        (await params).id,
        request,
      ),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof MarketingError
            ? error.message
            : 'This inquiry could not be updated.',
      },
      {
        status:
          error instanceof MarketingError
            ? error.status
            : error instanceof Error && error.message === 'Unauthenticated'
              ? 401
              : 403,
      },
    );
  }
}
