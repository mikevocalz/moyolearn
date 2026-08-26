// Web: tus-js-client's own localStorage-backed store already works, so this
// fork deliberately supplies nothing and lets the library use its default.
//
// Returning `undefined` rather than re-implementing it is the point — a second
// store on web would be a second source of truth for the same resume state.
// SOT-KEYWORDS: tus url storage resume upload media web
import type { TusUrlStorage } from './tus-url-storage.types.ts';

export const tusUrlStorage = (): TusUrlStorage | undefined => undefined;
