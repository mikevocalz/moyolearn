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
  | 'presence'
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
export type SettleReason =
  | 'tier-2d'
  | 'assets-unavailable'
  | 'demoted-frame-budget'
  | 'demoted-thermal'
  | 'context-lost';

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

export const DEFAULT_MINIMUM_PRESENCE_MS = 900;

export function createTutorStage(options: TutorStageOptions): TutorStage {
  const minimumPresenceMs = options.minimumPresenceMs ?? DEFAULT_MINIMUM_PRESENCE_MS;

  let state: StageState = {
    // Always. There is no configuration in which 3D is the first thing drawn:
    // the 2D presence is instant and the 3D path cannot be, so starting
    // anywhere else means starting on a blank rectangle.
    phase: options.tier === 'presence-2d' ? 'settled-2d' : 'presence',
    surface: 'presence-2d',
    progress: null,
    reason: options.tier === 'presence-2d' ? 'tier-2d' : null,
    hasBeenLive: false,
  };

  let speaking = false;
  let startedAt: number | null = null;
  /**
   * The most recent time anyone told us about. `setSpeaking` has no clock of
   * its own but still needs to evaluate the minimum-presence rule, and using
   * the moment the frame became ready would freeze the machine's sense of time
   * at that instant — so an utterance that ended ten seconds later would be
   * judged against a four-hundred-millisecond-old `now` and never swap.
   */
  let lastNowMs = 0;
  const observe = (nowMs: number) => {
    if (nowMs > lastNowMs) lastNowMs = nowMs;
    if (startedAt === null) startedAt = nowMs;
  };

  const commit = (next: Partial<StageState>) => {
    const previous = state;
    const merged = { ...state, ...next };
    if (
      merged.phase === previous.phase &&
      merged.surface === previous.surface &&
      merged.progress === previous.progress &&
      merged.reason === previous.reason &&
      merged.hasBeenLive === previous.hasBeenLive
    ) {
      return;
    }
    state = merged;
    options.onChange?.(state, previous);
  };

  const trySwap = (nowMs: number) => {
    if (state.phase !== 'pending-swap') return;
    // Rule 1: never mid-utterance.
    if (speaking) return;
    // And never before the child has actually seen the 2D tutor.
    if (startedAt !== null && nowMs - startedAt < minimumPresenceMs) return;
    commit({ phase: 'live', surface: 'avatar-3d', progress: null, hasBeenLive: true });
  };

  return {
    state: () => state,

    tick(nowMs) {
      observe(nowMs);
      trySwap(nowMs);
    },

    beginUpgrade(nowMs) {
      observe(nowMs);
      // `settled-2d` is terminal, and re-entering `preparing` from `warming`
      // or later would restart a download that is already done.
      if (state.phase !== 'presence') return;
      commit({ phase: 'preparing', progress: 0 });
    },

    setProgress(fraction) {
      if (state.phase !== 'preparing') return;
      commit({ progress: Math.min(1, Math.max(0, fraction)) });
    },

    assetsReady(nowMs) {
      observe(nowMs);
      if (state.phase !== 'preparing') return;
      commit({ phase: 'warming', progress: null });
    },

    firstFrameRendered(nowMs) {
      // The gate that matters. Not "the renderer initialised" — a real frame,
      // with assets resolved and the head evaluated. Anything looser and the
      // child watches their tutor vanish into a spinner.
      observe(nowMs);
      if (state.phase !== 'warming') return;
      commit({ phase: 'pending-swap' });
      trySwap(nowMs);
    },

    setSpeaking(next) {
      const wasSpeaking = speaking;
      speaking = next;
      // Finishing an utterance is the natural moment to hand over, so take it
      // immediately rather than waiting for the next tick.
      if (wasSpeaking && !next) trySwap(lastNowMs);
    },

    settle(reason) {
      // Rule 2: irreversible. `tiers.ts` never promotes back up and neither
      // does this — flapping between two tutors is worse than either alone.
      if (state.phase === 'settled-2d') return;
      commit({ phase: 'settled-2d', surface: 'presence-2d', progress: null, reason });
    },
  };
}

/** True while the UI should show a download indicator. Deliberately narrow. */
export function showsProgress(state: StageState): boolean {
  return state.phase === 'preparing' && state.progress !== null;
}

/**
 * Whether the 3D scene should be rendering at all.
 *
 * Note this is true during `pending-swap` — the stage keeps drawing off-screen
 * while it waits for the utterance to end, because a stage that stopped and
 * restarted would have to warm up twice and would swap in a cold first frame,
 * which is exactly the stutter the whole handoff exists to avoid.
 */
export function shouldRender3D(state: StageState): boolean {
  return state.phase === 'warming' || state.phase === 'pending-swap' || state.phase === 'live';
}
