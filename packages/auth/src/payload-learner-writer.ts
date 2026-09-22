// Binds the LearnerWriter port to the two real systems: Better Auth for the user
// row, Payload for the guardianship and consent rows.
// Payload is typed structurally rather than imported, so @acme/auth stays free
// of the CMS server (doc 11 §3 — only repositories touch @acme/payload).
// SOT: docs/pack/06-auth-onboarding-spec.md §2 · docs/pack/11-architectural-guardrails.md §3
// SOT-KEYWORDS: learner writer adapter payload better-auth guardianship consent

import type { Auth } from './server';
import type { LearnerWriter } from './create-managed-learner';

interface PayloadLike {
  create(args: { collection: string; data: Record<string, unknown> }): Promise<unknown>;
}

export function createPayloadLearnerWriter(auth: Auth, payload: PayloadLike): LearnerWriter {
  return {
    async createUser({ email, password, name, username }) {
      // The username plugin hooks /sign-up/email, so this is the credential
      // path for a username-only account too — the email is the §2 placeholder.
      const result = await auth.api.signUpEmail({
        body: { email, password, name, username },
      });
      const id = result?.user?.id;
      if (!id) throw new Error('Better Auth returned no user id for the learner.');

      // isMinor/guardianManaged are declared `input: false` precisely so a
      // signup payload cannot set them; they get written server-side, after.
      //
      // `emailVerified` rides along in the SAME call, and both the placement and
      // the value are load-bearing.
      //
      // The value: a managed learner is born verified because there is nothing
      // to verify. Doc 06 §2 gives the child no email, so the column holds
      // `<uuid>@learners.invalid` (create-learner.ts) — RFC 2606 reserved and
      // undeliverable. The flag is meaningless for a username credential, but
      // better-auth@1.7.2 checks it anyway on the username path
      // (dist/plugins/username/index.mjs:195-207), so leaving it false deadlocks
      // every handoff sign-in against `requireEmailVerification` — and no mail
      // can ever clear it.
      //
      // The placement: this runs while `guardianManaged` is still false on the
      // stored row, so `isRestrictedLearnerUpdate` — which refuses any write
      // carrying `emailVerified` for a managed user — does not fire. A later,
      // separate update would be refused by that hook.
      const ctx = await auth.$context;
      await ctx.internalAdapter.updateUser(id, {
        isMinor: true,
        guardianManaged: true,
        emailVerified: true,
      });
      return { id };
    },

    async deleteUser(id) {
      const ctx = await auth.$context;
      await ctx.internalAdapter.deleteUser(id);
    },

    async createGuardianship(data) {
      await payload.create({ collection: 'guardianships', data: { ...data, status: 'active' } });
    },

    async createConsent(data) {
      await payload.create({ collection: 'consents', data: { ...data } });
    },
  };
}
