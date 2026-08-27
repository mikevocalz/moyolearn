// The server-side entitlement READ: Better Auth's own `subscription` rows,
// projected into the `SubscriptionState` shape `entitlementsFor` consumes. This
// is what makes the server — not the client store — the real plan boundary.
//
// It goes through the adapter rather than `auth.api.listActiveSubscriptions`
// DELIBERATELY. That endpoint runs the Stripe plugin's `referenceMiddleware`,
// which for an organisation reference calls our `authorizeReference` and admits
// only `owner`/`finance` (billing-plans.ts §BILLING_ROLES). Billing MANAGEMENT
// is rightly that narrow; an entitlement CHECK is not — a scheduler running an
// org operation has to know the org's plan, and routing that read through the
// billing endpoint would refuse every non-finance member and read as "your org
// has no plan". Same table, different question.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/05-monetization-access-spec.md §1.2 · §6
// SOT-KEYWORDS: subscription reader entitlement server plan stripe better-auth adapter referenceid

import type { Subscription } from '@better-auth/stripe';
import { isPlanName } from './billing-plans.ts';
import type { SubscriptionState, SubscriptionStatus } from './entitlements.ts';
import type { Auth } from './server.ts';

/** Derived from the plugin's own row type — the four columns this projection reads. */
export type SubscriptionRow = Pick<Subscription, 'plan' | 'status' | 'referenceId' | 'periodEnd'>;

/**
 * Stripe ships eight statuses; doc 06 §4's projection names six. The two extra
 * pairs collapse rather than widen:
 *   `unpaid` → `canceled`. `past_due` keeps writing because Stripe is still
 *     retrying a card that usually succeeds; `unpaid` is the state AFTER those
 *     retries are exhausted, so the benefit of the doubt has already been spent.
 *   `paused` → `canceled`. A paused subscription is not billing and not
 *     serving; read-only grace plus export (doc 05 §6) is exactly right for it.
 *   `incomplete_expired` → `incomplete`. Both mean the first payment never
 *     landed, which is "never started", not "ended".
 * The map is exhaustive over the plugin's union, so a status Better Auth adds
 * later fails the build here instead of falling through to a default.
 */
const STATUS: Record<Subscription['status'], SubscriptionStatus> = {
  active: 'active',
  trialing: 'trialing',
  past_due: 'past_due',
  canceled: 'canceled',
  paused: 'canceled',
  unpaid: 'canceled',
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete',
};

/**
 * Row → projection. An unrecognised `plan` string becomes `null` rather than a
 * cast: a row naming a plan this build does not ship must not carry that plan's
 * limits, and `null` resolves to the zeroed limits in `entitlementsFor`.
 */
export function toSubscriptionState(row: SubscriptionRow): SubscriptionState {
  return {
    plan: isPlanName(row.plan) ? row.plan : null,
    status: STATUS[row.status],
    referenceId: row.referenceId,
    periodEnd: row.periodEnd ? new Date(row.periodEnd).toISOString() : null,
  };
}

/**
 * Every subscription row filed against one reference — a guardian's user id or
 * an organisation id.
 *
 * A read that throws resolves to an EMPTY list, which projects to
 * `NO_SUBSCRIPTION`: paid capabilities refuse, while export and the child's
 * practice floor survive (doc 05 §1.2, §6). A deployment with no Stripe keys
 * has no `subscription` table at all, and that deployment must serve learners
 * and refuse paid writes — not crash, and not grant.
 */
export async function readSubscriptions(
  auth: Auth,
  referenceId: string,
): Promise<SubscriptionState[]> {
  return rowsFor(auth, [referenceId]);
}

/**
 * Every plan the acting user can be judged against: their own, plus one per
 * organisation they belong to. This is what the client store is filled from,
 * because a person can switch context between orgs without a round trip and
 * `subscriptionFor` needs all of them in hand to answer.
 *
 * The org ids are DERIVED from the user id through the membership table, never
 * accepted from the caller (CLAUDE.md · The block) — an org id in a request body
 * is an org id an attacker picks.
 */
export async function readSessionSubscriptions(
  auth: Auth,
  userId: string,
): Promise<SubscriptionState[]> {
  try {
    const context = await auth.$context;
    const memberships = await context.adapter.findMany<{ organizationId: string }>({
      model: 'member',
      where: [{ field: 'userId', value: userId }],
    });
    return rowsFor(auth, [userId, ...memberships.map((m) => m.organizationId)]);
  } catch {
    return [];
  }
}

async function rowsFor(auth: Auth, referenceIds: string[]): Promise<SubscriptionState[]> {
  if (referenceIds.length === 0) return [];
  try {
    const context = await auth.$context;
    const rows = await context.adapter.findMany<SubscriptionRow>({
      model: 'subscription',
      where: [{ field: 'referenceId', operator: 'in', value: referenceIds }],
    });
    return rows.map(toSubscriptionState);
  } catch {
    return [];
  }
}
