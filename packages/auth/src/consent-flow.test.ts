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
  isCodeExpired,
  completeConsent,
  confirm,
  isChallengeComplete,
  needsReconsent,
  scoreKba,
  startChallenge,
  verifyCode,
  DEFAULT_CONSENT_ENVIRONMENT,
  CODE_TTL_MINUTES,
  KBA_PASS_MARK,
  KBA_QUESTION_COUNT,
  MAX_CODE_ATTEMPTS,
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

/** The happy path through the channel: the code matched. */
const verified = (challenge: ConsentChallenge) => verifyCode(challenge, true).challenge;

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
    const challenge = verified(started('email-plus'));
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
    const challenge = confirm(verified(started('email-plus')));
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

  it('spends it as a SET — reshuffling the same four questions is the same set', () => {
    /*
      The comparison was `ids.join()` on presentation order, so re-serving the
      same four questions in any other order missed the spent check entirely.
      A child who failed once already knows the four correct answers; a second
      pass over the same screens grants `codeVerified` and `confirmed` — full
      parental consent, which is the exact brute-force the spend exists to stop.
    */
    const failed = scoreKba(started('kba'), set, [0, 0, 0, 0]);
    const shuffled = questions(['q2', 'q1', 'q4', 'q3']);
    const retried = scoreKba(failed, shuffled, [1, 1, 1, 1]);
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
      : confirm(verified(started(method, to)));

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

describe('code limits', () => {
  const issued = new Date('2026-08-24T15:00:00Z');
  const fresh = () => {
    const started = startChallenge('email-plus', 'ada@example.com', DEFAULT_CONSENT_ENVIRONMENT, issued);
    assert.ok(started.ok);
    return started.challenge;
  };

  it('counts wrong guesses and burns the challenge at the limit', () => {
    let challenge = fresh();
    for (let i = 1; i < MAX_CODE_ATTEMPTS; i += 1) {
      const result = verifyCode(challenge, false, issued);
      assert.equal(result.verdict, 'wrong', `attempt ${i}`);
      challenge = result.challenge;
    }
    const last = verifyCode(challenge, false, issued);
    assert.equal(last.verdict, 'burnt');
    assert.equal(last.challenge.attempts, MAX_CODE_ATTEMPTS);
  });

  it('refuses the RIGHT code once the challenge is burnt', () => {
    let challenge = fresh();
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i += 1) {
      challenge = verifyCode(challenge, false, issued).challenge;
    }
    const late = verifyCode(challenge, true, issued);
    assert.equal(late.verdict, 'burnt');
    assert.equal(late.challenge.codeVerified, false);
  });

  it('refuses the right code after it expires', () => {
    const challenge = fresh();
    const justInside = new Date(issued.getTime() + (CODE_TTL_MINUTES - 1) * 60_000);
    const justOutside = new Date(issued.getTime() + (CODE_TTL_MINUTES + 1) * 60_000);

    assert.equal(isCodeExpired(challenge, justInside), false);
    assert.equal(verifyCode(challenge, true, justInside).verdict, 'verified');

    assert.equal(isCodeExpired(challenge, justOutside), true);
    const late = verifyCode(challenge, true, justOutside);
    assert.equal(late.verdict, 'expired');
    assert.equal(late.challenge.codeVerified, false);
  });

  it('does not spend an attempt on an expired code', () => {
    const challenge = fresh();
    const tooLate = new Date(issued.getTime() + (CODE_TTL_MINUTES + 5) * 60_000);
    assert.equal(verifyCode(challenge, false, tooLate).challenge.attempts, 0);
  });
});
