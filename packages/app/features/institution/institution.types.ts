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

/**
 * How an institutional read came back — a discriminated union so a page cannot
 * render a payload it does not have, and cannot confuse the three answers.
 *
 * Three, not two, because the three mean different things to the person in
 * front of the screen and the contracts prescribe different treatments:
 *
 *   ok          — the read ran; `data` may still be empty, which is a state.
 *   denied      — the caller holds no permission in this tenant scope. Both
 *                 district.schools and school.academics say "role-mismatched
 *                 deep link → sys.not-found silent redirect", so the PAGE
 *                 turns this into `notFound()`: a 403 body would answer the
 *                 stranger's real question, which is whether the route exists.
 *   unavailable — the read could not be completed (no confirmable session, a
 *                 repository failure). This is NOT a permission answer and must
 *                 never render as one, nor as an empty roster: "no schools" and
 *                 "we could not check" are different sentences, and only one of
 *                 them is a fact about the district.
 *
 * Modelled on `OrgSettingsRead` (org-settings.service.ts), which established
 * that a server component must resolve a refusal into a state rather than
 * throwing it into the route group's error boundary.
 */
export type InstitutionRead<T> =
  | { state: 'ok'; data: T }
  | { state: 'denied' }
  | { state: 'unavailable' };
