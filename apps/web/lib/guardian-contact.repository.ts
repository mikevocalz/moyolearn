// Who to tell about a child's incident, and what to call the child.
//
// The guardianship read insists on `status: active` for the reason every other
// guardian surface gives: an `invited` guardian has not finished doc 06 §2's
// ladder and a `revoked` one is a household that has changed. Neither is
// somebody a safety alert goes to.
//
// The email comes from Better Auth's own user row through the instance's
// internal adapter, the way `loadIncidentStaff` reads staff names: no second
// copy of an address anywhere in Payload, so revoking or changing one changes
// where the alert goes.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.3 · packages/app/features/safety/guardian-alert.service.ts
// SOT-KEYWORDS: guardian contact repository incident email active guardianship better auth user first name
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { LoadGuardianContacts, LoadLearnerFirstName } from '@acme/app/server';
import { auth } from './auth';

interface UserRow {
  id: string;
  name?: string | null;
  email?: string | null;
}

async function findUser(userId: string): Promise<UserRow | null> {
  const ctx = await auth.$context;
  const user = (await ctx.internalAdapter.findUserById(userId)) as UserRow | null | undefined;
  return user ?? null;
}

export const loadGuardianContacts: LoadGuardianContacts = async (learnerAuthId) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: 'guardianships',
    where: {
      learnerAuthId: { equals: learnerAuthId },
      status: { equals: 'active' },
    },
    // Every guardian: doc 06 §2 supports two households, and a first page that
    // dropped the second would leave one parent untold.
    pagination: false,
  });

  const users = await Promise.all(docs.map((row) => findUser(row.guardianAuthId)));
  return docs.map((row, index) => ({
    userId: row.guardianAuthId,
    email: users[index]?.email ?? null,
  }));
};

export const loadLearnerFirstName: LoadLearnerFirstName = async (learnerAuthId) => {
  const user = await findUser(learnerAuthId);
  return user?.name ?? null;
};
