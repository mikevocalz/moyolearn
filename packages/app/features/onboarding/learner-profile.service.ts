// Persists the parts of onboarding the server needs to know about.
//
// The band is the whole reason this exists. Onboarding has always collected it,
// but it lived only in the client session store — so `loadGradeBand` on the
// server read a Payload field nobody had ever written and every learner got the
// `older` default, including nine-year-olds. Doc 07 §3 layer 1 requires the
// band be server-injected, which is only true if the server has one.
//
// It is doc 31 §2.1's four-value voice band, not the plane's two-value policy
// register: onboarding already asks a question fine enough to tell a first
// grader from a fifth grader, and storing the coarse answer threw that away.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 · docs/pack/07-security-child-ai-safety-spec.md §3
// SOT-KEYWORDS: onboarding learner profile grade band persist protected operation server
import 'server-only';
import type { Auth } from '@acme/auth/server';
import type { VoiceBand } from '@acme/student-model';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation';

export type SaveGradeBand = (ctx: ProtectedCtx, gradeBand: VoiceBand) => Promise<void>;

export async function saveLearnerProfile(
  auth: Auth,
  headers: Headers,
  input: { gradeBand: VoiceBand },
  saveGradeBand: SaveGradeBand,
): Promise<void> {
  // The band is validated at the route rather than trusted, but it is still the
  // learner's own record being written from their own session — identity comes
  // from `ctx`, so there is no id in the payload to forge.
  return protectedOperation(auth, headers, (ctx) => saveGradeBand(ctx, input.gradeBand), {
    telemetry: { op: 'onboarding.learnerProfile.save', resource: 'learners', action: 'write' },
  });
}
