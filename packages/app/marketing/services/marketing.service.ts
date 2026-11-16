import 'server-only';
// Shared adult-intake orchestration; every entry traverses the common operation boundary.
// SOT: docs/site/signaliq-business-connection.md · docs/pack/11-architectural-guardrails.md
// SOT-KEYWORDS: marketing service consent internal payload source protected operation
import { z } from 'zod';
import type { MarketingInternalRequest } from '../permissions/marketing.permissions.ts';
import { protectedOperation } from '../../core/protected-operation.ts';
import {
  inquiryInput,
  MarketingError,
  updateInput,
} from '../schemas/marketing.schema.ts';
import type { MarketingPayment } from '../schemas/marketing.schema.ts';
import {
  connectionStatus,
  listInquiries,
  reconcileVerifiedPayments,
  repairPaymentEvidence,
  saveInquiry,
  saveInquiryUpdate,
  saveVerifiedPayment,
  pruneMarketingRateLimits,
  deliverNextMarketingItem,
} from '../repository/marketing.repository.ts';
import { deliverItem, deliveryConfiguration } from '../delivery.ts';
export { marketingOrigin } from '../permissions/marketing.permissions.ts';

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

/** Public write-only intake. Scope is supplied by the guarded source, never JSON. */
export async function receivePublicInquiry(request: Request) {
  return protectedOperation({
    source: 'public-inquiry',
    request,
    telemetry: {
      op: 'marketing.inquiries.receive',
      resource: 'marketing-inquiries',
      action: 'write',
    },
    operation: async (ctx) => {
      const parsed = inquiryInput.safeParse(await readMarketingBody(request));
      if (!parsed.success)
        throw new MarketingError(
          'Check your contact details and consent choices.',
          422,
        );
      return saveInquiry(ctx.scope, parsed.data, ctx.rateKey);
    },
  });
}

export async function marketingInbox(request: MarketingInternalRequest) {
  return protectedOperation({
    source: 'payload-internal',
    request,
    action: 'read',
    telemetry: {
      op: 'marketing.inquiries.list',
      resource: 'marketing-inquiries',
      action: 'read',
    },
    operation: async (ctx) => ({
      inquiries: await listInquiries(ctx.scope),
      delivery: await connectionStatus(ctx.scope),
    }),
  });
}

export async function updateMarketingInquiry(
  request: MarketingInternalRequest & { body?: Request['body'] },
  id: string,
) {
  return protectedOperation({
    source: 'payload-internal',
    request,
    action: 'write',
    telemetry: {
      op: 'marketing.inquiries.update',
      resource: 'marketing-inquiries',
      action: 'write',
    },
    operation: async (ctx) => {
      const parsed = updateInput.safeParse(
        await readMarketingBody({
          headers: request.headers,
          body: request.body ?? null,
        }),
      );
      if (!z.uuid().safeParse(id).success || !parsed.success)
        throw new MarketingError('Check this inquiry update.', 422);
      return saveInquiryUpdate(ctx.scope, ctx.actorId, id, parsed.data);
    },
  });
}

/** Wired only into the signature-verified Better Auth Stripe callback. */
export async function recordMarketingPayment(payment: MarketingPayment) {
  return protectedOperation({
    source: 'billing-callback',
    payment,
    telemetry: {
      op: 'marketing.payments.record',
      resource: 'marketing-payments',
      action: 'write',
    },
    operation: async (ctx) => {
      await saveVerifiedPayment(ctx.scope, ctx.payment);
    },
  });
}

export async function drainMarketingOutbox(
  request: Pick<Request, 'headers'>,
  inspectInvoice?: Parameters<typeof repairPaymentEvidence>[1],
) {
  return protectedOperation({
    source: 'marketing-cron',
    request,
    telemetry: {
      op: 'marketing.outbox.drain',
      resource: 'marketing-outbox',
      action: 'write',
    },
    operation: async (ctx) => {
      const config = deliveryConfiguration(
        process.env.SIGNALIQ_BUSINESS_ENDPOINT,
        process.env.SIGNALIQ_BUSINESS_KEY,
      );
      if (!config) return { state: 'not-configured' as const, processed: 0 };
      if (inspectInvoice)
        await repairPaymentEvidence(ctx.scope, inspectInvoice);
      await reconcileVerifiedPayments(ctx.scope);
      await pruneMarketingRateLimits();
      let processed = 0;
      // Bounds network work while the repository retains consent/receipt row locks.
      for (let count = 0; count < 3; count++) {
        const found = await deliverNextMarketingItem(
          ctx.scope,
          (item, accepted) => deliverItem(config, item, accepted),
        );
        if (!found) break;
        processed++;
      }
      return { state: 'ready' as const, processed };
    },
  });
}
