// The plan catalogue and the reference rules — doc 06 §4's "config of record".
//
// Price ids come from the environment, never from source: they differ per Stripe
// mode and a committed one is a live price nobody can change without a deploy.
// The SHAPE is here because it is a product decision (who may buy what, on whose
// behalf, with which limits) and that shape has to be testable without a network.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · docs/pack/05-monetization-access-spec.md §1.1
// SOT-KEYWORDS: stripe billing plans price entitlement authorize reference org family trial

/** Who a subscription is bought FOR. Family plans belong to a person, ops to an org. */
export type CustomerType = 'user' | 'organization';

export type PlanName =
  | 'family-early-bird'
  | 'family'
  | 'ops-solo'
  | 'ops-studio'
  | 'ops-scale';

export interface PlanLimits {
  /** S19's automated pay runs. Gated at Studio (doc 06 §4). */
  payoutAutomation: number;
}

export interface Plan {
  name: PlanName;
  customerType: CustomerType;
  /** Env var holding the monthly price id. Read at wiring time, never inlined. */
  priceEnv: string;
  annualPriceEnv?: string;
  trialDays: number;
  limits: PlanLimits;
}

const NO_LIMITS: PlanLimits = { payoutAutomation: 0 };

/**
 * 30 days everywhere (doc 06 §4). The plugin's own trial-abuse check enforces
 * one trial per customer, which is why nothing here tracks whether a trial has
 * been used — duplicating that would be a second, disagreeing answer.
 */
const TRIAL_DAYS = 30;

export const PLANS: Record<PlanName, Plan> = {
  'family-early-bird': {
    name: 'family-early-bird',
    customerType: 'user',
    priceEnv: 'STRIPE_PRICE_FAMILY_EARLY_BIRD',
    annualPriceEnv: 'STRIPE_PRICE_FAMILY_EARLY_BIRD_ANNUAL',
    trialDays: TRIAL_DAYS,
    limits: NO_LIMITS,
  },
  family: {
    name: 'family',
    customerType: 'user',
    priceEnv: 'STRIPE_PRICE_FAMILY',
    annualPriceEnv: 'STRIPE_PRICE_FAMILY_ANNUAL',
    trialDays: TRIAL_DAYS,
    limits: NO_LIMITS,
  },
  'ops-solo': {
    name: 'ops-solo',
    customerType: 'organization',
    priceEnv: 'STRIPE_PRICE_OPS_SOLO',
    trialDays: TRIAL_DAYS,
    limits: NO_LIMITS,
  },
  'ops-studio': {
    name: 'ops-studio',
    customerType: 'organization',
    priceEnv: 'STRIPE_PRICE_OPS_STUDIO',
    trialDays: TRIAL_DAYS,
    // The Studio upsell made real (doc 06 §4): this single number is what
    // unlocks S19's pay runs, and it is why the tier exists.
    limits: { payoutAutomation: 1 },
  },
  'ops-scale': {
    name: 'ops-scale',
    customerType: 'organization',
    priceEnv: 'STRIPE_PRICE_OPS_SCALE',
    trialDays: TRIAL_DAYS,
    limits: { payoutAutomation: 1 },
  },
};

export const isPlanName = (value: string): value is PlanName => value in PLANS;

/** Family plans are bought by a guardian for themselves; ops plans by an org. */
export const plansFor = (customerType: CustomerType) =>
  Object.values(PLANS).filter((plan) => plan.customerType === customerType);

/** Roles that may spend an organisation's money. Doc 06 §4 names both. */
export const BILLING_ROLES = ['owner', 'finance'] as const;
export type BillingRole = (typeof BILLING_ROLES)[number];

export interface ReferenceRequest {
  plan: PlanName;
  /** The guardian's user id, or the organisation id — never anything else. */
  referenceId: string;
  user: { id: string };
  /** The acting user's role in the org named by `referenceId`, if any. */
  membershipRole?: string;
}

/**
 * `authorizeReference` (doc 06 §4). Better Auth asks this before letting a user
 * act on a subscription that carries a referenceId, and it is the ONLY thing
 * standing between a member and their employer's billing page — so it refuses by
 * default and names the two ways through.
 */
export function authorizeReference(request: ReferenceRequest):
  | { ok: true }
  | { ok: false; reason: string } {
  const plan = PLANS[request.plan];
  if (!plan) return { ok: false, reason: 'Unknown plan.' };

  if (plan.customerType === 'user') {
    // A family plan's reference IS the guardian. Anything else is one user
    // operating on another's subscription, which has no legitimate form.
    return request.referenceId === request.user.id
      ? { ok: true }
      : { ok: false, reason: 'A family plan can only be managed by the guardian who owns it.' };
  }

  if (request.referenceId === request.user.id) {
    return { ok: false, reason: 'An ops plan belongs to an organisation, not a person.' };
  }
  return isBillingRole(request.membershipRole)
    ? { ok: true }
    : { ok: false, reason: 'Only an owner or finance member can change the organisation’s plan.' };
}

export const isBillingRole = (role: string | undefined): role is BillingRole =>
  role !== undefined && (BILLING_ROLES as readonly string[]).includes(role);

/**
 * Resolves the configured price ids. Returns the plans it could NOT configure
 * rather than throwing: a deployment missing one price should start and refuse
 * that plan, not fail to boot and take the whole product with it.
 */
export function resolvePrices(env: Record<string, string | undefined> = process.env): {
  priced: { plan: Plan; priceId: string; annualPriceId?: string }[];
  missing: PlanName[];
} {
  const priced: { plan: Plan; priceId: string; annualPriceId?: string }[] = [];
  const missing: PlanName[] = [];
  for (const plan of Object.values(PLANS)) {
    const priceId = env[plan.priceEnv];
    if (!priceId) {
      missing.push(plan.name);
      continue;
    }
    priced.push({
      plan,
      priceId,
      annualPriceId: plan.annualPriceEnv ? env[plan.annualPriceEnv] : undefined,
    });
  }
  return { priced, missing };
}
