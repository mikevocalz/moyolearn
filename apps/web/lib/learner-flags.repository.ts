// Learner-flags repository — doc 07 §3 layer 1's guardian policy, bound to the
// store that actually holds it.
//
// `aiEnabled` lives on the Better Auth user row (`learnerFields` in
// `packages/auth/src/server.ts`), beside `isMinor` and `guardianManaged`, because
// doc 06 §110 groups all three as `learnerFlags` and because they are set the
// same way: server-side at creation, `input: false`, never by the account
// itself. It is NOT on the Payload `users` collection next to `gradeBand` — one
// flag in two stores is two answers to "is the tutor on for this child", and the
// wrong one would be the one a turn happened to read.
//
// A repository rather than a call from the service for the ordinary reason:
// features take ports and the composition root binds them, so nothing on the
// coaching path holds a connection.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 · docs/pack/07-security-child-ai-safety-spec.md §3 · packages/auth/src/server.ts
// SOT-KEYWORDS: learner flags repository ai enabled guardian policy better auth layer 1 identity refused
import 'server-only';
import { readLearnerFlags } from '@acme/auth/server';
import type { LoadLearnerFlags } from '@acme/app/server';
import { auth } from './auth';

/**
 * The read, unguarded on purpose.
 *
 * There is no `.catch(() => ({ aiEnabled: true }))` here and there must not be.
 * `loadGradeBand` can fall back because both bands are safe — the older register
 * shown to a young child is still a correct crisis resource. This flag has no
 * safe default under failure: a guardian who switched tutoring off and a
 * database that cannot answer look identical from here, and defaulting would run
 * the tutor for that child every time the read failed.
 *
 * So a failure propagates into `safetyLayer('1-identity')` at the coaching
 * boundary, which is doc 12 §5's pause. The default that DOES exist is for a
 * missing row, and it lives in `readLearnerFlags` where the column's meaning
 * does: absence means nobody has switched anything off.
 */
export const loadLearnerFlags: LoadLearnerFlags = (ctx) => readLearnerFlags(auth, ctx.learnerId);
