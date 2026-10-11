// The web mutation envelope. Authorization stays in the injected service;
// body/org hints never influence identity, provider selection, or recipients.
// SOT: docs/business/creative-studio.md
// SOT-KEYWORDS: business campaign HTTP origin CSRF bounded body
import { CampaignInputError, MAX_DOCUMENT_BYTES, parseDocument, type CampaignDocument, type draftReceipt } from './document.ts';
import { MailcheapError, readBoundedBody } from './mailcheap.ts';

export const responseHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

export async function campaignResponse(
  request: Request,
  create: (document: CampaignDocument, headers: Headers) => Promise<ReturnType<typeof draftReceipt>>,
) {
  const json = (value: { error: string } | ReturnType<typeof draftReceipt>, status: number) =>
    Response.json(value, { status, headers: responseHeaders });
  if (request.headers.get('origin') !== new URL(request.url).origin) return json({ error: 'Open the campaign studio on this site to create a draft.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') return json({ error: 'Send a JSON document.' }, 415);
  try {
    const document = parseDocument(await readBoundedBody(request.body, MAX_DOCUMENT_BYTES));
    return json(await create(document, request.headers), 201);
  } catch (error) {
    if (error instanceof CampaignInputError) return json({ error: error.message }, 400);
    if (error instanceof MailcheapError) return json({ error: error.message }, error.status);
    return json({ error: 'The draft request could not be completed. No delivery was requested.' }, 500);
  }
}
