/**
 * The golden-image gate — doc 22 §8 and §10.5.
 *
 * This is the thing that turns "the API compiles" into "the picture is right",
 * and after rows 1–17 it is the only remaining unknown of any size. Every
 * material in the package is verified at the level of *symbols exist and the
 * node graph constructs*; not one of them has been looked at.
 *
 * ── THE SPLIT, WHICH IS THE WHOLE DESIGN ────────────────────────────────────
 *
 * The device CAPTURES. The host COMPARES.
 *
 * This file is the device half and it imports nothing that Hermes lacks — no
 * zlib, no filesystem, no image codec. It owns the deterministic setup, the
 * camera set, and the capture loop, and it hands back raw RGBA. `png.ts`,
 * `pixel-diff.ts` and `tools/golden-compare.ts` are the host half and run in
 * Node. Trying to do the comparison on device would mean shipping an inflate
 * implementation into a renderer package to service a test, which is the tail
 * wagging the dog.
 *
 * ── WHAT MAKES A GOLDEN REPRODUCIBLE ────────────────────────────────────────
 *
 * Five things, and every one of them has bitten this scene before:
 *
 *  1. **A fixed timestep.** The idle engine, the sway and the saccades are all
 *     functions of time. `fixedDt` replaces the wall clock so frame 240 is the
 *     same frame 240 every run — this is what the reference's `?fixedDt=1` did.
 *  2. **A fixed seed.** The groom, the stitch phase and the idle engine are all
 *     seeded; `GOLDEN_SEED` pins them.
 *  3. **Damping off.** Camera damping converges asymptotically, so it lands on
 *     a slightly different subpixel each run. `controls.update(false)` snaps —
 *     this is why `controls.ts` takes the flag rather than owning the policy.
 *  4. **A fixed backing size, and DPR pinned to 1.** A golden captured at a
 *     different DPR is not comparable and must not be resized into agreement;
 *     `diffImages` refuses a size mismatch outright for this reason.
 *  5. **A settled first frame.** WebGPU pipeline compilation and PMREM
 *     generation happen lazily on the first draw. `WARMUP_FRAMES` renders and
 *     discards before the clock starts, or frame 0 is a different picture from
 *     everyone else's frame 0.
 *
 * ── THE CAMERA SET ──────────────────────────────────────────────────────────
 *
 * Seven cameras, matching the reference's count, but each one is chosen to
 * police specific rows of §4's parity table rather than to look nice. When a
 * golden fails, the camera that failed is the first clue about which row broke
 * — so the mapping is recorded in the data, not in someone's head.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §8, §10.5
 * SOT-KEYWORDS: golden harness capture deterministic camera fixeddt seed damping dpr warmup offscreen
 */
/** Matches the reference's `?seed=7`. */
export declare const GOLDEN_SEED = 7;
/** Milliseconds per frame. `?fixedDt=1` in the reference; 1/60 s here, stated in ms. */
export declare const GOLDEN_FRAME_MS: number;
/** The reference's `?stopAt=240` — four seconds of idle, enough for a full breath cycle. */
export declare const GOLDEN_STOP_AT = 240;
/** Discarded before the clock starts. Pipeline compilation and PMREM live here. */
export declare const WARMUP_FRAMES = 8;
/** Doc 22 §8's budget. A camera over this fails the gate. */
export declare const GOLDEN_BUDGET = 0.004;
export interface GoldenCamera {
    id: string;
    /** World-space eye position, metres. The avatar's head sits near y = 1.5. */
    position: readonly [number, number, number];
    target: readonly [number, number, number];
    /** Vertical FOV in degrees. The close-ups are long lenses, not crops. */
    fov: number;
    /** Which §4 parity rows this view is here to police. */
    watches: readonly number[];
    why: string;
}
export declare const GOLDEN_CAMERAS: readonly GoldenCamera[];
export interface GoldenFrame {
    camera: GoldenCamera;
    /** Frame index the capture was taken at. */
    frame: number;
    width: number;
    height: number;
    /** Raw RGBA, top-left origin, `width * height * 4`. */
    data: Uint8Array;
}
/**
 * The renderer-facing surface the harness needs. Injected rather than imported,
 * so the capture loop is unit-testable in Node — and so the same loop drives an
 * on-device `GPUOffscreenCanvas` and a desktop-web canvas without a branch.
 */
export interface GoldenTarget {
    width: number;
    height: number;
    /** Point the camera. The harness never touches the camera object itself. */
    setCamera(camera: GoldenCamera): void;
    /** Advance simulation by exactly `deltaMs` and render one frame. */
    renderFrame(deltaMs: number, elapsedMs: number): void | Promise<void>;
    /** Read the colour attachment back as RGBA. */
    readPixels(): Uint8Array | Promise<Uint8Array>;
}
export interface CaptureOptions {
    cameras?: readonly GoldenCamera[];
    stopAt?: number;
    frameMs?: number;
    warmupFrames?: number;
    onCamera?: (camera: GoldenCamera, index: number, total: number) => void;
}
/**
 * Runs the deterministic capture and returns one frame per camera.
 *
 * Note the clock is rebuilt per camera: each view starts from frame 0 and runs
 * `stopAt` frames of its own. Sharing one continuous clock across seven cameras
 * would make every golden depend on the order and count of the ones before it,
 * so adding an eighth camera would invalidate all seven — a gate nobody would
 * then be willing to extend.
 */
export declare function captureGoldens(target: GoldenTarget, options?: CaptureOptions): Promise<GoldenFrame[]>;
export interface CaptureInvariants {
    devicePixelRatio: number;
    dampingEnabled: boolean;
    seed: number;
    width: number;
    height: number;
}
/**
 * Fails a capture whose setup could not possibly be reproducible.
 *
 * This exists because every one of these has been got wrong before, and each
 * produces a golden that passes on the machine that made it and fails on every
 * other one — which reads as flakiness and gets the gate disabled rather than
 * the setup fixed.
 */
export declare function assertCaptureInvariants(invariants: CaptureInvariants): void;
export interface CameraVerdict {
    id: string;
    diffPixels: number;
    fraction: number;
    antialiased: number;
    passed: boolean;
    /** §4 rows this camera watches — the first place to look when it fails. */
    watches: readonly number[];
}
export interface GoldenReport {
    passed: boolean;
    budget: number;
    cameras: CameraVerdict[];
    worst: CameraVerdict | null;
    /** Rows implicated by the failing cameras, deduplicated and sorted. */
    suspectRows: number[];
}
/**
 * Turns per-camera numbers into a verdict, and — the useful part — into a list
 * of which parity rows to go and read. A red gate that only says "0.9 % over
 * budget on three-quarter-left" costs an hour of bisecting; one that says
 * "suspect rows 1, 3, 5" starts the investigation in the right file.
 */
export declare function summarise(verdicts: readonly Omit<CameraVerdict, 'passed'>[], budget?: number): GoldenReport;
/** A short human-readable report — what CI prints and what a PR comment quotes. */
export declare function formatReport(report: GoldenReport): string;
