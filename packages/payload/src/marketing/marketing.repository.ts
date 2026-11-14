import '@tanstack/react-start/server-only';
// Native Payload REST uses TanStack's compiler-enforced server boundary.
// Moyo's own adult sales intake; never a copy of customer organizations' CRM.
// SOT: packages/payload/migrations/signaliq_marketing_additive.sql
// SOT-KEYWORDS: marketing repository inquiry transaction outbox consent billing
import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { z } from 'zod';
import {
  connectionCount,
  inquiryEvent,
  inquiryRow,
  inquirySourceId,
  inquirySummary,
  MarketingError,
  RECOVERABLE_DELIVERY_ERRORS,
  updateEvent,
} from './contract.ts';
import type { BusinessEvent, InquiryInput, InquiryUpdate } from './contract.ts';
import { stripeInvoiceToIsoMinor } from './payment-units.ts';

let pool: Pool | undefined;
function connection() {
  if (!process.env.DATABASE_URL)
    throw new MarketingError(
      'Customer inquiries are temporarily unavailable.',
      503,
    );
  return (pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  }));
}
export async function marketingTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await connection().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
const fingerprint = (value: object) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

async function enqueue(
  client: PoolClient,
  orgId: string,
  inquiryId: string,
  event: BusinessEvent,
) {
  await client.query(
    'INSERT INTO payload.marketing_outbox (id,org_id,inquiry_id,source_id,event) VALUES ($1,$2,$3,$4,$5::jsonb) ON CONFLICT (org_id,source_id) DO NOTHING',
    [randomUUID(), orgId, inquiryId, event.sourceId, JSON.stringify(event)],
  );
}

export async function saveInquiry(
  orgId: string,
  input: InquiryInput,
  rateKey: string,
) {
  return marketingTransaction(async (client) => {
    // Serializes retries before either the rate charge or contact write.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `marketing:${orgId}:${input.requestId}`,
    ]);
    const previous = await client.query(
      'SELECT id,request_fingerprint FROM payload.marketing_inquiries WHERE org_id=$1 AND request_id=$2',
      [orgId, input.requestId],
    );
    if (previous.rows[0]) {
      if (previous.rows[0].request_fingerprint !== fingerprint(input))
        throw new MarketingError(
          'This request changed. Start a new inquiry.',
          409,
        );
      return { id: z.uuid().parse(previous.rows[0].id), replayed: true };
    }
    const rate = await client.query(
      `INSERT INTO payload.marketing_rate_limits(key,window_start,attempts) VALUES($1,now(),1)
      ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN marketing_rate_limits.window_start < now()-interval '1 hour' THEN 1 ELSE marketing_rate_limits.attempts+1 END,
      window_start=CASE WHEN marketing_rate_limits.window_start < now()-interval '1 hour' THEN now() ELSE marketing_rate_limits.window_start END RETURNING attempts`,
      [rateKey],
    );
    if (rate.rows[0].attempts > 5)
      throw new MarketingError(
        'Too many inquiries. Please try again later.',
        429,
      );
    // A genuinely repeated inquiry reuses only this exact submitted prospect.
    // Neither an email domain nor an organization name alone establishes identity.
    const prospectSignature = fingerprint([
      input.email,
      input.audience,
      input.organizationName,
      input.organizationDomain,
    ]);
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `marketing:prospect:${orgId}:${prospectSignature}`,
    ]);
    const previousProspect = await client.query(
      'SELECT prospect_id FROM payload.marketing_inquiries WHERE org_id=$1 AND email=$2 AND audience=$3 AND organization_name=$4 AND organization_domain=$5 ORDER BY created_at,id LIMIT 1',
      [
        orgId,
        input.email,
        input.audience,
        input.organizationName,
        input.organizationDomain,
      ],
    );
    const id = randomUUID();
    const prospectId = z
      .uuid()
      .parse(previousProspect.rows[0]?.prospect_id ?? id);
    const result = await client.query(
      `INSERT INTO payload.marketing_inquiries(id,org_id,request_id,request_fingerprint,contact_name,email,audience,organization_name,organization_domain,contact_consent_at,signal_consent,prospect_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$11) RETURNING to_jsonb(marketing_inquiries) AS record`,
      [
        id,
        orgId,
        input.requestId,
        fingerprint(input),
        input.name,
        input.email,
        input.audience,
        input.organizationName,
        input.organizationDomain,
        input.signalConsent,
        prospectId,
      ],
    );
    const record = inquiryRow.parse(result.rows[0].record);
    if (record.signal_consent)
      await enqueue(client, orgId, id, inquiryEvent(record));
    return { id, replayed: false };
  });
}

export async function listInquiries(orgId: string) {
  const result = await connection().query(
    `SELECT to_jsonb(summary) AS record FROM (SELECT i.id,i.contact_name,i.email,i.audience,i.organization_name,i.created_at,i.signal_consent,i.withdrawn_at,i.billing_reference_id,
    (SELECT max(scheduled_at) FROM payload.marketing_updates u WHERE u.org_id=i.org_id AND u.inquiry_id=i.id) AS scheduled_at,
    (SELECT count(*)::int FROM payload.marketing_outbox o WHERE o.org_id=i.org_id AND o.inquiry_id=i.id AND state IN ('pending','accepted')) AS pending,
    (SELECT count(*)::int FROM payload.marketing_outbox o WHERE o.org_id=i.org_id AND o.inquiry_id=i.id AND state IN ('blocked','failed') AND error_code IS DISTINCT FROM 'consent_withdrawn') AS attention,
    (SELECT error_code FROM payload.marketing_outbox o WHERE o.org_id=i.org_id AND o.inquiry_id=i.id AND error_code IS NOT NULL AND error_code <> 'consent_withdrawn' ORDER BY created_at DESC LIMIT 1) AS last_error,
    (SELECT count(*)::int FROM payload.marketing_verified_payments p WHERE p.org_id=i.org_id AND p.customer_id=i.stripe_customer_id AND (p.evidence_status<>'verified' OR p.error_code IS NOT NULL) AND EXISTS(SELECT 1 FROM better_auth.subscription s WHERE s."stripeSubscriptionId"=p.subscription_id AND s."stripeCustomerId"=p.customer_id AND s."referenceId"=i.billing_reference_id)) AS billing_attention,
    (SELECT count(*)::int FROM payload.marketing_verified_payments p WHERE p.org_id=i.org_id AND p.customer_id=i.stripe_customer_id AND p.evidence_status='verified' AND NOT EXISTS(SELECT 1 FROM better_auth.subscription s WHERE s."stripeSubscriptionId"=p.subscription_id AND s."stripeCustomerId"=p.customer_id)) AS billing_waiting,
    (SELECT p.error_code FROM payload.marketing_verified_payments p WHERE p.org_id=i.org_id AND p.customer_id=i.stripe_customer_id AND p.error_code IS NOT NULL AND EXISTS(SELECT 1 FROM better_auth.subscription s WHERE s."stripeSubscriptionId"=p.subscription_id AND s."stripeCustomerId"=p.customer_id AND s."referenceId"=i.billing_reference_id) ORDER BY p.occurred_at DESC LIMIT 1) AS billing_error
    FROM payload.marketing_inquiries i WHERE i.org_id=$1 ORDER BY i.created_at DESC LIMIT 100) summary`,
    [orgId],
  );
  return result.rows.map((row) => inquirySummary.parse(row.record));
}

export async function saveInquiryUpdate(
  orgId: string,
  actorId: string,
  id: string,
  input: InquiryUpdate,
) {
  return marketingTransaction(async (client) => {
    if (input.action === 'link-billing')
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
        [`marketing:billing:${orgId}`],
      );
    const found = await client.query(
      'SELECT to_jsonb(i) AS record FROM payload.marketing_inquiries i WHERE org_id=$1 AND id=$2 FOR UPDATE',
      [orgId, id],
    );
    if (!found.rows[0]) throw new MarketingError('Inquiry not found.', 404);
    const record = inquiryRow.parse(found.rows[0].record);
    const signature = fingerprint({ id, input });
    const previous = await client.query(
      'SELECT request_fingerprint FROM payload.marketing_updates WHERE id=$1 AND org_id=$2',
      [input.requestId, orgId],
    );
    if (previous.rows[0]) {
      if (previous.rows[0].request_fingerprint !== signature)
        throw new MarketingError(
          'This update changed. Refresh the inquiry.',
          409,
        );
      return { id, replayed: true };
    }
    if (
      record.withdrawn_at &&
      input.action !== 'withdraw' &&
      input.action !== 'retry-delivery'
    )
      throw new MarketingError('This inquiry has been withdrawn.', 409);
    if (input.action === 'booking') {
      const scheduled = Date.parse(input.scheduledAt);
      if (
        scheduled < Date.now() - 300000 ||
        scheduled > Date.now() + 366 * 86400000
      )
        throw new MarketingError(
          'Choose a future discovery-call time within the next year.',
          422,
        );
    }
    if (input.action === 'link-billing') {
      // The subscription reference is resolved here. A submitted Stripe id or
      // email domain can never establish who paid or which business owns it.
      const linked = await client.query(
        `SELECT s."stripeCustomerId" AS customer_id FROM better_auth.subscription s
        WHERE s."referenceId"=$1 AND s."stripeCustomerId" IS NOT NULL AND s."stripeSubscriptionId" IS NOT NULL AND (
          EXISTS(SELECT 1 FROM better_auth.organization o WHERE o.id=s."referenceId") OR
          EXISTS(SELECT 1 FROM better_auth."user" u WHERE u.id=s."referenceId" AND lower(u.email)=$2 AND u."emailVerified"=true AND coalesce(u."guardianManaged",false)=false AND coalesce(u."isMinor",false)=false))
        ORDER BY s.id LIMIT 1`,
        [input.referenceId, record.email],
      );
      const customer = z
        .string()
        .regex(/^cus_[a-zA-Z0-9]+$/)
        .safeParse(linked.rows[0]?.customer_id);
      if (!customer.success)
        throw new MarketingError(
          'No verified adult or organization subscription matches this reference.',
          422,
        );
      const occupied = await client.query(
        'SELECT id FROM payload.marketing_inquiries WHERE org_id=$1 AND stripe_customer_id=$2 AND id<>$3',
        [orgId, customer.data, id],
      );
      if (occupied.rowCount)
        throw new MarketingError(
          'This subscription is already linked to another inquiry.',
          409,
        );
      await client.query(
        'UPDATE payload.marketing_inquiries SET stripe_customer_id=$1,billing_reference_id=$2 WHERE org_id=$3 AND id=$4',
        [customer.data, input.referenceId, orgId, id],
      );
      if (record.signal_consent) {
        await enqueueEligiblePayments(client, orgId, id);
      }
    }
    if (input.action === 'withdraw') {
      await client.query(
        'UPDATE payload.marketing_inquiries SET signal_consent=false,withdrawn_at=coalesce(withdrawn_at,now()) WHERE org_id=$1 AND id=$2',
        [orgId, id],
      );
      await client.query(
        "UPDATE payload.marketing_outbox SET state='blocked',event=null,error_code='consent_withdrawn' WHERE org_id=$1 AND inquiry_id=$2 AND operation='business-event' AND state <> 'delivered'",
        [orgId, id],
      );
      if (record.signal_consent)
        await client.query(
          `INSERT INTO payload.marketing_outbox(id,org_id,inquiry_id,source_id,operation,event) VALUES($1,$2,$3,$4,'withdrawal',$5::jsonb) ON CONFLICT(org_id,source_id) DO NOTHING`,
          [
            randomUUID(),
            orgId,
            id,
            `moyo.withdraw:${input.requestId}`,
            JSON.stringify({
              requestId: input.requestId,
              inquirySourceId: inquirySourceId(id),
            }),
          ],
        );
      await client.query(
        "UPDATE payload.marketing_outbox SET state='pending',attempts=0,next_attempt_at=now(),error_code=null WHERE org_id=$1 AND inquiry_id=$2 AND operation='withdrawal' AND state IN ('blocked','failed')",
        [orgId, id],
      );
    } else if (input.action === 'retry-billing') {
      await client.query(
        `UPDATE payload.marketing_verified_payments p SET next_verify_at=now()
        WHERE p.org_id=$1 AND p.customer_id=$2 AND p.evidence_status<>'verified'
        AND p.error_code IS DISTINCT FROM 'invoice_evidence_changed'
        AND EXISTS(SELECT 1 FROM better_auth.subscription s WHERE s."stripeSubscriptionId"=p.subscription_id AND s."stripeCustomerId"=p.customer_id AND s."referenceId"=$3)`,
        [orgId, record.stripe_customer_id, record.billing_reference_id],
      );
    } else if (input.action === 'retry-delivery') {
      // Same source ids and exact payloads: an unconfirmed response never turns
      // into a second business event. Revoked contact payloads stay suppressed.
      const retried = await client.query(
        `UPDATE payload.marketing_outbox SET state='pending',attempts=0,next_attempt_at=now(),error_code=null
        WHERE org_id=$1 AND inquiry_id=$2 AND state IN ('blocked','failed') AND event IS NOT NULL
        AND (operation='withdrawal' OR $3=true) AND error_code=ANY($4::varchar[])`,
        [
          orgId,
          id,
          record.signal_consent && !record.withdrawn_at,
          RECOVERABLE_DELIVERY_ERRORS,
        ],
      );
      if (!retried.rowCount)
        throw new MarketingError(
          'This delivery needs a source review; no recoverable events can be retried.',
          409,
        );
    } else if (
      (input.action === 'booking' || input.action === 'progress') &&
      record.signal_consent
    ) {
      await enqueue(client, orgId, id, updateEvent(record, input, new Date()));
    }
    await client.query(
      'INSERT INTO payload.marketing_updates(id,org_id,inquiry_id,actor_id,action,request_fingerprint,scheduled_at,stage) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        input.requestId,
        orgId,
        id,
        actorId,
        input.action,
        signature,
        input.action === 'booking' ? input.scheduledAt : null,
        input.action === 'progress' ? input.stage : null,
      ],
    );
    return { id, replayed: false };
  });
}

const paymentInput = z
  .object({
    invoiceId: z.string().regex(/^in_[a-zA-Z0-9]+$/),
    customerId: z.string().regex(/^cus_[a-zA-Z0-9]+$/),
    subscriptionId: z.string().regex(/^sub_[a-zA-Z0-9]+$/),
    amountCents: z.number().int().positive().max(2147483647),
    currency: z.string().regex(/^[A-Z]{3}$/),
    occurredAt: z.iso.datetime(),
    live: z.boolean(),
    evidenceStatus: z.enum(['verified', 'incomplete', 'mismatch']),
    moyoPriceSeen: z.boolean(),
  })
  .strict()
  .refine(
    (payment) => payment.evidenceStatus !== 'verified' || payment.moyoPriceSeen,
    'Verified Moyo evidence must include a configured plan price.',
  );
export type MarketingPayment = z.infer<typeof paymentInput>;
const paymentFromRow = z
  .object({
    id: z.string(),
    customer_id: z.string(),
    subscription_id: z.string(),
    amount_cents: z.number(),
    currency: z.string(),
    occurred_at: z.string(),
    live: z.boolean(),
    evidence_status: z.enum(['verified', 'incomplete', 'mismatch']),
    moyo_price_seen: z.boolean(),
  })
  .transform((row) =>
    paymentInput.parse({
      invoiceId: row.id,
      customerId: row.customer_id,
      subscriptionId: row.subscription_id,
      amountCents: row.amount_cents,
      currency: row.currency,
      occurredAt: new Date(row.occurred_at).toISOString(),
      live: row.live,
      evidenceStatus: row.evidence_status,
      moyoPriceSeen: row.moyo_price_seen,
    }),
  );
async function enqueuePayment(
  client: PoolClient,
  orgId: string,
  inquiryId: string,
  input: MarketingPayment,
) {
  // Keep the journal and immutable evidence identity in Stripe's original units.
  // Only the frozen Signal outcome uses the general ISO minor-unit contract.
  const amountMinor = stripeInvoiceToIsoMinor(
    input.amountCents,
    input.currency,
  );
  if (amountMinor === null) {
    await client.query(
      "UPDATE payload.marketing_verified_payments SET error_code='invoice_amount_unrepresentable' WHERE org_id=$1 AND id=$2",
      [orgId, input.invoiceId],
    );
    return;
  }
  await enqueue(client, orgId, inquiryId, {
    sourceId: `moyo.invoice:${input.invoiceId}`,
    kind: 'order',
    occurredAt: input.occurredAt,
    sourceRef: `record:${inquiryId}`,
    consent: true,
    path: '/for-schools',
    inquirySourceId: inquirySourceId(inquiryId),
    summary: 'Stripe confirmed a paid Moyo subscription invoice.',
    amount: { amountCents: amountMinor, currency: input.currency },
  });
}
const paymentIdentity = (payment: MarketingPayment) =>
  fingerprint([
    payment.invoiceId,
    payment.customerId,
    payment.subscriptionId,
    payment.amountCents,
    payment.currency,
    new Date(payment.occurredAt).toISOString(),
    payment.live,
  ]);

/** A customer alone is insufficient: the exact subscription must belong to the linked reference. */
async function enqueueEligiblePayments(
  client: PoolClient,
  orgId: string,
  inquiryId?: string,
) {
  const eligible = await client.query(
    `SELECT i.id AS inquiry_id,to_jsonb(p) AS record FROM payload.marketing_inquiries i
    JOIN payload.marketing_verified_payments p ON p.org_id=i.org_id AND p.customer_id=i.stripe_customer_id
    WHERE i.org_id=$1 AND ($2::uuid IS NULL OR i.id=$2::uuid) AND i.signal_consent=true AND i.withdrawn_at IS NULL
    AND p.evidence_status='verified' AND p.moyo_price_seen=true AND p.error_code IS NULL
    AND EXISTS(SELECT 1 FROM better_auth.subscription s WHERE s."stripeSubscriptionId"=p.subscription_id AND s."stripeCustomerId"=p.customer_id AND s."referenceId"=i.billing_reference_id)
    AND NOT EXISTS(SELECT 1 FROM payload.marketing_outbox o WHERE o.org_id=i.org_id AND o.source_id='moyo.invoice:'||p.id)
    ORDER BY p.occurred_at,p.id LIMIT 50 FOR UPDATE OF i`,
    [orgId, inquiryId ?? null],
  );
  for (const row of eligible.rows)
    await enqueuePayment(
      client,
      orgId,
      z.uuid().parse(row.inquiry_id),
      paymentFromRow.parse(row.record),
    );
}

export async function saveVerifiedPayment(
  orgId: string,
  payment: MarketingPayment,
) {
  const input = paymentInput.parse(payment);
  if (!input.live && process.env.NODE_ENV === 'production') return;
  return marketingTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `marketing:billing:${orgId}`,
    ]);
    // Unknown complete prices on a non-Moyo subscription are unrelated to this app.
    // Incomplete evidence is held privately until an exact canonical association can
    // establish whether it belongs here. It never becomes revenue by customer match.
    if (!input.moyoPriceSeen && input.evidenceStatus !== 'incomplete') {
      const canonical = await client.query(
        'SELECT 1 FROM better_auth.subscription WHERE "stripeSubscriptionId"=$1 AND "stripeCustomerId"=$2 LIMIT 1',
        [input.subscriptionId, input.customerId],
      );
      if (!canonical.rowCount) return;
    }
    const previous = await client.query(
      'SELECT to_jsonb(p) AS record FROM payload.marketing_verified_payments p WHERE org_id=$1 AND id=$2',
      [orgId, input.invoiceId],
    );
    if (previous.rows[0]) {
      const stored = paymentFromRow.safeParse(previous.rows[0].record);
      if (
        !stored.success ||
        paymentIdentity(stored.data) !== paymentIdentity(input)
      ) {
        await client.query(
          "UPDATE payload.marketing_verified_payments SET error_code='invoice_evidence_changed' WHERE org_id=$1 AND id=$2",
          [orgId, input.invoiceId],
        );
        return;
      }
    }
    const evidenceError =
      stripeInvoiceToIsoMinor(input.amountCents, input.currency) === null
        ? 'invoice_amount_unrepresentable'
        : input.evidenceStatus === 'verified'
          ? null
          : input.evidenceStatus === 'incomplete'
            ? 'invoice_evidence_incomplete'
            : 'invoice_price_or_subscription_mismatch';
    // Durable before the subscription association or inquiry billing link exists.
    // Proof can improve, but a previously verified receipt is never weakened by a
    // later configuration change. Core payment facts cannot be rewritten on replay.
    await client.query(
      `INSERT INTO payload.marketing_verified_payments(id,org_id,customer_id,subscription_id,amount_cents,currency,occurred_at,live,evidence_status,moyo_price_seen,error_code)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT(org_id,id) DO UPDATE SET
      evidence_status=CASE WHEN marketing_verified_payments.evidence_status='verified' THEN 'verified' ELSE excluded.evidence_status END,
      moyo_price_seen=marketing_verified_payments.moyo_price_seen OR excluded.moyo_price_seen,
      error_code=CASE WHEN marketing_verified_payments.error_code='invoice_evidence_changed' THEN marketing_verified_payments.error_code
        WHEN excluded.error_code='invoice_amount_unrepresentable' THEN excluded.error_code
        WHEN marketing_verified_payments.evidence_status='verified' THEN NULL ELSE excluded.error_code END`,
      [
        input.invoiceId,
        orgId,
        input.customerId,
        input.subscriptionId,
        input.amountCents,
        input.currency,
        input.occurredAt,
        input.live,
        input.evidenceStatus,
        input.moyoPriceSeen,
        evidenceError,
      ],
    );
    await enqueueEligiblePayments(client, orgId);
  });
}

/** Handles invoice.paid arriving before subscription.created, including already-linked inquiries. */
export async function reconcileVerifiedPayments(orgId: string) {
  await marketingTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
      `marketing:billing:${orgId}`,
    ]);
    await enqueueEligiblePayments(client, orgId);
  });
}

/** Revalidate retained/legacy orders at the final sending boundary. */
export async function hasVerifiedOrderReceipt(
  client: PoolClient,
  orgId: string,
  inquiryId: string,
  event: Extract<BusinessEvent, { kind: 'order' }>,
) {
  if (
    !event.sourceId.startsWith('moyo.invoice:') ||
    event.inquirySourceId !== inquirySourceId(inquiryId)
  )
    return false;
  const result = await client.query(
    `SELECT p.amount_cents,p.currency FROM payload.marketing_verified_payments p JOIN payload.marketing_inquiries i
    ON i.org_id=p.org_id AND i.stripe_customer_id=p.customer_id
    WHERE p.org_id=$1 AND i.id=$2 AND p.id=$3 AND p.evidence_status='verified' AND p.moyo_price_seen=true AND p.error_code IS NULL
    AND p.currency=$4 AND p.occurred_at=$5::timestamptz
    AND EXISTS(SELECT 1 FROM better_auth.subscription s WHERE s."stripeSubscriptionId"=p.subscription_id AND s."stripeCustomerId"=p.customer_id AND s."referenceId"=i.billing_reference_id)`,
    [
      orgId,
      inquiryId,
      event.sourceId.slice('moyo.invoice:'.length),
      event.amount.currency,
      event.occurredAt,
    ],
  );
  const payment = result.rows[0];
  return Boolean(
    payment &&
    stripeInvoiceToIsoMinor(payment.amount_cents, payment.currency) ===
      event.amount.amountCents,
  );
}

/** One bounded private verification attempt per worker run; no raw invoice body is retained. */
export async function repairPaymentEvidence(
  orgId: string,
  inspect: (
    receipt: Pick<MarketingPayment, 'invoiceId' | 'occurredAt'>,
  ) => Promise<MarketingPayment | null>,
) {
  const candidate = await marketingTransaction(async (client) => {
    const result = await client.query(
      `SELECT to_jsonb(p) AS record FROM payload.marketing_verified_payments p
      WHERE p.org_id=$1 AND p.evidence_status IN ('incomplete','mismatch') AND p.next_verify_at<=now()
      AND p.error_code IS DISTINCT FROM 'invoice_evidence_changed'
      AND EXISTS(SELECT 1 FROM payload.marketing_inquiries i JOIN better_auth.subscription s
        ON s."referenceId"=i.billing_reference_id AND s."stripeCustomerId"=i.stripe_customer_id
        WHERE i.org_id=p.org_id AND i.stripe_customer_id=p.customer_id AND s."stripeSubscriptionId"=p.subscription_id
        AND i.signal_consent=true AND i.withdrawn_at IS NULL)
      ORDER BY p.next_verify_at,p.id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [orgId],
    );
    if (!result.rows[0]) return null;
    const item = paymentFromRow.parse(result.rows[0].record);
    await client.query(
      "UPDATE payload.marketing_verified_payments SET next_verify_at=now()+interval '30 minutes' WHERE org_id=$1 AND id=$2",
      [orgId, item.invoiceId],
    );
    return item;
  });
  if (!candidate) return;
  try {
    const inspected = await inspect({
      invoiceId: candidate.invoiceId,
      occurredAt: candidate.occurredAt,
    });
    if (!inspected) {
      await connection().query(
        "UPDATE payload.marketing_verified_payments SET error_code='invoice_evidence_unavailable' WHERE org_id=$1 AND id=$2 AND evidence_status<>'verified'",
        [orgId, candidate.invoiceId],
      );
      return;
    }
    if (paymentIdentity(inspected) !== paymentIdentity(candidate)) {
      await connection().query(
        "UPDATE payload.marketing_verified_payments SET error_code='invoice_evidence_changed' WHERE org_id=$1 AND id=$2",
        [orgId, candidate.invoiceId],
      );
      return;
    }
    await saveVerifiedPayment(orgId, inspected);
  } catch {
    await connection().query(
      "UPDATE payload.marketing_verified_payments SET error_code='invoice_verification_unavailable' WHERE org_id=$1 AND id=$2 AND evidence_status<>'verified'",
      [orgId, candidate.invoiceId],
    );
  }
}

export async function connectionStatus(orgId: string) {
  const result = await connection().query(
    `SELECT to_jsonb(summary) AS record FROM (SELECT state,count(*)::int AS count,max(delivered_at) AS last_delivered_at FROM payload.marketing_outbox WHERE org_id=$1 AND error_code IS DISTINCT FROM 'consent_withdrawn' GROUP BY state) summary`,
    [orgId],
  );
  return result.rows.map((row) => connectionCount.parse(row.record));
}
