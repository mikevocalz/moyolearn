/**
 * Reduced motion — doc 22 §7, doc 01.
 *
 * The interesting tests here are the two asymmetries: a user may always ask for
 * less motion but not always for more, and reduced motion removes vestibular
 * load without removing the signs of life. Both are easy to implement backwards
 * and neither is visible in a diff.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §7, §9; docs/pack/01
 * SOT-KEYWORDS: reduced motion test accessibility vestibular xr blink mouth registry coverage
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANIMATED_SURFACES,
  MOTION_POLICIES,
  applyMotionPolicy,
  assertMotionPolicyComplete,
  motionPolicy,
  resolveMotionMode,
} from './reduced-motion.ts';
import type { AnimatedSurface } from './reduced-motion.ts';

describe('resolving the mode', () => {
  it('follows the system when the user has expressed no preference', () => {
    // `null` means "follow the system", which is the correct default and the
    // one most products get wrong by defaulting to false.
    assert.equal(
      resolveMotionMode({ systemPrefersReduced: true, userPreference: null, surface: 'screen' }),
      'reduced'
    );
    assert.equal(
      resolveMotionMode({ systemPrefersReduced: false, userPreference: null, surface: 'screen' }),
      'full'
    );
  });

  it('lets a user ask for LESS motion anywhere', () => {
    for (const surface of ['screen', 'xr'] as const) {
      assert.equal(
        resolveMotionMode({ systemPrefersReduced: false, userPreference: 'reduced', surface }),
        'reduced',
        surface
      );
    }
  });

  it('lets a user override back to full on a screen', () => {
    // On a screen the consequence of being wrong is aesthetic.
    assert.equal(
      resolveMotionMode({ systemPrefersReduced: true, userPreference: 'full', surface: 'screen' }),
      'full'
    );
  });

  it('does NOT let a user override back to full in a headset', () => {
    // §7: "on a headset it is safety, not preference." Vection with a
    // stationary inner ear is a nausea mechanism, and people susceptible to it
    // often do not find out until it is happening.
    assert.equal(
      resolveMotionMode({ systemPrefersReduced: true, userPreference: 'full', surface: 'xr' }),
      'reduced'
    );
  });

  it('does not force reduced motion in XR when the system did not ask for it', () => {
    // The XR rule is a FLOOR on the system setting, not a blanket ban on
    // motion in headsets — otherwise no XR user could ever see the idle layer.
    assert.equal(
      resolveMotionMode({ systemPrefersReduced: false, userPreference: null, surface: 'xr' }),
      'full'
    );
  });
});

describe('what reduced motion actually removes', () => {
  it('pins every vestibular source', () => {
    const reduced = motionPolicy('reduced');
    assert.equal(reduced.idleBodyScale, 0, 'breath, sway, drift, nod');
    assert.equal(reduced.gazeScale, 0, 'saccades');
    assert.equal(reduced.cameraFloatScale, 0, 'the whole world moving relative to the viewer');
    // Pinned, not damped: hair at 20% still swings on a head turn, and the
    // braids are the largest moving silhouette on screen.
    assert.equal(reduced.hairSwayScale, 0);
  });

  it('keeps the mouth and the blink, in BOTH modes', () => {
    for (const mode of ['full', 'reduced'] as const) {
      const policy = motionPolicy(mode);
      // A tutor whose lips do not move is broken, not restful.
      assert.equal(policy.mouthScale, 1, mode);
      // A face that never blinks is not calm, it is unsettling.
      assert.equal(policy.blinkScale, 1, mode);
    }
  });

  it('changes nothing in full mode', () => {
    const full = motionPolicy('full');
    for (const value of Object.values(full)) {
      if (typeof value === 'number') assert.equal(value, 1);
    }
  });

  it('is frozen, so nobody mutates the policy at runtime', () => {
    assert.ok(Object.isFrozen(MOTION_POLICIES.reduced));
    assert.ok(Object.isFrozen(MOTION_POLICIES));
  });
});

describe('the coverage registry', () => {
  it('covers every surface doc 22 §7 names', () => {
    assert.doesNotThrow(() => assertMotionPolicyComplete());
  });

  it('fails when an animation ships without accessibility wiring', () => {
    // This is the whole point of the registry. Before it, the fourth animated
    // surface someone added would ship unwired and nothing would complain.
    const missing = ANIMATED_SURFACES.filter((s) => s.id !== 'camera-float');
    assert.throws(() => assertMotionPolicyComplete(missing), /camera-float/);
  });

  it('fails when a surface claims a policy field that does not exist', () => {
    const bogus: AnimatedSurface[] = [
      ...ANIMATED_SURFACES,
      {
        id: 'confetti',
        moves: 'particles',
        governedBy: 'particleScale' as never,
        consumer: 'nowhere',
      },
    ];
    assert.throws(() => assertMotionPolicyComplete(bogus), /does not exist/);
  });

  it('requires a named consumer, so the wiring can be reviewed', () => {
    const unwired: AnimatedSurface[] = [
      ...ANIMATED_SURFACES,
      { id: 'glow-pulse', moves: 'rim brightness', governedBy: 'idleBodyScale', consumer: '' },
    ];
    assert.throws(() => assertMotionPolicyComplete(unwired), /names no consumer/);
  });

  it('describes what each surface moves, for the person deciding coverage', () => {
    for (const surface of ANIMATED_SURFACES) {
      assert.ok(surface.moves.length > 8, `${surface.id} needs a real description`);
    }
  });
});

describe('applying it', () => {
  function spies() {
    const calls: string[] = [];
    return {
      calls,
      faceBus: { setReducedMotion: (r: boolean) => calls.push(`face:${r}`) },
      cameraFloat: { setScale: (s: number) => calls.push(`camera:${s}`) },
    };
  }

  it('tells every consumer together, from one call site', () => {
    const s = spies();
    const result = applyMotionPolicy(motionPolicy('reduced'), {
      faceBus: s.faceBus,
      cameraFloat: s.cameraFloat,
    });
    assert.deepEqual(s.calls, ['face:true', 'camera:0']);
    // Hair rides along on the per-frame update, so the scale comes back rather
    // than being pushed — that keeps the policy the single source instead of a
    // value the frame loop caches and forgets to refresh.
    assert.equal(result.hairSwayScale, 0);
  });

  it('works when a surface has no hair or no camera rig', () => {
    // A 2D presence surface has neither. Optional consumers must not throw.
    assert.doesNotThrow(() => applyMotionPolicy(motionPolicy('full'), {}));
    const s = spies();
    const result = applyMotionPolicy(motionPolicy('full'), { faceBus: s.faceBus });
    assert.deepEqual(s.calls, ['face:false']);
    assert.equal(result.hairSwayScale, 1);
  });
});
