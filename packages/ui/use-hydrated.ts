// useHydrated — "has the client taken over from the server yet?"
//
// It lived in `motion.tsx` because that is where it was first needed, and that
// made it unreachable without importing the whole motion layer: React Native's
// AccessibilityInfo, the Legend Motion presets, and the css runtime. The hook
// itself has no dependencies at all — one `useSyncExternalStore` with a noop
// subscribe — so the marketing site was paying ~95 kB to ask a boolean.
//
// Split out so an SSR-rendered surface can reach it through the primitives
// entry point. `motion.tsx` re-exports it, so every existing importer is
// unaffected and there is still exactly one implementation.
//
// WHY AN EXTERNAL-STORE READ AND NOT state: the server snapshot is `false` and
// the client snapshot is `true`, so React resolves the difference during
// hydration instead of a `useEffect` writing state on the first commit. Markup
// may therefore branch on this value safely — which is exactly what markup must
// NOT do with reduced-motion, where the answer differs per reader rather than
// per render pass.
// 'use client' is required, not decorative: this module is reachable from the
// primitives barrel, which Next.js Server Components import (via
// packages/app/providers/session/role-switcher.tsx). `useSyncExternalStore` is
// a client-only API, and while it sat inside motion.tsx it was shielded by that
// module's own boundary. Splitting it out removed the shield.
// SOT: packages/ui/motion.tsx · docs/site/adr-001-ssr-lane.md
// SOT-KEYWORDS: use hydrated hydration ssr prerender client snapshot sync external store primitives entry
'use client';

import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

export const useHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
