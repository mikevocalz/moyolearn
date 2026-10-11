// Pure protocol adapter; credentials enter only from campaigns.service.ts.
// The upstream POST creates a draft, never a send. No implicit retry is safe:
// Mailcheap does not offer an idempotency contract on this endpoint.
// SOT: marclou/mailcheap app/api/v1/campaigns/route.js · docs/business/creative-studio.md
// SOT-KEYWORDS: business campaign mailcheap connection tenant draft protocol
import { CampaignInputError, draftReceipt, httpsUrl, jsonObject, readJson, text, type CampaignDocument } from './document.ts';

export class MailcheapError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}

export function connectionFor(source: string | undefined, organizationId: string) {
  if (!source?.trim()) return null;
  try {
    if (source.length > 262_144) throw new Error('Configuration is too large.');
    const entries = readJson(source);
    if (!Array.isArray(entries) || entries.length > 100) throw new Error('Invalid configuration.');
    const origins = new Set<string>();
    const ids = new Set<string>();
    const connections = entries.map((entry) => {
      const value = jsonObject(entry);
      const orgId = text(value.orgId, 'Organization', 160);
      const url = new URL(httpsUrl(value.origin, 'Mailcheap origin'));
      if (url.pathname !== '/' || url.search || url.hash || url.port ||
          !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/iu.test(url.hostname) ||
          /(?:^|\.)(localhost|local|internal|test)$/iu.test(url.hostname)) throw new Error('Invalid origin.');
      if (origins.has(url.origin) || ids.has(orgId)) throw new Error('Duplicate tenant configuration.');
      origins.add(url.origin); ids.add(orgId);
      const apiKey = text(value.apiKey, 'API key', 512);
      if (apiKey.length < 16 || /\s/u.test(apiKey)) throw new Error('Invalid key.');
      const newsletter = text(value.newsletter, 'Newsletter slug', 120);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(newsletter)) throw new Error('Invalid newsletter.');
      return { orgId, origin: url.origin, apiKey, newsletter,
        brand: { name: text(value.businessName, 'Business name', 160), postalAddress: text(value.postalAddress, 'Postal address', 500) } };
    });
    return connections.find((connection) => connection.orgId === organizationId) ?? null;
  } catch {
    // Never send parser errors containing operator config or secrets to a browser.
    throw new MailcheapError('Campaign delivery configuration is invalid. Contact your administrator.', 503);
  }
}
export type MailcheapConnection = NonNullable<ReturnType<typeof connectionFor>>;

export async function readBoundedBody(body: ReadableStream<Uint8Array> | null, limit: number) {
  if (!body) throw new CampaignInputError('A request body is required.');
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let result = '';
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > limit) {
        void reader.cancel().catch(() => undefined);
        throw new CampaignInputError('The request exceeds the permitted size.');
      }
      result += decoder.decode(part.value, { stream: true });
    }
    return result + decoder.decode();
  } finally { reader.releaseLock(); }
}

export async function createMailcheapDraft(
  connection: MailcheapConnection,
  document: CampaignDocument,
  html: string,
  fetcher: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await fetcher(`${connection.origin}/api/v1/campaigns`, {
      method: 'POST', redirect: 'error', cache: 'no-store', credentials: 'omit',
      signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${connection.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ newsletter: connection.newsletter, subject: document.subject, previewText: document.previewText, html }),
    });
  } catch {
    throw new MailcheapError('Draft creation could not be confirmed. Check Mailcheap before creating another draft.', 504);
  }
  if (response.status === 429) {
    void response.body?.cancel().catch(() => undefined);
    throw new MailcheapError('Mailcheap has temporarily limited draft creation. Review your existing drafts before retrying.', 429);
  }
  if (response.status !== 201) {
    void response.body?.cancel().catch(() => undefined);
    throw new MailcheapError('Draft creation could not be confirmed. Check Mailcheap and its connection settings before retrying.');
  }
  try { return draftReceipt(await readBoundedBody(response.body, 8_192), connection.origin); }
  catch { throw new MailcheapError('The draft receipt could not be read. Check Mailcheap before creating another draft.'); }
}
