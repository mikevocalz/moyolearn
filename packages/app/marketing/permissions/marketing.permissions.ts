import 'server-only';
// Internal Payload identity boundary, independent of paid customer organizations.
// SOT: docs/pack/06-auth-onboarding-spec.md §Account model · docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing internal admin payload identity allowlist scope
import { z } from 'zod';
import { createHmac } from 'node:crypto';
import {
  MarketingError,
  paymentInput,
  trustedOrigin,
} from '../schemas/marketing.schema.ts';
import type { MarketingPayment } from '../schemas/marketing.schema.ts';
import type { OperationDescriptor } from '../../core/telemetry.ts';

// A projection of Payload's already-authenticated request, not a sign-in input.
// Keeping the boundary schema here avoids pulling the CMS/Next SDK types into
// the cross-platform app package. Hosts typecheck their real Payload request against it.
const internalIdentity = z.object({
  id: z.union([z.string().min(1), z.number().int()]),
  collection: z.string().optional(),
});
export type MarketingInternalRequest = Pick<Request, 'headers'> & {
  user?: z.input<typeof internalIdentity> | null;
};
const identityFilter = (ids: string[]) => ({ id: { not_in: ids } });

// A private source partition, not a Better Auth customer organization ID.
export const MOYO_MARKETING_SCOPE = 'moyo-platform-sales';
const administratorIds = () =>
  process.env.MOYO_MARKETING_ADMIN_IDS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
export function isMarketingAdministrator(
  user: MarketingInternalRequest['user'],
): boolean {
  const identity = internalIdentity.safeParse(user);
  return (
    identity.success &&
    identity.data.collection === 'users' &&
    administratorIds().includes(String(identity.data.id))
  );
}

/**
 * Payload's default internal-Users access allows staff to edit every user.
 * Protect configured sales identities from credential takeover by other staff.
 * Updates to one's own identity remain available; deletion requires removing
 * that identity from the server-owned allowlist first. Payload combines this
 * Where with both direct-ID and bulk mutation queries.
 */
export function marketingIdentityAccess(
  user:
    | Pick<NonNullable<MarketingInternalRequest['user']>, 'id' | 'collection'>
    | null
    | undefined,
  operation: 'update' | 'delete',
): boolean | ReturnType<typeof identityFilter> {
  if (!user || user.collection !== 'users') return false;
  const protectedIds = administratorIds().filter(
    (id) => operation === 'delete' || id !== String(user.id),
  );
  return protectedIds.length ? identityFilter(protectedIds) : true;
}
export function marketingAdministrator(
  request: MarketingInternalRequest,
  mutation = false,
): string {
  if (!request.user)
    throw new MarketingError('Sign in to the Moyo internal admin.', 401);
  if (!isMarketingAdministrator(request.user))
    throw new MarketingError(
      'This internal account is not authorized for Moyo sales inquiries.',
      403,
    );
  const allowed =
    process.env.MOYO_MARKETING_ADMIN_ORIGIN ?? 'https://admin.moyolearn.com';
  const domain = new URL(allowed);
  const host = (
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase();
  if (
    domain.protocol !== 'https:' ||
    domain.origin !== allowed ||
    host !== domain.host
  )
    throw new MarketingError(
      'Open Moyo inquiries on the internal admin site.',
      403,
    );
  if (mutation && request.headers.get('origin') !== allowed)
    throw new MarketingError(
      'Open Moyo inquiries on the internal admin site.',
      403,
    );
  return `payload:${request.user.id}`;
}

export function marketingOrigin(
  origin: string | null,
): ReturnType<typeof trustedOrigin> {
  return trustedOrigin(
    origin,
    process.env.MOYO_MARKETING_ALLOWED_ORIGINS ?? 'https://www.moyolearn.com',
  );
}

const contexts = {
  internal: (actorId: string) => ({
    kind: 'internal-admin' as const,
    scope: MOYO_MARKETING_SCOPE,
    actorId,
  }),
  public: (rateKey: string) => ({
    kind: 'anonymous' as const,
    scope: MOYO_MARKETING_SCOPE,
    rateKey,
  }),
  machine: () => ({ kind: 'machine' as const, scope: MOYO_MARKETING_SCOPE }),
  billing: (payment: MarketingPayment) => ({
    kind: 'machine' as const,
    scope: MOYO_MARKETING_SCOPE,
    payment,
  }),
};

export function marketingInternalContext(
  request: MarketingInternalRequest,
  mutation: boolean,
): ReturnType<typeof contexts.internal> {
  const actorId = marketingAdministrator(request, mutation);
  return contexts.internal(actorId);
}

export function marketingPublicContext(
  request: Pick<Request, 'headers'>,
): ReturnType<typeof contexts.public> {
  if (!marketingOrigin(request.headers.get('origin')))
    throw new MarketingError('Open the inquiry form on Moyo’s website.', 403);
  const secret = process.env.MOYO_MARKETING_RATE_SECRET;
  if (!secret)
    throw new MarketingError(
      'Customer inquiries are temporarily unavailable.',
      503,
    );
  // Only Vercel's overwritten address contributes; no raw address is retained.
  const ip =
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown';
  const rateKey = createHmac('sha256', secret)
    .update(
      `${MOYO_MARKETING_SCOPE}:${ip}:${new Date().toISOString().slice(0, 10)}`,
    )
    .digest('hex');
  return contexts.public(rateKey);
}

export function marketingCronContext(
  request: Pick<Request, 'headers'>,
): ReturnType<typeof contexts.machine> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    throw new MarketingError('Unauthorized', 401);
  return contexts.machine();
}

/** The only caller is the signature-verified Better Auth billing callback. */
export function marketingBillingContext(
  payment: MarketingPayment,
): ReturnType<typeof contexts.billing> {
  const parsed = paymentInput.safeParse(payment);
  if (!parsed.success)
    throw new MarketingError('Invalid verified payment receipt.', 422);
  return contexts.billing(parsed.data);
}

/**
 * Fixed entry-point policies, not an arbitrary context/authorization override.
 * Payload's authenticated request is passed intact; identity never comes from JSON.
 */
export type MarketingOperation<R> =
  | {
      source: 'payload-internal';
      request: MarketingInternalRequest;
      action: 'read' | 'write';
      operation: (
        ctx: ReturnType<typeof marketingInternalContext>,
      ) => Promise<R>;
      telemetry: OperationDescriptor;
    }
  | {
      source: 'public-inquiry';
      request: Pick<Request, 'headers'>;
      operation: (ctx: ReturnType<typeof marketingPublicContext>) => Promise<R>;
      telemetry: OperationDescriptor;
    }
  | {
      source: 'marketing-cron';
      request: Pick<Request, 'headers'>;
      operation: (ctx: ReturnType<typeof marketingCronContext>) => Promise<R>;
      telemetry: OperationDescriptor;
    }
  | {
      source: 'billing-callback';
      payment: MarketingPayment;
      operation: (
        ctx: ReturnType<typeof marketingBillingContext>,
      ) => Promise<R>;
      telemetry: OperationDescriptor;
    };
