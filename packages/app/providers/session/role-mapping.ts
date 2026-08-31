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
