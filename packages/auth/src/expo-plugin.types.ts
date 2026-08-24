// Type-only: erased at compile time, so naming `@better-auth/expo/client` here
// costs the web bundle nothing. The runtime import lives in the .native fork.
import type { expoClient } from '@better-auth/expo/client';

export type ExpoClientPlugin = ReturnType<typeof expoClient>;

export interface ExpoPluginOptions {
  /** The SecureStore-backed cookie jar the Expo plugin writes to. */
  storage?: unknown;
  scheme?: string;
}

/**
 * A TUPLE, not an array, and that is load-bearing: Better Auth infers the whole
 * client's shape from the literal plugin list, and spreading a plain
 * `Plugin[]` collapses it to a union — `authClient.organization` and
 * `useSession()`'s data both go `never`. `[] | [Plugin]` spreads while staying a
 * tuple, which is what the original inline conditional spread produced.
 */
export type ExpoPlugins = (options: ExpoPluginOptions) => [] | [ExpoClientPlugin];
