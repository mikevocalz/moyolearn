// UNAUTHENTICATED BY DESIGN: write-only adult business inquiry, fixed tenant and exact origin.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing public inquiry intake cors consent
import { MarketingError } from '@/lib/marketing/contract';
import {
  marketingOrigin,
  receivePublicInquiry,
} from '@/lib/marketing/marketing.service';
export const dynamic = 'force-dynamic';
const cors = (request: Request) => ({
  'Access-Control-Allow-Origin':
    marketingOrigin(request.headers.get('origin')) ?? 'null',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
  Vary: 'Origin',
});
export function OPTIONS(request: Request) {
  return new Response(null, {
    status: marketingOrigin(request.headers.get('origin')) ? 204 : 403,
    headers: cors(request),
  });
}
export async function POST(request: Request) {
  try {
    const saved = await receivePublicInquiry(request);
    return Response.json(
      { accepted: true, ...saved },
      { status: 201, headers: cors(request) },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof MarketingError
            ? error.message
            : 'Your inquiry could not be saved. Please try again.',
      },
      {
        status: error instanceof MarketingError ? error.status : 503,
        headers: cors(request),
      },
    );
  }
}
