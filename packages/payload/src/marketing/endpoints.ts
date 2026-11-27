// Payload verifies its session before invoking custom REST handlers.
// SOT: docs/site/signaliq-business-connection.md · node_modules/payload/dist/utilities/createPayloadRequest.js
// SOT-KEYWORDS: marketing internal payload endpoints same origin authorization
import type { Endpoint } from 'payload';
import { marketingInbox, updateMarketingInquiry } from '@acme/app/marketing';
import { MarketingError } from '@acme/app/marketing-contract';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};
const failure = (error: Error) =>
  Response.json(
    {
      error:
        error instanceof MarketingError
          ? error.message
          : 'The inquiry service is temporarily unavailable. Retry the same action.',
    },
    {
      status: error instanceof MarketingError ? error.status : 503,
      headers: privateHeaders,
    },
  );
export const marketingEndpoints: Endpoint[] = [
  {
    path: '/moyo-sales/inquiries',
    method: 'get',
    handler: async (req) => {
      try {
        return Response.json(await marketingInbox(req), {
          headers: privateHeaders,
        });
      } catch (error) {
        return failure(
          error instanceof Error ? error : new Error('Unavailable'),
        );
      }
    },
  },
  {
    path: '/moyo-sales/inquiries/:id',
    method: 'post',
    handler: async (req) => {
      try {
        const id = req.routeParams?.id;
        if (typeof id !== 'string')
          throw new MarketingError('Inquiry not found.', 404);
        return Response.json(await updateMarketingInquiry(req, id), {
          headers: privateHeaders,
        });
      } catch (error) {
        return failure(
          error instanceof Error ? error : new Error('Unavailable'),
        );
      }
    },
  },
];
