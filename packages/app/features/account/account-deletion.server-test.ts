// FD-26's rules, held where they are decided.
//
// Three claims are worth a test here and the rest are not. Whether Payload
// deletes a row is Payload's business; whether the CASCADE reaches the right
// people, refuses the wrong ones, and runs in an order that cannot orphan a
// child mid-way is this service's, and all three are decidable without a
// database because `planAccountDeletion` is pure and `executeDeletionPlan`
// takes ports.
//
//   1. IDENTITY NEVER COMES FROM INPUT. The subject set is computed from
//      ownership the session resolved; a request naming an id is answered by
//      looking that id up in that ownership, so a forged one finds nothing.
//   2. A NON-OWNER CANNOT DELETE. Neither another family's child, nor — for a
//      guardian-managed learner — their own account.
//   3. THE CASCADE BEHAVES AS DOCUMENTED. Sole wards go with the guardian,
//      shared wards stay, wards go before the holder, and a legal hold keeps
//      what it is supposed to keep without turning a deletion into a failure.
//
// `.server-test.ts` because the service opens with `import 'server-only'`.
// SOT: packages/app/features/account/account-deletion.service.ts · docs/pack/11-architectural-guardrails.md §3
// SOT-KEYWORDS: account deletion test fd-26 identity ctx not input non-owner refuse cascade ward sole guardian legal hold order
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { Auth } from '@acme/auth/server';
import type { ProtectedCtx } from '../../core/protected-operation.ts';
import { setOperationSink } from '../../core/telemetry.ts';
import {
  AccountDeletionRefused,
  deleteOwnAccount,
  executeDeletionPlan,
  planAccountDeletion,
  type AccountDeletionPorts,
  type AccountOwnership,
  type DeletionPlan,
  type ErasedMedia,
  type ManagedWard,
} from './account-deletion.service.ts';

/** Never dereferenced on the mock path; the cast records that, it does not hide it. */
const AUTH_UNUSED = {} as Auth;
const HEADERS = new Headers();

const GUARDIAN = { authId: 'guardian_1', isLearner: false };
const CTX: ProtectedCtx = { learnerId: GUARDIAN.authId, isLearner: false };

const ward = (id: string, name: string, soleGuardian: boolean): ManagedWard => ({
  learnerAuthId: id,
  displayName: name,
  soleGuardian,
});

const ownership = (
  wards: readonly ManagedWard[],
  soleOwnedOrgs: readonly string[] = [],
): AccountOwnership => ({ wards, soleOwnedOrgs });

const CLEAN_MEDIA: ErasedMedia = { scoped: true, deleted: 3, failed: [] };

/** A ports double that records the order every leg ran in. */
function recordingPorts(
  overrides: Partial<{
    media: (authId: string) => ErasedMedia;
    heldReports: (authId: string) => number;
  }> = {},
) {
  const calls: string[] = [];
  const ports: AccountDeletionPorts = {
    loadOwnership: async () => ownership([]),
    eraseEdu: async (_ctx, subject) => {
      calls.push(`edu:${subject.authId}`);
      return { transcripts: 2, facts: 5, blockedTags: 1 };
    },
    erasePayload: async (_ctx, subject) => {
      calls.push(`payload:${subject.authId}`);
      return { rows: 7, summaries: 2, heldReports: overrides.heldReports?.(subject.authId) ?? 0 };
    },
    eraseMedia: async (_ctx, subject) => {
      calls.push(`media:${subject.authId}`);
      return overrides.media?.(subject.authId) ?? CLEAN_MEDIA;
    },
    deleteAuthUser: async (_ctx, subject) => {
      calls.push(`auth:${subject.authId}`);
    },
  };
  return { calls, ports };
}

const planned = (plan: DeletionPlan): Extract<DeletionPlan, { ok: true }> => {
  assert.equal(plan.ok, true, 'this plan was supposed to run');
  return plan as Extract<DeletionPlan, { ok: true }>;
};

before(() => setOperationSink(() => {}));
after(() => setOperationSink(null));

describe('FD-26 — who a deletion may name', () => {
  it('takes its subjects from ownership, never from the request', () => {
    /*
      The request says `self` and names nobody; the subject list still comes
      back with two entries, because ownership said so. This is the property the
      route's "it reads no body" depends on — there is nothing for a caller to
      say because the answer is already resolved from the session.
    */
    const plan = planned(
      planAccountDeletion(
        GUARDIAN,
        ownership([ward('learner_1', 'Maya', true), ward('learner_2', 'Sam', true)]),
        { target: 'self' },
      ),
    );

    assert.deepEqual(
      plan.subjects.map((subject) => subject.authId),
      ['learner_1', 'learner_2', 'guardian_1'],
    );
  });

  it('refuses a learner id the session does not hold a guardianship over', () => {
    // A real child, of a different family. The id is well-formed and the
    // request is authenticated; the ward lookup is the whole defence.
    const plan = planAccountDeletion(GUARDIAN, ownership([ward('learner_1', 'Maya', true)]), {
      target: 'learner',
      learnerAuthId: 'someone_elses_child',
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.ok === false && plan.refusal, 'not-your-learner');
  });

  it('refuses a guardian-managed learner deleting their own account', () => {
    const plan = planAccountDeletion(
      { authId: 'learner_1', isLearner: true },
      ownership([]),
      { target: 'self' },
    );

    assert.equal(plan.ok, false);
    assert.equal(plan.ok === false && plan.refusal, 'managed-learner');
  });

  it('refuses a learner reaching the per-child path too', () => {
    // Not incidental to their empty ward list: the check is on `isLearner` and
    // runs first, so it still holds the day the ward shape changes.
    const plan = planAccountDeletion(
      { authId: 'learner_1', isLearner: true },
      ownership([ward('learner_2', 'Sam', true)]),
      { target: 'learner', learnerAuthId: 'learner_2' },
    );

    assert.equal(plan.ok, false);
    assert.equal(plan.ok === false && plan.refusal, 'managed-learner');
  });

  it('refuses the last owner of an organisation, and says which rule', () => {
    // The org's classes, assignments and enrollments are the org's. Deleting
    // the last owner would leave nobody able to administer them, so this stops
    // rather than choosing between orphaning the org and destroying its records.
    const plan = planAccountDeletion(GUARDIAN, ownership([], ['riverside-unified']), {
      target: 'self',
    });

    assert.equal(plan.ok, false);
    assert.equal(plan.ok === false && plan.refusal, 'sole-org-owner');
  });

  it('refuses a managed learner at the real boundary, not only in the plan', async () => {
    /*
      Through `protectedOperation` in mock mode, whose ctx IS a guardian-managed
      learner (`MOCK_CTX.isLearner`) with two active subscriptions. The refusal
      has to be the identity one and not a billing one — a 402 in answer to
      "delete my account" would be an upsell.
    */
    process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
    process.env.NODE_ENV = 'development';
    const { calls, ports } = recordingPorts();
    try {
      await assert.rejects(
        () => deleteOwnAccount(AUTH_UNUSED, HEADERS, ports),
        (error: unknown) =>
          error instanceof AccountDeletionRefused && error.reason === 'managed-learner',
      );
      assert.deepEqual(calls, [], 'nothing may be erased on a refused deletion');
    } finally {
      delete process.env.NEXT_PUBLIC_AUTH_MODE;
    }
  });
});

describe('FD-26 — the cascade', () => {
  it('takes the children only this guardian holds, and leaves the shared one', () => {
    /*
      Doc 06 §2 supports two guardians per learner. A guardian deleting their
      own account is LEAVING: a child the other parent still holds keeps their
      account, their guardianship and the consent behind it.
    */
    const plan = planned(
      planAccountDeletion(
        GUARDIAN,
        ownership([ward('learner_1', 'Maya', true), ward('learner_2', 'Sam', false)]),
        { target: 'self' },
      ),
    );

    assert.deepEqual(
      plan.subjects.map((subject) => subject.authId),
      ['learner_1', 'guardian_1'],
    );
    assert.deepEqual(plan.keptWards, ['Sam']);
  });

  it('deletes a shared child when the child is what was asked for', () => {
    // The other direction of the same fact: naming the child is a consent
    // WITHDRAWAL, and withdrawal by a verified parent stops processing. It is
    // not a vote between the two guardians.
    const plan = planned(
      planAccountDeletion(GUARDIAN, ownership([ward('learner_2', 'Sam', false)]), {
        target: 'learner',
        learnerAuthId: 'learner_2',
      }),
    );

    assert.deepEqual(
      plan.subjects.map((subject) => subject.authId),
      ['learner_2'],
    );
    assert.equal(plan.subjects[0]?.kind, 'managed-learner');
    // The guardian's own account is untouched by the per-child path.
    assert.equal(
      plan.subjects.some((subject) => subject.authId === GUARDIAN.authId),
      false,
    );
  });

  it('erases every ward before the account that holds them', async () => {
    /*
      The ward list is reachable only through the holder's guardianship rows, so
      deleting the holder first would cut the remaining children loose
      mid-cascade — rows nothing can trace to anybody, which is `sweep.sql`'s
      orphan case. Within a subject: rows, then objects, then the auth user
      whose id every one of those rows was keyed on.
    */
    const plan = planned(
      planAccountDeletion(GUARDIAN, ownership([ward('learner_1', 'Maya', true)]), {
        target: 'self',
      }),
    );
    const { calls, ports } = recordingPorts();

    await executeDeletionPlan(CTX, plan, ports);

    assert.deepEqual(calls, [
      'edu:learner_1',
      'payload:learner_1',
      'media:learner_1',
      'auth:learner_1',
      'edu:guardian_1',
      'payload:guardian_1',
      'media:guardian_1',
      'auth:guardian_1',
    ]);
  });

  it('reports uploads it could not prove gone, without undoing the record', async () => {
    // A school account has no per-child prefix (`presign.rules.ts`), so the
    // record goes and the files do not. The receipt says so; 200-with-files-left
    // reported as a clean success is this feature's failure wearing a success
    // message.
    const plan = planned(
      planAccountDeletion(GUARDIAN, ownership([ward('learner_1', 'Maya', true)]), {
        target: 'self',
      }),
    );
    const { ports } = recordingPorts({
      media: (authId) =>
        authId === 'learner_1'
          ? { scoped: false, reason: 'Uploads on a school account are stored under the school.' }
          : CLEAN_MEDIA,
    });

    const receipt = await executeDeletionPlan(CTX, plan, ports);

    assert.equal(receipt.mediaIncomplete, true);
    assert.equal(receipt.subjects.length, 2);
    assert.equal(receipt.subjects[0]?.edu.transcripts, 2, 'the record still went');
  });

  it('counts safety reports a legal hold kept, and still succeeds', async () => {
    /*
      Doc 31 §4.1 holds S4 and abuse-disclosure reports outside every retention
      schedule, and counsel-review-s4.md §4 Q5 leaves open whether a guardian's
      erasure may reach them. Retaining is the fail-closed direction — and the
      count is what stops a kept record from being a secret, because the
      confirmation renders a sentence off this number.
    */
    const plan = planned(
      planAccountDeletion(GUARDIAN, ownership([ward('learner_1', 'Maya', true)]), {
        target: 'self',
      }),
    );
    const { ports } = recordingPorts({ heldReports: (authId) => (authId === 'learner_1' ? 1 : 0) });

    const receipt = await executeDeletionPlan(CTX, plan, ports);

    assert.equal(receipt.heldReports, 1);
    assert.equal(receipt.mediaIncomplete, false);
  });

  it('owes nothing when the sweep was clean', async () => {
    const plan = planned(planAccountDeletion(GUARDIAN, ownership([]), { target: 'self' }));
    const { ports } = recordingPorts();

    const receipt = await executeDeletionPlan(CTX, plan, ports);

    assert.equal(receipt.heldReports, 0);
    assert.equal(receipt.mediaIncomplete, false);
    assert.deepEqual(receipt.keptWards, []);
    assert.equal(receipt.subjects[0]?.kind, 'account-holder');
  });
});
