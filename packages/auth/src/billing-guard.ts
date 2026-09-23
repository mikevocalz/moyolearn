// Guard Better Auth's billing routes before the Stripe plugin can create or update anything.
// The plugin's authorizeReference is not called for the acting user's own id.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §4
// SOT-KEYWORDS: billing guard learner minor plan customer type authorization
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { z } from 'zod';
import { PLANS, isPlanName } from './billing-plans.ts';
import { entitlementsFor } from './entitlements.ts';
import { readRevenueCatFamily, revenueCatEnabled } from './revenuecat.ts';

const upgradeSchema = z.object({
  plan: z.string(),
  customerType: z.enum(['user', 'organization']).default('user'),
  referenceId: z.string().optional(),
  seats: z.number().optional(),
});
const adultSchema = z.object({
  id: z.string(),
  guardianManaged: z.boolean().nullish(),
  isMinor: z.boolean().nullish(),
});

export function permitsBillingPlan(body: z.infer<typeof upgradeSchema>, userId: string) {
  if (!isPlanName(body.plan)) return false;
  const plan = PLANS[body.plan];
  if (body.customerType !== plan.customerType) return false;
  if (plan.customerType === 'user') {
    return (!body.referenceId || body.referenceId === userId)
      && (body.seats === undefined || body.seats === 1);
  }
  return body.referenceId !== userId;
}

export const billingGuard = createAuthMiddleware(async (ctx) => {
  if (!ctx.path?.startsWith('/subscription/') || ctx.path === '/subscription/success') return;
  const session = await getSessionFromCtx(ctx);
  if (!session) throw new APIError('UNAUTHORIZED', { message: 'Sign in to manage billing.' });
  const parsedUser = adultSchema.safeParse(session.user);
  if (!parsedUser.success) throw new APIError('UNAUTHORIZED', { message: 'Sign in to manage billing.' });
  const user = parsedUser.data;
  if (user.guardianManaged || user.isMinor) {
    throw new APIError('FORBIDDEN', { message: 'Billing is available to adults only.' });
  }
  if (ctx.path !== '/subscription/upgrade') return;
  const body = upgradeSchema.safeParse(ctx.body);
  if (!body.success || !permitsBillingPlan(body.data, user.id)) {
    throw new APIError('BAD_REQUEST', { message: 'This plan does not match the billing account.' });
  }
  if (body.data.customerType === 'user' && revenueCatEnabled()) {
    const subscriptions = await readRevenueCatFamily(user.id);
    if (subscriptions.some((subscription) => subscription.billingStore !== 'stripe'
      && entitlementsFor(subscription).active)) {
      throw new APIError('BAD_REQUEST', { message: 'Manage your existing subscription in the store where you purchased it.' });
    }
  }
});
