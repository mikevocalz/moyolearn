/**
 * Maps Moyo's eight education roles onto the five desktop workspaces.
 *
 * Resolution follows the mobile LiveSessionProvider on main
 * (packages/app/providers/session/live.tsx `memberEducationRole`): the member
 * row's `educationRole` wins; otherwise the organisation role maps through
 * `DEFAULT_ORGANIZATION_TO_EDUCATION` (packages/app/providers/session/role-mapping.ts);
 * a user with no organisation is a guardian. Those files import
 * `@acme/auth/membership` through a workspace alias Metro in apps/desktop cannot
 * resolve, so the two small tables are restated here and checked against main
 * in scripts/auth.test.mjs. Remove this copy when `@acme/auth` exposes a
 * `desktop` export condition.
 * Pure (type-only imports) for node --test.
 * SOT: docs/pack/06-auth-onboarding-spec.md §1 · docs/desktop/seams/D04.md
 * SOT-KEYWORDS: desktop auth roles education workspace mapping membership
 */
import type { WorkspaceRole } from "../commands";

export const ROLE_KINDS = ["learner", "guardian", "tutor", "teacher", "owner", "staff", "school_admin", "district_admin"] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export const MEMBERSHIP_ROLES = ["owner", "manager", "scheduler", "finance"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const ORGANIZATION_TO_EDUCATION = {
  owner: "owner",
  manager: "staff",
  scheduler: "staff",
  finance: "staff",
} as const satisfies Record<MembershipRole, RoleKind>;

/** Desktop has five workspaces; teacher works in Tutor, school staff and owners in Organization. */
export const WORKSPACE_FOR_ROLE = {
  learner: "learner",
  guardian: "guardian",
  tutor: "tutor",
  teacher: "tutor",
  owner: "org",
  staff: "org",
  school_admin: "org",
  district_admin: "district",
} as const satisfies Record<RoleKind, WorkspaceRole>;

function isRoleKind(value: unknown): value is RoleKind {
  return typeof value === "string" && (ROLE_KINDS as readonly string[]).includes(value);
}

function isMembershipRole(value: unknown): value is MembershipRole {
  return typeof value === "string" && (MEMBERSHIP_ROLES as readonly string[]).includes(value);
}

/** A member row as `organization/get-full-organization` returns it. */
export interface MemberRow {
  readonly userId?: string;
  readonly user?: { readonly id?: string };
  readonly role?: string;
  readonly educationRole?: string | null;
}

export function memberEducationRole(member: MemberRow): RoleKind {
  if (isRoleKind(member.educationRole)) return member.educationRole;
  if (isMembershipRole(member.role)) return ORGANIZATION_TO_EDUCATION[member.role];
  return "guardian";
}

/** Distinct workspaces for a session, in WORKSPACE order; a user with no organisation is a guardian. */
export function workspacesFor(educationRoles: readonly RoleKind[]): WorkspaceRole[] {
  const order: readonly WorkspaceRole[] = ["learner", "guardian", "tutor", "org", "district"];
  const roles = educationRoles.length > 0 ? educationRoles : (["guardian"] as const);
  const set = new Set(roles.map((role) => WORKSPACE_FOR_ROLE[role]));
  return order.filter((role) => set.has(role));
}
