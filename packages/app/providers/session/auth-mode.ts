// Which session is real. One reader, because three copies of this env lookup had
// already appeared and a fourth would eventually disagree with the other three —
// at which point the app boots a mock session and syncs live entitlements into
// it, or the reverse.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: auth mode env mock live session provider entitlements

export type AuthMode = 'mock' | 'live';

/**
 * Both prefixes, because the same code runs under Expo and Next and each strips
 * the other's variables. Mock is the floor: a build with neither variable set is
 * a developer's build, and the live path needs a real Better Auth server behind
 * it before it can do anything but fail.
 */
export function getAuthMode(): AuthMode {
  const env =
    typeof process !== 'undefined'
      ? process.env.EXPO_PUBLIC_AUTH_MODE ?? process.env.NEXT_PUBLIC_AUTH_MODE
      : undefined;
  return env === 'live' ? 'live' : 'mock';
}
