// ConsentFlow's rules are legal, not cosmetic, so they get asserted rather than
// reviewed. The three that matter: the "plus" cannot be skipped, text-plus turns
// itself off the day we disclose anything to a third party, and a failed KBA set
// cannot be re-answered.
// SOT: docs/pack/06-auth-onboarding-spec.md §1 · §3.1
// SOT-KEYWORDS: consent flow test coppa email-plus text-plus kba evidence reconsent

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  availableMethods,
  completeConsent,
  confirm,
  isChallengeComplete,
  needsReconsent,
  scoreKba,
  startChallenge,
  verifyCode,
  DEFAULT_CONSENT_ENVIRONMENT,
  KBA_PASS_MARK,
  KBA_QUESTION_COUNT,
  type ConsentChallenge,
  type KbaQuestion,
} from './consent-flow.ts';
import { validateConsent } from './create-learner.ts';

const SCOPE = { scope: 'tutoring', policyVersion: '2026-08-01', now: new Date('2026-08-24T15:04:05Z') };

const started = (method: 'email-plus' | 'text-plus' | 'kba' | 'card', to = 'ada@example.com') => {
  const result = startChallenge(method, to, {
    ...DEFAULT_CONSENT_ENVIRONMENT,
    hasVerifiedCard: method === 'card',
  });
  assert.ok(result.ok, 'challenge should start');
  return result.challenge;
};

const questions = (ids: string[]): KbaQuestion[] =>
  ids.map((id) => ({ id, prompt: id, options: ['a', 'b', 'c', 'd'], answerIndex: 1 }));

describe('which methods are on offer', () => {
  it('offers text-plus only while nothing is disclosed to third parties', () => {
    assert.ok(availableMethods(DEFAULT_CONSENT_ENVIRONMENT).includes('text-plus'));
    const disclosing = { ...DEFAULT_CONSENT_ENVIRONMENT, disclosesToThirdParties: true };
    assert.ok(!availableMethods(disclosing).includes('text-plus'));

    const refused = startChallenge('text-plus', '+15550100', disclosing);
    assert.equal(refused.ok, false);
  });

  it('offers card only once there is a verified card', () => {
    assert.ok(!availableMethods(DEFAULT_CONSENT_ENVIRONMENT).includes('card'));
    assert.ok(
      availableMethods({ ...DEFAULT_CONSENT_ENVIRONMENT, hasVerifiedCard: true }).includes('card'),
    );
  });

  it('always keeps the KBA fallback reachable', () => {
    assert.ok(availableMethods(DEFAULT_CONSENT_ENVIRONMENT).includes('kba'));
    assert.ok(
      availableMethods({ disclosesToThirdParties: true, hasVerifiedCard: false }).includes('kba'),
    );
  });
});

describe('the "plus" is not optional', () => {
  it('refuses to complete on a verified code alone', () => {
    const challenge = verifyCode(started('email-plus'), true);
    assert.equal(isChallengeComplete(challenge), false);
    const result = completeConsent(challenge, SCOPE);
    assert.equal(result.ok, false);
  });

  it('will not confirm before the first contact is verified', () => {
    const jumped = confirm(started('email-plus'));
    assert.equal(jumped.confirmed, false);
    assert.equal(completeConsent(jumped, SCOPE).ok, false);
  });

  it('completes once both contacts have happened', () => {
    const challenge = confirm(verifyCode(started('email-plus'), true));
    assert.ok(isChallengeComplete(challenge));
    const result = completeConsent(challenge, SCOPE);
    assert.ok(result.ok);
    assert.equal(result.record.method, 'email-plus');
    assert.equal(result.record.verifiedAt, '2026-08-24T15:04:05.000Z');
  });
});

describe('KBA', () => {
  const set = questions(['q1', 'q2', 'q3', 'q4']);

  it('passes at the mark and completes in one act', () => {
    const scored = scoreKba(started('kba'), set, [1, 1, 1, 0]);
    assert.equal(scored.correct, KBA_PASS_MARK);
    assert.ok(isChallengeComplete(scored));
  });

  it('fails below the mark', () => {
    const scored = scoreKba(started('kba'), set, [1, 1, 0, 0]);
    assert.equal(isChallengeComplete(scored), false);
  });

  it('will not accept a short set even if every answer is right', () => {
    const short = questions(['q1', 'q2', 'q3']);
    assert.ok(short.length < KBA_QUESTION_COUNT);
    assert.equal(isChallengeComplete(scoreKba(started('kba'), short, [1, 1, 1])), false);
  });

  it('spends a failed set — the same four questions cannot be ground down', () => {
    const failed = scoreKba(started('kba'), set, [0, 0, 0, 0]);
    const retried = scoreKba(failed, set, [1, 1, 1, 1]);
    assert.equal(isChallengeComplete(retried), false);
    assert.equal(retried.correct, 0);
  });

  it('lets a fresh set through after a failure', () => {
    const failed = scoreKba(started('kba'), set, [0, 0, 0, 0]);
    const fresh = scoreKba(failed, questions(['q5', 'q6', 'q7', 'q8']), [1, 1, 1, 1]);
    assert.ok(isChallengeComplete(fresh));
  });
});

describe('the record', () => {
  const complete = (method: Parameters<typeof started>[0], to?: string): ConsentChallenge =>
    method === 'kba'
      ? scoreKba(started('kba'), questions(['q1', 'q2', 'q3', 'q4']), [1, 1, 1, 1])
      : confirm(verifyCode(started(method, to), true));

  it('carries evidence every method can be audited by', () => {
    for (const method of ['email-plus', 'text-plus', 'kba', 'card'] as const) {
      const result = completeConsent(complete(method, '+15550100'), SCOPE);
      assert.ok(result.ok, `${method} did not complete`);
      assert.ok(result.record.evidenceRef.startsWith(method), method);
      // Whatever this flow produces must satisfy the server action's own check.
      assert.deepEqual(validateConsent(result.record), { ok: true }, method);
    }
  });

  it('names the channel without storing the whole address', () => {
    const result = completeConsent(complete('email-plus', 'adalovelace@example.com'), SCOPE);
    assert.ok(result.ok);
    assert.match(result.record.evidenceRef, /ad\*\*\*@example\.com/);
    assert.doesNotMatch(result.record.evidenceRef, /adalovelace/);
  });

  it('re-consents when the policy version moves, and only then', () => {
    const result = completeConsent(complete('email-plus'), SCOPE);
    assert.ok(result.ok);
    assert.equal(needsReconsent(result.record, '2026-08-01'), false);
    assert.equal(needsReconsent(result.record, '2026-12-01'), true);
  });
});
