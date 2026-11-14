// Moyo sales inbox. Customer organizations cannot read platform sales records.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing ops inquiry owner scope
import { auth } from '@/lib/auth';
import { marketingInbox } from '@/lib/marketing/marketing.service';
import { MarketingError } from '@/lib/marketing/contract';
export async function GET(request: Request) {
  try {
    return Response.json(await marketingInbox(auth, request.headers), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof MarketingError
            ? error.message
            : 'This sales inbox is unavailable.',
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
