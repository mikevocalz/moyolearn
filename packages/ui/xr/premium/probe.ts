// Which of the vendored files throws at import, named rather than guessed.
//
// Enabling `XrTriPanel` took the VR root down with `VRQuestScene has not been
// registered` and `undefined is not a function` — a module-scope throw
// somewhere in this package. Every symbol it imports resolves in isolation, so
// the failure is in what one of them RUNS at load: `materials.ts` registers
// materials, `PremiumXRMediaPanel` registers materials AND animations, and
// `icon-atlas/icons.ts` requires 45 PNGs. This requires them one at a time and
// logs the first that fails, so the next reload answers the question instead of
// costing another bisect.
//
// Dev-only and temporary: delete it once the culprit is fixed.
// SOT: packages/ui/xr/premium/index.ts
// SOT-KEYWORDS: premium panel probe module load failure diagnostic import order

/* eslint-disable @typescript-eslint/no-require-imports */
export function probePremiumImports(): void {
  if (!__DEV__) return;
  const steps: [string, () => unknown][] = [
    ['spatialTokens', () => require('./spatialTokens')],
    ['use-instance-store', () => require('./use-instance-store')],
    ['icon-atlas/icons', () => require('./icon-atlas/icons')],
    ['ViroIcon', () => require('./ViroIcon')],
    ['materials', () => require('./materials')],
    ['PremiumXRMediaPanel', () => require('./PremiumXRMediaPanel')],
  ];
  for (const [name, load] of steps) {
    try {
      load();
      console.log(`[premium-probe] ok: ${name}`);
    } catch (error) {
      console.log(`[premium-probe] FAILED at ${name}:`, String(error));
      return;
    }
  }
  console.log('[premium-probe] every module imported cleanly');
}
