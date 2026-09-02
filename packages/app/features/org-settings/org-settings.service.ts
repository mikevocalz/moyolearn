import 'server-only';
// Org Settings read — the gated branding load behind the org Settings rail
// destination (org.settings contract). Read-only by scope: identity comes from
// the Organizations row, plan state travels the entitlement chain the client
// already syncs, and nothing on the surface writes.
// SOT: design/screens/org/org.settings/contract.md · packages/app/core/protected-operation.ts
// SOT-KEYWORDS: org settings service branding billing roles owner finance protected operation read

import type { Auth } from '@acme/auth/server';
import { BILLING_ROLES } from '@acme/auth';
import { protectedOperation } from '../../core/protected-operation.ts';
import { MembershipDenied } from '../../core/membership-gate.ts';
import type { LoadOrgBranding, OrgBranding } from '../org/org.service.ts';

/**
 * A discriminated union rather than `OrgBranding | null`, because the screen
 * renders two DIFFERENT absences: `denied` gets the role-wall card (the
 * org.safety precedent — a correct answer, never an upsell), while an `ok`
 * with a null org means the tenant key matched no Organizations row and the
 * identity card says so honestly.
 */
export type OrgSettingsRead =
  | { state: 'ok'; org: OrgBranding | null }
  | { state: 'denied' };

/**
 * Loads the org's identity for the Settings surface, behind the same wall the
 * contract names: `BILLING_ROLES` (owner/finance — billing-plans.ts), enforced
 * server-side whatever the rail chose to render.
 *
 * `MembershipDenied` and an unauthenticated session both resolve to `denied`
 * rather than throwing: this runs in a server component, where a thrown
 * refusal renders the (business) error boundary instead of the role wall —
 * and the shell's own anon guard owns the login redirect. The read's job is
 * to never 500 the door. Anything else (a real failure) still throws.
 */
export async function loadOrgSettings(
  loadOrgBranding: LoadOrgBranding,
  authInstance: Auth,
  headers: Headers,
): Promise<OrgSettingsRead> {
  try {
    const org = await protectedOperation(
      authInstance,
      headers,
      async (ctx): Promise<OrgBranding | null> => (ctx.orgId ? loadOrgBranding(ctx.orgId) : null),
      {
        // Reading what the org is and pays for must never itself depend on
        // what it pays for (the entitlements-route law) — the wall here is
        // WHO, not which plan.
        requires: 'practise',
        requiresMembership: BILLING_ROLES,
        telemetry: { op: 'org-settings.read', resource: 'organizations', action: 'read' },
      },
    );
    return { state: 'ok', org };
  } catch (error) {
    if (error instanceof MembershipDenied) return { state: 'denied' };
    if (error instanceof Error && error.message === 'Unauthenticated') return { state: 'denied' };
    throw error;
  }
}
