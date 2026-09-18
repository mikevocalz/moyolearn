// The native guardian flow has NO paywall step.
//
// Why, precisely: billing is Stripe, server-side (`stripePlugin` in
// @acme/auth's server). There is no StoreKit, no react-native-iap, no
// expo-in-app-purchases and no RevenueCat anywhere in this repo, so the app
// cannot take a payment on iOS at all. Rendering `$11/month` and a
// "Start 30-day free trial" button there breaks two guidelines at once:
// 3.1.1, which requires unlockable features to be sold through in-app
// purchase, and 2.1, because the CTA only advanced an onboarding step — no
// subscription was ever created by the tap.
//
// The step is REMOVED rather than stripped of its prices. A plan step with no
// price and no purchase is a heading, one line of prose and no control — the
// same faked surface the `grants` step was deleted for (see steps.ts). And
// nothing here may steer a guardian to the web to pay: 3.1.3 forbids
// advertising or linking to another purchase method, so the honest native
// flow says nothing about buying at all and ends on the handoff step.
//
// Flipping this to `true` is a submission decision, not a styling one: it
// requires in-app purchase in the binary first.
// SOT: APP_STORE_APPROVAL.md · docs/release/app-store-readiness.md §8
// SOT-KEYWORDS: guardian onboarding plan step paywall native ios app-store 3.1.1 2.1

// Annotated `boolean`, not left to infer the literal: the value differs by platform,
// so a `true`/`false` literal type would let TypeScript narrow away the branch the
// OTHER fork takes and report it as dead code.
export const GUARDIAN_PLAN_STEP: boolean = false;
