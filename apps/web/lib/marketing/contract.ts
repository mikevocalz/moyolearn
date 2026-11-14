// Adult marketing records and the narrow SignalIQ projection.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing inquiry signaliq schema consent business event
import { z } from 'zod';

const shortText = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value));
export const inquiryInput = z
  .object({
    requestId: z.uuid(),
    name: shortText,
    email: z.email().trim().toLowerCase().max(320),
    audience: z.enum(['school', 'tutoring-business', 'parent']),
    organizationName: z.string().trim().max(200).default(''),
    // This is supplied organization context, never evidence of employment.
    organizationDomain: z
      .string()
      .trim()
      .toLowerCase()
      .max(253)
      .default('')
      .refine(
        (value) =>
          value === '' ||
          /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
            value,
          ),
      ),
    adult: z.literal(true),
    contactConsent: z.literal(true),
    // Optional sharing is independent of the request to speak with Moyo.
    signalConsent: z.boolean(),
    website: z.literal('').default(''),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.audience !== 'parent' && !value.organizationName)
      ctx.addIssue({
        code: 'custom',
        path: ['organizationName'],
        message: 'Enter your school or business name.',
      });
    if (
      value.audience === 'parent' &&
      (value.organizationName || value.organizationDomain)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['organizationName'],
        message: 'Family inquiries do not need an organization.',
      });
  });
export type InquiryInput = z.infer<typeof inquiryInput>;

export const updateInput = z.discriminatedUnion('action', [
  z
    .object({
      requestId: z.uuid(),
      action: z.literal('booking'),
      scheduledAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      requestId: z.uuid(),
      action: z.literal('progress'),
      stage: z.enum(['contacted', 'pilot-started', 'proposal-sent', 'closed']),
    })
    .strict(),
  z
    .object({
      requestId: z.uuid(),
      action: z.literal('link-billing'),
      referenceId: z.string().min(1).max(200),
    })
    .strict(),
  z.object({ requestId: z.uuid(), action: z.literal('withdraw') }).strict(),
  z
    .object({ requestId: z.uuid(), action: z.literal('retry-delivery') })
    .strict(),
]);
export type InquiryUpdate = z.infer<typeof updateInput>;

export const inquiryRow = z.object({
  id: z.uuid(),
  org_id: z.string(),
  request_id: z.uuid(),
  contact_name: z.string(),
  email: z.string(),
  audience: z.enum(['school', 'tutoring-business', 'parent']),
  organization_name: z.string(),
  organization_domain: z.string(),
  signal_consent: z.boolean(),
  withdrawn_at: z.string().nullable(),
  created_at: z.string(),
  stripe_customer_id: z.string().nullable(),
  billing_reference_id: z.string().nullable(),
});
export type InquiryRecord = z.infer<typeof inquiryRow>;
export const inquirySummary = z.object({
  id: z.uuid(),
  contact_name: z.string(),
  email: z.string(),
  audience: inquiryRow.shape.audience,
  organization_name: z.string(),
  created_at: z.string(),
  signal_consent: z.boolean(),
  withdrawn_at: z.string().nullable(),
  billing_reference_id: z.string().nullable(),
  scheduled_at: z.string().nullable(),
  pending: z.number().int(),
  attention: z.number().int(),
  last_error: z.string().nullable(),
});
export type InquirySummary = z.infer<typeof inquirySummary>;
export const connectionCount = z.object({
  state: z.enum(['pending', 'accepted', 'delivered', 'blocked', 'failed']),
  count: z.number().int(),
  last_delivered_at: z.string().nullable(),
});
export const marketingInboxResponse = z.object({
  inquiries: z.array(inquirySummary),
  delivery: z.array(connectionCount),
  configured: z.boolean(),
});

const sourceFields = {
  sourceId: z.string().min(1).max(200),
  occurredAt: z.iso.datetime({ offset: true }),
  sourceRef: z.string(),
  consent: z.literal(true),
  path: z.literal('/for-schools'),
  summary: z.string().max(2000),
};
export const businessEvent = z.discriminatedUnion('kind', [
  z
    .object({
      ...sourceFields,
      kind: z.literal('inquiry'),
      contact: z.object({ email: z.email(), name: z.string() }).strict(),
      organization: z
        .object({
          externalId: z.string(),
          name: z.string(),
          domain: z.string().optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      ...sourceFields,
      kind: z.enum(['booking', 'progress']),
      inquirySourceId: z.string(),
    })
    .strict(),
  z
    .object({
      ...sourceFields,
      kind: z.literal('order'),
      inquirySourceId: z.string(),
      amount: z
        .object({
          amountCents: z.number().int().positive(),
          currency: z.string().regex(/^[A-Z]{3}$/),
        })
        .strict(),
    })
    .strict(),
]);
export type BusinessEvent = z.infer<typeof businessEvent>;
export const receipt = z.object({
  sourceEventId: z.uuid(),
  state: z.enum(['processed', 'queued', 'blocked', 'failed']),
  reason: z.string().nullable().optional(),
});
export const inquirySourceId = (id: string) => `moyo.inquiry:${id}`;

export function inquiryEvent(record: InquiryRecord): BusinessEvent {
  return businessEvent.parse({
    sourceId: inquirySourceId(record.id),
    kind: 'inquiry',
    occurredAt: record.created_at,
    sourceRef: `record:${record.id}`,
    consent: true,
    path: '/for-schools',
    contact: { email: record.email, name: record.contact_name },
    ...(record.audience === 'parent'
      ? {}
      : {
          organization: {
            externalId: `moyo.prospect:${record.id}`,
            name: record.organization_name,
            ...(record.organization_domain
              ? { domain: record.organization_domain }
              : {}),
          },
        }),
    summary:
      record.audience === 'parent'
        ? 'An adult requested information about Moyo family tutoring.'
        : 'An adult requested a Moyo school or tutoring-business demonstration.',
  });
}

export function updateEvent(
  record: InquiryRecord,
  update: Extract<InquiryUpdate, { action: 'booking' | 'progress' }>,
  now: Date,
): BusinessEvent {
  return businessEvent.parse({
    sourceId: `moyo.${update.action}:${update.requestId}`,
    kind: update.action,
    occurredAt: now.toISOString(),
    sourceRef: `record:${update.requestId}`,
    consent: true,
    path: '/for-schools',
    inquirySourceId: inquirySourceId(record.id),
    summary:
      update.action === 'booking'
        ? `Moyo staff scheduled a discovery call for ${new Date(update.scheduledAt).toISOString()}.`
        : `Moyo staff recorded business progress: ${update.stage.replaceAll('-', ' ')}.`,
  });
}

export function trustedOrigin(
  origin: string | null,
  allowed: string,
): string | null {
  if (!origin) return null;
  return (
    allowed
      .split(',')
      .map((value) => value.trim())
      .find((value) => {
        try {
          const parsed = new URL(value);
          return (
            parsed.protocol === 'https:' &&
            parsed.origin === value &&
            value === origin
          );
        } catch {
          return false;
        }
      }) ?? null
  );
}

export class MarketingError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'MarketingError';
    this.status = status;
  }
}
