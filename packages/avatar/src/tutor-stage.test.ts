/**
 * The 2D ↔ 3D handoff — doc 22 §10.8, doc 23.
 *
 * Every test here corresponds to a way the handoff can be unkind to a child:
 * a tutor that vanishes into a spinner, a face that changes mid-sentence, a
 * flap between two tutors, or an error screen for something they never asked
 * for. The state machine exists to make those unrepresentable, so these are
 * the tests that actually matter rather than coverage of the enum.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §10.8; docs/pack/23-tutorstage-handoff.md
 * SOT-KEYWORDS: tutorstage test handoff swap speech demotion progress presence first-frame
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_MINIMUM_PRESENCE_MS,
  createTutorStage,
  shouldRender3D,
  showsProgress,
} from './tutor-stage.ts';
import type { StageState } from './tutor-stage.ts';

/** Drives a stage all the way to `pending-swap`, without ticking past the minimum. */
function readyStage(overrides: Parameters<typeof createTutorStage>[0] | null = null) {
  const changes: StageState[] = [];
  const stage = createTutorStage(
    overrides ?? { tier: 'tablet', onChange: (state) => changes.push(state) }
  );
  stage.tick(0);
  stage.beginUpgrade(0);
  stage.setProgress(0.5);
  stage.assetsReady(200);
  stage.firstFrameRendered(400);
  return { stage, changes };
}

describe('the tutor is never absent', () => {
  it('shows 2D from the very first state, on every tier', () => {
    for (const tier of ['presence-2d', 'phone', 'tablet', 'studio'] as const) {
      const stage = createTutorStage({ tier });
      // There is no configuration where 3D is the first thing drawn — it cannot
      // be instant, and the alternative to 2D is a blank rectangle.
      assert.equal(stage.state().surface, 'presence-2d', tier);
    }
  });

  it('stays on 2D through the entire download and warm-up', () => {
    const stage = createTutorStage({ tier: 'tablet' });
    stage.tick(0);
    stage.beginUpgrade(0);
    assert.equal(stage.state().surface, 'presence-2d');
    stage.setProgress(0.9);
    assert.equal(stage.state().surface, 'presence-2d');
    stage.assetsReady(500);
    // "Assets are on disk" is NOT the swap gate. This is the specific mistake
    // that puts a child in front of a spinner.
    assert.equal(stage.state().phase, 'warming');
    assert.equal(stage.state().surface, 'presence-2d');
  });

  it('swaps only after a real rendered frame', () => {
    const { stage } = readyStage();
    assert.equal(stage.state().phase, 'pending-swap');
    stage.tick(DEFAULT_MINIMUM_PRESENCE_MS + 1);
    assert.equal(stage.state().surface, 'avatar-3d');
    assert.equal(stage.state().hasBeenLive, true);
  });

  it('will not swap before the child has actually seen the 2D tutor', () => {
    const { stage } = readyStage();
    // A swap 200 ms after mount reads as a glitch, not an upgrade.
    stage.tick(300);
    assert.equal(stage.state().surface, 'presence-2d');
    stage.tick(DEFAULT_MINIMUM_PRESENCE_MS);
    assert.equal(stage.state().surface, 'avatar-3d');
  });
});

describe('the swap never interrupts speech', () => {
  it('waits while the tutor is mid-utterance', () => {
    const { stage } = readyStage();
    stage.setSpeaking(true);
    stage.tick(10_000);
    // A face changing identity mid-sentence is uncanny in a way a delay is not.
    assert.equal(stage.state().surface, 'presence-2d');
    assert.equal(stage.state().phase, 'pending-swap');
  });

  it('takes the moment the utterance ends, without waiting for the next tick', () => {
    const { stage } = readyStage();
    stage.setSpeaking(true);
    stage.tick(10_000);
    stage.setSpeaking(false);
    assert.equal(stage.state().surface, 'avatar-3d', 'end of utterance is the natural handover');
  });

  it('keeps rendering 3D off-screen while it waits', () => {
    const { stage } = readyStage();
    stage.setSpeaking(true);
    stage.tick(10_000);
    // Stopping and restarting would warm up twice and swap in a cold frame —
    // the exact stutter the handoff exists to avoid.
    assert.equal(shouldRender3D(stage.state()), true);
  });
});

describe('falling back', () => {
  it('settles permanently — no flapping between two tutors', () => {
    const { stage } = readyStage();
    stage.tick(DEFAULT_MINIMUM_PRESENCE_MS + 1);
    assert.equal(stage.state().surface, 'avatar-3d');

    stage.settle('demoted-thermal');
    assert.equal(stage.state().surface, 'presence-2d');
    assert.equal(stage.state().phase, 'settled-2d');

    // Everything that would normally advance the machine is now inert.
    stage.beginUpgrade(20_000);
    stage.assetsReady(21_000);
    stage.firstFrameRendered(22_000);
    stage.tick(30_000);
    assert.equal(stage.state().phase, 'settled-2d');
    assert.equal(stage.state().surface, 'presence-2d');
  });

  it('remembers that 3D worked, so telemetry can tell the two failures apart', () => {
    const { stage } = readyStage();
    stage.tick(DEFAULT_MINIMUM_PRESENCE_MS + 1);
    stage.settle('demoted-frame-budget');
    // "never started" and "started then thermally demoted" are different bugs.
    assert.equal(stage.state().hasBeenLive, true);
    assert.equal(stage.state().reason, 'demoted-frame-budget');
  });

  it('treats a download failure as 2D, not as an error', () => {
    const stage = createTutorStage({ tier: 'phone' });
    stage.tick(0);
    stage.beginUpgrade(0);
    stage.settle('assets-unavailable');
    // Doc 23's state union has no `error` kind on purpose. A child is not shown
    // a failure for something they never asked for.
    assert.equal(stage.state().phase, 'settled-2d');
    assert.equal(stage.state().surface, 'presence-2d');
    assert.equal(showsProgress(stage.state()), false);
  });

  it('starts settled on the 2D tier and never tries', () => {
    const stage = createTutorStage({ tier: 'presence-2d' });
    assert.equal(stage.state().phase, 'settled-2d');
    assert.equal(stage.state().reason, 'tier-2d');
    stage.beginUpgrade(0);
    assert.equal(stage.state().phase, 'settled-2d', 'no download on a device that cannot draw it');
    assert.equal(shouldRender3D(stage.state()), false);
  });
});

describe('progress reporting', () => {
  it('is shown only while downloading, and is clamped', () => {
    const stage = createTutorStage({ tier: 'tablet' });
    stage.tick(0);
    assert.equal(showsProgress(stage.state()), false, 'not before the upgrade begins');

    stage.beginUpgrade(0);
    stage.setProgress(0.42);
    assert.equal(showsProgress(stage.state()), true);
    assert.equal(stage.state().progress, 0.42);

    stage.setProgress(9);
    assert.equal(stage.state().progress, 1);
    stage.setProgress(-3);
    assert.equal(stage.state().progress, 0);

    stage.assetsReady(100);
    // Warming is not a download and must not show a progress bar that will
    // then sit at 100 % for a second and a half.
    assert.equal(showsProgress(stage.state()), false);
    assert.equal(stage.state().progress, null);
  });
});

describe('the change callback', () => {
  it('fires once per real transition and not on no-ops', () => {
    const changes: StageState[] = [];
    const stage = createTutorStage({ tier: 'tablet', onChange: (s) => changes.push(s) });
    stage.tick(0);
    stage.beginUpgrade(0);
    stage.beginUpgrade(0); // idempotent
    stage.setProgress(0.5);
    stage.setProgress(0.5); // same value
    stage.assetsReady(100);
    stage.firstFrameRendered(200);
    stage.tick(DEFAULT_MINIMUM_PRESENCE_MS + 1);

    assert.deepEqual(
      changes.map((c) => c.phase),
      ['preparing', 'preparing', 'warming', 'pending-swap', 'live']
    );
  });
});

describe('what should be rendering', () => {
  it('renders 3D from warm-up through live, and never before or after', () => {
    const stage = createTutorStage({ tier: 'studio' });
    stage.tick(0);
    assert.equal(shouldRender3D(stage.state()), false, 'presence');
    stage.beginUpgrade(0);
    assert.equal(shouldRender3D(stage.state()), false, 'downloading');
    stage.assetsReady(100);
    assert.equal(shouldRender3D(stage.state()), true, 'warming');
    stage.firstFrameRendered(200);
    assert.equal(shouldRender3D(stage.state()), true, 'pending-swap');
    stage.tick(DEFAULT_MINIMUM_PRESENCE_MS + 1);
    assert.equal(shouldRender3D(stage.state()), true, 'live');
    stage.settle('context-lost');
    assert.equal(shouldRender3D(stage.state()), false, 'settled');
  });
});
