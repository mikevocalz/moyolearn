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
  CONSENT_SENDS_PER_WINDOW,
  CONSENT_SEND_WINDOW_MINUTES,
  MAX_CODE_ATTEMPTS,
  type ConsentMailer,
  type ConsentVerificationRow,
  type ConsentVerificationStore,
} from './consent-verification.ts';

function memory() {
  const rows = new Map<string, ConsentVerificationRow>();
  let next = 1;
  const store: ConsentVerificationStore = {
    // Synchronous between awaits, so each call is atomic the way the
    // repository's locked insert and conditional UPDATE are.
    async create(row, limit) {
      const recent = [...rows.values()].filter(
        (r) => r.guardianAuthId === row.guardianAuthId && r.sentAt >= limit.since,
      ).length;
      if (recent >= limit.max) return null;
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
    async claimAttempt(id, max) {
      const row = rows.get(id);
      if (!row || row.attempts >= max) return null;
      rows.set(id, { ...row, attempts: row.attempts + 1 });
      return row.attempts + 1;
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

  it('stops mailing after the per-guardian limit in the window, and only for that guardian', async () => {
    const { deps, mails } = memory();
    const now = new Date('2026-11-27T12:00:00Z');
    for (let i = 0; i < CONSENT_SENDS_PER_WINDOW; i++) {
      await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: `stranger${i}@example.com` }, { now });
    }
    await assert.rejects(
      startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: 'one-more@example.com' }, { now }),
      (error: unknown) => error instanceof ConsentVerificationError && error.status === 429,
    );
    assert.equal(mails.length, CONSENT_SENDS_PER_WINDOW, 'a refused send still mailed someone');
    await startConsentChallenge(deps, { guardianAuthId: 'guardian-2', method: 'email-plus', target: 'grace@example.com' }, { now });
    const later = new Date(now.getTime() + (CONSENT_SEND_WINDOW_MINUTES + 1) * 60_000);
    await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: 'ada@example.com' }, { now: later });
    assert.equal(mails.length, CONSENT_SENDS_PER_WINDOW + 2);
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

  it('holds the attempt limit when guesses arrive at once', async () => {
    const { deps, rows } = memory();
    const { challengeId } = await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: 'ada@example.com' }, fixedCode);
    // Every request reads the row before any writes — the race the old
    // read-compare-write lost. The last guess is the right code.
    const guesses = Array.from({ length: MAX_CODE_ATTEMPTS * 4 }, (_, i) => String(100000 + i));
    guesses.push('444444');
    const results = await Promise.all(
      guesses.map((code) => verifyConsentCode(deps, { guardianAuthId: guardian, challengeId, code })),
    );
    assert.equal(rows.get(challengeId)!.attempts, MAX_CODE_ATTEMPTS);
    // Exactly MAX guesses were compared: MAX - 1 wrong, the MAXth burns it.
    assert.equal(results.filter((r) => r.verdict === 'wrong').length, MAX_CODE_ATTEMPTS - 1);
    assert.equal(results.at(-1)!.verdict, 'burnt', 'a guess past the limit was still compared');
    assert.equal(rows.get(challengeId)!.codeVerifiedAt, null);
  });

  it('still verifies the right code on the last permitted try', async () => {
    const { deps } = memory();
    const { challengeId } = await startConsentChallenge(deps, { guardianAuthId: guardian, method: 'email-plus', target: 'ada@example.com' }, fixedCode);
    for (let i = 0; i < MAX_CODE_ATTEMPTS - 1; i++) {
      assert.equal((await verifyConsentCode(deps, { guardianAuthId: guardian, challengeId, code: '000000' })).verdict, 'wrong');
    }
    assert.equal((await verifyConsentCode(deps, { guardianAuthId: guardian, challengeId, code: '444444' })).verdict, 'verified');
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
