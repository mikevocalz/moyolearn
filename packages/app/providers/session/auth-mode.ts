// Which session is real. One reader, because three copies of this env lookup had
// already appeared and a fourth would eventually disagree with the other three —
// at which point the app boots a mock session and syncs live entitlements into
// it, or the reverse.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: auth mode env mock live session provider entitlements dev build release

export type AuthMode = 'mock' | 'live';

/**
 * Whether this is a development build of the code that is running.
 *
 * Metro defines `__DEV__` and inlines it; Next does not define it and inlines
 * `process.env.NODE_ENV` instead. The first is preferred when present because
 * a Metro release bundle can still carry `NODE_ENV` from the shell that built
 * it, and the second is the only signal a browser bundle has.
 *
 * Code that needs the bundler to DROP a module (a dev-only `require`) must
 * spell the `__DEV__` test out inline at the call site: a call to this function
 * is not something the bundler can fold to a constant.
 */
export function isDevBuild(): boolean {
  if (typeof __DEV__ !== 'undefined') return __DEV__;
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
}

/**
 * Both prefixes, because the same code runs under Expo and Next and each strips
 * the other's variables.
 *
 * A release build is live, full stop. The environment variable can only choose
 * between mock and live inside a development build: a production bundle that
 * happened to be built with `EXPO_PUBLIC_AUTH_MODE=mock` (or with the variable
 * missing) used to boot a fixture session with eleven ready-made identities and
 * no password, which is the same mistake `isMockAuth()` pairs with
 * `NODE_ENV === 'development'` on the server. Inside a dev build, mock remains
 * the floor — a developer's build with neither variable set has no Better Auth
 * server behind it and the live path can do nothing but fail.
 */
export function getAuthMode(): AuthMode {
  if (!isDevBuild()) return 'live';
  const env =
    typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_AUTH_MODE ?? process.env.NEXT_PUBLIC_AUTH_MODE
      : undefined;
  return env === 'live' ? 'live' : 'mock';
}
