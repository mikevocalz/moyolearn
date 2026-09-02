// Subscription fixtures — the plan each dev persona is paying for.
//
// They exist so `loaded` becomes TRUE in mock mode from a real signal. Without
// them the entitlement store sits unloaded forever, which is the state that used
// to hand every paid capability away for free and now, correctly, shows nothing.
//
// The rules are derived rather than listed, so adding a persona does not mean
// remembering to add a plan:
//   · every persona holds a family plan under their own id;
//   · every membership becomes an ops plan under the org id, `ops-studio` for an
//     owner and `ops-solo` for anyone else — so both sides of doc 06 §4's payout
//     gate are reachable in dev without editing a fixture;
//   · Jordan's family plan is CANCELED, on purpose. Doc 05 §1.2 promises a child
//     keeps practising through a lapsed card, and a promise with no persona that
//     tests it is a promise nobody notices breaking.
// SOT: docs/pack/05-monetization-access-spec.md §1.2 · docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: subscription fixtures mock persona plan entitlement dev lapsed trial ops family

import type { SubscriptionState } from '@acme/auth';
import type { Persona } from './personas';

const LAPSED_PERSONA_ID = 'jordan';

export function mockSubscriptionsFor(persona: Persona): SubscriptionState[] {
  return [
    {
      plan: 'family',
      status: persona.id === LAPSED_PERSONA_ID ? 'canceled' : 'active',
      referenceId: persona.id,
      periodEnd: null,
      seats: null,
    },
    // Seats mirror the walkthrough org (`ops-studio` holds 6, ACCOUNTS.md) so
    // the org Settings summary shows a real number in dev, not a blank row.
    ...persona.memberships.map((membership): SubscriptionState => ({
      plan: membership.role === 'owner' ? 'ops-studio' : 'ops-solo',
      status: 'active',
      referenceId: membership.orgId,
      periodEnd: null,
      seats: membership.role === 'owner' ? 6 : 1,
    })),
  ];
}
