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
export declare const TIERS: readonly ["presence-2d", "phone", "tablet", "studio"];
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
export declare const TIER_PROFILES: Readonly<Record<Tier, TierProfile>>;
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
export declare const REBAKED_HEAD_BUDGET: HeadBudget;
/**
 * Can this adapter run the head as a compute pass?
 *
 * `maxStorageBuffersPerShaderStage` defaults to **8** in the WebGPU spec and
 * the kernel wants 7 — position, skinIndex, skinWeight, output, basis, scales,
 * weights. That is the constraint that actually bites; the byte limits are
 * comfortable once the container is rebaked.
 */
export declare function canComputeHead(adapter: AdapterFacts, budget?: HeadBudget): boolean;
export type DeviceClass = 'phone' | 'tablet' | 'desktop' | 'headset';
/**
 * The opening tier. A software adapter is a hard fall — not a demotion
 * candidate — because no amount of watching frame times rescues it, and a
 * child should not watch a 3D avatar stutter its way down the ladder when the
 * answer was knowable at mount.
 */
export declare function selectTier(adapter: AdapterFacts | null, deviceClass: DeviceClass, budget?: HeadBudget): Tier;
export declare function tierBelow(tier: Tier): Tier;
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
export declare const DEFAULT_DEMOTION: DemotionConfig;
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
export declare function createTierWatcher(initial: Tier, config?: DemotionConfig): TierWatcher;
