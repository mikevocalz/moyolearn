import 'server-only';
// Incident staff repository — the org's assignable safety staff, from the
// Better Auth member and user tables.
//
// The SAME TABLES as `people.repository.ts` next door, deliberately a separate
// read: that one serves the institution people screen and returns emails for
// every role, this one serves the Safety queue's assignment control and
// returns owner/manager rows only, with id + name + role and nothing else —
// `IncidentStaffMember` has nowhere to put an email, so the narrowing is
// structural rather than remembered. It goes through the adapter, not
// `auth.api.listMembers`, for the reason `membership-reader.ts` records: the
// organization plugin's endpoint answers for the SESSION's active org, and
// this port is asked about `ctx.orgId` — the org the Block already resolved,
// which the host step may have chosen over the session's own claim.
//
// The role filter runs here, on the write-side values `MEMBERSHIP_ROLES`
// names: a member row whose role is scheduler, finance, or any string this
// build does not ship never reaches the roster, so it can never pass the
// service's assignee verification either — the two checks read the same rows
// and fail in different ways.
// SOT: packages/app/features/safety/incidents.service.ts · packages/auth/src/membership-reader.ts · packages/payload/migrations/better_auth_tables.sql
// SOT-KEYWORDS: incident staff repository roster member auth adapter owner manager assignee
import type { IncidentStaffMember, LoadIncidentStaff } from '@acme/app/server';
import { auth } from './auth';

/** Two seated roles per org is the floor; a hundred is a district's ceiling. */
const ROSTER_LIMIT = 100;

interface MemberRow {
  userId: string;
  role: string;
}

interface UserRow {
  id: string;
  name?: string | null;
  email?: string | null;
}

/**
 * Narrowing, not casting — the same move `isMembershipRole` makes one layer
 * down. Only the two roles the incident wall seats come back as anything.
 */
const seatedRole = (role: string): IncidentStaffMember['role'] | null =>
  role === 'owner' || role === 'manager' ? role : null;

export const loadIncidentStaff: LoadIncidentStaff = async (orgId) => {
  const ctx = await auth.$context;
  const members = await ctx.adapter.findMany<MemberRow>({
    model: 'member',
    where: [{ field: 'organizationId', value: orgId }],
    limit: ROSTER_LIMIT,
  });

  const seated = members.flatMap((member) => {
    const role = seatedRole(member.role);
    return role === null ? [] : [{ userId: member.userId, role }];
  });

  const users = await Promise.all(
    seated.map(
      (member) =>
        ctx.internalAdapter.findUserById(member.userId) as Promise<UserRow | null | undefined>,
    ),
  );

  return seated.map((member, index) => {
    const user = users[index];
    // The people-screen fallback chain: a profile with no name shows its
    // email, and only a user row that vanished mid-read shows the raw id.
    return {
      id: member.userId,
      name: user?.name ?? user?.email ?? member.userId,
      role: member.role,
    };
  });
};
