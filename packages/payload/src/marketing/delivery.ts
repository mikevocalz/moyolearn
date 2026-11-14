// Safe server-to-server transport. Acceptance and completed routing stay distinct.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: signaliq delivery receipt retry timeout server key
import { z } from 'zod';
import { businessEvent, receipt } from './contract.ts';

export function deliveryConfiguration(endpoint?: string, key?: string) {
  if (!endpoint || !key?.trim()) return null;
  try {
    const url = new URL(endpoint);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/api/ingest/v1/business-events'
    )
      return null;
    return { endpoint: url.href, key: key.trim() };
  } catch {
    return null;
  }
}
const withdrawal = z
  .object({ requestId: z.uuid(), inquirySourceId: z.string().max(200) })
  .strict();
export const deliveryItem = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('business-event'), event: businessEvent }),
  z.object({ operation: z.literal('withdrawal'), event: withdrawal }),
]);
export type DeliveryItem = z.infer<typeof deliveryItem>;

export async function deliverItem(
  config: NonNullable<ReturnType<typeof deliveryConfiguration>>,
  item: DeliveryItem,
  accepted: boolean,
  fetcher: typeof fetch = fetch,
) {
  const url = new URL(config.endpoint);
  let method = 'POST';
  let body: string | undefined = JSON.stringify(item.event);
  if (item.operation === 'withdrawal') url.pathname += '/withdrawals';
  else if (accepted) {
    method = 'GET';
    url.searchParams.set('sourceId', item.event.sourceId);
    body = undefined;
  }
  try {
    const response = await fetcher(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.key}`,
        'Content-Type': 'application/json',
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    });
    if (response.status === 429 || response.status >= 500)
      return { state: 'retry' as const, error: 'source_unavailable' };
    if (!response.ok)
      return {
        state: 'blocked' as const,
        error:
          response.status === 401 || response.status === 403
            ? 'source_authorization'
            : 'source_rejected',
      };
    if (item.operation === 'withdrawal') {
      const parsed = z
        .object({ state: z.literal('withdrawn'), requestId: z.uuid() })
        .safeParse(await response.json());
      return parsed.success && parsed.data.requestId === item.event.requestId
        ? { state: 'delivered' as const, sourceEventId: null }
        : { state: 'retry' as const, error: 'invalid_receipt' };
    }
    const parsed = receipt.safeParse(await response.json());
    if (!parsed.success)
      return { state: 'retry' as const, error: 'invalid_receipt' };
    const data = parsed.data;
    if (data.state === 'processed')
      return { state: 'delivered' as const, sourceEventId: data.sourceEventId };
    if (data.state === 'queued')
      return { state: 'accepted' as const, sourceEventId: data.sourceEventId };
    const reason =
      data.reason && /^[a-z0-9_:-]{1,100}$/.test(data.reason)
        ? data.reason
        : null;
    return {
      state: 'blocked' as const,
      error:
        (reason === 'consent_withdrawn'
          ? 'source_consent_withdrawn'
          : reason) ??
        (data.state === 'failed'
          ? 'source_processing_failed'
          : 'source_processing_blocked'),
    };
  } catch {
    return { state: 'retry' as const, error: 'delivery_unconfirmed' };
  }
}
