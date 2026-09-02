// The one API base URL every client fetch resolves against.
//
// This existed as a copied three-line expression in 23 files, each ending in a
// hardcoded `http://localhost:3001` — a port nothing in this repo serves. Next
// only inlines `NEXT_PUBLIC_*`, so on web the `EXPO_PUBLIC_` value is ALWAYS
// undefined and every one of those files fell through to that dead port: not
// just in local dev, but on any deploy whose env is missing the variable,
// where it silently turned working screens into empty ones.
//
// The browser therefore falls back to SAME ORIGIN (''), which is correct by
// construction — the API routes ship in the same Next app. Native keeps a
// localhost default because a simulator has no origin to be same as.
// `document` (not `window`) is the web test: React Native defines `window`.
// SOT: apps/web/app/api/* · packages/app/features/tutor/tutor-constants.ts
// SOT-KEYWORDS: api url base origin fetch env public app url fallback

export const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  (typeof document !== 'undefined' ? '' : 'http://localhost:3001');
