// Who may see which plan card. The decision `PlanCard` makes before it draws
// anything, pure so it is a test rather than a review note.
//
// Three laws, from doc 05 §2.2/§2.3 and CONTRIBUTING.md (Children's surfaces):
//   · a business tier never renders where a parent reads;
//   · a family tier never renders on an org surface (the org pays for ops, and a
//     family price there is a lie about what the org is buying);
//   · nothing with a price renders on a learner surface, any tier, any state.
// The props union in PlanCard.tsx makes the first two compile errors; this
// function is what holds them at runtime, where a prop can arrive from data.
// SOT: docs/pack/05-monetization-access-spec.md §2.2 · §2.3 · docs/38-front-door-and-flow.md §5 FD-13 · CONTRIBUTING.md
// SOT-KEYWORDS: plan card guard tier context learner guardian org business family paywall render nothing

export const PLAN_TIERS = ['family', 'business'] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** Who is looking. `learner` exists here only so the guard can refuse it. */
export const PLAN_CARD_CONTEXTS = ['guardian', 'org', 'learner'] as const;
export type PlanCardContext = (typeof PLAN_CARD_CONTEXTS)[number];

/** Which tier each adult context may be shown. Learners are absent on purpose. */
export const TIER_FOR_CONTEXT = {
  guardian: 'family',
  org: 'business',
} as const satisfies Record<Exclude<PlanCardContext, 'learner'>, PlanTier>;

export const PLAN_CARD_RENDER = ['card', 'nothing'] as const;
export type PlanCardRender = (typeof PLAN_CARD_RENDER)[number];

export function planCardDecision(context: PlanCardContext, tier: PlanTier): PlanCardRender {
  if (context === 'learner') return 'nothing';
  return TIER_FOR_CONTEXT[context] === tier ? 'card' : 'nothing';
}
