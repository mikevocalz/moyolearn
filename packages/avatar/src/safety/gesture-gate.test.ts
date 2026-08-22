/**
 * Red-team cases for the gesture gate — doc 22 §7, §10.7.
 *
 * These are written as attacks, not as coverage. Each one is a track a
 * well-meaning model could plausibly generate, or a change a well-meaning
 * engineer could plausibly make, that would put a tutor across the line doc 02
 * drew. If any of them passes, the gate is decorative.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §7, §10.7
 * SOT-KEYWORDS: safety test red-team gesture gate reach lean gaze fail-closed engagement pressure
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CALM_IDLE,
  DEFAULT_GESTURE_LIMITS,
  DEFAULT_RIG_SEMANTICS,
  FORBIDDEN_GESTURES,
  PERMITTED_GESTURES,
  assertNoEngagementPressure,
  assertRigSemantics,
  gateGestureTrack,
  isPermittedGesture,
} from './gesture-gate.ts';
import type { GestureTrack } from '../speech/track.ts';

const JOINTS = [
  'spine1',
  'spine2',
  'spine3',
  'neck',
  'head',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
];

/** A benign track: small beats, head looking slightly off-camera. */
function track(
  frameCount = 60,
  mutate: (frame: number[], index: number, joint: (name: string) => number) => void = () => {}
): GestureTrack {
  const joint = (name: string) => JOINTS.indexOf(name) * 3;
  const frames: number[][] = [];
  for (let f = 0; f < frameCount; ++f) {
    const frame = new Array<number>(JOINTS.length * 3).fill(0);
    // A small, slow beat on the elbows — permitted, and enough that the tests
    // are not comparing an all-zero track against itself.
    frame[joint('left_elbow') + 1] = 0.05 * Math.sin(f / 9);
    frame[joint('right_elbow') + 1] = -0.05 * Math.sin(f / 9);
    // Head held slightly off-axis, i.e. NOT staring down the camera.
    frame[joint('head') + 1] = 0.2;
    mutate(frame, f, joint);
    frames.push(frame);
  }
  return { fps: 30, joints: JOINTS, frames };
}

describe('the vocabulary', () => {
  it('permits attention cues and nothing that reads as attachment', () => {
    // Attention is the point — a tutor who does not appear to be listening is
    // worse than no tutor. Attachment is the line doc 02 drew.
    assert.ok(isPermittedGesture('backchannel-nod'));
    assert.ok(isPermittedGesture('indicate-board'));
    for (const forbidden of FORBIDDEN_GESTURES) {
      assert.equal(isPermittedGesture(forbidden.id), false, forbidden.id);
    }
  });

  it('fails closed on an id nobody enumerated', () => {
    // However innocuous it sounds. Adding one is a reviewed edit to the list.
    assert.equal(isPermittedGesture('friendly-hug'), false);
    assert.equal(isPermittedGesture(''), false);
    assert.equal(isPermittedGesture('BACKCHANNEL-NOD'), false, 'not case-forgiving either');
  });

  it('cites the rule each forbidden gesture would break', () => {
    // A boundary a reviewer cannot read is a boundary that erodes.
    for (const forbidden of FORBIDDEN_GESTURES) {
      assert.match(forbidden.violates, /doc \d+/, forbidden.id);
    }
    for (const permitted of PERMITTED_GESTURES) {
      assert.ok(permitted.why.length > 30, `${permitted.id} needs a stated function`);
    }
  });
});

describe('red team: tracks that must not play', () => {
  it('rejects a lean toward the camera', () => {
    const attack = track(30, (frame, _f, joint) => {
      // Split across three spine joints so no single one looks extreme — this
      // is exactly how a lean-in shows up in a real pose stream.
      frame[joint('spine1')] = 0.06;
      frame[joint('spine2')] = 0.06;
      frame[joint('spine3')] = 0.06;
    });
    const result = gateGestureTrack(attack);
    assert.equal(result.passed, false);
    assert.equal(result.violations[0]?.kind, 'torso-lean');
    assert.match(result.violations[0]?.message ?? '', /leaning-in/);
  });

  it('rejects a reach toward the viewer', () => {
    const attack = track(30, (frame, f, joint) => {
      // Ramped in slowly so the speed cap is not what catches it — the reach
      // itself must be the violation.
      frame[joint('right_shoulder')] = Math.min(1.0, f * 0.03);
    });
    const result = gateGestureTrack(attack);
    assert.equal(result.passed, false);
    assert.equal(result.violations[0]?.kind, 'shoulder-reach');
  });

  it('rejects a held stare', () => {
    // Camera-facing, motionless, for four seconds. Nothing about this track is
    // anomalous frame by frame; the violation is entirely in the duration.
    const attack = track(150, (frame, _f, joint) => {
      frame[joint('head') + 1] = 0;
    });
    const result = gateGestureTrack(attack);
    assert.equal(result.passed, false);
    assert.equal(result.violations[0]?.kind, 'sustained-gaze');
    assert.match(result.violations[0]?.message ?? '', /stare/);
  });

  it('allows eye contact that is made and broken', () => {
    // The gate must not forbid mutual gaze — a tutor who never meets your eye
    // is its own problem. A smooth four-second cycle in and out of the cone,
    // ~1.7 s of contact each time, which is inside a conversational norm.
    //
    // The transition is SMOOTH on purpose: an instant snap between looking at
    // you and away trips the speed cap, and correctly so — that is a flick, not
    // a glance. Writing this test naively is how you discover the speed cap
    // also polices gaze.
    const ok = track(240, (frame, f, joint) => {
      frame[joint('head') + 1] = 0.3 * (0.5 - 0.5 * Math.cos((f * 2 * Math.PI) / 120));
    });
    const result = gateGestureTrack(ok);
    assert.equal(result.passed, true, result.violations[0]?.message);
  });

  it('rejects a startle even when the pose it lands in is legal', () => {
    const attack = track(30, (frame, f, joint) => {
      // One frame of violent motion, ending somewhere unremarkable.
      frame[joint('left_elbow')] = f === 15 ? 0.9 : 0;
    });
    const result = gateGestureTrack(attack);
    assert.equal(result.passed, false);
    assert.equal(result.violations[0]?.kind, 'joint-speed');
  });

  it('rejects a wild pose outright', () => {
    const attack = track(10, (frame, _f, joint) => {
      frame[joint('left_elbow')] = 2.5;
    });
    assert.equal(gateGestureTrack(attack).passed, false);
  });
});

describe('failing closed', () => {
  it('falls back to a calm idle, never a T-pose or an error', () => {
    const result = gateGestureTrack(track(30, (frame, _f, joint) => {
      frame[joint('spine3')] = 0.9;
    }));
    assert.equal(result.passed, false);
    assert.equal(result.fallback, CALM_IDLE);
    // §7 is explicit about the failure mode: a child should read "she has gone
    // quiet", which is a thing people do, not "she is broken", which is not.
    assert.deepEqual([...CALM_IDLE.channels], ['breath', 'blink']);
    assert.match(CALM_IDLE.why, /never a frozen T-pose/);
  });

  it('rejects a malformed track rather than playing part of it', () => {
    const short = track(4);
    (short.frames[2] as number[]).pop();
    assert.equal(gateGestureTrack(short).violations[0]?.kind, 'malformed-track');

    const nan = track(4);
    (nan.frames[1] as number[])[0] = Number.NaN;
    // A NaN propagates silently through the FK into a vanished mesh.
    assert.equal(gateGestureTrack(nan).violations[0]?.kind, 'malformed-track');

    assert.equal(gateGestureTrack({ ...track(4), fps: 0 }).passed, false);
    assert.equal(gateGestureTrack({ ...track(4), frames: [] }).passed, false);
  });

  it('refuses a track missing a joint the limits depend on', () => {
    const partial = track(4);
    const stripped: GestureTrack = {
      fps: partial.fps,
      joints: partial.joints.filter((j) => j !== 'spine2'),
      frames: partial.frames.map((f) => f.slice(0, (partial.joints.length - 1) * 3)),
    };
    const result = gateGestureTrack(stripped);
    // The gate cannot check what it cannot find, and a partially-checked track
    // is worse than a rejected one because it looks checked.
    assert.equal(result.passed, false);
    assert.equal(result.violations[0]?.kind, 'unknown-joint');
  });

  it('rejects the whole track, not the offending window', () => {
    const attack = track(120, (frame, f, joint) => {
      if (f === 90) frame[joint('spine1')] = 0.5;
    });
    const result = gateGestureTrack(attack);
    assert.equal(result.passed, false);
    // Splicing would produce a pose discontinuity mid-sentence — a glitch that
    // draws exactly the attention the rejection was avoiding.
    assert.equal(result.fallback, CALM_IDLE);
  });
});

describe('benign tracks still play', () => {
  it('passes ordinary co-speech beats', () => {
    // A gate that rejects everything is not a safe gate, it is a broken one:
    // the fallback idle would play constantly and the tutor would read as dead.
    const result = gateGestureTrack(track(240));
    assert.equal(result.passed, true, result.violations[0]?.message);
    assert.equal(result.fallback, null);
    assert.equal(result.violations.length, 0);
  });

  it('passes a nod and an open-palm offer inside the limits', () => {
    const ok = track(90, (frame, f, joint) => {
      frame[joint('neck')] = 0.09 * Math.sin(f / 4); // nod
      frame[joint('left_shoulder')] = 0.4; // palm up, below the shoulder line
    });
    assert.equal(gateGestureTrack(ok).passed, true);
  });
});

describe('engagement pressure', () => {
  const clean = {
    attentionGetsLouderAfterInactivityMs: null,
    hasDisappointmentState: false,
    presenceOutsideWakingHours: false,
  };

  it('accepts a policy with none of it', () => {
    assert.doesNotThrow(() => assertNoEngagementPressure(clean));
  });

  it('rejects each mechanic a growth team reaches for by reflex', () => {
    assert.throws(
      () => assertNoEngagementPressure({ ...clean, attentionGetsLouderAfterInactivityMs: 30_000 }),
      /attention-getting motion after inactivity/
    );
    assert.throws(
      () => assertNoEngagementPressure({ ...clean, hasDisappointmentState: true }),
      /sulking, waiting, or disappointment/
    );
    assert.throws(
      () => assertNoEngagementPressure({ ...clean, presenceOutsideWakingHours: true }),
      /late-night presence/
    );
  });

  it('cites the document, so the next ticket argues with the doc and not the test', () => {
    try {
      assertNoEngagementPressure({ ...clean, hasDisappointmentState: true });
      assert.fail('should have thrown');
    } catch (error) {
      assert.match((error as Error).message, /doc 04/);
    }
  });
});

describe('rig semantics', () => {
  it('confirms a known forward lean reads positive', () => {
    const forward = track(1, (frame, _f, joint) => {
      frame[joint('spine1')] = 0.1;
      frame[joint('spine2')] = 0.1;
    });
    assert.doesNotThrow(() => assertRigSemantics(forward));
  });

  it('catches an inverted convention — the worst failure a safety check has', () => {
    const forward = track(1, (frame, _f, joint) => {
      frame[joint('spine1')] = 0.1;
    });
    assert.throws(
      () => assertRigSemantics(forward, { ...DEFAULT_RIG_SEMANTICS, pitchSign: -1 }),
      // As configured it would PASS the tracks it exists to reject, which is
      // strictly worse than having no gate: the gate would be providing false
      // assurance in review.
      /would\s+PASS the tracks it exists to reject/
    );
  });

  it('keeps the limits at values a human can sanity-check', () => {
    // ~8° of lean and ~45° of shoulder flexion. If either drifts far from
    // these, someone has tuned the gate to admit a specific track.
    assert.ok(DEFAULT_GESTURE_LIMITS.maxTorsoLeanRad < 0.2);
    assert.ok(DEFAULT_GESTURE_LIMITS.maxShoulderFlexionRad < 1.0);
    assert.equal(DEFAULT_GESTURE_LIMITS.maxGazeHoldMs, 3000);
  });
});
