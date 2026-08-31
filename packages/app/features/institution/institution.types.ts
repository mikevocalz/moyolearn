// Institutional permission vocabulary.
//
// These types name the resources, actions, and scopes that the institutional
// admin surfaces operate on. They are deliberately NOT the same as
// `MembershipRole` (Better Auth's org table) or `RoleKind` (the shell's notion
// of a hat): the policy derives from the shell role plus the tenant kind, not
// from either dimension alone.
// SOT: packages/app/providers/session/role-mapping.ts · packages/app/core/membership-gate.ts
// SOT-KEYWORDS: institution permission scope resource action policy vocabulary

/** Where the action is taking place. */
export type InstitutionScope = 'own_org' | 'school' | 'district';

/** The thing being acted on. */
export type InstitutionResource =
  | 'people'
  | 'schools'
  | 'programs'
  | 'reports'
  | 'billing'
  | 'settings'
  | 'tenant';

/** What the caller wants to do. */
export type InstitutionAction = 'view' | 'manage' | 'invite' | 'delete';
