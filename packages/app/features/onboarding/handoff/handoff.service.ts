// Device-handoff service — the server side of doc 36 §2's guardian→learner
// handoff, behind the block. Issuing runs inside `protectedOperation`: the
// guardian is whoever the session says (identity is never a parameter), the
// learner id is a resource CLAIM that @acme/auth re-verifies against the
// active guardianship rows, and a guardian-managed session can never mint a
// code at all.
//
// Redemption is deliberately NOT here: redeeming IS signing in, so it lives on
// the auth trust plane (`redeemDeviceHandoff` + the /api/handoff/redeem route),
// exactly like a password at /api/auth — there is no session to protect an
// operation with yet.
// SOT: docs/pack/36-role-navigation-flows.md §2 · packages/auth/src/handoff.ts
// SOT-KEYWORDS: handoff service issue code protected operation guardian ward resource claim
import 'server-only';
import type { Auth } from '@acme/auth/server';
import {
  createDeviceHandoff,
  HandoffError,
  type GuardianshipReader,
  type HandoffIssue,
  type HandoffStore,
} from '@acme/auth/server';
import { protectedOperation } from '../../../core/protected-operation.ts';

export interface HandoffDeps {
  store: HandoffStore;
  guardianships: GuardianshipReader;
}

export async function issueHandoffCode(
  auth: Auth,
  headers: Headers,
  learnerAuthId: string,
  deps: HandoffDeps,
): Promise<HandoffIssue> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      /*
        A guardian-managed account is a child's account. A child minting a code
        for another child is a lateral move the guardianship check below would
        also stop — but stopping it here names the rule instead of relying on
        the data to happen to enforce it.
      */
      if (ctx.isLearner) throw new HandoffError('Only a guardian can create a handoff code.');
      return createDeviceHandoff(auth, deps, {
        guardianAuthId: ctx.learnerId,
        learnerAuthId,
      });
    },
    { telemetry: { op: 'handoff.issue', resource: 'handoff-codes', action: 'write' } },
  );
}
