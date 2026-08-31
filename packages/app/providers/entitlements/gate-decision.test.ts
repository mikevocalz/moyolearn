// The client gate's unloaded branch, which used to render the CHILDREN — so with
// `setSubscriptions` uncalled anywhere in the repo, `loaded` was permanently
// false and every `PermissionGate` in the app granted, permanently.
// SOT-KEYWORDS: permission gate decision test entitlement loaded pending fallback learner paywall
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ActiveContextKind } from '../session/types.ts';
import { gateDecision, type GateInput } from './gate-decision.ts';

const KINDS: ActiveContextKind[] = [
  'anon',
  'learner',
  'guardian',
  'tutor',
  'teacher',
  'owner',
  'staff',
  'school_admin',
  'district_admin',
];

const decide = (over: Partial<GateInput>) =>
  gateDecision({ loaded: true, allowed: true, contextKind: 'guardian', hasPending: false, ...over });

describe('permission gate — unknown is not permission', () => {
  it('does not render children while entitlement truth is unknown', () => {
    for (const contextKind of KINDS) {
      assert.notEqual(decide({ loaded: false, contextKind }), 'children', contextKind);
      assert.notEqual(decide({ loaded: false, contextKind, allowed: true }), 'children', contextKind);
    }
  });

  it('does not sell an upgrade against an unknown answer either', () => {
    // `fallback` is the caller's argument and on an adult surface it is usually
    // an upgrade prompt. A paying customer on a slow network must not see one.
    for (const contextKind of KINDS) {
      for (const hasPending of [true, false]) {
        assert.notEqual(decide({ loaded: false, contextKind, hasPending }), 'fallback', contextKind);
      }
    }
  });

  it('shows the caller placeholder while unknown, on an adult surface', () => {
    assert.equal(decide({ loaded: false, hasPending: true }), 'pending');
    assert.equal(decide({ loaded: false, hasPending: false }), 'nothing');
  });

  it('shows a learner nothing at all while unknown, placeholder or not', () => {
    // A "checking your plan" shape on a child's screen is a billing surface with
    // the price filed off (doc 05 §2.3).
    assert.equal(decide({ loaded: false, contextKind: 'learner', hasPending: true }), 'nothing');
    assert.equal(decide({ loaded: false, contextKind: 'learner', hasPending: false }), 'nothing');
  });
});

describe('permission gate — once the answer is known', () => {
  it('renders children for a covered capability', () => {
    for (const contextKind of KINDS) {
      assert.equal(decide({ contextKind, allowed: true }), 'children', contextKind);
    }
  });

  it('falls back on an adult surface and renders nothing on a learner one', () => {
    assert.equal(decide({ allowed: false, contextKind: 'guardian' }), 'fallback');
    assert.equal(decide({ allowed: false, contextKind: 'owner' }), 'fallback');
    assert.equal(decide({ allowed: false, contextKind: 'learner' }), 'nothing');
  });

  it('never routes a learner to a fallback, loaded or not', () => {
    for (const loaded of [true, false]) {
      for (const allowed of [true, false]) {
        for (const hasPending of [true, false]) {
          assert.notEqual(
            gateDecision({ loaded, allowed, hasPending, contextKind: 'learner' }),
            'fallback',
          );
        }
      }
    }
  });
});
