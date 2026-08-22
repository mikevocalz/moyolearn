/**
 * Device tiers, and the demotion that keeps a promise the tier made.
 *
 * Doc 22 §6: tier selection is MEASURED, not guessed. A device is asked what it
 * can do (`adapter.limits`), given a tier, and then watched — if the frame-time
 * EMA misses the budget the tier drops, and it keeps dropping until the frame
 * budget is met or the avatar is a 2D presence mark. A phone that renders the
 * top tier for four seconds and then thermally throttles for the rest of a
 * twenty-minute lesson has not "supported" that tier; the demotion is what makes
 * the tier honest.
 *
 * `presence-2d` is a first-class designed state, not a failure mode — see doc 23
 * §3.1. Falling to it must look finished.
 *
 * Everything here is pure: limits in, tier out; frame times in, demotion out.
 * That is deliberate, because the alternative is a policy nobody can test that
 * only misbehaves on hardware nobody has to hand.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §6, §10.4
 * SOT-KEYWORDS: tiers device demotion adapter limits frame budget ema thermal fallback presence
 */

/** Ordered worst → best. Index is the ladder; do not reorder. */
export const TIERS = ['presence-2d', 'phone', 'tablet', 'studio'] as const;
export type Tier = (typeof TIERS)[number];

export interface TierProfile {
  tier: Tier;
  /** Evaluate the head on the GPU rather than the CPU (doc 22 §4 row 14). */
  computeHead: boolean;
  /** MSAA sample count for the scene pass; 0 = no multisampling. */
  samples: number;
  bloom: boolean;
  ambientOcclusion: boolean;
  hair: 'none' | 'low' | 'medium' | 'high';
  wardrobe: 'none' | 'performance' | 'balanced';
  /** Upper bound on devicePixelRatio; the phone tier is the one that needs it. */
  maxPixelRatio: number;
}

export const TIER_PROFILES: Readonly<Record<Tier, TierProfile>> = Object.freeze({
  'presence-2d': {
    tier: 'presence-2d',
    computeHead: false,
    samples: 0,
    bloom: false,
    ambientOcclusion: false,
    hair: 'none',
    wardrobe: 'none',
    maxPixelRatio: 1,
  },
  phone: {
    tier: 'phone',
    computeHead: false,
    samples: 0,
    bloom: false,
    ambientOcclusion: false,
    hair: 'low',
    wardrobe: 'performance',
    maxPixelRatio: 2,
  },
  tablet: {
    tier: 'tablet',
    computeHead: true,
    samples: 4,
    bloom: true,
    ambientOcclusion: false,
    hair: 'medium',
    wardrobe: 'balanced',
    maxPixelRatio: 2,
  },
  studio: {
    tier: 'studio',
    computeHead: true,
    samples: 4,
    bloom: true,
    ambientOcclusion: true,
    hair: 'high',
    wardrobe: 'balanced',
    maxPixelRatio: 2,
  },
});

/**
 * The slice of `GPUAdapter` this decision reads. Declared rather than imported
 * so the policy is testable without a WebGPU global.
 */
export interface AdapterFacts {
  /** True when the browser/runtime handed back a software adapter. */
  isFallbackAdapter: boolean;
  limits: {
    maxStorageBuffersPerShaderStage: number;
    maxStorageBufferBindingSize: number;
    maxBufferSize: number;
  };
}

export interface HeadBudget {
  /** Bytes of the largest single storage binding the compute path needs. */
  largestBindingBytes: number;
  /** Distinct storage buffers the compute kernel binds. */
  storageBuffers: number;
}

/**
 * The rebaked container's actual shape (doc 22 §6.3): a 19-channel int8 basis
 * at ~1.0 MB, plus position/skin/output buffers. The authoring container's
 * 20.5 MB basis is what made this a real question; the rebake makes it a
 * formality on any adapter that reports the spec defaults.
 */
export const REBAKED_HEAD_BUDGET: HeadBudget = Object.freeze({
  largestBindingBytes: 1_015_797,
  storageBuffers: 7,
});

/**
 * Can this adapter run the head as a compute pass?
 *
 * `maxStorageBuffersPerShaderStage` defaults to **8** in the WebGPU spec and
 * the kernel wants 7 — position, skinIndex, skinWeight, output, basis, scales,
 * weights. That is the constraint that actually bites; the byte limits are
 * comfortable once the container is rebaked.
 */
export function canComputeHead(adapter: AdapterFacts, budget: HeadBudget = REBAKED_HEAD_BUDGET): boolean {
  const { limits } = adapter;
  return (
    limits.maxStorageBuffersPerShaderStage >= budget.storageBuffers &&
    limits.maxStorageBufferBindingSize >= budget.largestBindingBytes &&
    limits.maxBufferSize >= budget.largestBindingBytes
  );
}

export type DeviceClass = 'phone' | 'tablet' | 'desktop' | 'headset';

/**
 * The opening tier. A software adapter is a hard fall — not a demotion
 * candidate — because no amount of watching frame times rescues it, and a
 * child should not watch a 3D avatar stutter its way down the ladder when the
 * answer was knowable at mount.
 */
export function selectTier(
  adapter: AdapterFacts | null,
  deviceClass: DeviceClass,
  budget: HeadBudget = REBAKED_HEAD_BUDGET
): Tier {
  if (!adapter || adapter.isFallbackAdapter) return 'presence-2d';
  if (deviceClass === 'phone') return 'phone';
  if (!canComputeHead(adapter, budget)) {
    // The GPU is real but the compute path will not fit. Rather than refusing
    // the device, drop to the tier whose head runs on the CPU.
    return 'phone';
  }
  return deviceClass === 'tablet' ? 'tablet' : 'studio';
}

export function tierBelow(tier: Tier): Tier {
  const i = TIERS.indexOf(tier);
  return TIERS[Math.max(0, i - 1)] as Tier;
}

export interface DemotionConfig {
  /** Frame budget in ms. 16.7 is 60fps (doc 22 §6). */
  budgetMs: number;
  /** EMA weight for each new sample; 0.1 ≈ a ~10-frame memory. */
  smoothing: number;
  /** Frames to ignore at the start — shader compilation is not the steady state. */
  warmupFrames: number;
  /** Consecutive over-budget frames before a demotion fires. */
  strikes: number;
  /** Frames to wait after demoting before judging again. */
  cooldownFrames: number;
}

export const DEFAULT_DEMOTION: DemotionConfig = Object.freeze({
  budgetMs: 16.7,
  smoothing: 0.1,
  warmupFrames: 60,
  strikes: 45,
  cooldownFrames: 120,
});

export interface TierWatcher {
  /** Feed one frame time in ms; returns the tier to render next. */
  frame(frameMs: number): Tier;
  readonly tier: Tier;
  /** Smoothed frame time, or 0 before the first post-warmup sample. */
  readonly frameMs: number;
  readonly demotions: number;
}

/**
 * Watches frame time and walks the tier down. It never walks back UP: a device
 * that recovers after thermal throttling would otherwise oscillate, and a
 * visible quality flip mid-lesson is worse than staying one tier low.
 */
export function createTierWatcher(
  initial: Tier,
  config: DemotionConfig = DEFAULT_DEMOTION
): TierWatcher {
  let tier = initial;
  let ema = 0;
  let seen = 0;
  let overBudget = 0;
  let cooldown = 0;
  let demotions = 0;

  return {
    get tier() {
      return tier;
    },
    get frameMs() {
      return ema;
    },
    get demotions() {
      return demotions;
    },
    frame(frameMs: number): Tier {
      seen += 1;
      if (seen <= config.warmupFrames) return tier;

      ema = ema === 0 ? frameMs : ema + (frameMs - ema) * config.smoothing;

      if (cooldown > 0) {
        cooldown -= 1;
        return tier;
      }
      if (tier === 'presence-2d') return tier;

      if (ema > config.budgetMs) {
        overBudget += 1;
        if (overBudget >= config.strikes) {
          tier = tierBelow(tier);
          demotions += 1;
          overBudget = 0;
          cooldown = config.cooldownFrames;
          // Re-seed the EMA: the old average describes the tier we just left.
          ema = 0;
        }
      } else {
        overBudget = 0;
      }
      return tier;
    },
  };
}
