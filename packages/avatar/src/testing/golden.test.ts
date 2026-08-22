/**
 * The golden gate, tested without a GPU — doc 22 §8, §10.5.
 *
 * A test harness that is itself untested is a liability: it fails open, nobody
 * notices, and the gate has been green for six weeks while comparing nothing.
 * So the codec round-trips, the diff is checked against hand-built images with
 * known answers, and the capture loop is driven by a fake target that records
 * exactly what it was asked to do.
 *
 * The one thing these cannot check is whether the CAMERAS are pointed at
 * anything. That needs eyes on the first capture.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §8, §10.5
 * SOT-KEYWORDS: golden test harness png codec pixel diff capture determinism budget report
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GOLDEN_BUDGET,
  GOLDEN_CAMERAS,
  GOLDEN_FRAME_MS,
  GOLDEN_SEED,
  GOLDEN_STOP_AT,
  WARMUP_FRAMES,
  assertCaptureInvariants,
  captureGoldens,
  formatReport,
  summarise,
} from './golden.ts';
import type { GoldenTarget } from './golden.ts';
import { decodePng, encodePng } from './png.ts';
import { diffImages } from './pixel-diff.ts';

function solid(width: number, height: number, rgba: [number, number, number, number]) {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; ++i) data.set(rgba, i * 4);
  return { width, height, data };
}

describe('the PNG codec', () => {
  it('round-trips exactly', () => {
    const image = solid(9, 7, [12, 240, 33, 255]);
    image.data[4 * 4] = 200; // one odd pixel, so a constant-fill bug shows
    const decoded = decodePng(encodePng(image.data, image.width, image.height));
    assert.equal(decoded.width, 9);
    assert.equal(decoded.height, 7);
    assert.deepEqual([...decoded.data], [...image.data]);
  });

  it('round-trips a gradient, which exercises every row filter path', () => {
    const width = 33;
    const height = 17;
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        const p = (y * width + x) * 4;
        data[p] = (x * 7) & 0xff;
        data[p + 1] = (y * 13) & 0xff;
        data[p + 2] = (x * y) & 0xff;
        data[p + 3] = 255;
      }
    }
    assert.deepEqual([...decodePng(encodePng(data, width, height)).data], [...data]);
  });

  it('is byte-deterministic', () => {
    const image = solid(16, 16, [40, 50, 60, 255]);
    assert.ok(
      encodePng(image.data, 16, 16).equals(encodePng(image.data, 16, 16)),
      'goldens are checked in — the bytes must not depend on the run'
    );
  });

  it('refuses a buffer that is not a PNG, and a size that does not add up', () => {
    assert.throws(() => decodePng(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /not a PNG/);
    assert.throws(() => encodePng(new Uint8Array(10), 4, 4), /expected 64 bytes/);
  });
});

describe('the pixel diff', () => {
  it('reports zero for identical images', () => {
    const a = solid(20, 20, [128, 64, 32, 255]);
    const result = diffImages(a, solid(20, 20, [128, 64, 32, 255]));
    assert.equal(result.diffPixels, 0);
    assert.equal(result.fraction, 0);
  });

  it('counts a whole-image change as 100%', () => {
    const result = diffImages(solid(10, 10, [0, 0, 0, 255]), solid(10, 10, [255, 255, 255, 255]));
    assert.equal(result.diffPixels, 100);
    assert.equal(result.fraction, 1);
  });

  it('is far more sensitive to luminance than to chroma', () => {
    // This is the property that makes the metric agree with a reviewer: a
    // shifted highlight matters, a 1/255 hue drift in the sclera does not.
    const base = solid(4, 4, [128, 128, 128, 255]);
    const brighter = solid(4, 4, [168, 168, 168, 255]);
    const hueShift = solid(4, 4, [132, 128, 124, 255]);
    assert.ok(diffImages(base, brighter).diffPixels > 0, 'luminance shift is caught');
    assert.equal(diffImages(base, hueShift).diffPixels, 0, 'a small hue drift is not');
  });

  it('excludes antialiased edges by default and counts them when asked', () => {
    // A soft edge between two flat regions — black | grey | white — with the
    // grey column at a different coverage in each image. This is the braid and
    // lash case: a subpixel camera nudge changes thousands of edge pixels and
    // not one of them is a regression, so the default must exclude them.
    //
    // Note a HARD one-pixel line moved by a whole pixel is deliberately NOT
    // excluded by this heuristic, and should not be: that is a moved feature,
    // not a resampled edge.
    const softEdge = (grey: number) => {
      const image = solid(24, 24, [0, 0, 0, 255]);
      for (let y = 0; y < 24; ++y) {
        for (let x = 0; x < 24; ++x) {
          const p = (y * 24 + x) * 4;
          const value = x < 12 ? 0 : x === 12 ? grey : 255;
          image.data[p] = value;
          image.data[p + 1] = value;
          image.data[p + 2] = value;
        }
      }
      return image;
    };

    const excluded = diffImages(softEdge(96), softEdge(168));
    const included = diffImages(softEdge(96), softEdge(168), { includeAA: true });
    assert.ok(excluded.antialiased > 0, 'the soft edge was recognised as an edge');
    assert.equal(excluded.diffPixels, 0, 'and excluded from the count by default');
    assert.ok(included.diffPixels > 0, 'includeAA:true counts it');
    assert.equal(
      included.diffPixels,
      excluded.antialiased,
      'the two accountings must agree — every AA pixel is a diff pixel when included'
    );
  });

  it('refuses a size mismatch instead of resizing into agreement', () => {
    assert.throws(
      () => diffImages(solid(10, 10, [0, 0, 0, 255]), solid(20, 20, [0, 0, 0, 255])),
      /recapture, do not resize/
    );
  });
});

describe('the capture loop', () => {
  function fakeTarget() {
    const calls: { camera: string | null; deltas: number[] } = { camera: null, deltas: [] };
    const log: { camera: string; warmups: number; steps: number }[] = [];
    let warmups = 0;
    let steps = 0;
    const target: GoldenTarget = {
      width: 4,
      height: 4,
      setCamera(camera) {
        if (calls.camera) log.push({ camera: calls.camera, warmups, steps });
        calls.camera = camera.id;
        warmups = 0;
        steps = 0;
      },
      renderFrame(deltaMs) {
        if (deltaMs === 0) warmups += 1;
        else steps += 1;
        calls.deltas.push(deltaMs);
      },
      readPixels() {
        return new Uint8Array(4 * 4 * 4);
      },
    };
    return { target, calls, finish: () => [...log, { camera: calls.camera as string, warmups, steps }] };
  }

  it('warms up with a still frame, then runs a fixed number of fixed steps', async () => {
    const { target, finish } = fakeTarget();
    const cameras = GOLDEN_CAMERAS.slice(0, 2);
    await captureGoldens(target, { cameras, stopAt: 5, warmupFrames: 3 });
    const log = finish();
    assert.equal(log.length, 2);
    for (const entry of log) {
      assert.equal(entry.warmups, 3, 'pipeline compilation and PMREM happen here');
      // A warm-up that ticked the clock would make the capture depend on
      // warmupFrames, which is a tuning knob.
      assert.equal(entry.steps, 5);
    }
  });

  it('restarts the clock per camera, so adding one does not invalidate the rest', async () => {
    const { target, calls } = fakeTarget();
    await captureGoldens(target, { cameras: GOLDEN_CAMERAS.slice(0, 3), stopAt: 4, warmupFrames: 0 });
    assert.equal(calls.deltas.length, 12);
    assert.ok(calls.deltas.every((d) => d === GOLDEN_FRAME_MS), 'a fixed timestep throughout');
  });

  it('returns one frame per camera, tagged with which camera it was', async () => {
    const { target } = fakeTarget();
    const frames = await captureGoldens(target, { stopAt: 1, warmupFrames: 0 });
    assert.equal(frames.length, GOLDEN_CAMERAS.length);
    assert.deepEqual(
      frames.map((f) => f.camera.id),
      GOLDEN_CAMERAS.map((c) => c.id)
    );
    assert.equal(frames[0]?.data.length, 4 * 4 * 4);
  });
});

describe('capture invariants', () => {
  const good = { devicePixelRatio: 1, dampingEnabled: false, seed: GOLDEN_SEED, width: 512, height: 512 };

  it('accepts a reproducible setup', () => {
    assert.doesNotThrow(() => assertCaptureInvariants(good));
  });

  it('rejects each way a capture stops being reproducible', () => {
    // Every one of these produces a golden that passes on the machine that made
    // it and fails everywhere else — which reads as flakiness and gets the gate
    // turned off rather than the setup fixed.
    assert.throws(() => assertCaptureInvariants({ ...good, devicePixelRatio: 2 }), /devicePixelRatio/);
    assert.throws(() => assertCaptureInvariants({ ...good, dampingEnabled: true }), /damping/);
    assert.throws(() => assertCaptureInvariants({ ...good, seed: 8 }), /seed must be 7/);
    assert.throws(() => assertCaptureInvariants({ ...good, width: 512.5 }), /whole pixels/);
  });

  it('reports every problem at once, not just the first', () => {
    try {
      assertCaptureInvariants({ ...good, devicePixelRatio: 3, dampingEnabled: true, seed: 1 });
      assert.fail('should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      assert.match(message, /devicePixelRatio/);
      assert.match(message, /damping/);
      assert.match(message, /seed/);
    }
  });
});

describe('the camera set', () => {
  it('is seven cameras with unique ids', () => {
    assert.equal(GOLDEN_CAMERAS.length, 7, "matching the reference's count");
    assert.equal(new Set(GOLDEN_CAMERAS.map((c) => c.id)).size, 7);
  });

  it('covers every visually risky parity row', () => {
    const watched = new Set(GOLDEN_CAMERAS.flatMap((c) => [...c.watches]));
    // Rows 1 (skin BRDF), 3 (iris parallax), 5 (hair anisotropy), 6 (denim
    // wear), 7 (cavity + brow), 11 (post chain) and 13 (lashes) all change what
    // the picture looks like. A camera set that cannot see one of them cannot
    // police it.
    for (const row of [1, 3, 5, 6, 7, 11, 13]) {
      assert.ok(watched.has(row), `no camera watches §4 row ${row}`);
    }
  });

  it('gives every camera a stated reason', () => {
    for (const camera of GOLDEN_CAMERAS) {
      assert.ok(camera.why.length > 40, `${camera.id} needs a real reason, not a label`);
      assert.ok(camera.watches.length > 0, `${camera.id} watches nothing`);
      assert.ok(camera.fov > 0 && camera.fov < 90);
    }
  });

  it('pins the reference run parameters', () => {
    assert.equal(GOLDEN_SEED, 7);
    assert.equal(GOLDEN_STOP_AT, 240);
    assert.equal(GOLDEN_BUDGET, 0.004, 'doc 22 §8: 0.4%');
    assert.ok(WARMUP_FRAMES > 0);
  });
});

describe('the report', () => {
  const verdict = (id: string, fraction: number, watches: number[]) => ({
    id,
    fraction,
    diffPixels: Math.round(fraction * 10000),
    antialiased: 0,
    watches,
  });

  it('passes when every camera is inside the budget', () => {
    const report = summarise([verdict('front', 0.001, [1]), verdict('eyes-closeup', 0.0039, [3])]);
    assert.equal(report.passed, true);
    assert.equal(report.suspectRows.length, 0);
    assert.equal(report.worst?.id, 'eyes-closeup');
  });

  it('names the rows to read when it fails, deduplicated', () => {
    // A gate that says "0.9% over on three-quarter-left" costs an hour of
    // bisecting. One that says "suspect rows 1, 3, 5" starts in the right file.
    const report = summarise([
      verdict('front', 0.0005, [1, 8]),
      verdict('three-quarter-left', 0.009, [1, 3, 5]),
      verdict('profile-right', 0.02, [3, 4, 13]),
    ]);
    assert.equal(report.passed, false);
    assert.deepEqual(report.suspectRows, [1, 3, 4, 5, 13]);
    assert.equal(report.worst?.id, 'profile-right');
  });

  it('formats something a human can act on', () => {
    const text = formatReport(summarise([verdict('front', 0.02, [1, 11])]));
    assert.match(text, /FAIL/);
    assert.match(text, /suspect §4 rows: 1, 11/);
    assert.match(text, /2\.000%/);
  });
});
