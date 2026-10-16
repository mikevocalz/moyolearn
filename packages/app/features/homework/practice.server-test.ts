// The practice-set key-holder rule, through the real `protectedOperation`.
//
// The answer key is the guardian's. Three refusals hold that: a guardianship
// that was revoked stops approve and print, a child's own session cannot
// approve or print a set about themselves, and a draft never prints because
// the adult approves what they have read first.
//
// The fake `Auth` answers the session read and an empty subscription read,
// the incidents.server-test.ts fixture: these operations ask for `practise`,
// which every subscription status satisfies.
// SOT: docs/work/pr-100/contract.md §Practice sets · packages/app/features/homework/practice.service.ts
// SOT-KEYWORDS: practice set test key holder revoked guardian learner forbidden draft not approved print
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { Auth } from '@acme/auth/server';
import { setOperationSink } from '../../core/telemetry.ts';
import type { PracticeSetView } from './homework.types.ts';
import {
  approvePracticeSetFor,
  PracticeSetNotApproved,
  practiceSetForPrint,
  type PracticePorts,
} from './practice.service.ts';

const sessionAuth = (id: string, guardianManaged: boolean): Auth => {
  const value: object = {
    api: { getSession: () => Promise.resolve({ user: { id, guardianManaged } }) },
    $context: Promise.resolve({ adapter: { findMany: () => Promise.resolve([]) } }),
  };
  return value as Auth;
};

const set = (status: PracticeSetView['status']): PracticeSetView => ({
  practiceSetId: 'ps_1',
  submissionId: 'sub_1',
  learnerAuthId: 'ada_1',
  status,
  seed: 'seed-1',
  targetedTags: ['fractions'],
  items: [],
  createdAt: '2026-10-15T15:00:00.000Z',
});

function ports(wards: string[], stored: PracticeSetView) {
  const approved: string[] = [];
  const value: PracticePorts = {
    loadGuardianWards: async () => wards,
    loadSubmission: async () => null,
    loadLearnerBand: async () => null,
    createPracticeSet: async (_ctx, draft) => draft,
    // Repository scoping is by guardianAuthId; the fixture's guardian owns it.
    loadPracticeSet: async () => stored,
    approvePracticeSet: async (_ctx, id) => {
      approved.push(id);
      return { ...stored, status: 'approved' };
    },
    newPracticeSetId: () => 'ps_new',
    reportDropped: () => {},
  };
  return { value, approved };
}

describe('practice set key holder', () => {
  setOperationSink(() => {});
  afterEach(() => setOperationSink(() => {}));

  it('refuses approve and print once the guardianship is revoked', async () => {
    const guardian = sessionAuth('guardian_1', false);
    const revoked = ports([], set('approved'));
    await assert.rejects(approvePracticeSetFor(guardian, new Headers(), 'ps_1', revoked.value), /Forbidden/);
    await assert.rejects(practiceSetForPrint(guardian, new Headers(), 'ps_1', revoked.value), /Forbidden/);
    assert.deepEqual(revoked.approved, []);
  });

  it('refuses a learner session, even for a set about that learner', async () => {
    const child = sessionAuth('ada_1', true);
    const own = ports(['ada_1'], set('approved'));
    await assert.rejects(approvePracticeSetFor(child, new Headers(), 'ps_1', own.value), /Forbidden/);
    await assert.rejects(practiceSetForPrint(child, new Headers(), 'ps_1', own.value), /Forbidden/);
  });

  it('does not print a draft', async () => {
    const guardian = sessionAuth('guardian_1', false);
    const draft = ports(['ada_1'], set('draft'));
    await assert.rejects(
      practiceSetForPrint(guardian, new Headers(), 'ps_1', draft.value),
      (error: unknown) => error instanceof PracticeSetNotApproved,
    );
  });
});
