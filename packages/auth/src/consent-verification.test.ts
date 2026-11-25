// The server-side consent channel gets the tests the dev channel had, plus the
// ones a client-minted code could never be held to: the record is written by
// the server, carries the guardian from the session, and cannot be read back
// by a different guardian.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 §6
// SOT-KEYWORDS: consent verification test code hash record guardian h3

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  hashConsentCode,
  readVerifiedConsent,
  recordConsent,
  sendConsentConfirmation,
  startConsentChallenge,
  verifyConsentCode,
  ConsentVerificationError,
  MAX_CODE_ATTEMPTS,
  type ConsentMailer,
  type ConsentVerificationRow,
  type ConsentVerificationStore,
} from './consent-verification.ts';

function memory() {
  const rows = new Map<string, ConsentVerificationRow>();
  let next = 1;
  const store: ConsentVerificationStore = {
    async create(row) {
      const id = String(next++);
      rows.set(id, { ...row, id });
      return { id };
    },
    async find(id) {
      return rows.get(id) ?? null;
    },
    async update(id, patch) {
      const row = rows.get(id);
      assert.ok(row);
      rows.set(id, { ...row, ...patch });
    },
  };
  const mails: { kind: 'code' | 'confirm'; to: string; code?: string }[] = [];
  const mailer: ConsentMailer = {
    async sendCode(to, code) {
      mails.push({ kind: 'code', to, code });
    },
    async sendConfirmation(to) {
      mails.push({ kind: 'confirm', to });
    },
  };
  return { deps: { store, mailer }, mails, rows };
}

const guardian = 'guardian-1';
const fixedCode = { random: () => 4 }; // "444444"

describe('startConsentChallenge', () => {
  it('mails a six-digit code and stores only its hash', async () => {
    const { deps, mails, rows } = memory();
    const issue = await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: ' ada@example.com ' }, fixedCode);
    assert.equal(issue.sentTo, 'ada@example.com');
    assert.deepEqual(mails, [{ kind: 'code', to: 'ada@example.com', code: '444444' }]);
    const row = rows.get(issue.challengeId)!;
    assert.equal(row.codeHash, hashConsentCode('444444'));
    assert.ok(!JSON.stringify(row).includes('444444'));
  });

  it('refuses the methods this server cannot deliver', async () => {
    const { deps } = memory();
    await assert.rejects(
      startConsentChallenge(deps, { guardianAuthId: guardian, method: 'text-plus', target: '+15550100' }),
      ConsentVerificationError,
    );
  });
});

describe('verifyConsentCode', () => {
  it('matches the code it sent and nothing merely plausible', async () => {
    const { deps } = memory();
    const { challengeId } = await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: 'ada@example.com' }, fixedCode);
    assert.equal((await verifyConsentCode(deps, { guardianAuthId: guardian, challengeId, code: '000000' })).verdict, 'wrong');
    assert.equal((await verifyConsentCode(deps, { guardianAuthId: guardian, challengeId, code: ' 444444 ' })).verdict, 'verified');
  });

  it('burns the challenge after the machine’s attempt limit, across requests', async () => {
    const { deps } = memory();
    const { challengeId } = await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: 'ada@example.com' }, fixedCode);
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) {
      await verifyConsentCode(deps, { guardianAuthId: guardian, challengeId, code: '000000' });
    }
    assert.equal((await verifyConsentCode(deps, { guardianAuthId: guardian, challengeId, code: '444444' })).verdict, 'burnt');
  });

  it('reports another guardian’s challenge as absent', async () => {
    const { deps } = memory();
    const { challengeId } = await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: 'ada@example.com' }, fixedCode);
    await assert.rejects(
      verifyConsentCode(deps, { guardianAuthId: 'someone-else', challengeId, code: '444444' }),
      (error: unknown) => error instanceof ConsentVerificationError && error.status === 404,
    );
  });
});

describe('recordConsent', () => {
  async function verified() {
    const m = memory();
    const { challengeId } = await startConsentChallenge(m.deps, { guardianAuthId: guardian, method: 'email-plus', target: 'ada@example.com' }, fixedCode);
    await verifyConsentCode(m.deps, { guardianAuthId: guardian, challengeId, code: '444444' });
    return { ...m, challengeId };
  }

  it('refuses before the confirmation message has gone out', async () => {
    const { deps, challengeId } = await verified();
    await assert.rejects(
      recordConsent(deps, { guardianAuthId: guardian, challengeId, scope: 'tutoring', policyVersion: '2026-08-01' }),
      (error: unknown) => error instanceof ConsentVerificationError && error.status === 409,
    );
  });

  it('writes the record with the server’s evidence reference, once', async () => {
    const { deps, mails, challengeId } = await verified();
    await sendConsentConfirmation(deps, { guardianAuthId: guardian, challengeId });
    await sendConsentConfirmation(deps, { guardianAuthId: guardian, challengeId });
    assert.equal(mails.filter((m) => m.kind === 'confirm').length, 1);

    const first = await recordConsent(deps, { guardianAuthId: guardian, challengeId, scope: 'tutoring', policyVersion: '2026-08-01' });
    assert.equal(first.consentId, challengeId);
    assert.match(first.record.evidenceRef, /^email-plus:ad\*\*\*@example\.com:\d{14}$/);
    const again = await recordConsent(deps, { guardianAuthId: guardian, challengeId, scope: 'other', policyVersion: 'x' });
    assert.deepEqual(again, first);
  });

  it('is readable back only by the guardian who verified, and only once recorded', async () => {
    const { deps, challengeId } = await verified();
    assert.equal(await readVerifiedConsent(deps.store, challengeId, guardian), null);
    await sendConsentConfirmation(deps, { guardianAuthId: guardian, challengeId });
    await recordConsent(deps, { guardianAuthId: guardian, challengeId, scope: 'tutoring', policyVersion: '2026-08-01' });
    const read = await readVerifiedConsent(deps.store, challengeId, guardian);
    assert.ok(read);
    assert.equal(read.method, 'email-plus');
    assert.equal(read.scope, 'tutoring');
    assert.equal(read.verificationId, challengeId);
    assert.equal(await readVerifiedConsent(deps.store, challengeId, 'someone-else'), null);
  });
});
