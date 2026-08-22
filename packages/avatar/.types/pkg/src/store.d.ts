/**
 * Moyo header block: the expression store and the face single-writer guard.
 * The head's expression vector is the single most contended piece of state in
 * the renderer — speech, idle, and emotion all want it — so exactly one writer
 * (the face bus) claims the token and everything else contributes upstream.
 * Zustand's VANILLA store rather than a plain object because the renderer
 * subscribes synchronously and re-accumulates the expression basis on change —
 * and vanilla rather than the React binding because nothing here is React.
 *
 * Ported verbatim from the gnm-avatar reference renderer (`src/store.ts`).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: store zustand vanilla expression face-writer single-writer guard avatar state
 */
export declare function claimFaceWriter(): symbol;
interface AvatarState {
    expression: Float32Array;
    initExpression: (dim: number) => void;
    setExpression: (values: ArrayLike<number>, writer?: symbol) => void;
}
/**
 * `zustand/vanilla`, not `zustand` — the React binding would pull React into a
 * package whose consumers are an imperative render loop and a Node test runner,
 * neither of which has a component. `getState`/`setState`/`subscribe` is the
 * whole surface anything here uses. A React view that wants a hook can build
 * one at the app layer with `useStore(avatarStore, selector)`; the store does
 * not need to know that happened.
 */
export declare const avatarStore: import("zustand/vanilla").StoreApi<AvatarState>;
export {};
