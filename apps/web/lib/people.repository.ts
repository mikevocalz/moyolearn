import 'server-only';
// People repository — reads the Better Auth member and user tables.
//
// This is the only file in apps/web that touches the auth member surface. It
// returns the display name, email, and role for each member of the requested
// organization, falling back to the user id when a name is not present.
// SOT: packages/auth/src/membership-reader.ts · packages/app/features/institution/people.service.ts
// SOT-KEYWORDS: people repository members auth better-adapter users

import type { LoadOrgMembers } from '@acme/app/server';
import { auth } from './auth';

interface UserRow {
  id: string;
  name?: string | null;
  email?: string | null;
}

interface MemberRow {
  userId: string;
  role: string;
}

export const loadOrgMembers: LoadOrgMembers = async (orgId) => {
  const ctx = await auth.$context;
  const members = await ctx.adapter.findMany<MemberRow>({
    model: 'member',
    where: [
      { field: 'organizationId', value: orgId },
    ],
    limit: 100,
  });

  const users = await Promise.all(
    members.map((m) => ctx.internalAdapter.findUserById(m.userId) as Promise<UserRow | null | undefined>),
  );

  return members.map((m, i) => {
    const u = users[i];
    const name = u?.name ?? u?.email ?? m.userId;
    return { id: m.userId, name, email: u?.email ?? '', role: m.role };
  });
};
