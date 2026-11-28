// Consent verification service — the server side of ConsentFlow (doc 06
// §3.1), behind the block. Every call runs inside `protectedOperation`: the
// guardian is whoever the session says (identity is never a parameter), the
// challenge id is a resource CLAIM that @acme/auth re-checks against the row's
// own guardian, and a guardian-managed session can never verify consent.
//
// Reading the record for the learner route is also here, so the one place
// that turns a client-sent id into a consent is the one place that insists on
// the session's guardian.
// SOT: docs/pack/06-auth-onboarding-spec.md §3.1 §6 · packages/auth/src/consent-verification.ts
// SOT-KEYWORDS: consent service verify code record protected operation guardian h3
import 'server-only';
import {
  type Auth,
  readVerifiedConsent,
  recordConsent,
  sendConsentConfirmation,
  startConsentChallenge,
  verifyConsentCode,
  ConsentVerificationError,
  type ConsentChallengeIssue,
  type ConsentVerificationDeps,
  type ConsentVerificationStore,
  type ConsentVerifyResult,
  type VerifiedConsent,
} from '@acme/auth/server';
import type { ConsentMethod } from '@acme/auth';
import { protectedOperation, type ProtectedCtx } from '../../../core/protected-operation.ts';

const guardianOnly = (ctx: ProtectedCtx) => {
  // A child's account cannot give consent for a child. Named here rather than
  // left to the data: the row check below would also refuse, but for the
  // wrong reason.
  if (ctx.isLearner) throw new ConsentVerificationError('Only a guardian can give consent.', 403);
};

export async function issueConsentChallenge(
  auth: Auth,
  headers: Headers,
  input: { method: ConsentMethod; target: string },
  deps: ConsentVerificationDeps,
): Promise<ConsentChallengeIssue> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      guardianOnly(ctx);
      return startConsentChallenge(deps, { guardianAuthId: ctx.learnerId, ...input });
    },
    { telemetry: { op: 'consent.challenge', resource: 'consent-verifications', action: 'write' } },
  );
}

export async function checkConsentCode(
  auth: Auth,
  headers: Headers,
  input: { challengeId: string; code: string },
  deps: ConsentVerificationDeps,
): Promise<ConsentVerifyResult> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      guardianOnly(ctx);
      return verifyConsentCode(deps, { guardianAuthId: ctx.learnerId, ...input });
    },
    { telemetry: { op: 'consent.verify', resource: 'consent-verifications', action: 'write' } },
  );
}

export async function confirmConsentChallenge(
  auth: Auth,
  headers: Headers,
  input: { challengeId: string },
  deps: ConsentVerificationDeps,
): Promise<void> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      guardianOnly(ctx);
      await sendConsentConfirmation(deps, { guardianAuthId: ctx.learnerId, ...input });
    },
    { telemetry: { op: 'consent.confirm', resource: 'consent-verifications', action: 'write' } },
  );
}

export async function recordGuardianConsent(
  auth: Auth,
  headers: Headers,
  input: { challengeId: string; scope: string; policyVersion: string },
  deps: ConsentVerificationDeps,
): Promise<{ consentId: string }> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      guardianOnly(ctx);
      const { consentId } = await recordConsent(deps, { guardianAuthId: ctx.learnerId, ...input });
      return { consentId };
    },
    { telemetry: { op: 'consent.record', resource: 'consent-verifications', action: 'write' } },
  );
}

/**
 * For the learner route: the recorded consent this guardian holds, or null.
 * Not wrapped in `protectedOperation` because the caller already is — the
 * route reads it INSIDE its own operation with the ctx that operation got.
 */
export function readGuardianConsent(
  store: ConsentVerificationStore,
  ctx: ProtectedCtx,
  consentId: string,
): Promise<VerifiedConsent | null> {
  return readVerifiedConsent(store, consentId, ctx.learnerId);
}
