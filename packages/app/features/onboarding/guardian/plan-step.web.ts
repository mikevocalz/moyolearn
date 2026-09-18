// The web guardian flow keeps its paywall step: Stripe is the purchase
// mechanism, the browser is where the charge is made, and doc 05 §6 S16 is
// written for exactly this surface.
// SOT: docs/pack/05-monetization-access-spec.md §6 S16
// SOT-KEYWORDS: guardian onboarding plan step paywall web stripe

// Annotated `boolean`, not left to infer the literal: the value differs by platform,
// so a `true`/`false` literal type would let TypeScript narrow away the branch the
// OTHER fork takes and report it as dead code.
export const GUARDIAN_PLAN_STEP: boolean = true;
