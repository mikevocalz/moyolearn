// The server-side role READ: the organization plugin's own `member` rows,
// narrowed to the doc 06 §1 union. This is what makes the server — not any
// client store — the boundary between a family session and a staff surface.
//
// It reads through the adapter rather than `pool.query` (the pattern
// `readSessionSubscriptions` set for the same table) so this file needs no pg
// import and no knowledge of the auth schema's search_path. `server.ts` has a
// pool-based `memberRole` for the Stripe plugin's callback, which has a pool in
// hand and no `Auth` — same table, different call site, and neither can replace
// the other without dragging its dependencies along.
// SOT: docs/pack/06-auth-onboarding-spec.md §1 · docs/pack/11-architectural-guardrails.md §3
// SOT-KEYWORDS: membership reader role member table adapter server org staff gate

import { isMembershipRole, type MembershipRole } from './membership.ts';
import type { Auth } from './server.ts';

/**
 * The acting user's role in one organisation, or `null` for none.
 *
 * A read that throws resolves to `null` — no role — because this feeds a
 * refusal gate and the failure has to fall closed: a database that cannot
 * answer must read as "not staff", never as "staff". The same is true of a
 * role string the build does not recognise (`isMembershipRole`).
 */
export async function readMembershipRole(
  auth: Auth,
  organizationId: string,
  userId: string,
): Promise<MembershipRole | null> {
  try {
    const context = await auth.$context;
    const rows = await context.adapter.findMany<{ role: string }>({
      model: 'member',
      where: [
        { field: 'organizationId', value: organizationId },
        { field: 'userId', value: userId },
      ],
      limit: 1,
    });
    const role = rows[0]?.role;
    return isMembershipRole(role) ? role : null;
  } catch {
    return null;
  }
}
