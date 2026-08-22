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

import { createStore } from 'zustand/vanilla';

// Dev single-writer guard: the face bus claims the sole expression writer.
let faceWriter: symbol | null = null;
export function claimFaceWriter(): symbol {
  faceWriter = Symbol('face-writer');
  return faceWriter;
}

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
export const avatarStore = createStore<AvatarState>()((set, get) => ({
  expression: new Float32Array(0),
  initExpression: (dim) => set({ expression: new Float32Array(dim) }),
  setExpression: (values, writer) => {
    if (
      process.env.NODE_ENV !== 'production' &&
      faceWriter &&
      writer !== faceWriter
    ) {
      console.error('expression written outside the face bus');
    }
    const next = new Float32Array(get().expression.length);
    for (let i = 0; i < next.length && i < values.length; ++i) {
      // `?? 0` rather than an assertion: `values` is ArrayLike, so a sparse or
      // short caller array is representable, and a hole must land as a neutral
      // coefficient rather than NaN — one NaN poisons the whole expression sum.
      next[i] = values[i] ?? 0;
    }
    set({ expression: next });
  },
}));
