import '@tanstack/react-start/server-only';
// Internal Payload identity boundary, independent of paid customer organizations.
// SOT: docs/pack/06-auth-onboarding-spec.md §Account model · docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing internal admin payload identity allowlist scope
import type { AccessResult, PayloadRequest } from 'payload';
import { MarketingError } from './contract.ts';

// A private source partition, not a Better Auth customer organization ID.
export const MOYO_MARKETING_SCOPE = 'moyo-platform-sales';
const administratorIds = () =>
  process.env.MOYO_MARKETING_ADMIN_IDS?.split(',')
    .map((value) => value.trim())
    .filter(Boolean) ?? [];
export function isMarketingAdministrator(user: PayloadRequest['user']) {
  if (!user || user.collection !== 'users') return false;
  return administratorIds().includes(String(user.id));
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
    | Pick<NonNullable<PayloadRequest['user']>, 'id' | 'collection'>
    | null
    | undefined,
  operation: 'update' | 'delete',
): AccessResult {
  if (!user || user.collection !== 'users') return false;
  const protectedIds = administratorIds().filter(
    (id) => operation === 'delete' || id !== String(user.id),
  );
  return protectedIds.length ? { id: { not_in: protectedIds } } : true;
}
export function marketingAdministrator(
  request: Pick<PayloadRequest, 'user' | 'headers'>,
  mutation = false,
) {
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
