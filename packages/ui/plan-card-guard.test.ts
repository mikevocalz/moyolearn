// PlanCard's rendering guard, exhaustively: every context against every tier.
// SOT-KEYWORDS: plan card guard test learner business family solo studio scale price
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  planCardDecision,
  PLAN_CARD_CONTEXTS,
  PLAN_TIERS,
  TIER_FOR_CONTEXT,
} from './plan-card-guard.ts';

/** The ops tiers a parent must never be shown, by the names they would carry. */
const BUSINESS_TIER_NAMES = ['Solo', 'Studio', 'Scale'] as const;

describe('plan card guard', () => {
  it('never renders a business tier on a family (guardian) surface', () => {
    for (const name of BUSINESS_TIER_NAMES) {
      assert.equal(planCardDecision('guardian', 'business'), 'nothing', name);
    }
  });

  it('never renders a family tier on an org surface', () => {
    assert.equal(planCardDecision('org', 'family'), 'nothing');
  });

  it('never renders any tier — so never a price — on a learner surface', () => {
    for (const tier of PLAN_TIERS) {
      assert.equal(planCardDecision('learner', tier), 'nothing', tier);
    }
  });

  it('renders exactly the tier each adult context is allowed', () => {
    assert.equal(planCardDecision('guardian', 'family'), 'card');
    assert.equal(planCardDecision('org', 'business'), 'card');
  });

  it('has one allowed cell per adult context and none for a learner', () => {
    for (const context of PLAN_CARD_CONTEXTS) {
      const allowed = PLAN_TIERS.filter((tier) => planCardDecision(context, tier) === 'card');
      if (context === 'learner') {
        assert.deepEqual(allowed, []);
      } else {
        assert.deepEqual(allowed, [TIER_FOR_CONTEXT[context]]);
      }
    }
  });
});
