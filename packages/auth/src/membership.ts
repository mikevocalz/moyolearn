// The organisation role catalogue — doc 06 §1's staff roles, as a closed union.
//
// These are the values Better Auth's organization plugin stores in the `member`
// table's `role` column. They exist here, beside `BILLING_ROLES`, because two
// files each declaring "what a role can be" is how `finance` ends up spendable
// in one and unknown in the other. `BILLING_ROLES` (billing-plans.ts) narrows
// THIS set; the Block's membership gate (`packages/app/core`) consumes it whole.
//
// Pure and importable anywhere — the reader that resolves a user's actual role
// lives in `membership-reader.ts`, behind the server entrypoint, because a
// member-table read has no business in a client bundle.
// SOT: docs/pack/06-auth-onboarding-spec.md §1 · docs/pack/11-architectural-guardrails.md §3
// SOT-KEYWORDS: membership role org owner manager scheduler finance union staff member table

/** Doc 06 §1: "roles: owner, manager, scheduler, finance". */
export const MEMBERSHIP_ROLES = ['owner', 'manager', 'scheduler', 'finance'] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/**
 * Narrowing rather than casting, for the same reason `isPlanName` exists: a
 * `role` column value this build does not ship must not pass a gate that was
 * written against the four it does. An unrecognised role reads as no role.
 */
export const isMembershipRole = (role: string | undefined): role is MembershipRole =>
  role !== undefined && (MEMBERSHIP_ROLES as readonly string[]).includes(role);
