// What `PermissionGate` renders, as a decision it can be held to. Pure and
// separate from the component so the one branch that used to hand paid features
// away for free is a test, not a code review.
//
// THE UNLOADED DEFAULT, and why it changed. This gate used to render its
// CHILDREN while entitlement truth was still in flight, on the grounds that the
// server enforced the real boundary anyway. It did not — `protectedOperation`
// checked a session and nothing else — so "unloaded" was a permanent state that
// granted every capability to everyone. The server gate now exists
// (`core/capability-gate.ts`), and with it in place the client's unloaded state
// is free to be honest: unknown is not permission.
//
// Unknown is also not a refusal you can sell against. While unloaded this
// returns `pending` or `nothing` — never `fallback` — because `fallback` is a
// caller's argument and on a guardian or ops surface that argument is usually an
// upgrade prompt. Showing one to a paying customer because the network was slow
// is the failure the old default was protecting against, and it is avoided by
// withholding the upsell rather than by handing over the feature.
// SOT: docs/pack/06-auth-onboarding-spec.md §4 · CLAUDE.md (Children's surfaces)
// SOT-KEYWORDS: permission gate decision entitlement capability loaded pending fallback learner paywall

import type { ActiveContextKind } from '../session/types';

export type GateRender = 'children' | 'pending' | 'fallback' | 'nothing';

export interface GateInput {
  /** Has entitlement truth arrived for this session at all? */
  loaded: boolean;
  /** The resolved answer, meaningless until `loaded`. */
  allowed: boolean;
  contextKind: ActiveContextKind;
  /** Whether the caller supplied a neutral in-flight placeholder. */
  hasPending: boolean;
}

export function gateDecision({ loaded, allowed, contextKind, hasPending }: GateInput): GateRender {
  const isLearner = contextKind === 'learner';

  if (!loaded) {
    /*
      A learner never gets a placeholder either: a "checking your plan" shape on
      a child's screen is a billing surface with the price filed off, and doc 05
      §2.3 says the child never sees one. The child's own floor — practise —
      does not travel through this gate to begin with; it is granted on every
      subscription status by `entitlementsFor`, so nothing a learner needs is
      withheld by rendering nothing here.
    */
    if (isLearner) return 'nothing';
    return hasPending ? 'pending' : 'nothing';
  }

  if (allowed) return 'children';

  // CLAUDE.md: no paywall, price, or upgrade prompt may render on a learner
  // surface. Ever. A fallback is a caller's argument, so this is the only place
  // that can refuse to render one on the child's side of the app.
  return isLearner ? 'nothing' : 'fallback';
}
