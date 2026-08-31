// People feature types.
//
// These are shared by the server-only service and the client list screen so the
// shape cannot drift. The source of truth for role values is
// @acme/auth/membership.
// SOT: packages/app/features/institution/people.service.ts · packages/auth/src/membership.ts
// SOT-KEYWORDS: people member org user role

export interface OrgMember {
  /** The Better Auth user id. */
  id: string;
  /** Display name, falling back to email when the profile has none. */
  name: string;
  /** The user email address. */
  email: string;
  /** The organization membership role. */
  role: string;
}
