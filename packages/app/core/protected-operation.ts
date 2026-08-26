// Server-side authorization boundary.
// Every operation that reaches the Safety Plane, payload repositories, or the
// learner model must run inside a protectedOperation so identity is never a
// parameter and unauthenticated callers fail closed.
// SOT: docs/pack/06-auth-onboarding-spec.md §7 · docs/pack/07-security-child-ai-safety-spec.md §2
// SOT-KEYWORDS: protected operation auth boundary server-only learner context mock
import 'server-only';
import type { Auth } from '@acme/auth/server';

export interface ProtectedCtx {
  /** The acting learner's Better Auth user id. */
  learnerId: string;
  /** Whether the account is guardian-managed (a child learner). */
  isLearner: boolean;
  /** Organization id when the session is scoped to one. */
  orgId?: string;
}

/**
 * Runs an operation inside an authenticated, learner-scoped context.
 *
 * The caller passes the `Auth` instance and the request headers. This function
 * derives the session and hands the operation a `ProtectedCtx`. It never asks
 * the operation to validate identity or accept an id as input.
 *
 * In dev with `NEXT_PUBLIC_AUTH_MODE=mock`, a deterministic mock learner is
 * used so that features can be exercised without a real Better Auth session.
 */
export async function protectedOperation<R>(
  auth: Auth,
  headers: Headers,
  operation: (ctx: ProtectedCtx) => Promise<R>,
): Promise<R> {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'mock' && process.env.NODE_ENV === 'development') {
    return operation({
      learnerId: 'dev-learner-1',
      isLearner: true,
      /*
        The mock session carries an org too. Without one every org-scoped read
        fails closed to an empty result, and the ops dashboard looks broken in
        exactly the mode it is meant to be developed in.

        It is a REAL slug from the organizations table, not a `dev-org-1`
        placeholder: a mock tenant key that matches no row reads as "the query is
        broken" rather than "you are signed in as nobody".
      */
      orgId: 'riverside-unified',
    });
  }

  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error('Unauthenticated');

  const user = session.user as { id: string; guardianManaged?: boolean; orgId?: string };
  return operation({
    learnerId: user.id,
    isLearner: !!user.guardianManaged,
    orgId: user.orgId,
  });
}
