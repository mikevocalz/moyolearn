// The handoff-code store and guardianship reader (doc 36 §2), as a repository.
//
// The guardianship read insists on `status: active` for the same reason the
// incident repository next door does: an `invited` guardian has not finished
// doc 06 §2's ladder and a `revoked` one is a household that has changed —
// neither is somebody who may mint a sign-in for a child.
//
// Rows are matched by HASH only; the code never reaches this module. Redemption
// filters expiry and redeemed-ness IN THE QUERY, so an expired or burned row is
// indistinguishable from an absent one all the way up the stack.
// SOT: docs/pack/36-role-navigation-flows.md §2 · packages/auth/src/handoff.ts · packages/payload/src/collections/HandoffCodes.ts
// SOT-KEYWORDS: handoff repository payload code hash guardianship active redeem expiry
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { GuardianshipReader, HandoffStore } from '@acme/auth';

export const handoffStore: HandoffStore = {
  async create(row) {
    const payload = await getPayload({ config });
    await payload.create({ collection: 'handoff-codes', data: { ...row } });
  },

  async findActive(codeHash, now) {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: 'handoff-codes',
      where: {
        and: [
          { codeHash: { equals: codeHash } },
          { expiresAt: { greater_than: now.toISOString() } },
          { redeemedAt: { exists: false } },
        ],
      },
      limit: 1,
    });
    const doc = result.docs[0] as { id: string | number; learnerAuthId: string } | undefined;
    if (!doc) return null;
    return { id: String(doc.id), learnerAuthId: doc.learnerAuthId };
  },

  async markRedeemed(id, at) {
    const payload = await getPayload({ config });
    await payload.update({
      collection: 'handoff-codes',
      id,
      data: { redeemedAt: at.toISOString() },
    });
  },
};

export const guardianshipReader: GuardianshipReader = {
  async isActiveGuardian(guardianAuthId, learnerAuthId) {
    const payload = await getPayload({ config });
    const result = await payload.find({
      collection: 'guardianships',
      where: {
        and: [
          { guardianAuthId: { equals: guardianAuthId } },
          { learnerAuthId: { equals: learnerAuthId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
    });
    return result.docs.length > 0;
  },
};
