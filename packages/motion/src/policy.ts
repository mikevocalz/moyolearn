/**
 * The reduced-motion policy for every Moyo surface.
 *
 * Kinetrell accepts 'system' | 'always' | 'never' on both runtimes. Moyo ships
 * 'system' everywhere: a learner or guardian who turned Reduce Motion on gets
 * the finished frame, on every screen, without any call site having to
 * remember. 'always' is safe to request anywhere (screenshots, posters).
 * 'never' ignores the person's setting, so it is honoured only in a
 * development build that has also set the test flag below; in any other
 * build the request resolves to 'system'.
 *
 * The behaviour under reduced motion is 'finish': Kinetrell's
 * `reducedMotionDestination` jumps the playhead to the end in the direction of
 * play, so a loop or entrance lands on its complete state instead of freezing
 * mid-frame.
 *
 * SOT: kinetrell src/native/runtime.ts (ReducedMotionPolicy),
 *      src/native/lifecycle.ts (reducedMotionDestination),
 *      src/web/react.tsx (WebReducedMotionPolicy)
 * SOT-KEYWORDS: motion reduced-motion policy system never always finish
 */

export type ReducedMotionPolicy = 'system' | 'always' | 'never';
export type ReducedMotionBehavior = 'finish' | 'pause';

export const REDUCED_MOTION_BEHAVIOR: ReducedMotionBehavior = 'finish';

/** Set to `true` on globalThis by a test or a dev harness that must film motion with the OS setting on. */
export const MOTION_TEST_FLAG = '__MOYO_MOTION_TEST__' as const;

type MotionGlobals = typeof globalThis & {
  __DEV__?: boolean;
  [MOTION_TEST_FLAG]?: boolean;
};

export type PolicyEnvironment = Readonly<{ dev: boolean; testFlag: boolean }>;

/**
 * React Native and Metro define `__DEV__`; Vite builds do not, so the web
 * wrapper passes its own `import.meta.env.DEV` through `dev`.
 */
export function readPolicyEnvironment(dev?: boolean): PolicyEnvironment {
  const scope = globalThis as MotionGlobals;
  return {
    dev: dev ?? scope.__DEV__ === true,
    testFlag: scope[MOTION_TEST_FLAG] === true,
  };
}

export function resolveReducedMotionPolicy(
  requested: ReducedMotionPolicy | undefined,
  environment: PolicyEnvironment = readPolicyEnvironment(),
): ReducedMotionPolicy {
  if (requested === 'always') return 'always';
  if (requested === 'never' && environment.dev && environment.testFlag) return 'never';
  return 'system';
}
