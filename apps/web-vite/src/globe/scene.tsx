'use client';
/**
 * The WebGL globe — Tier A and Tier B. THE ONLY MODULE IN THE APP THAT IMPORTS
 * `three` OR `@react-three/fiber`.
 *
 * It is reached exclusively through `React.lazy(() => import('./scene'))` in
 * `globe.tsx`, behind a mounted gate, and the server's tier is C. So this file
 * and its ~200 kB of vendor code are a chunk that the prerender lane never
 * evaluates and a Tier C visitor never downloads. That is the single most
 * important structural property of this chapter: ADR-001 bought real
 * prerendered HTML, and a globe that runs during SSR would spend it.
 *
 * ── No lights. Anywhere. ───────────────────────────────────────────────────
 * Every material is `MeshBasicMaterial` and the tone mapping is `NoToneMapping`
 * (`flat` on the Canvas). Both are deliberate and both are the same decision:
 * the rendered pixel must BE the token. `docs/site/tokens.md` publishes measured
 * contrast ratios for `moyoOnSun` on `moyoSun` and for `moyoOutline` on every
 * ground; a Lambert term or an ACES curve would shade those colours per-pixel
 * and every published ratio would become a claim about a colour that is no
 * longer on screen. Flat colour blocking is also the art direction — a printed
 * puzzle globe, not a lit sphere.
 *
 * Depth still reads, from three sources that cost no lighting: the extruded
 * side wall in ink, the occlusion of the atmosphere rings behind the globe, and
 * the offset shadows on the DOM cards.
 *
 * ── Orthographic ───────────────────────────────────────────────────────────
 * See `projection.ts`. The camera is orthographic so that the DOM leader lines
 * can be placed by eight lines of trigonometry that work identically on the
 * tier with no camera at all.
 *
 * SOT: apps/web-vite/src/globe/projection.ts · apps/web-vite/src/globe/geometry.ts
 *      node_modules/@react-three/fiber/dist/declarations/src/core/renderer.d.ts:RenderProps
 *      node_modules/@react-three/fiber/dist/declarations/src/core/hooks.d.ts:useFrame,useThree
 * SOT-KEYWORDS: globe scene r3f three canvas orthographic flat basic material rings
 *               grain shader fps probe tier lazy island
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, DoubleSide, Group, MeshBasicMaterial, SRGBColorSpace, ShaderMaterial } from 'three';
import { ATMOSPHERE_RINGS, RADIAN } from './composition';
import { GLOBE_OCEAN_RADIUS, type GlobeFillToken } from './generated/manifest';
import type { RegionGeometry } from './geometry';
import { globeScaleForPhase, useGlobeStore } from './globe-store';
import { globeRadiusPx } from './projection';
import {
  PROBE_MIN_FRAMES,
  PROBE_STALL_S,
  PROBE_WINDOW_MS,
  TIER_SETTINGS,
  usePerfStore,
} from '@/stores/perf-store';
import { readMoyoNumber, readSceneColors, type MoyoColors } from './theme-tokens';

type WebglTier = 'A' | 'B';


/**
 * Ink speckle over the whole frame. A fullscreen quad, not a post pass: a post
 * pass means an EffectComposer, a second render target and a copy of the frame
 * for what is one hash per pixel.
 *
 * The vertex shader writes clip space directly and ignores every matrix, which
 * is why the geometry is a 2×2 plane and `frustumCulled` is off — three would
 * otherwise cull a quad whose real position it cannot know.
 */
const GRAIN_VERTEX = /* glsl */ `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const GRAIN_FRAGMENT = /* glsl */ `
  uniform vec3 uInk;
  uniform float uOpacity;

  void main() {
    // Per-DEVICE-pixel hash, so the grain reads as paper tooth rather than as a
    // pattern that scales with the globe.
    vec2 cell = floor(gl_FragCoord.xy);
    float n = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453123);
    gl_FragColor = vec4(uInk, uOpacity * n);
  }
`;

/** sRGB components of a token, for a raw ShaderMaterial uniform. */
function srgbTriplet(css: string): [number, number, number] {
  // A raw ShaderMaterial writes straight to the drawing buffer with no
  // colour-space conversion chunk, so the uniform has to already be sRGB —
  // `Color`'s internal value is linear-sRGB once ColorManagement is on.
  const color = new Color().setStyle(css, SRGBColorSpace);
  const rgb = color.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  return [rgb.r, rgb.g, rgb.b];
}

function Grain({ inkCss }: { inkCss: string }) {
  const material = useMemo(() => {
    const [r, g, b] = srgbTriplet(inkCss);
    return new ShaderMaterial({
      vertexShader: GRAIN_VERTEX,
      fragmentShader: GRAIN_FRAGMENT,
      uniforms: {
        uInk: { value: [r, g, b] },
        // 2–4% is the entire sanctioned range (docs/site/tokens.md §5.1); the
        // token is read rather than restated so the ceiling lives in one place.
        uOpacity: { value: readMoyoNumber('--moyo-grain-opacity', 0.03) },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
  }, [inkCss]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh renderOrder={1000} frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}

/**
 * The scene graph, and the one frame driver.
 *
 * The refs live HERE rather than being handed down from `GlobeScene`, for a
 * reason the linter is right about: a component that mutates a ref it was given
 * as a prop is mutating somebody else's state. This component owns the two
 * groups, so writing their transforms every frame is its own business.
 *
 * Every store read is `getState()`, never a selector, so a scroll timeline
 * writing `phase` sixty times a second renders no React at all.
 *
 * ── Why the camera zoom is 1 and the GLOBE is scaled ───────────────────────
 * R3F builds an orthographic frustum from the canvas in CSS pixels
 * (`left = -width / 2`), so at zoom 1 one world unit is one pixel. Scaling the
 * globe group to `globeRadiusPx(...)` therefore puts the disc at exactly the
 * radius `projection.ts` gives the DOM leader lines — the same result as
 * setting `camera.zoom`, without reaching into an object the renderer owns.
 *
 * ── Three groups, and why the outermost one is declarative ─────────────────
 *   scaleGroup   pixel scale, from JSX, recomputed on resize
 *   tiltGroup    tilt + phase scale, written per frame
 *   yawGroup     yaw, written per frame
 *
 * The pixel scale is a PROP and not a per-frame write because the frame loop is
 * not guaranteed to have run: a tab that is occluded or throttled at mount gets
 * no rAF, and a globe whose size only exists inside `useFrame` renders as a
 * one-pixel dot until the tab is looked at. The same reasoning puts the store's
 * current tilt, yaw and phase scale on the JSX as initial values — the first
 * paint is correct with zero frames, and `useFrame` only keeps it that way.
 */
function SceneGraph({
  regions,
  colors,
  settings,
  onProbe,
}: {
  regions: readonly RegionGeometry[];
  colors: MoyoColors;
  settings: (typeof TIER_SETTINGS)[WebglTier];
  onProbe: (frames: number, elapsedMs: number) => void;
}) {
  const focused = useGlobeStore((state) => state.focusedRegion);
  const size = useThree((state) => state.size);
  const yawGroup = useRef<Group>(null);
  const tiltGroup = useRef<Group>(null);

  // Read once, for the first paint only. Not a subscription: yaw and phase
  // change every frame and a selector on either would re-render React at 60 Hz.
  const initial = useRef(useGlobeStore.getState());
  const pixelScale = globeRadiusPx(size.width, size.height) / GLOBE_OCEAN_RADIUS;

  // Tells the store a frame loop exists, which is what makes `focusLongitude`
  // legal. Cleared on unmount so a tier demotion to C cannot leave a tween
  // running against a renderer that has gone.
  useEffect(() => {
    const { setDriven } = useGlobeStore.getState();
    setDriven(true);
    return () => setDriven(false);
  }, []);

  const probe = useRef({ frames: 0, startedAt: 0, done: false });

  useFrame((_state, delta) => {
    const store = useGlobeStore.getState();
    // Clamped: a backgrounded tab resumes with a multi-second delta, which
    // would otherwise spin the globe through several turns in one frame.
    store.tick(Math.min(delta, 1 / 20));

    const yaw = yawGroup.current;
    if (yaw) yaw.rotation.y = store.yaw;
    const tilt = tiltGroup.current;
    if (tilt) {
      tilt.rotation.x = store.tilt;
      tilt.scale.setScalar(globeScaleForPhase(store.phase));
    }

    /*
      The frame probe, and every way it can lie.

      A naive "count frames for 500 ms" reported 0 fps on a machine rendering
      perfectly, and demoted Tier A to Tier B for it: the tab was backgrounded
      between the first frame and the next, rAF stopped, and the window
      "elapsed" across several seconds of throttling with one frame in it. So
      the probe restarts rather than concludes whenever the evidence is not a
      contiguous run of real frames — while the document is hidden, after any
      single frame longer than PROBE_STALL_MS, and unless at least
      PROBE_MIN_FRAMES landed. A wrong measurement is worse than a late one,
      because the demotion it causes is permanent.
    */
    const p = probe.current;
    if (p.done) return;
    if (document.hidden || delta > PROBE_STALL_S) {
      p.frames = 0;
      p.startedAt = 0;
      return;
    }
    if (p.startedAt === 0) {
      // Skip the mount frame: it carries geometry upload and shader compile,
      // and a probe that includes it measures the load, not the scene.
      p.startedAt = performance.now();
      return;
    }
    p.frames += 1;
    const elapsed = performance.now() - p.startedAt;
    if (elapsed >= PROBE_WINDOW_MS && p.frames >= PROBE_MIN_FRAMES) {
      p.done = true;
      onProbe(p.frames, elapsed);
    }
  });

  return (
    <group scale={pixelScale}>
      <group
        ref={tiltGroup}
        rotation-x={initial.current.tilt}
        scale={globeScaleForPhase(initial.current.phase)}
      >
        <group ref={yawGroup} rotation-y={initial.current.yaw}>
          <Ocean colors={colors} segments={settings.oceanSegments} />
          <Continents regions={regions} colors={colors} focused={focused} />
        </group>
        <Rings colors={colors} segments={settings.ringSegments} />
      </group>
    </group>
  );
}

function Continents({
  regions,
  colors,
  focused,
}: {
  regions: readonly RegionGeometry[];
  colors: MoyoColors;
  focused: string | null;
}) {
  const materials = useMemo(() => {
    const outline = new MeshBasicMaterial({
      color: new Color().setStyle(colors.moyoOutline, SRGBColorSpace),
      // The side wall is a swept quad strip whose winding follows Natural
      // Earth's shapefile ordering, which is not GeoJSON's right-hand rule and
      // is not consistent between outer rings and holes. DoubleSide removes a
      // whole class of "half the coastline has no border" bugs for the cost of
      // culling on a few thousand triangles that are occluded anyway.
      side: DoubleSide,
    });
    const fills = new Map<GlobeFillToken, MeshBasicMaterial>();
    for (const { slice } of regions) {
      if (fills.has(slice.fillToken)) continue;
      fills.set(
        slice.fillToken,
        new MeshBasicMaterial({
          // `GlobeFillToken` is a subset of `MoyoSceneToken`, so this lookup is
          // total. A region whose token nobody reads fails the build here.
          color: new Color().setStyle(colors[slice.fillToken], SRGBColorSpace),
        }),
      );
    }
    return { outline, fills };
  }, [regions, colors]);

  useEffect(
    () => () => {
      materials.outline.dispose();
      for (const material of materials.fills.values()) material.dispose();
    },
    [materials],
  );

  return (
    <>
      {regions.map(({ slice, geometry }) => (
        <mesh
          key={slice.id}
          geometry={geometry}
          material={[
            materials.fills.get(slice.fillToken) ?? materials.outline,
            materials.outline,
          ]}
          // Focus lifts the slab rather than tinting it: a highlight that
          // changes a region's colour would break the "Africa is moyoSun"
          // promise `docs/site/tokens.md` makes in public.
          scale={focused === slice.id ? 1.012 : 1}
        />
      ))}
    </>
  );
}

function Rings({ colors, segments }: { colors: MoyoColors; segments: number }) {
  const materials = useMemo(
    () =>
      ATMOSPHERE_RINGS.map(
        (ring) =>
          new MeshBasicMaterial({
            color: new Color().setStyle(colors[ring.token], SRGBColorSpace),
            side: DoubleSide,
          }),
      ),
    [colors],
  );

  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials]);

  return (
    <>
      {ATMOSPHERE_RINGS.map((ring, index) => (
        <mesh
          key={ring.inner}
          material={materials[index]}
          rotation={[ring.tiltDeg * RADIAN, 0, ring.rollDeg * RADIAN]}
        >
          <ringGeometry args={[ring.inner, ring.outer, segments]} />
        </mesh>
      ))}
    </>
  );
}

function Ocean({
  colors,
  segments,
}: {
  colors: MoyoColors;
  segments: readonly [number, number];
}) {
  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color().setStyle(colors.moyoPrimary, SRGBColorSpace),
      }),
    [colors],
  );
  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[GLOBE_OCEAN_RADIUS, segments[0], segments[1]]} />
    </mesh>
  );
}

export interface GlobeSceneProps {
  readonly tier: WebglTier;
  readonly regions: readonly RegionGeometry[];
}

/**
 * The scene, given geometry that has ALREADY been fetched and decoded.
 *
 * Loading happens outside the Canvas on purpose: a suspending loader inside R3F
 * unmounts and remounts the WebGL context on every retry, and a failed fetch
 * has to be able to fall the whole island back to Tier C — which it cannot do
 * from inside a renderer it is part of.
 */
export default function GlobeScene({ tier, regions }: GlobeSceneProps) {
  const settings = TIER_SETTINGS[tier];
  const reportProbe = usePerfStore((state) => state.reportProbe);
  const colors = useMemo(() => readSceneColors(), []);

  return (
    <Canvas
      orthographic
      // `flat` is NoToneMapping. Without it R3F applies ACES Filmic and every
      // published contrast ratio in docs/site/tokens.md stops describing what is
      // actually on screen.
      flat
      dpr={settings.dpr}
      gl={{ antialias: settings.antialias, alpha: true }}
      /*
        The camera sits far back with a deep frustum because the scene is
        measured in PIXELS, not in radii: the globe group is scaled to the disc
        radius, so on a 2000 px stage it is ~900 units across and ~1200 deep.
        `near`/`far` have to clear that at every viewport, and an orthographic
        depth buffer is linear so the wide range costs no precision.
      */
      camera={{ position: [0, 0, 4000], zoom: 1, near: 1, far: 8000 }}
      onCreated={({ gl }) => {
        gl.setClearAlpha(0);
      }}
      // The canvas is a picture of claims that are already in the DOM as text.
      // `Globe` renders the equivalent list and the alt paragraph beside it.
      aria-hidden
      style={{ position: 'absolute', inset: 0 }}
    >
      <SceneGraph
        regions={regions}
        colors={colors}
        settings={settings}
        onProbe={reportProbe}
      />
      {settings.grain ? <Grain inkCss={colors.moyoInk} /> : null}
    </Canvas>
  );
}
