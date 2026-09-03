/**
 * The splash's hearts — a GPU particle field that rises from the bottom edge
 * and spreads across the screen while the mark assembles.
 *
 * WHY THE GPU. Two hundred sprites, each with its own drift, sway and fade,
 * is a per-frame write per sprite on the JS thread; on the UI thread with
 * Reanimated it is 200 nodes fighting the same frame as the mark's own
 * animation. Here the whole field is one compute dispatch and one instanced
 * draw: the JS side writes three floats a frame (time, delta, aspect) and
 * touches nothing else.
 *
 * Ported from TypeGPU's `react/confetti` example, with three changes React
 * Native forces:
 *
 *  1. NO `@typegpu/react`. Its `useConfigureContext` takes a DOM canvas ref.
 *     Here the surface is `react-native-webgpu`'s `<Canvas>`, so the device,
 *     the context configuration and the frame loop are owned by this file —
 *     the same shape `src/native-3d/webgpu-smoke.tsx` proved on device.
 *  2. `context.present()` AFTER EVERY FRAME. Three's renderer and this both
 *     draw into a surface that is not shown until it is presented; omitting it
 *     is a permanently empty view with a healthy frame loop behind it.
 *  3. A HEART, NOT A RECTANGLE. Confetti draws its quad and returns the
 *     instance colour; the fragment here evaluates the heart implicit
 *     ((x²+y²-1)³ - x²y³ ≤ 0) over the quad's own uv and discards outside it,
 *     so a heart costs the same four vertices a confetto does.
 *
 * IT IS OPTIONAL BY CONSTRUCTION. `navigator.gpu` only exists because
 * `react-native-webgpu` was imported, and a device request can fail on old
 * hardware or a software adapter. Every failure path leaves `ready` false and
 * this renders nothing: the splash plays without hearts rather than not at all.
 *
 * SOT: ./MoyoSplash.tsx · docs/decisions/adr-111-native-3d-runtime.md
 * SOT-KEYWORDS: splash hearts typegpu webgpu particles compute instanced gpu
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, type CanvasRef } from 'react-native-webgpu';
import { tgpu, d, std } from 'typegpu';

import { INK } from './moyo-splash-scene';

/** Enough to read as a field, few enough to stay in one dispatch. */
const HEARTS = 180;

/** The brand's warm half. Plum is the ink of the lockup, not of the hearts. */
const PALETTE = [INK.coral, INK.amber, INK.teal].map((hex) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return d.vec4f(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1);
});

const HeartGeometry = d.struct({
  /** Half-width in clip space; the heart is drawn about its own centre. */
  size: d.f32,
  /** Radians. A field of upright hearts reads as a pattern, not as motion. */
  tilt: d.f32,
  color: d.vec4f,
});

const HeartData = d.struct({
  position: d.vec2f,
  velocity: d.vec2f,
  seed: d.f32,
});

const geometryLayout = tgpu.vertexLayout(d.arrayOf(HeartGeometry), 'instance');
const dataLayout = tgpu.vertexLayout(d.arrayOf(HeartData), 'instance');

/**
 * Where a heart starts: along the bottom edge, below it, drifting up and out.
 *
 * `x` spans the full width plus a margin so the spread does not begin as a
 * column in the middle; `y` starts under the edge and is staggered by up to two
 * screen heights so the field arrives continuously rather than as one wave.
 */
function seedHearts() {
  return Array.from({ length: HEARTS }, () => ({
    position: d.vec2f(Math.random() * 2.4 - 1.2, -1.1 - Math.random() * 2),
    // Up, always — with a sideways component that gives the field its spread.
    velocity: d.vec2f((Math.random() * 2 - 1) * 0.22, 0.28 + Math.random() * 0.5),
    seed: Math.random(),
  }));
}

const computeLayout = tgpu.bindGroupLayout({
  time: { uniform: d.f32 },
  deltaTime: { uniform: d.f32 },
  hearts: { storage: d.arrayOf(HeartData), access: 'mutable' },
});

const simulate = (idx: number) => {
  'use gpu';
  const heart = computeLayout.$.hearts[idx];
  const phase = computeLayout.$.time / 900 + heart.seed * 6.28;

  /*
    Rise, plus a sway whose period is per-heart — the sway is what stops 180
    sprites moving as one sheet.

    FUNCTION-STYLE MATH, not operators. TypeGPU's vector types support `+` and
    `*` only under `tsover`, the TypeScript fork with operator-overload
    checking (redraw/TypeGPU docs both call this out). This repo compiles with
    stock `tsc`, so vector arithmetic is `std.add` / `std.mul` — the same WGSL
    comes out either way.
  */
  heart.position = std.add(
    heart.position,
    std.mul(heart.velocity, computeLayout.$.deltaTime / 1000),
  );
  heart.position.x += (std.sin(phase) * computeLayout.$.deltaTime) / 9000;

  // Past the top it returns under the bottom edge, so the field never thins.
  if (heart.position.y > 1.35) {
    heart.position.y = -1.2;
  }
};

/*
  THE SPARKS — the magic on the ornaments.

  The mark's leg ornaments pop in top-to-bottom (`MoyoSplash`'s ornament
  cascade). These are the sparks that come off them: a burst seeded at the two
  legs, thrown outward with gravity, dying young. They share the heart field's
  pipeline shape — same instanced quad, same vertex function — and differ only
  in their motion and in being drawn as points rather than hearts, because a
  spark with a heart's silhouette is a heart.
*/
const SPARKS = 140;

const SparkData = d.struct({
  position: d.vec2f,
  velocity: d.vec2f,
  /** Seconds remaining, counted down by the compute pass. */
  life: d.f32,
});

const sparkDataLayout = tgpu.vertexLayout(d.arrayOf(SparkData), 'instance');

const sparkComputeLayout = tgpu.bindGroupLayout({
  deltaTime: { uniform: d.f32 },
  /** Rises 0 → 1 across the ornament cascade; each spark launches at its own step. */
  progress: { uniform: d.f32 },
  sparks: { storage: d.arrayOf(SparkData), access: 'mutable' },
});

/**
 * Where a spark starts: on one of the two legs, at the height the cascade has
 * reached. The legs are at roughly ±0.13 of clip space either side of the
 * spine on the settled mark, and the cascade runs downward, so the launch
 * height follows `progress` down the leg.
 */
function seedSparks() {
  return Array.from({ length: SPARKS }, (_, i) => {
    const leg = i % 2 === 0 ? -0.115 : 0.115;
    return {
      position: d.vec2f(leg, 0),
      // Outward and up, mostly sideways: a spark that goes straight up reads as
      // smoke rather than as something struck off the mark.
      velocity: d.vec2f(
        (leg < 0 ? -1 : 1) * (0.18 + Math.random() * 0.5),
        0.1 + Math.random() * 0.55,
      ),
      // Staggered so the field fires down the leg with the cascade rather than
      // all at once, and so a spark is always young somewhere.
      life: -(i / SPARKS) * 0.9,
    };
  });
}

const SPARK_LIFE = 0.75;

const simulateSparks = (idx: number) => {
  'use gpu';
  const spark = sparkComputeLayout.$.sparks[idx];
  const dt = sparkComputeLayout.$.deltaTime / 1000;

  // A negative life is a spark waiting its turn; the cascade's progress is what
  // brings it forward, so the burst tracks the ornaments rather than a clock of
  // its own.
  if (spark.life < 0) {
    spark.life += dt * sparkComputeLayout.$.progress * 2.2;
    return;
  }

  spark.position = std.add(spark.position, std.mul(spark.velocity, dt));
  // Gravity, and drag: the arc has to fall or it is a firework, not a spark.
  spark.velocity.y -= dt * 1.6;
  spark.velocity = std.mul(spark.velocity, 1 - dt * 0.9);
  spark.life -= dt;

  if (spark.life <= 0 && sparkComputeLayout.$.progress > 0.02) {
    // Relit at the launch point, so the cascade keeps throwing sparks for as
    // long as the ornaments are arriving.
    spark.position = d.vec2f(spark.position.x > 0 ? 0.115 : -0.115, 0);
    spark.velocity = d.vec2f(
      (spark.position.x > 0 ? 1 : -1) * (0.2 + std.fract(spark.life * 91.7) * 0.5),
      0.12 + std.fract(spark.life * 37.3) * 0.5,
    );
    spark.life = SPARK_LIFE;
  }
};

const sparkRenderLayout = tgpu.bindGroupLayout({
  aspectRatio: { uniform: d.f32 },
  intensity: { uniform: d.f32 },
});

const sparkAttribs = {
  ...geometryLayout.attrib,
  center: sparkDataLayout.attrib.position,
  life: sparkDataLayout.attrib.life,
};

const sparkVertex = (input: {
  size: number;
  tilt: number;
  color: d.v4f;
  center: d.v2f;
  life: number;
  $vertexIndex: number;
}) => {
  'use gpu';
  const corners = [d.vec2f(-1, -1), d.vec2f(1, -1), d.vec2f(-1, 1), d.vec2f(1, 1)];
  const uv = corners[input.$vertexIndex];

  // A spark shrinks as it dies, which is what makes the burst read as embers
  // rather than as dots switching off.
  const fade = std.clamp(input.life / SPARK_LIFE, 0, 1);
  const pos = std.add(std.mul(uv, input.size * 0.45 * fade), input.center);

  if (sparkRenderLayout.$.aspectRatio < 1) {
    pos.x /= sparkRenderLayout.$.aspectRatio;
  } else {
    pos.y *= sparkRenderLayout.$.aspectRatio;
  }

  return { $position: d.vec4f(pos, 0, 1), uv, fade, color: input.color };
};

const sparkFragment = (input: { uv: d.v2f; fade: number; color: d.v4f }) => {
  'use gpu';
  // A round core with a soft halo — one length, no texture.
  const r = std.length(input.uv);
  const core = 1 - std.smoothstep(0.25, 1, r);
  const alpha = core * input.fade * sparkRenderLayout.$.intensity;
  if (alpha <= 0.004) {
    std.discard();
  }
  // Sparks read warmer than their source: pushed toward white at the core.
  const hot = std.mix(input.color.xyz, d.vec3f(1, 1, 1), core * 0.65);
  return d.vec4f(std.mul(hot, alpha), alpha);
};

const renderLayout = tgpu.bindGroupLayout({
  aspectRatio: { uniform: d.f32 },
  /** 0 → 1 over the splash: the field swells in and fades before the hand-off. */
  intensity: { uniform: d.f32 },
});

const attribs = {
  ...geometryLayout.attrib,
  center: dataLayout.attrib.position,
};

const vertexShader = (input: {
  size: number;
  tilt: number;
  color: d.v4f;
  center: d.v2f;
  $vertexIndex: number;
}) => {
  'use gpu';
  // A unit quad about the origin, so the heart implicit in the fragment gets a
  // uv in [-1, 1] with no extra uniforms.
  const corners = [d.vec2f(-1, -1), d.vec2f(1, -1), d.vec2f(-1, 1), d.vec2f(1, 1)];
  const uv = corners[input.$vertexIndex];

  const c = std.cos(input.tilt);
  const s = std.sin(input.tilt);
  const spun = d.vec2f(uv.x * c - uv.y * s, uv.x * s + uv.y * c);

  const pos = std.add(std.mul(spun, input.size), input.center);
  // Keep hearts round on a wide window rather than stretched with it.
  if (renderLayout.$.aspectRatio < 1) {
    pos.x /= renderLayout.$.aspectRatio;
  } else {
    pos.y *= renderLayout.$.aspectRatio;
  }

  return {
    $position: d.vec4f(pos, 0, 1),
    uv,
    color: input.color,
  };
};

/**
 * Inigo Quilez's exact heart SDF, in TGSL.
 *
 * The first version evaluated the heart IMPLICIT — (x²+y²-1)³ - x²y³ ≤ 0 — and
 * took its magnitude as a distance to feather the edge with. That value is not
 * a distance: it grows cubically off the surface, so the "soft edge" swallowed
 * the cusp and the notch and every sprite rendered as a blob. This returns a
 * real signed distance in the same units as the uv, which is what makes both
 * the notch at the top and a one-pixel edge possible.
 *
 * Its space: the point sits at y = 0, the lobes reach y ≈ 1.3, x ∈ [-1, 1].
 * https://iquilezles.org/articles/distfunctions2d/
 */
const dot2 = (v: d.v2f) => {
  'use gpu';
  return std.dot(v, v);
};

const sdHeart = (q: d.v2f) => {
  'use gpu';
  // Mirrored about x, so only half the shape has to be described.
  const p = d.vec2f(std.abs(q.x), q.y);

  if (p.y + p.x > 1) {
    return std.sqrt(dot2(std.sub(p, d.vec2f(0.25, 0.75)))) - std.sqrt(2) / 4;
  }
  const lobe = dot2(std.sub(p, d.vec2f(0, 1)));
  const k = std.max(p.x + p.y, 0) * 0.5;
  const cleft = dot2(std.sub(p, d.vec2f(k, k)));
  return std.sqrt(std.min(lobe, cleft)) * std.sign(p.x - p.y);
};

const fragmentShader = (input: { uv: d.v2f; color: d.v4f }) => {
  'use gpu';
  /*
    The quad's uv is [-1, 1]; the SDF wants the point at y = 0 and the lobes
    near y = 1.3. `0.9` leaves a margin inside the quad so the antialiased edge
    is never clipped by the triangle it is drawn on.
  */
  const q = d.vec2f(input.uv.x * 0.9, (input.uv.y + 1) * 0.65);
  const dist = sdHeart(q);

  // One SDF, one edge: filled inside, feathered over the last 0.05 of distance.
  const edge = 1 - std.smoothstep(0, 0.05, dist);
  if (edge <= 0.001) {
    std.discard();
  }

  const alpha = edge * renderLayout.$.intensity;
  // Premultiplied: colour carries the alpha, matching the surface's alphaMode
  // and the blend factors on the pipeline's target.
  return d.vec4f(std.mul(input.color.xyz, alpha), alpha);
};

export interface HeartFieldLevels {
  /**
   * The heart field's level, 0 → 1. It is the field's opacity AND its own
   * fade-out, so the hearts belong to the splash's clock rather than running
   * on one of their own.
   */
  hearts: number;
  /** The spark burst's level, rising and falling with the ornament cascade. */
  sparks: number;
}

export interface HeartFieldProps {
  /**
   * Written every frame by the splash. A ref, not props: these change 60 times
   * a second and the GPU loop reads whatever is current, so re-rendering React
   * to move them would be 60 renders a second to update two floats.
   */
  levelsRef: { current: HeartFieldLevels };
}

export function HeartField({ levelsRef }: HeartFieldProps) {
  const ref = useRef<CanvasRef>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (failed) return;
    let raf = 0;
    let disposed = false;

    const start = async () => {
      const context = ref.current?.getContext('webgpu');
      if (!context) {
        setFailed(true);
        return;
      }

      const adapter = await navigator.gpu?.requestAdapter();
      const device = await adapter?.requestDevice();
      if (!device) {
        setFailed(true);
        return;
      }
      if (disposed) return;

      const format = navigator.gpu.getPreferredCanvasFormat();
      context.configure({ device, format, alphaMode: 'premultiplied' });

      const root = tgpu.initFromDevice({ device });

      const geometry = root
        .createBuffer(
          d.arrayOf(HeartGeometry, HEARTS),
          Array.from({ length: HEARTS }, () => ({
            size: 0.018 + Math.random() * 0.03,
            tilt: (Math.random() * 2 - 1) * 0.5,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? PALETTE[0],
          })),
        )
        .$usage('vertex');

      const data = root
        .createBuffer(d.arrayOf(HeartData, HEARTS), seedHearts())
        .$usage('storage', 'vertex');

      const sparkData = root
        .createBuffer(d.arrayOf(SparkData, SPARKS), seedSparks())
        .$usage('storage', 'vertex');

      const sparkGeometry = root
        .createBuffer(
          d.arrayOf(HeartGeometry, SPARKS),
          Array.from({ length: SPARKS }, () => ({
            size: 0.012 + Math.random() * 0.014,
            tilt: 0,
            color: PALETTE[Math.floor(Math.random() * PALETTE.length)] ?? PALETTE[0],
          })),
        )
        .$usage('vertex');

      const time = root.createBuffer(d.f32, 0).$usage('uniform');
      const deltaTime = root.createBuffer(d.f32, 0).$usage('uniform');
      const aspectRatio = root.createBuffer(d.f32, 1).$usage('uniform');
      const intensity = root.createBuffer(d.f32, 0).$usage('uniform');
      const sparkLevel = root.createBuffer(d.f32, 0).$usage('uniform');

      const computePipeline = root.createGuardedComputePipeline(simulate);
      const renderPipeline = root.createRenderPipeline({
        attribs,
        vertex: vertexShader,
        fragment: fragmentShader,
        primitive: { topology: 'triangle-strip' },
        targets: {
          format,
          blend: {
            // Premultiplied source over: the hearts sit on the paper, and the
            // fragment already multiplied colour by alpha.
            color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' },
          },
        },
      });

      const sparkCompute = root.createGuardedComputePipeline(simulateSparks);
      const sparkPipeline = root.createRenderPipeline({
        attribs: sparkAttribs,
        vertex: sparkVertex,
        fragment: sparkFragment,
        primitive: { topology: 'triangle-strip' },
        targets: {
          format,
          blend: {
            // ADDITIVE for the sparks — they are light, so two overlapping
            // sparks are brighter rather than one occluding the other. The
            // hearts stay source-over; they are ink.
            color: { srcFactor: 'one', dstFactor: 'one' },
            alpha: { srcFactor: 'one', dstFactor: 'one' },
          },
        },
      });

      const computeGroup = root.createBindGroup(computeLayout, {
        time,
        deltaTime,
        hearts: data,
      });
      const renderGroup = root.createBindGroup(renderLayout, { aspectRatio, intensity });
      const sparkComputeGroup = root.createBindGroup(sparkComputeLayout, {
        deltaTime,
        progress: sparkLevel,
        sparks: sparkData,
      });
      const sparkRenderGroup = root.createBindGroup(sparkRenderLayout, {
        aspectRatio,
        intensity: sparkLevel,
      });

      /*
        The surface is sized in DEVICE PIXELS by the native side, and that is
        what the aspect ratio must be computed from — `getNativeSurface()`
        reports both, and its `width`/`height` are the real drawable extent
        rather than the dp box the view occupies.
      */
      const canvas = ref.current?.getNativeSurface() ?? { width: 1, height: 1 };
      let last = performance.now();
      const frame = () => {
        if (disposed) return;
        const now = performance.now();
        const delta = Math.min(now - last, 64);
        last = now;

        time.write(now);
        deltaTime.write(delta);
        aspectRatio.write(canvas.width / canvas.height);
        intensity.write(levelsRef.current.hearts);
        sparkLevel.write(levelsRef.current.sparks);

        computePipeline.with(computeGroup).dispatchThreads(HEARTS);
        renderPipeline
          .with(renderGroup)
          .with(geometryLayout, geometry)
          .with(dataLayout, data)
          .withColorAttachment({
            view: context,
            // The paper is painted by the view under this canvas, so the
            // surface clears to nothing rather than to a colour.
            clearValue: [0, 0, 0, 0],
            loadOp: 'clear',
            storeOp: 'store',
          })
          .draw(4, HEARTS);

        /*
          The sparks are a SECOND pass on the same surface, loaded rather than
          cleared — the hearts are already in it and this adds light on top.
          Skipped entirely while the cascade is not running, so the ornament
          burst costs nothing for the rest of the splash.
        */
        if (levelsRef.current.sparks > 0.01) {
          sparkCompute.with(sparkComputeGroup).dispatchThreads(SPARKS);
          sparkPipeline
            .with(sparkRenderGroup)
            .with(geometryLayout, sparkGeometry)
            .with(sparkDataLayout, sparkData)
            .withColorAttachment({ view: context, loadOp: 'load', storeOp: 'store' })
            .draw(4, SPARKS);
        }
        context.present();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    void start().catch(() => setFailed(true));

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [failed, levelsRef]);

  if (failed) return null;
  return (
    <Canvas
      ref={ref}
      // Behind the lockup and never in the way of a press: the splash's own
      // overlay is what swallows taps.
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      transparent
    />
  );
}
