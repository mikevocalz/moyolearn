'use client';
/**
 * `usePerfStore` — the marketing site's one store for "how much may this
 * machine be asked to do". Two concerns share it on purpose:
 *
 *   REDUCED MOTION. `reducedMotion` is the single source of truth every
 *   animation on the site reads. Nothing else may call
 *   `matchMedia('(prefers-reduced-motion: reduce)')`.
 *
 *   PERF TIER. `tier` is the globe's quality budget — which LOD, which DPR,
 *   whether the R3F island mounts at all.
 *
 * ONE store rather than two because they are read together and answer the same
 * question. A globe that renders at 60 fps on a machine whose owner asked for
 * less motion is still wrong, and a second store would make that a coordination
 * problem between two files instead of a selector. (This file IS the resolution
 * of that collision: `src/globe/perf-store.ts` and `src/motion/perf-store.ts`
 * both existed for a few hours and both are gone.)
 *
 * ── The three tiers ────────────────────────────────────────────────────────
 *   A  full geometry (14 889 triangles), grain pass on, DPR clamped to 1.5,
 *      renderer antialiasing OFF, 96x64 ocean sphere.
 *   B  the reduced LOD (7 378 triangles — half of A), no grain pass, DPR pinned
 *      to 1, 48x32 ocean sphere and half the ring segments.
 *   C  no WebGL at all — the build-time SVG silhouette, same composition,
 *      same nodes, same facts.
 *
 * TIER C IS THE DEFAULT, AND THE SERVER'S ANSWER. `tier` starts `null`, which
 * resolves to C, so the prerender emits the static composition and the client's
 * first render matches it. Detection only ever runs in an effect after mount,
 * so it cannot cause a hydration mismatch and cannot pull three into the SSR
 * lane. Everything else follows from that: a visitor whose capability we have
 * not measured gets the version that works everywhere, not the one that might.
 *
 * ANTIALIASING IS OFF ON TIER A ON PURPOSE. Stripe's globe write-up
 * (https://stripe.com/blog/globe) reports that simply disabling renderer
 * antialiasing materially improved smoothness. The art direction is flat colour
 * blocking with a hard dark border, where MSAA buys very little: the edges that
 * matter are already 3–4 px of solid ink, not one-pixel gradients.
 *
 * ── The hydration law ──────────────────────────────────────────────────────
 * `reducedMotion` is false on the server, because there is no `window` there.
 * The prerendered HTML is ONE document served to every reader, so MARKUP MUST
 * NEVER BRANCH ON `reducedMotion` — only effects may. A tree that differs by
 * this value is a hydration mismatch by construction.
 *
 * Why Zustand and not the kit's `useReducedMotion` (packages/ui/motion.tsx):
 * the kit's hook is `useSyncExternalStore`, so it is only readable from a React
 * render. GSAP primitives run inside `gsap.context` callbacks, ticker callbacks
 * and ScrollTrigger handlers — none of which are renders — and they need a
 * SYNCHRONOUS answer before they build a timeline. `getState()` gives them one.
 * This is not a second reader of the OS setting: it is the same
 * `prefers-reduced-motion` media query react-native-web's `AccessibilityInfo`
 * wraps, so the kit's components and the site's timelines cannot disagree.
 *
 * SOT: this file · docs/site/motion-matrix.md · docs/site/adr-002-globe-geometry.md
 * SOT-KEYWORDS: site motion perf store zustand reduced-motion prefers-reduced-motion
 *               tier globe usePerfStore single-source deviceMemory hardwareConcurrency
 *               rAF probe fps webgl dpr antialias
 */
import { create } from 'zustand';

export type PerfTier = 'A' | 'B' | 'C';

/** How the tier was arrived at. Surfaced in the lab so a demo can prove it. */
export type PerfReason =
  | 'undetected'
  | 'forced'
  | 'no-webgl'
  | 'low-memory'
  | 'few-cores'
  | 'coarse-pointer'
  | 'capable'
  | 'probe-demoted';

export interface PerfProfile {
  /** `navigator.deviceMemory`, in GiB. Chromium-only; `null` elsewhere. */
  readonly deviceMemory: number | null;
  readonly hardwareConcurrency: number | null;
  readonly devicePixelRatio: number;
  readonly webgl2: boolean;
  readonly coarsePointer: boolean;
}

export interface PerfState {
  /** True when the reader has asked the OS for less motion. */
  reducedMotion: boolean;
  /** `null` until `detect()` has run. Resolves to C — see the header. */
  tier: PerfTier | null;
  reason: PerfReason;
  /** Set by the lab route. Wins over detection, and pins the tier permanently. */
  override: PerfTier | null;
  profile: PerfProfile | null;
  /** Frames per second measured by the in-scene probe, once it has finished. */
  probeFps: number | null;
  setReducedMotion: (reducedMotion: boolean) => void;
  detect: () => void;
  reportProbe: (frames: number, elapsedMs: number) => void;
  setOverride: (tier: PerfTier | null) => void;
}

/**
 * Static thresholds.
 *
 * 4 GiB / 4 threads is the line Chromium's own `deviceMemory` buckets make
 * meaningful (it reports 0.25, 0.5, 1, 2, 4, 8 — capping at 8), and it is where
 * a 26 k-triangle scene with a fullscreen shader pass stops being free. A
 * coarse pointer alone is enough for C: this globe is a background object in a
 * scroll chapter, and burning a phone's thermal budget on one is not a trade
 * anybody asked for.
 *
 * Absent `deviceMemory` (Safari, Firefox) the check is skipped rather than
 * assumed low — treating "unreported" as "tiny" would put every Safari desktop
 * on the static tier.
 */
const MIN_DEVICE_MEMORY_GIB = 4;
const MIN_HARDWARE_CONCURRENCY = 4;

/**
 * Probe thresholds, applied to a 500 ms window of REAL rendered frames.
 *
 * 45 fps demotes A → B and 24 fps demotes B → C. The probe measures the scene
 * actually on screen, which is the only measurement that means anything: a bare
 * rAF loop reports the display's refresh rate and tells you nothing about a GPU
 * that is about to fall over. Demotion is one-way — a tier that flickers up and
 * down mid-scroll is worse than a tier that is slightly too low.
 */
export const PROBE_WINDOW_MS = 500;
/**
 * A single frame longer than this is a stall, not a frame rate — a backgrounded
 * tab, a garbage-collection pause, a laptop lid. The probe restarts instead of
 * counting it. Set above the 4 fps a heavily throttled tab reports and well
 * below anything a rendering machine produces.
 */
export const PROBE_STALL_S = 0.25;
/**
 * Frames the window must actually contain. Without this a 500 ms window with a
 * single frame in it reads as 2 fps and demotes a machine that is fine.
 */
export const PROBE_MIN_FRAMES = 12;
const DEMOTE_A_BELOW_FPS = 45;
const DEMOTE_B_BELOW_FPS = 24;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/*
  Read once at module scope so `usePerfStore.getState().reducedMotion` is
  already correct the first time a primitive asks — before React has rendered,
  and without a frame of motion on a machine that asked for none.
*/
const initialReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

function reflectReducedMotion(reducedMotion: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.reducedMotion = String(reducedMotion);
}

function readProfile(): PerfProfile {
  // `deviceMemory` is not in lib.dom; it is a Device Memory API extension to
  // Navigator that Chromium ships and the TS DOM lib does not model. Declared
  // structurally rather than with a cast so no `any` enters the file.
  const nav: Navigator & { deviceMemory?: number } = navigator;

  let webgl2 = false;
  try {
    const probe = document.createElement('canvas');
    webgl2 = probe.getContext('webgl2') !== null;
  } catch {
    // A blocked or exhausted WebGL implementation throws rather than returning
    // null in some builds. Either way the answer is "no".
    webgl2 = false;
  }

  return {
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    hardwareConcurrency:
      typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    devicePixelRatio: window.devicePixelRatio,
    webgl2,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
  };
}

function tierFor(profile: PerfProfile): { tier: PerfTier; reason: PerfReason } {
  if (!profile.webgl2) return { tier: 'C', reason: 'no-webgl' };
  if (profile.coarsePointer) return { tier: 'C', reason: 'coarse-pointer' };
  if (profile.deviceMemory !== null && profile.deviceMemory < MIN_DEVICE_MEMORY_GIB) {
    return { tier: 'C', reason: 'low-memory' };
  }
  if (
    profile.hardwareConcurrency !== null &&
    profile.hardwareConcurrency < MIN_HARDWARE_CONCURRENCY
  ) {
    return { tier: 'B', reason: 'few-cores' };
  }
  return { tier: 'A', reason: 'capable' };
}

export const usePerfStore = create<PerfState>()((set, get) => ({
  reducedMotion: initialReducedMotion(),
  tier: null,
  reason: 'undetected',
  override: null,
  profile: null,
  probeFps: null,

  setReducedMotion: (reducedMotion) => {
    reflectReducedMotion(reducedMotion);
    set({ reducedMotion });
  },

  detect: () => {
    if (typeof window === 'undefined') return;
    const profile = readProfile();
    const { tier, reason } = tierFor(profile);
    set({ profile, tier, reason });
  },

  reportProbe: (frames, elapsedMs) => {
    const fps = elapsedMs > 0 ? (frames * 1000) / elapsedMs : 0;
    const { tier, override } = get();
    set({ probeFps: Math.round(fps) });
    // A forced tier is a statement about what to render, not a hypothesis to
    // test; the lab has to be able to hold Tier A on a machine that cannot
    // sustain it, or it cannot demonstrate the difference.
    if (override !== null) return;
    if (tier === 'A' && fps < DEMOTE_A_BELOW_FPS) set({ tier: 'B', reason: 'probe-demoted' });
    else if (tier === 'B' && fps < DEMOTE_B_BELOW_FPS) set({ tier: 'C', reason: 'probe-demoted' });
  },

  setOverride: (override) => set({ override, reason: override ? 'forced' : get().reason }),
}));

/**
 * Keep the store live for the rest of the session. Subscribed at module scope
 * rather than from a provider effect because the answer has to be right for
 * non-React callers too, and because a reader can flip the OS setting mid-visit
 * — the site is long and scroll-driven, which is exactly the kind of page that
 * setting gets turned on for.
 *
 * The listener is intentionally never removed: it lives as long as the document
 * does, and tearing it down in a route unmount would leave `getState()` stale
 * for every primitive built afterwards.
 */
if (typeof window !== 'undefined') {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener('change', (event) => {
    usePerfStore.getState().setReducedMotion(event.matches);
  });
}

/**
 * The single reduced-motion selector. Components read this; primitives read
 * `isReducedMotion()`. There is no third way to ask.
 */
export const useReducedMotion = (): boolean => usePerfStore((state) => state.reducedMotion);

/** Synchronous read for the non-React callers (GSAP builders, ticker callbacks). */
export const isReducedMotion = (): boolean => usePerfStore.getState().reducedMotion;

/** The tier actually in force. Unmeasured resolves to C, never to A. */
export function resolveTier(state: Pick<PerfState, 'tier' | 'override'>): PerfTier {
  return state.override ?? state.tier ?? 'C';
}

/**
 * False until the device has actually been measured. A chapter that mounts an
 * expensive scene waits for this rather than trusting an optimistic default.
 */
export const useTierResolved = (): boolean => usePerfStore((state) => state.tier !== null);

export interface TierSettings {
  readonly lod: 'hi' | 'lo';
  /** `dpr` for R3F's Canvas. Tier A clamps to 1.5; Tier B pins to 1. */
  readonly dpr: number;
  readonly antialias: boolean;
  /** The paper-grain fullscreen pass. Tier A only. */
  readonly grain: boolean;
  /** Ocean sphere segments — the other half of "reduced segment counts". */
  readonly oceanSegments: readonly [number, number];
  /** Atmosphere ring segments. */
  readonly ringSegments: number;
}

/**
 * Tier A and B differ in five measurable ways at once, which is the point:
 * a tier that only swaps a geometry file is not a tier, it is a slider.
 */
export const TIER_SETTINGS = {
  A: {
    lod: 'hi',
    dpr: 1.5,
    antialias: false,
    grain: true,
    oceanSegments: [96, 64],
    ringSegments: 128,
  },
  B: {
    lod: 'lo',
    dpr: 1,
    antialias: false,
    grain: false,
    oceanSegments: [48, 32],
    ringSegments: 64,
  },
} as const satisfies Record<'A' | 'B', TierSettings>;
