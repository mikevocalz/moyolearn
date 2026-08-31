// The three role dimensions for session membership: education, organisation, and conference.
// SOT: docs/pack/06-auth-onboarding-spec.md §1 · CLAUDE.md (The block)
// SOT-KEYWORDS: session role education organization conference mapping membership

import { isMembershipRole, type MembershipRole } from '@acme/auth/membership';
import type { RoleKind } from './types';

export const ROLE_KINDS: readonly RoleKind[] = [
  'learner',
  'guardian',
  'tutor',
  'teacher',
  'owner',
  'staff',
  'school_admin',
  'district_admin',
] as const;

export function isRoleKind(role: string | undefined): role is RoleKind {
  return role !== undefined && (ROLE_KINDS as readonly string[]).includes(role);
}

export const ORGANIZATION_KINDS = ['tutoring', 'school', 'district'] as const;
export type OrganizationKind = (typeof ORGANIZATION_KINDS)[number];

export const DEFAULT_ORGANIZATION_TO_EDUCATION: Record<MembershipRole, RoleKind> = {
  owner: 'owner',
  manager: 'staff',
  scheduler: 'staff',
  finance: 'staff',
} as const;

/**
 * Resolves a fall-back education role when the member row does not carry one.
 * The real `educationRole` field in the Better Auth `member` table is the
 * source of truth; this map is only the safe default used before that field
 * is populated or when it is missing.
 */
export function roleForOrganizationRole(
  organizationRole: MembershipRole | null | undefined,
): RoleKind | undefined {
  if (organizationRole === undefined || organizationRole === null) return undefined;
  if (!isMembershipRole(organizationRole)) return undefined;
  return DEFAULT_ORGANIZATION_TO_EDUCATION[organizationRole];
}

/**
 * Resolves a role kind from the member's organisation role and the kind of
 * organisation they are acting in. Owner of a district becomes `district_admin`,
 * owner of a school becomes `school_admin`, and owner of a tutoring business
 * stays `owner`; other member roles map to `staff`.
 */
export function roleForOrganizationRoleAndKind(
  organizationRole: MembershipRole | null | undefined,
  orgKind: OrganizationKind | undefined,
): RoleKind | undefined {
  const base = roleForOrganizationRole(organizationRole);
  if (base === undefined) return undefined;
  if (orgKind === 'district' && base === 'owner') return 'district_admin';
  if (orgKind === 'school' && base === 'owner') return 'school_admin';
  return base;
}
