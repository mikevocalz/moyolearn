// Both platform paywalls finish onboarding only after server-confirmed access.
// SOT: docs/pack/06-auth-onboarding-spec.md §4
// SOT-KEYWORDS: paywall callbacks platform subscription completion
export type PaywallProps = {
  onSubscribed: () => void;
  onContinueFree: () => void;
};
