/**
 * The 2D ↔ 3D handoff controller — doc 22 §10.8, on the contract doc 01
 * reserved and inside the states doc 23 drew.
 *
 * `TutorStage` has always had a 2D presence: an illustrated tutor that appears
 * instantly, costs nothing, and works on every device. The 3D avatar is an
 * *upgrade to that*, not a replacement for it, and doc 01 is explicit about the
 * order — "XR ships when the learning loop has retention data, not before."
 * The same discipline applies here.
 *
 * So the rule this file enforces is simple and non-negotiable:
 *
 *   **2D presence is shown from the first frame and is never taken away until
 *   3D is actually ready to draw a face.**
 *
 * Not "3D has started downloading". Not "the renderer initialised". A first
 * rendered frame, with assets resolved and the head evaluated. Anything looser
 * and a child watches their tutor disappear into a spinner mid-sentence, which
 * is worse than never having offered 3D at all.
 *
 * ── WHY THIS IS A CONTROLLER AND NOT A COMPONENT ────────────────────────────
 *
 * It is a plain state machine with no React, no three.js and no timers of its
 * own: `tick(nowMs)` is called by whoever owns the frame loop. That keeps it in
 * the renderer-free half of the package (so the 2D-only build never pulls a
 * renderer in behind a barrel — doc 20, Metro does not tree-shake) and it makes
 * every transition testable without mounting anything.
 *
 * ── THE RULES THAT ARE EASY TO GET WRONG ────────────────────────────────────
 *
 * 1. **The upgrade never interrupts speech.** If the tutor is mid-utterance
 *    when 3D becomes ready, the swap waits for the utterance to end. A face
 *    changing identity mid-sentence is uncanny in a way a delay is not.
 * 2. **Demotion is immediate and unconditional.** `tiers.ts` never promotes
 *    back up, and neither does this: once we fall to 2D for thermal or frame
 *    -budget reasons, we stay there for the session. Flapping between two
 *    tutors is the worst of both.
 * 3. **A download failure is not an error state.** It is simply "2D, and we
 *    stopped trying". The child is not shown a failure for something they never
 *    asked for. Doc 23's state union deliberately has no `error` kind and this
 *    controller respects that — the only thing surfaced is `reason`, for
 *    telemetry.
 * 4. **Reduced motion does not block 3D.** It is a render mode, not a toggle
 *    (doc 22 §9) — the stage renders with motion damped rather than falling
 *    back to a still image.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §6, §10.8; docs/pack/23-tutorstage-handoff.md
 * SOT-KEYWORDS: tutorstage handoff presence 2d 3d swap upgrade demotion first-paint streaming
 */
import type { Tier } from './tiers.ts';
/** What the screen is actually showing. Exactly one at a time. */
export type Surface = 'presence-2d' | 'avatar-3d';
export type StagePhase = 
/** 2D on screen, nothing else happening. The universal starting point. */
'presence'
/** 2D on screen, assets downloading. */
 | 'preparing'
/** 2D on screen, 3D warming up (pipelines, PMREM, first head evaluation). */
 | 'warming'
/** 2D on screen, 3D ready, waiting for a safe moment to swap. */
 | 'pending-swap'
/** 3D on screen. */
 | 'live'
/** 2D on screen, permanently. `reason` says why. */
 | 'settled-2d';
/** Why we are on 2D and staying there. Telemetry only — never shown to a child. */
export type SettleReason = 'tier-2d' | 'assets-unavailable' | 'demoted-frame-budget' | 'demoted-thermal' | 'context-lost';
export interface StageState {
    phase: StagePhase;
    surface: Surface;
    /** 0-1 while `preparing`; null otherwise. */
    progress: number | null;
    reason: SettleReason | null;
    /** True once 3D has been live at least once this session. */
    hasBeenLive: boolean;
}
export interface TutorStageOptions {
    tier: Tier;
    /**
     * Minimum milliseconds 2D must be on screen before a swap. A swap that lands
     * 200 ms after mount reads as a glitch rather than an upgrade — the child
     * never registered the first face, so the change looks like a bug.
     */
    minimumPresenceMs?: number;
    onChange?: (state: StageState, previous: StageState) => void;
}
export interface TutorStage {
    state(): StageState;
    /** Advance time. Call from the frame loop; it allocates nothing. */
    tick(nowMs: number): void;
    /** Begin resolving assets. Idempotent; a no-op on the 2D tier. */
    beginUpgrade(nowMs: number): void;
    /** 0-1 from the capability manager's `onProgress`. */
    setProgress(fraction: number): void;
    /** Assets are on disk and the renderer is initialising. */
    assetsReady(nowMs: number): void;
    /** The stage has drawn a real frame with a real face in it. */
    firstFrameRendered(nowMs: number): void;
    /** Whether the tutor is mid-utterance. The swap waits for this to be false. */
    setSpeaking(speaking: boolean): void;
    /** Give up on 3D for the rest of the session. Irreversible, by design. */
    settle(reason: SettleReason): void;
}
export declare const DEFAULT_MINIMUM_PRESENCE_MS = 900;
export declare function createTutorStage(options: TutorStageOptions): TutorStage;
/** True while the UI should show a download indicator. Deliberately narrow. */
export declare function showsProgress(state: StageState): boolean;
/**
 * Whether the 3D scene should be rendering at all.
 *
 * Note this is true during `pending-swap` — the stage keeps drawing off-screen
 * while it waits for the utterance to end, because a stage that stopped and
 * restarted would have to warm up twice and would swap in a cold first frame,
 * which is exactly the stutter the whole handoff exists to avoid.
 */
export declare function shouldRender3D(state: StageState): boolean;
