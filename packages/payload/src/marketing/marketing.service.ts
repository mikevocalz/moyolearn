import '@tanstack/react-start/server-only';
// Public adult intake and authenticated internal Payload sales management.
// SOT: docs/site/signaliq-business-connection.md · docs/pack/06-auth-onboarding-spec.md
// SOT-KEYWORDS: marketing service consent internal payload source
import { createHmac } from 'node:crypto';
import {
  inquiryInput,
  MarketingError,
  trustedOrigin,
  updateInput,
} from './contract.ts';
import {
  connectionStatus,
  hasVerifiedOrderReceipt,
  listInquiries,
  marketingTransaction,
  reconcileVerifiedPayments,
  repairPaymentEvidence,
  saveInquiry,
  saveInquiryUpdate,
  saveVerifiedPayment,
} from './marketing.repository.ts';
import type { MarketingPayment } from './marketing.repository.ts';
import {
  deliverItem,
  deliveryConfiguration,
  deliveryItem,
} from './delivery.ts';
import { z } from 'zod';
import type { PayloadRequest } from 'payload';
import {
  marketingAdministrator,
  MOYO_MARKETING_SCOPE,
} from './marketing-access.ts';

export function marketingOrigin(origin: string | null) {
  return trustedOrigin(
    origin,
    process.env.MOYO_MARKETING_ALLOWED_ORIGINS ?? 'https://www.moyolearn.com',
  );
}
export async function readMarketingBody(
  request: Pick<Request, 'headers' | 'body'>,
) {
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !==
    'application/json'
  )
    throw new MarketingError('Send a JSON request.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new MarketingError('The inquiry is empty.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new MarketingError('The inquiry is too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new MarketingError('The inquiry could not be read.', 400);
  }
}

/** Public write-only intake. Internal source scope is fixed, never from the browser. */
export async function receivePublicInquiry(request: Request) {
  if (!marketingOrigin(request.headers.get('origin')))
    throw new MarketingError('Open the inquiry form on Moyo’s website.', 403);
  const secret = process.env.MOYO_MARKETING_RATE_SECRET;
  if (!secret)
    throw new MarketingError(
      'Customer inquiries are temporarily unavailable.',
      503,
    );
  const parsed = inquiryInput.safeParse(await readMarketingBody(request));
  if (!parsed.success)
    throw new MarketingError(
      'Check your contact details and consent choices.',
      422,
    );
  // Only Vercel's overwritten address is used. Raw network addresses are not retained.
  const ip =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const orgId = MOYO_MARKETING_SCOPE;
  const key = createHmac('sha256', secret)
    .update(`${orgId}:${ip}:${new Date().toISOString().slice(0, 10)}`)
    .digest('hex');
  return saveInquiry(orgId, parsed.data, key);
}

export async function marketingInbox(
  request: Pick<PayloadRequest, 'headers' | 'user'>,
) {
  marketingAdministrator(request);
  return {
    inquiries: await listInquiries(MOYO_MARKETING_SCOPE),
    delivery: await connectionStatus(MOYO_MARKETING_SCOPE),
  };
}
export async function updateMarketingInquiry(
  request: Pick<PayloadRequest, 'headers' | 'user' | 'body'>,
  id: string,
) {
  const actorId = marketingAdministrator(request, true);
  const parsed = updateInput.safeParse(
    await readMarketingBody({
      headers: request.headers,
      body: request.body ?? null,
    }),
  );
  if (!z.uuid().safeParse(id).success || !parsed.success)
    throw new MarketingError('Check this inquiry update.', 422);
  return saveInquiryUpdate(MOYO_MARKETING_SCOPE, actorId, id, parsed.data);
}
export async function recordMarketingPayment(payment: MarketingPayment) {
  // The Better Auth Stripe plugin invokes this only after signature verification.
  await saveVerifiedPayment(MOYO_MARKETING_SCOPE, payment);
}

export async function drainMarketingOutbox(
  inspectInvoice?: Parameters<typeof repairPaymentEvidence>[1],
) {
  const config = deliveryConfiguration(
    process.env.SIGNALIQ_BUSINESS_ENDPOINT,
    process.env.SIGNALIQ_BUSINESS_KEY,
  );
  if (!config) return { state: 'not-configured' as const, processed: 0 };
  const orgId = MOYO_MARKETING_SCOPE;
  if (inspectInvoice) await repairPaymentEvidence(orgId, inspectInvoice);
  await reconcileVerifiedPayments(orgId);
  let processed = 0;
  await marketingTransaction(async (client) => {
    await client.query(
      "DELETE FROM payload.marketing_rate_limits WHERE window_start<now()-interval '2 days'",
    );
  });
  // Bounded network time; the row locks serialize delivery with consent withdrawal.
  for (let count = 0; count < 3; count++) {
    const found = await marketingTransaction(async (client) => {
      const result = await client.query(
        `SELECT o.*,i.signal_consent,i.withdrawn_at FROM payload.marketing_outbox o JOIN payload.marketing_inquiries i ON i.org_id=o.org_id AND i.id=o.inquiry_id
        WHERE o.org_id=$1 AND o.state IN ('pending','accepted') AND o.next_attempt_at<=now()
        AND (o.operation='withdrawal' OR o.source_id='moyo.inquiry:'||i.id::text OR EXISTS(
          SELECT 1 FROM payload.marketing_outbox parent WHERE parent.org_id=o.org_id AND parent.inquiry_id=o.inquiry_id
          AND parent.source_id='moyo.inquiry:'||i.id::text AND parent.state='delivered'))
        ORDER BY o.created_at,o.id LIMIT 1 FOR UPDATE OF o,i SKIP LOCKED`,
        [orgId],
      );
      const row = result.rows[0];
      if (!row) return false;
      if (
        row.operation !== 'withdrawal' &&
        (!row.signal_consent || row.withdrawn_at)
      ) {
        await client.query(
          "UPDATE payload.marketing_outbox SET state='blocked',event=null,error_code='consent_withdrawn' WHERE id=$1 AND org_id=$2",
          [row.id, orgId],
        );
        return true;
      }
      const parsed = deliveryItem.safeParse({
        operation: row.operation,
        event: row.event,
      });
      if (!parsed.success) {
        await client.query(
          "UPDATE payload.marketing_outbox SET state='failed',error_code='invalid_stored_event' WHERE id=$1 AND org_id=$2",
          [row.id, orgId],
        );
        return true;
      }
      if (
        parsed.data.operation === 'business-event' &&
        parsed.data.event.kind === 'order' &&
        !(await hasVerifiedOrderReceipt(
          client,
          orgId,
          row.inquiry_id,
          parsed.data.event,
        ))
      ) {
        await client.query(
          "UPDATE payload.marketing_outbox SET state='blocked',event=null,error_code='invoice_evidence_unverified' WHERE id=$1 AND org_id=$2",
          [row.id, orgId],
        );
        return true;
      }
      const outcome = await deliverItem(
        config,
        parsed.data,
        row.state === 'accepted',
      );
      const nextState =
        outcome.state === 'retry'
          ? row.attempts >= 19
            ? 'failed'
            : row.state
          : outcome.state;
      const delay = Math.min(3600, 30 * 2 ** Math.min(row.attempts, 7));
      await client.query(
        `UPDATE payload.marketing_outbox SET state=$1::varchar,attempts=attempts+1,next_attempt_at=now()+($2::int*interval '1 second'),source_event_id=coalesce($3,source_event_id),error_code=$4,
        delivered_at=CASE WHEN $1::varchar='delivered' THEN now() ELSE delivered_at END,event=CASE WHEN $1::varchar='delivered' THEN null ELSE event END WHERE id=$5 AND org_id=$6`,
        [
          nextState,
          delay,
          'sourceEventId' in outcome ? outcome.sourceEventId : null,
          'error' in outcome ? outcome.error : null,
          row.id,
          orgId,
        ],
      );
      return true;
    });
    if (!found) break;
    processed++;
  }
  return { state: 'ready' as const, processed };
}
