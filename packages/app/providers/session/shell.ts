// Shell resolution — which of the four navigator trees a session dispatches to.
// Doc 36 §2: shell dispatch is SEPARATE layout trees per role, so the decision
// of "which tree" must be one pure function every platform shares — the mobile
// dispatcher, the web nav, and the switcher all read this table or they drift.
// SOT: docs/pack/36-role-navigation-flows.md §2 §3
// SOT-KEYWORDS: shell dispatch role resolution learner guardian tutor org last-used

import type { ActiveContextKind, AppSession, Membership, RoleKind } from './types';

/**
 * The four consumer shells. `teacher` folds into the tutor shell (doc 36 §3.3 —
 * the educator IA is one shell; the school-teacher share-link viewer has no
 * shell at all), and `anon` has none.
 */
export type Shell = 'learner' | 'guardian' | 'tutor' | 'org';

export function shellForRole(kind: ActiveContextKind): Shell | null {
  switch (kind) {
    case 'learner':
      return 'learner';
    case 'guardian':
      return 'guardian';
    case 'tutor':
    case 'teacher':
      return 'tutor';
    case 'owner':
      return 'org';
    case 'anon':
      return null;
  }
}

/** Where each shell's navigator tree starts. The only place these paths are spelled. */
export const SHELL_ROOTS = {
  learner: '/today',
  guardian: '/family-home',
  tutor: '/tutor-today',
  org: '/overview',
} as const satisfies Record<Shell, string>;

/**
 * Every role this session could wear: the account's own kind plus each
 * membership's role, deduped in stable order. The switcher renders these; the
 * resolver picks among them.
 */
export function availableRoles(session: Pick<AppSession, 'user' | 'memberships'>): RoleKind[] {
  const roles: RoleKind[] = [];
  const push = (role: RoleKind) => {
    if (!roles.includes(role)) roles.push(role);
  };
  if (session.user) push(session.user.kind);
  for (const membership of session.memberships) push(membership.role);
  return roles;
}

/**
 * Doc 36 §2's role resolution: one role → that shell; several → the last-used
 * one, and never a picker wall at login. Falls back to the account's own kind
 * when the remembered role is one this session no longer carries (revoked
 * membership, changed account) — a stale preference must not open a door the
 * session cannot walk through.
 */
export function resolveBootRole(
  session: Pick<AppSession, 'user' | 'memberships'>,
  lastUsed: RoleKind | null,
): RoleKind | null {
  const roles = availableRoles(session);
  if (roles.length === 0) return null;
  if (roles.length === 1) return roles[0]!;
  if (lastUsed && roles.includes(lastUsed)) return lastUsed;
  return roles[0]!;
}

/** The membership that carries a role, for org-scoped shells. */
export function membershipForRole(memberships: Membership[], role: RoleKind): Membership | undefined {
  return memberships.find((m) => m.role === role);
}
